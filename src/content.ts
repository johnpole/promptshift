/**
 * PromptShift — Content Script
 * 
 * Injected into every page. Detects text inputs and shows a floating
 * "Enhance" pill when the user has text to enhance. Results appear in
 * a sleek floating card with Copy / Replace actions.
 */

// ──────────────────────────── STATE ────────────────────────────
let currentInput: HTMLElement | null = null;
let pillEl: HTMLElement | null = null;
let cardEl: HTMLElement | null = null;
let selectedFramework = 'CLEANUP';  // Default to simplest
let selectedTone = 'PROFESSIONAL';
let isEnhancing = false;

// Ordered: simple → advanced
const FRAMEWORKS = ['CLEANUP', 'STRUCTURED_OUTPUT', 'PERSONA_BASED', 'CO_STAR', 'CHAIN_OF_THOUGHT', 'SOCRATIC', 'AGENTIC'];

const FRAMEWORK_LABELS: Record<string, string> = {
    CLEANUP: '✨ Polish',
    STRUCTURED_OUTPUT: '📋 Structured',
    PERSONA_BASED: '🎭 Persona',
    CO_STAR: '⭐ CO-STAR',
    CHAIN_OF_THOUGHT: '🧠 Think Step-by-Step',
    SOCRATIC: '❓ Socratic',
    AGENTIC: '🤖 Agentic',
};

const FRAMEWORK_DESCRIPTIONS: Record<string, string> = {
    CLEANUP: 'Fix grammar, typos & make it clear',
    STRUCTURED_OUTPUT: 'Get results in a specific format (JSON, table)',
    PERSONA_BASED: 'Make the AI act as an expert role',
    CO_STAR: 'Add Context, Objective, Style, Tone, Audience & Format',
    CHAIN_OF_THOUGHT: 'Force step-by-step reasoning',
    SOCRATIC: 'Turn it into guided questions (tutor mode)',
    AGENTIC: 'Full agent prompt with Role, Plan & Constraints',
};

// ──────────────────────────── HELPERS ────────────────────────────

/** Get text from any input element. */
function getInputText(el: HTMLElement): string {
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
        return el.value;
    }
    // contenteditable
    return el.innerText || el.textContent || '';
}

/** Set text on any input element. */
function setInputText(el: HTMLElement, text: string): void {
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
        // Use native setter to trigger React/framework change events
        const nativeSetter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement?.prototype || window.HTMLInputElement?.prototype,
            'value'
        )?.set;
        if (nativeSetter) {
            nativeSetter.call(el, text);
        } else {
            el.value = text;
        }
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
        // contenteditable
        el.innerText = text;
        el.dispatchEvent(new Event('input', { bubbles: true }));
    }
}

/** Check if an element is a text input we should enhance. */
function isTextInput(el: EventTarget | null): el is HTMLElement {
    if (!el || !(el instanceof HTMLElement)) return false;
    if (el instanceof HTMLTextAreaElement) return true;
    if (el instanceof HTMLInputElement && el.type === 'text') return true;
    if (el.isContentEditable) return true;
    return false;
}

/** Position an element ABOVE a target element so it's always visible. */
function positionNear(floating: HTMLElement, target: HTMLElement) {
    const rect = target.getBoundingClientRect();
    floating.style.position = 'fixed';
    floating.style.bottom = `${window.innerHeight - rect.top + 6}px`;
    floating.style.top = 'auto';
    floating.style.right = `${window.innerWidth - rect.right}px`;
    floating.style.left = 'auto';
    floating.style.zIndex = '2147483647';
}

// ──────────────────────────── FLOATING PILL ────────────────────────────

