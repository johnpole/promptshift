/**
 * PromptShift — Background Service Worker
 * 
 * Handles Gemini API calls from content scripts.
 * Content scripts can't make cross-origin API calls directly,
 * so they send messages here, and we proxy the request to Gemini.
 */

// @ts-ignore — Injected at build time via Vite define
declare const PROMPTSHIFT_API_KEY: string;

const GEMINI_API_KEY = PROMPTSHIFT_API_KEY;
const MODEL_ID = 'gemini-2.0-flash-lite';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent?key=${GEMINI_API_KEY}`;

interface EnhanceRequest {
    type: 'enhance';
    text: string;
    framework: string;
    tone: string;
}

interface EnhanceResponse {
    success: boolean;
    enhanced?: string;
    explanation?: string;
    error?: string;
}

/**
 * Build the system instruction and prompt based on framework + tone.
 */
function buildPrompt(rawInput: string, framework: string, tone: string) {
    const systemInstruction = `You are a prompt improvement assistant. Your goal is to rewrite the user's input into a BETTER PROMPT for an LLM. 
CRITICAL RULES:
1. DO NOT ANSWER the user's request. You are a tool to IMPROVE the prompt, not execute it.
   - Example: If user says "How do I cook pasta?", do NOT explain how to cook pasta. Instead, rewrite it: "Provide a detailed step-by-step guide for cooking perfect pasta..."
2. Fix spelling and grammar errors.
3. Keep the user's original intent.
4. Tone: ${tone}.
5. Output JSON with exactly two STRING keys: "enhanced_prompt" and "explanation".
6. "enhanced_prompt" MUST be a single plain text string, NEVER a JSON object.
7. "explanation" must be 1-2 sentences describing what you improved.`;

    const frameworkInstructions: Record<string, string> = {
        AGENTIC: `Format for an Autonomous AI Agent. Structure as: # ROLE, # OBJECTIVE, # CONTEXT, # TOOLS & CONSTRAINTS, # EXECUTION PLAN`,
        CO_STAR: `Apply CO-STAR framework. Label sections: Context, Objective, Style, Tone, Audience, Response Format.`,
        CHAIN_OF_THOUGHT: `Append instructions forcing step-by-step reasoning. Use "Let's think step by step."`,
        PERSONA_BASED: `Identify the best expert persona and begin with "Act as a [Role]..."`,
        STRUCTURED_OUTPUT: `Define the output format (JSON, Markdown table). Create a schema if needed.`,
        SOCRATIC: `Rewrite so the AI acts as a tutor, asking guiding questions instead of direct answers.`,
        CLEANUP: `Focus only on clarity, grammar, and removing ambiguity. Keep it simple.`,
    };

    const frameworkInstruction = frameworkInstructions[framework] || frameworkInstructions.CLEANUP;

    const userPrompt = `User's Raw Input: "${rawInput}"
Task: Rewrite using the ${framework} approach.
${frameworkInstruction}
The 'explanation' field should briefly explain (1-2 sentences) what was improved.`;

    return { systemInstruction, userPrompt };
}

/**
 * Call Gemini API directly via REST (no SDK needed in service worker).
 */
const MAX_RETRIES = 1;
const BASE_DELAY_MS = 3000;

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function callGemini(rawInput: string, framework: string, tone: string): Promise<EnhanceResponse> {
    const { systemInstruction, userPrompt } = buildPrompt(rawInput, framework, tone);

    const requestBody = {
        system_instruction: {
            parts: [{ text: systemInstruction }]
        },
        contents: [{
            parts: [{ text: userPrompt }]
        }],
        generationConfig: {
            response_mime_type: 'application/json'
        }
    };

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response = await fetch(GEMINI_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (response.status === 429 && attempt < MAX_RETRIES) {
                const delay = BASE_DELAY_MS * Math.pow(2, attempt);
                console.warn(`PromptShift: Rate limited (429). Retrying in ${delay}ms... (${attempt + 1}/${MAX_RETRIES})`);
                await sleep(delay);
                continue;
            }

            if (!response.ok) {
                const errText = await response.text();
                console.error('Gemini API error:', errText);
                if (response.status === 429) {
                    return { success: false, error: 'Rate limited — too many requests. Wait a few seconds and try again.' };
                }
                return { success: false, error: `API Error (${response.status}): ${response.statusText}` };
            }

            const data = await response.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!text) {
                return { success: false, error: 'Empty response from Gemini' };
            }

            const parsed = JSON.parse(text);

            // Ensure values are strings — Gemini may return nested objects
            let enhanced = parsed.enhanced_prompt || 'Error parsing enhanced prompt.';
            let explanation = parsed.explanation || 'No explanation provided.';

            if (typeof enhanced !== 'string') {
                enhanced = JSON.stringify(enhanced, null, 2);
            }
            if (typeof explanation !== 'string') {
                explanation = JSON.stringify(explanation, null, 2);
            }

            return { success: true, enhanced, explanation };
        } catch (error: any) {
            if (attempt < MAX_RETRIES) {
                await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
                continue;
            }
            console.error('Gemini call failed:', error);
            return { success: false, error: error.message || 'Failed to enhance prompt.' };
        }
    }

    return { success: false, error: 'Max retries exceeded. Please try again in a moment.' };
}

/**
 * Listen for messages from content scripts.
 */
chrome.runtime.onMessage.addListener((
    message: EnhanceRequest,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: EnhanceResponse) => void
) => {
    if (message.type === 'enhance') {
        callGemini(message.text, message.framework, message.tone)
            .then(sendResponse)
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true; // Keep message channel open for async response
    }
});

// Log activation
console.log('PromptShift service worker activated');
