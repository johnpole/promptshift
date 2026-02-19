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
let selectedTone = 'FRIENDLY';      // Default to friendly as requested
let isEnhancing = false;
let isPillHidden = false; // User dismissal state
let sourceTextForVariants = '';
let allowAnotherVersion = false;
let resultVariants: Array<{ enhanced: string; explanation: string }> = [];
let activeVariantIndex = 0;
let cardStatusTimer: ReturnType<typeof setTimeout> | null = null;

// Persistence Key
const STORAGE_KEY = 'promptshift_preferences';

// Ordered: simple → advanced
const FRAMEWORKS = ['CLEANUP', 'EMAIL', 'CHAT', 'STRUCTURED_OUTPUT', 'PERSONA_BASED', 'CO_STAR', 'CHAIN_OF_THOUGHT', 'SOCRATIC', 'AGENTIC'];

const FRAMEWORK_LABELS: Record<string, string> = {
    CLEANUP: '✨ Polish',
    EMAIL: '📧 Email',
    CHAT: '💬 Chat',
    STRUCTURED_OUTPUT: '📋 Structured',
    PERSONA_BASED: '🎭 Persona',
    CO_STAR: '⭐ CO-STAR',
    CHAIN_OF_THOUGHT: '🧠 Think Step-by-Step',
    SOCRATIC: '❓ Socratic',
    AGENTIC: '🤖 Agentic',
};

const FRAMEWORK_DESCRIPTIONS: Record<string, string> = {
    CLEANUP: 'Fix grammar, typos & make it clear',
    EMAIL: 'Write a professional or casual email',
    CHAT: 'Optimized for chat interfaces (WhatsApp, Slack)',
    STRUCTURED_OUTPUT: 'Get results in a specific format (JSON, table)',
    PERSONA_BASED: 'Make the AI act as an expert role',
    CO_STAR: 'Add Context, Objective, Style, Tone, Audience & Format',
    CHAIN_OF_THOUGHT: 'Force step-by-step reasoning',
    SOCRATIC: 'Turn it into guided questions (tutor mode)',
    AGENTIC: 'Full agent prompt with Role, Plan & Constraints',
};

const TONES = ['PROFESSIONAL', 'FRIENDLY', 'CASUAL', 'DIRECT', 'CONFIDENT', 'EMPATHETIC'];
const TONE_LABELS: Record<string, string> = {
    PROFESSIONAL: '👔 Pro',
    FRIENDLY: '😊 Friendly',
    CASUAL: '👋 Casual',
    DIRECT: '🎯 Direct',
    CONFIDENT: '🦁 Confident',
    EMPATHETIC: '❤️ Empathetic',
};

interface EnhanceResponse {
    success: boolean;
    enhanced?: string;
    explanation?: string;
    error?: string;
}

interface ShortcutMessage {
    type: 'shortcut-enhance' | 'shortcut-toggle';
}

interface EnhanceRequestOptions {
    variation?: number;
    avoidPrompts?: string[];
}

interface ShowResultOptions {
    appendVariant?: boolean;
    sourceText?: string;
    allowAnotherVersion?: boolean;
}

// ──────────────────────────── HELPERS ────────────────────────────

function hasRuntimeApi(): boolean {
    return (
        typeof chrome !== 'undefined' &&
        typeof chrome.runtime !== 'undefined' &&
        typeof chrome.runtime.id === 'string' &&
        typeof chrome.runtime.sendMessage === 'function'
    );
}

function resolveTextInput(el: EventTarget | null): HTMLElement | null {
    if (!el || !(el instanceof HTMLElement)) return null;
    if (el instanceof HTMLTextAreaElement) return el;
    if (el instanceof HTMLInputElement && ['text', 'search', 'email', 'url', 'tel'].includes(el.type)) return el;
    if (el.isContentEditable) return el;

    const closestEditable = el.closest(
        'textarea, input[type="text"], input[type="search"], input[type="email"], input[type="url"], input[type="tel"], [contenteditable]:not([contenteditable="false"])'
    );
    return closestEditable instanceof HTMLElement ? closestEditable : null;
}

function syncCurrentInputFromActiveElement(): HTMLElement | null {
    const active = resolveTextInput(document.activeElement);
    if (active) {
        currentInput = active;
    }
    return currentInput;
}