function createPill(): HTMLElement {
    const pill = document.createElement('div');
    pill.id = 'promptshift-pill';
    pill.innerHTML = `
    <button id="ps-enhance-btn" title="Enhance with PromptShift">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
      <span>Enhance</span>
    </button>
    <select id="ps-framework-select" title="Select enhancement strategy"></select>
    <div id="ps-fw-hint"></div>
  `;

    // Populate framework selector with descriptions as titles
    const select = pill.querySelector('#ps-framework-select') as HTMLSelectElement;
    const hint = pill.querySelector('#ps-fw-hint') as HTMLElement;

    FRAMEWORKS.forEach(fw => {
        const opt = document.createElement('option');
        opt.value = fw;
        opt.textContent = FRAMEWORK_LABELS[fw] || fw;
        opt.title = FRAMEWORK_DESCRIPTIONS[fw] || '';
        if (fw === selectedFramework) opt.selected = true;
        select.appendChild(opt);
    });

    // Show description of selected framework
    function updateHint() {
        hint.textContent = FRAMEWORK_DESCRIPTIONS[selectedFramework] || '';
    }
    updateHint();

    select.addEventListener('change', (e) => {
        selectedFramework = (e.target as HTMLSelectElement).value;
        updateHint();
    });

    const btn = pill.querySelector('#ps-enhance-btn') as HTMLButtonElement;
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleEnhance();
    });

    document.body.appendChild(pill);
    return pill;
}

function showPill(target: HTMLElement) {
    if (!pillEl) pillEl = createPill();

    const text = getInputText(target).trim();
    if (!text || text.length < 3) {
        hidePill();
        return;
    }

    positionNear(pillEl, target);
    pillEl.classList.add('ps-visible');
}

function hidePill() {
    if (pillEl) pillEl.classList.remove('ps-visible');
}

// ──────────────────────────── RESULT CARD ────────────────────────────

