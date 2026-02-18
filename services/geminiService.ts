import { GoogleGenAI } from "@google/genai";
import { EnhancementFramework, Tone } from "../types";

const apiKey = process.env.API_KEY;

// Initialize Gemini client
const ai = new GoogleGenAI({ apiKey });

export const enhancePrompt = async (
  rawInput: string,
  framework: EnhancementFramework,
  tone: Tone
): Promise<{ enhanced: string; explanation: string }> => {
  if (!apiKey) {
    throw new Error("API Key is missing. Please check your environment configuration.");
  }

  const modelId = "gemini-2.0-flash-lite";

  // Construct the system instruction based on the framework
  let systemInstruction = `You are a world-class Lead Prompt Engineer. Your goal is to take user inputs (which may have typos, poor grammar, or vague instructions) and transform them into high-performance LLM prompts.
  
  General Rules:
  1. Fix all spelling and grammar errors.
  2. Maintain the user's original intent absolutely.
  3. Use the requested Tone: ${tone}.
  4. Output the result in JSON format with two keys: "enhanced_prompt" and "explanation".
  `;

  let frameworkInstruction = "";

  switch (framework) {
    case EnhancementFramework.AGENTIC:
      frameworkInstruction = `
        Format the prompt for an Autonomous AI Agent (like in Google Antigravity or Gemini CLI).
        Structure strictly as:
        # ROLE
        [Define a precise expert role, e.g., Senior Java Spring Boot Architect]
        # OBJECTIVE
        [Clear, actionable goal]
        # CONTEXT
        [Background info provided by user]
        # TOOLS & CONSTRAINTS
        [Assume standard CLI tools; Add constraints like 'Do not use deprecated libraries']
        # EXECUTION PLAN
        [Step-by-step logic for the agent]
      `;
      break;
    case EnhancementFramework.CLEANUP:
      frameworkInstruction = "Focus only on clarity, grammar, and removing ambiguity. Keep it simple.";
      break;
    case EnhancementFramework.CO_STAR:
      frameworkInstruction = "Apply the CO-STAR framework. Explicitly label sections for Context, Objective, Style, Tone, Audience, and Response Format.";
      break;
    case EnhancementFramework.CHAIN_OF_THOUGHT:
      frameworkInstruction = "Append instructions that force step-by-step reasoning. Use phrases like 'Let's think step by step' or 'Explain your reasoning before giving the final answer'.";
      break;
    case EnhancementFramework.PERSONA_BASED:
      frameworkInstruction = "Identify the most suitable expert persona for this request and begin the prompt with 'Act as a [Role]...'.";
      break;
    case EnhancementFramework.STRUCTURED_OUTPUT:
      frameworkInstruction = "Ensure the prompt strictly defines the output format (e.g., JSON, Markdown table). Create a schema or template if one isn't provided.";
      break;
    case EnhancementFramework.SOCRATIC:
      frameworkInstruction = "Rewrite the prompt so the AI acts as a tutor, asking guiding questions instead of giving direct answers.";
      break;
  }

  const prompt = `
    User's Raw Input: "${rawInput}"
    
    Task: Rewrite this input using the ${framework} approach.
    ${frameworkInstruction}
    
    The 'explanation' field should briefly explain (in 1-2 sentences) what specific techniques were added to improve the prompt.
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json"
      }
    });

    const responseText = response.text;
    if (!responseText) throw new Error("Empty response from Gemini");

    const parsed = JSON.parse(responseText);

    return {
      enhanced: parsed.enhanced_prompt || "Error parsing enhanced prompt.",
      explanation: parsed.explanation || "No explanation provided."
    };

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("Failed to enhance prompt. Please try again.");
  }
};