/** Load preferences from storage */
function loadPreferences() {
    try {
        chrome.storage.local.get(STORAGE_KEY, (result) => {
            if (result[STORAGE_KEY]) {
                const prefs = result[STORAGE_KEY];
                if (prefs.framework && FRAMEWORKS.includes(prefs.framework)) {
                    selectedFramework = prefs.framework;
                }
                if (prefs.tone && TONES.includes(prefs.tone)) {
                    selectedTone = prefs.tone;
                }
                // Update UI if it exists
                if (pillEl) {
                    const selectFw = pillEl.querySelector('#ps-framework-select') as HTMLSelectElement;
                    const selectTone = pillEl.querySelector('#ps-tone-select') as HTMLSelectElement;
                    if (selectFw) {
                        selectFw.value = selectedFramework;
                        const hint = pillEl.querySelector('#ps-fw-hint');
                        if (hint) hint.textContent = FRAMEWORK_DESCRIPTIONS[selectedFramework] || '';
                    }
                    if (selectTone) selectTone.value = selectedTone;
                }
            }
        });
    } catch (e) {
        console.warn('[PromptShift] Could not load preferences', e);
    }
}

/** Save preferences to storage */
function savePreferences() {
    try {
        chrome.storage.local.set({
            [STORAGE_KEY]: {
                framework: selectedFramework,
                tone: selectedTone
            }
        });
    } catch (e) {
        console.warn('[PromptShift] Could not save preferences', e);
    }
}

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
        const proto = el instanceof HTMLTextAreaElement
            ? window.HTMLTextAreaElement?.prototype
            : window.HTMLInputElement?.prototype;
        const nativeSetter = Object.getOwnPropertyDescriptor(
            proto,
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
    return resolveTextInput(el) instanceof HTMLElement;
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
    <button id="ps-enhance-btn" title="Enhance with PromptShift (Cmd+Shift+E)">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
      <span>Enhance</span>
    </button>
    <div class="ps-select-group">
        <select id="ps-framework-select" title="Select strategy"></select>
        <select id="ps-tone-select" title="Select tone"></select>
    </div>
    <button id="ps-close-btn" title="Hide (Cmd+Shift+Y to restore)">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
    <div id="ps-fw-hint"></div>
  `;

    // Populate framework selector with descriptions as titles
    const selectFw = pill.querySelector('#ps-framework-select') as HTMLSelectElement;
    const selectTone = pill.querySelector('#ps-tone-select') as HTMLSelectElement;
    const hint = pill.querySelector('#ps-fw-hint') as HTMLElement;
    const closeBtn = pill.querySelector('#ps-close-btn') as HTMLButtonElement;

    FRAMEWORKS.forEach(fw => {
        const opt = document.createElement('option');
        opt.value = fw;
        opt.textContent = FRAMEWORK_LABELS[fw] || fw;
        opt.title = FRAMEWORK_DESCRIPTIONS[fw] || '';
        if (fw === selectedFramework) opt.selected = true;
        selectFw.appendChild(opt);
    });

    TONES.forEach(tone => {
        const opt = document.createElement('option');
        opt.value = tone;
        opt.textContent = TONE_LABELS[tone] || tone;
        if (tone === selectedTone) opt.selected = true;
        selectTone.appendChild(opt);
    });

    // Show description of selected framework
    function updateHint() {
        hint.textContent = FRAMEWORK_DESCRIPTIONS[selectedFramework] || '';
    }
    updateHint();

    selectFw.addEventListener('change', (e) => {
        selectedFramework = (e.target as HTMLSelectElement).value;
        updateHint();
        savePreferences();
    });

    selectTone.addEventListener('change', (e) => {
        selectedTone = (e.target as HTMLSelectElement).value;
        savePreferences();
    });

    const btn = pill.querySelector('#ps-enhance-btn') as HTMLButtonElement;
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleEnhance();
    });

    closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        isPillHidden = true;
        if (pillEl) {
            pillEl.style.opacity = '0';
            pillEl.style.pointerEvents = 'none';
        }
    });

    document.body.appendChild(pill);
    return pill;
}

function showPill(target: HTMLElement) {
    if (isPillHidden) return; // Don't show if user dismissed it

    if (!pillEl) pillEl = createPill();

    const text = getInputText(target).trim();
    if (!text || text.length < 3) {
        hidePill();
        return;
    }

    positionNear(pillEl, target);
    pillEl.style.opacity = '1';
    pillEl.style.transform = 'translateY(0) scale(1)';
    pillEl.style.pointerEvents = 'auto';
}

function hidePill() {
    if (pillEl) {
        pillEl.style.opacity = '0';
        pillEl.style.transform = 'translateY(10px) scale(0.95)';
        pillEl.style.pointerEvents = 'none';
    }
}

// ──────────────────────────── RESULT CARD ────────────────────────────

function getActiveVariant() {
    if (!resultVariants.length) return null;
    if (activeVariantIndex < 0) activeVariantIndex = 0;
    if (activeVariantIndex >= resultVariants.length) activeVariantIndex = resultVariants.length - 1;
    return resultVariants[activeVariantIndex];
}

function positionCardNearInput() {
    if (!cardEl || !currentInput) return;
    const rect = currentInput.getBoundingClientRect();
    cardEl.style.position = 'fixed';
    cardEl.style.bottom = `${window.innerHeight - rect.top + 8}px`;
    cardEl.style.top = 'auto';
    cardEl.style.left = `${Math.max(8, rect.left)}px`;
    cardEl.style.maxWidth = `${Math.min(520, window.innerWidth - 16)}px`;
    cardEl.style.zIndex = '2147483647';
}

function setCardStatus(message: string, type: 'info' | 'error' = 'info') {
    if (!cardEl) return;
    const statusEl = cardEl.querySelector('.ps-inline-status') as HTMLElement | null;
    if (!statusEl) return;

    statusEl.textContent = message;
    statusEl.dataset.type = type;
    statusEl.classList.add('is-visible');

    if (cardStatusTimer) {
        clearTimeout(cardStatusTimer);
    }
    cardStatusTimer = setTimeout(() => {
        statusEl.classList.remove('is-visible');
        statusEl.textContent = '';
    }, 2200);
}

function renderResultCard() {
    if (!cardEl) {
        cardEl = document.createElement('div');
        cardEl.id = 'promptshift-card';
        document.body.appendChild(cardEl);
    }

    const variant = getActiveVariant();
    if (!variant) return;

    const safeEnhanced = escapeHtml(variant.enhanced);
    const safeExplanation = escapeHtml(variant.explanation);
    const hasMultipleVariants = resultVariants.length > 1;
    const canGoPrev = activeVariantIndex > 0;
    const canGoNext = activeVariantIndex < resultVariants.length - 1;
    const canGenerateAnother = allowAnotherVersion && !!sourceTextForVariants;
    const frameworkLabel = FRAMEWORK_LABELS[selectedFramework] || selectedFramework;

    cardEl.innerHTML = `
    <div class="ps-card-header">
      <div class="ps-card-title">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/>
        </svg>
        <span>Prompt Enhanced</span>
      </div>
      <button class="ps-card-close" aria-label="Close">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>

    <div class="ps-card-body">
      <div class="ps-meta-row">
        <span class="ps-chip">${escapeHtml(frameworkLabel)}</span>
        <span class="ps-chip">Version ${activeVariantIndex + 1}/${resultVariants.length}</span>
      </div>
      <div class="ps-explanation">${safeExplanation}</div>
      <div class="ps-result-box">${safeEnhanced}</div>
    </div>

    <div class="ps-card-actions">
      <button class="ps-btn ps-btn-another" ${canGenerateAnother ? '' : 'disabled'}>Another Version</button>
      <button class="ps-btn ps-btn-replace">Replace</button>
      <button class="ps-btn ps-btn-copy">Copy</button>
    </div>

    <div class="ps-card-variants ${hasMultipleVariants ? 'is-visible' : ''}">
      <button class="ps-nav-btn ps-btn-prev" ${canGoPrev ? '' : 'disabled'}>Previous</button>
      <span class="ps-version-label">${activeVariantIndex + 1} of ${resultVariants.length}</span>
      <button class="ps-nav-btn ps-btn-next" ${canGoNext ? '' : 'disabled'}>Next</button>
    </div>

    <div class="ps-inline-status" aria-live="polite"></div>
  `;

    positionCardNearInput();
    cardEl.classList.add('ps-visible');

    cardEl.querySelector('.ps-card-close')?.addEventListener('click', hideCard);

    cardEl.querySelector('.ps-btn-replace')?.addEventListener('click', () => {
        if (currentInput) {
            setInputText(currentInput, variant.enhanced);
            hideCard();
        }
    });

    cardEl.querySelector('.ps-btn-copy')?.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(variant.enhanced);
            setCardStatus('Copied to clipboard.');
        } catch {
            setCardStatus('Clipboard was blocked by the page.', 'error');
        }
    });

    cardEl.querySelector('.ps-btn-another')?.addEventListener('click', () => {
        void generateAnotherVersion();
    });

    cardEl.querySelector('.ps-btn-prev')?.addEventListener('click', () => {
        if (activeVariantIndex > 0) {
            activeVariantIndex -= 1;
            renderResultCard();
        }
    });

    cardEl.querySelector('.ps-btn-next')?.addEventListener('click', () => {
        if (activeVariantIndex < resultVariants.length - 1) {
            activeVariantIndex += 1;
            renderResultCard();
        }
    });
}

function showResultCard(enhanced: string, explanation: string, options: ShowResultOptions = {}) {
    const {
        appendVariant = false,
        sourceText,
        allowAnotherVersion: nextAllowAnotherVersion,
    } = options;

    if (appendVariant && resultVariants.length > 0) {
        resultVariants.push({ enhanced, explanation });
        activeVariantIndex = resultVariants.length - 1;
    } else {
        resultVariants = [{ enhanced, explanation }];
        activeVariantIndex = 0;
    }

    if (typeof sourceText === 'string') {
        sourceTextForVariants = sourceText;
    }
    if (typeof nextAllowAnotherVersion === 'boolean') {
        allowAnotherVersion = nextAllowAnotherVersion;
    }

    renderResultCard();
}

function hideCard() {
    if (!cardEl) return;
    cardEl.classList.remove('ps-visible');
    if (cardStatusTimer) {
        clearTimeout(cardStatusTimer);
        cardStatusTimer = null;
    }
}

function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ──────────────────────────── ENHANCE HANDLER ────────────────────────────

const COOLDOWN_MS = 1000; // 1 second cooldown (prevent double-clicks)
let lastEnhanceTime = 0;

function sendEnhanceMessage(text: string, options: EnhanceRequestOptions = {}): Promise<EnhanceResponse> {
    return new Promise((resolve, reject) => {
        if (!hasRuntimeApi()) {
            reject(new Error('PromptShift runtime unavailable. Refresh this tab.'));
            return;
        }

        try {
            chrome.runtime.sendMessage(
                {
                    type: 'enhance',
                    text,
                    framework: selectedFramework,
                    tone: selectedTone,
                    variation: options.variation ?? 0,
                    avoidPrompts: options.avoidPrompts ?? [],
                },
                (response: EnhanceResponse) => {
                    const lastError = chrome.runtime.lastError;
                    if (lastError) {
                        reject(new Error(lastError.message || 'Failed to contact PromptShift service worker.'));
                        return;
                    }
                    resolve(response);
                }
            );
        } catch (error) {
            reject(error);
        }
    });
}

async function handleEnhance() {
    if (isEnhancing) {
        return;
    }

    syncCurrentInputFromActiveElement();
    if (!currentInput) return;

    // Enforce cooldown
    const now = Date.now();
    const elapsed = now - lastEnhanceTime;
    if (elapsed < COOLDOWN_MS) {
        return;
    }

    const text = getInputText(currentInput).trim();
    if (!text) return;

    isEnhancing = true;
    lastEnhanceTime = Date.now();
    hidePill();
    showLoadingCard(
        'PromptShift Enhancing...',
        `Applying ${FRAMEWORK_LABELS[selectedFramework]} framework...`
    );

    try {
        if (!hasRuntimeApi()) {
            showResultCard('Extension Updated', 'Please refresh this page.', {
                sourceText: '',
                allowAnotherVersion: false,
            });
            return;
        }

        const response = await sendEnhanceMessage(text, {
            variation: 0,
            avoidPrompts: [],
        });

        if (response?.success) {
            showResultCard(
                response.enhanced || 'No enhanced prompt returned.',
                response.explanation || 'Prompt was enhanced.',
                {
                    sourceText: text,
                    allowAnotherVersion: true,
                }
            );
        } else {
            showResultCard('Enhancement failed.', response?.error || 'Unknown error.', {
                sourceText: '',
                allowAnotherVersion: false,
            });
        }
    } catch (err: any) {
        const errorMessage = err?.message || 'Unknown error.';
        console.error('[PromptShift] Error:', errorMessage);

        // Handle "Extension context invalidated" error (happens after extension reload)
        if (
            errorMessage.includes('Extension context invalidated') ||
            errorMessage.includes('PromptShift runtime unavailable') ||
            errorMessage.includes('Receiving end does not exist')
        ) {
            showResultCard('Extension Updated', 'Please refresh this page.', {
                sourceText: '',
                allowAnotherVersion: false,
            });
        } else {
            showResultCard('Enhancement failed.', errorMessage, {
                sourceText: '',
                allowAnotherVersion: false,
            });
        }
    } finally {
        isEnhancing = false;
    }
}

async function generateAnotherVersion() {
    if (isEnhancing || !allowAnotherVersion || !sourceTextForVariants) {
        return;
    }

    const snapshotVariants = resultVariants.map((variant) => ({ ...variant }));
    const snapshotIndex = activeVariantIndex;
    const nextVersion = snapshotVariants.length + 1;

    isEnhancing = true;
    showLoadingCard(
        'Creating Another Version...',
        `Generating version ${nextVersion} with a different structure...`
    );

    try {
        const response = await sendEnhanceMessage(sourceTextForVariants, {
            variation: snapshotVariants.length,
            avoidPrompts: snapshotVariants.map((variant) => variant.enhanced).slice(-3),
        });

        if (response?.success) {
            showResultCard(
                response.enhanced || 'No enhanced prompt returned.',
                response.explanation || 'Generated an alternate version.',
                {
                    appendVariant: true,
                    sourceText: sourceTextForVariants,
                    allowAnotherVersion: true,
                }
            );
            setCardStatus(`Added version ${resultVariants.length}.`);
            return;
        }

        resultVariants = snapshotVariants;
        activeVariantIndex = snapshotIndex;
        renderResultCard();
        setCardStatus(response?.error || 'Could not generate another version.', 'error');
    } catch (err: any) {
        const errorMessage = err?.message || 'Could not generate another version.';
        resultVariants = snapshotVariants;
        activeVariantIndex = snapshotIndex;
        renderResultCard();
        setCardStatus(errorMessage, 'error');
    } finally {
        isEnhancing = false;
    }
}

// ──────────────────────────── LOADING HANDLER ────────────────────────────

function showLoadingCard(title = 'PromptShift Enhancing...', detail = 'Working on your request...') {
    if (!cardEl) {
        cardEl = document.createElement('div');
        cardEl.id = 'promptshift-card';
        document.body.appendChild(cardEl);
    }

    cardEl.innerHTML = `
    <div class="ps-card-header">
      <div class="ps-card-title">
        <svg class="ps-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M4 12a8 8 0 0 1 8-8"></path>
        </svg>
        <span>${escapeHtml(title)}</span>
      </div>
    </div>
    <div class="ps-card-body">
      <div class="ps-explanation">${escapeHtml(detail)}</div>
    </div>
  `;

    positionCardNearInput();

    cardEl.classList.add('ps-visible');
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

function runEnhanceShortcut() {
    syncCurrentInputFromActiveElement();

    // If hidden, unhide first.
    if (isPillHidden) {
        isPillHidden = false;
        if (currentInput) showPill(currentInput);
        return;
    }

    if (currentInput && getInputText(currentInput).trim().length >= 3) {
        handleEnhance();
    }
}

function runToggleShortcut() {
    syncCurrentInputFromActiveElement();
    isPillHidden = !isPillHidden;

    if (isPillHidden) {
        hidePill();
    } else if (currentInput) {
        showPill(currentInput);
    }
}

/** Show pill when user focuses or types in a text input. */
const handleInputActivity = debounce((target: EventTarget | null) => {
    const inputEl = resolveTextInput(target);
    if (!inputEl) return;

    currentInput = inputEl;
    showPill(inputEl);
}, 150);

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
    if (resolveTextInput(target)) return;

    hidePill();
}

// Attach listeners
document.addEventListener('focusin', (e: FocusEvent) => {
    const inputEl = resolveTextInput(e.target);
    if (!inputEl) return;
    currentInput = inputEl;
    showPill(inputEl);
}, true);
document.addEventListener('input', (e: Event) => handleInputActivity(e.target), true);
document.addEventListener('click', handleClickOutside, true);

// Also listen for text selection in inputs
document.addEventListener('mouseup', debounce((e: Event) => {
    const inputEl = resolveTextInput((e as MouseEvent).target);
    if (inputEl) {
        currentInput = inputEl;
        const text = getInputText(inputEl).trim();
        if (text.length >= 3) {
            showPill(inputEl);
        }
    }
}, 200), true);

// Handle keyboard shortcut: Ctrl/Cmd + Shift + E to enhance OR restore
document.addEventListener('keydown', (e: KeyboardEvent) => {
    // CMD+SHIFT+E: Enhance (or Restore)
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.code === 'KeyE') {
        e.preventDefault();
        e.stopPropagation();
        runEnhanceShortcut();
    }

    // CMD+SHIFT+Y: Toggle Visibility
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.code === 'KeyY') {
        e.preventDefault();
        e.stopPropagation();
        runToggleShortcut();
    }
}, true);

if (hasRuntimeApi()) {
    chrome.runtime.onMessage.addListener((message: ShortcutMessage) => {
        if (message?.type === 'shortcut-enhance') {
            runEnhanceShortcut();
            return;
        }
        if (message?.type === 'shortcut-toggle') {
            runToggleShortcut();
        }
    });
}

// Load preferences on startup
loadPreferences();

console.log('PromptShift content script loaded');