function showResultCard(enhanced: string, explanation: string) {
    if (!cardEl) {
        cardEl = document.createElement('div');
        cardEl.id = 'promptshift-card';
        document.body.appendChild(cardEl);
    }

    cardEl.innerHTML = `
    <div class="ps-card-header">
      <div class="ps-card-title">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
        <span>Enhanced</span>
        <span class="ps-badge">${FRAMEWORK_LABELS[selectedFramework] || selectedFramework}</span>
      </div>
      <button class="ps-card-close" title="Close">&times;</button>
    </div>
    <div class="ps-card-body">
      <pre class="ps-card-text">${escapeHtml(enhanced)}</pre>
    </div>
    <div class="ps-card-explanation">
      <strong>What changed:</strong> ${escapeHtml(explanation)}
    </div>
    <div class="ps-card-actions">
      <button class="ps-btn ps-btn-replace" title="Replace text in input field">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
        Replace
      </button>
      <button class="ps-btn ps-btn-copy" title="Copy to clipboard">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        Copy
      </button>
    </div>
  `;

    // Position card
    if (currentInput) {
        const rect = currentInput.getBoundingClientRect();
        cardEl.style.position = 'fixed';
        cardEl.style.bottom = `${window.innerHeight - rect.top + 8}px`;
        cardEl.style.top = 'auto';
        cardEl.style.left = `${Math.max(8, rect.left)}px`;
        cardEl.style.maxWidth = `${Math.min(480, window.innerWidth - 16)}px`;
        cardEl.style.zIndex = '2147483647';
    }

    cardEl.classList.add('ps-visible');

    // Event handlers
    cardEl.querySelector('.ps-card-close')?.addEventListener('click', hideCard);

    cardEl.querySelector('.ps-btn-replace')?.addEventListener('click', () => {
        if (currentInput) {
            setInputText(currentInput, enhanced);
            hideCard();
        }
    });

    cardEl.querySelector('.ps-btn-copy')?.addEventListener('click', () => {
        navigator.clipboard.writeText(enhanced).then(() => {
            const copyBtn = cardEl?.querySelector('.ps-btn-copy');
            if (copyBtn) {
                copyBtn.textContent = '✓ Copied!';
                setTimeout(() => { if (copyBtn) copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`; }, 1500);
            }
        });
    });
}

function showLoadingCard() {
    if (!cardEl) {
        cardEl = document.createElement('div');
        cardEl.id = 'promptshift-card';
        document.body.appendChild(cardEl);
    }

    cardEl.innerHTML = `
    <div class="ps-card-header">
      <div class="ps-card-title">
        <svg class="ps-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
        <span>Enhancing...</span>
      </div>
    </div>
    <div class="ps-card-body">
      <div class="ps-shimmer"></div>
      <div class="ps-shimmer ps-shimmer-short"></div>
    </div>
  `;

    if (currentInput) {
        const rect = currentInput.getBoundingClientRect();
        cardEl.style.position = 'fixed';
        cardEl.style.bottom = `${window.innerHeight - rect.top + 8}px`;
        cardEl.style.top = 'auto';
        cardEl.style.left = `${Math.max(8, rect.left)}px`;
        cardEl.style.maxWidth = `${Math.min(480, window.innerWidth - 16)}px`;
        cardEl.style.zIndex = '2147483647';
    }

    cardEl.classList.add('ps-visible');
}

function hideCard() {
    if (cardEl) cardEl.classList.remove('ps-visible');
}

function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ──────────────────────────── ENHANCE HANDLER ────────────────────────────

const COOLDOWN_MS = 1000; // 1 second cooldown (prevent double-clicks)
let lastEnhanceTime = 0;

async function handleEnhance() {
    if (!currentInput || isEnhancing) {
        console.log('[PromptShift] Blocked: already enhancing or no input focused.');
        return;
    }

    // Enforce cooldown
    const now = Date.now();
    const elapsed = now - lastEnhanceTime;
    if (elapsed < COOLDOWN_MS) {
        const remaining = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
        console.log(`[PromptShift] Cooldown active. Wait ${remaining}s.`);
        return;
    }

    const text = getInputText(currentInput).trim();
    if (!text) return;

    isEnhancing = true;
    lastEnhanceTime = Date.now();
    hidePill();
    showLoadingCard();
    console.log('[PromptShift] Sending enhance request...');

    try {
        const response = await chrome.runtime.sendMessage({
            type: 'enhance',
            text,
            framework: selectedFramework,
            tone: selectedTone,
        });

        console.log('[PromptShift] Response received:', response?.success ? 'success' : response?.error);

        if (response?.success) {
            showResultCard(response.enhanced, response.explanation);
        } else {
            showResultCard('Enhancement failed.', response?.error || 'Unknown error. Check your API key.');
        }
    } catch (err: any) {
        console.error('[PromptShift] Error:', err.message);

        // Handle "Extension context invalidated" error (happens after extension reload)
        if (err.message.includes('Extension context invalidated')) {
            showResultCard('Extension Updated', 'Please refresh this page to use the new version of PromptShift.');
        } else {
            showResultCard('Enhancement failed.', err.message || 'Could not connect to service worker.');
        }
    } finally {
        isEnhancing = false;
    }
}

// ──────────────────────────── EVENT LISTENERS ────────────────────────────

/** Debounce helper. */
function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
    let timer: ReturnType<typeof setTimeout>;
    return ((...args: any[]) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    }) as T;
}

/** Show pill when user focuses or types in a text input. */
const handleInputActivity = debounce((e: Event) => {
    const target = e.target;
    if (!isTextInput(target)) return;

    currentInput = target;
    showPill(target);
}, 300);

/** Hide pill when clicking outside. */
function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (
        pillEl?.contains(target) ||
        cardEl?.contains(target)
    ) {
        return;
    }

    // Check if clicking on an input — don't hide
    if (isTextInput(target)) return;

    hidePill();
    // Don't hide card on click outside — user might want to read it
}

// Attach listeners
document.addEventListener('focusin', handleInputActivity, true);
document.addEventListener('input', handleInputActivity, true);
document.addEventListener('click', handleClickOutside, true);

// Also listen for text selection in inputs
document.addEventListener('mouseup', debounce((e: Event) => {
    const target = (e as MouseEvent).target;
    if (isTextInput(target)) {
        currentInput = target;
        const text = getInputText(target).trim();
        if (text.length >= 3) {
            showPill(target);
        }
    }
}, 200), true);

// Handle keyboard shortcut: Ctrl/Cmd + Shift + E to enhance
document.addEventListener('keydown', (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'E') {
        e.preventDefault();
        if (currentInput && getInputText(currentInput).trim().length >= 3) {
            handleEnhance();
        }
    }
});

console.log('PromptShift content script loaded');
