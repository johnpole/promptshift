import React, { useState, useCallback, useRef, useEffect } from 'react';
import { FRAMEWORKS, TONES, QUICK_TEMPLATES } from './constants';
import { EnhancementFramework, Tone, EnhancementResult } from './types';
import { enhancePrompt } from './services/geminiService';
import ResultView from './components/ResultView';
import { Sparkles, History, Zap, ChevronDown, X } from 'lucide-react';

const App: React.FC = () => {
  const [input, setInput] = useState('');
  const [selectedFramework, setSelectedFramework] = useState<EnhancementFramework>(EnhancementFramework.AGENTIC);
  const [selectedTone, setSelectedTone] = useState<Tone>(Tone.PROFESSIONAL);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<EnhancementResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<EnhancementResult[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
  }, [input]);

  const handleEnhance = useCallback(async () => {
    if (!input.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await enhancePrompt(input, selectedFramework, selectedTone);
      const newResult: EnhancementResult = {
        original: input,
        enhanced: data.enhanced,
        explanation: data.explanation,
        framework: selectedFramework,
        timestamp: Date.now(),
      };

      setResult(newResult);
      setHistory(prev => [newResult, ...prev].slice(0, 10));
    } catch (err: any) {
      setError(err.message || "Something went wrong. Check your API Key.");
    } finally {
      setIsLoading(false);
    }
  }, [input, selectedFramework, selectedTone]);

  const handleTemplateClick = (prompt: string) => {
    setInput(prompt);
    setResult(null);
    textareaRef.current?.focus();
  };

  const restoreFromHistory = (item: EnhancementResult) => {
    setInput(item.original);
    setResult(item);
    setSelectedFramework(item.framework);
    setShowHistory(false);
  };

  const handleReset = () => {
    setInput('');
    setResult(null);
    setError(null);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleEnhance();
    }
  };

  return (
    <div className="min-h-screen bg-background text-slate-200 font-sans selection:bg-primary/30">

      {/* ═══════════════════ HEADER ═══════════════════ */}
      <header className="border-b border-slate-800/60 bg-gradient-to-r from-background via-slate-900 to-background sticky top-0 z-50">
        <div className="w-full px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary via-accent to-secondary flex items-center justify-center shadow-lg shadow-primary/30">
              <Sparkles className="text-white w-3.5 h-3.5" />
            </div>
            <h1 className="text-base font-bold tracking-tight text-white">
              Prompt<span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Shift</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-all relative"
                aria-label="View history"
                title="Prompt History"
              >
                <History size={15} />
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-primary rounded-full text-[8px] font-bold flex items-center justify-center text-white">
                  {history.length}
                </span>
              </button>
            )}
            <span className="text-[9px] text-slate-600 font-mono bg-slate-800/50 px-2 py-0.5 rounded-md border border-slate-700/50">
              Gemini 2.0 Flash
            </span>
          </div>
        </div>
      </header>

      <main className="w-full px-4 py-3 flex flex-col gap-3">

        {/* ═══════════════════ QUICK TEMPLATES ═══════════════════ */}
        {!result && (
          <div className="animate-in fade-in duration-300">
            <label className="text-[10px] font-semibold text-slate-500 mb-1.5 block uppercase tracking-widest">
              Quick Start
            </label>
            <div className="flex gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
              {QUICK_TEMPLATES.map((tmpl, idx) => (
                <button
                  key={idx}
                  onClick={() => handleTemplateClick(tmpl.prompt)}
                  className="flex-none px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all
                    bg-slate-800/40 border-slate-700/50 text-slate-400 
                    hover:bg-primary/10 hover:border-primary/40 hover:text-primary hover:shadow-sm hover:shadow-primary/10
                    active:scale-95 whitespace-nowrap"
                  aria-label={`Use template: ${tmpl.label}`}
                >
                  {tmpl.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════ SMART INPUT AREA ═══════════════════ */}
        <div className="relative group">
          <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-primary/20 via-accent/10 to-secondary/20 opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 blur-sm" />
          <div className="relative bg-surface/80 backdrop-blur-sm border border-slate-700/60 rounded-2xl overflow-hidden shadow-xl shadow-black/20 group-focus-within:border-primary/40 transition-colors">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe what you need — messy is fine, we'll enhance it..."
              className="w-full bg-transparent p-3.5 pb-12 text-[13px] focus:outline-none resize-none font-sans leading-relaxed placeholder:text-slate-600 text-slate-200 min-h-[80px]"
              rows={3}
              aria-label="Prompt input"
            />

            {/* Inline Action Bar */}
            <div className="absolute bottom-0 left-0 right-0 px-3 pb-2.5 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {input && (
                  <button
                    onClick={handleReset}
                    className="text-[10px] text-slate-600 hover:text-slate-300 transition-colors flex items-center gap-0.5 px-1.5 py-0.5 rounded hover:bg-slate-800/50"
                    aria-label="Clear input"
                  >
                    <X size={10} /> Clear
                  </button>
                )}
                <span className="text-[9px] text-slate-700 font-mono">
                  {input.length > 0 && `${input.length} chars`}
                </span>
              </div>
              <button
                onClick={handleEnhance}
                disabled={isLoading || !input.trim()}
                className="px-4 py-1.5 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 
                  disabled:opacity-30 disabled:cursor-not-allowed rounded-xl text-white font-semibold text-[11px] 
                  shadow-lg shadow-primary/25 transition-all active:scale-95 flex items-center gap-1.5
                  hover:shadow-primary/40 hover:shadow-xl"
                aria-label="Enhance prompt"
              >
                {isLoading ? (
                  <>
                    <Sparkles className="animate-spin" size={12} />
                    <span>Enhancing...</span>
                  </>
                ) : (
                  <>
                    <Zap size={12} />
                    <span>Enhance</span>
                    <kbd className="hidden sm:inline text-[8px] opacity-50 ml-0.5 bg-white/10 px-1 rounded">⌘↵</kbd>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ═══════════════════ FRAMEWORK PILLS ═══════════════════ */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
              Strategy
            </label>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-[10px] text-slate-600 hover:text-slate-300 transition-colors flex items-center gap-0.5"
            >
              {showAdvanced ? 'Hide' : 'Tone'}
              <ChevronDown size={10} className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Enhancement strategy">
            {FRAMEWORKS.map(fw => (
              <button
                key={fw.id}
                onClick={() => setSelectedFramework(fw.id)}
                role="radio"
                aria-checked={selectedFramework === fw.id}
                title={fw.description}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all duration-200
                  ${selectedFramework === fw.id
                    ? 'bg-primary/15 border-primary/50 text-primary shadow-sm shadow-primary/10'
                    : 'bg-slate-800/30 border-slate-700/40 text-slate-500 hover:border-slate-500 hover:text-slate-300'
                  }`}
              >
                {fw.name}
              </button>
            ))}
          </div>

          {/* Framework Description Tooltip */}
          <p className="text-[10px] text-slate-600 mt-1.5 italic pl-0.5" aria-live="polite">
            {FRAMEWORKS.find(fw => fw.id === selectedFramework)?.description}
          </p>

          {/* Tone Selection (Collapsible) */}
          {showAdvanced && (
            <div className="mt-2 pt-2 border-t border-slate-800/50 animate-in slide-in-from-top-2 fade-in duration-200">
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Tone selection">
                {TONES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTone(t.id)}
                    role="radio"
                    aria-checked={selectedTone === t.id}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border transition-all ${selectedTone === t.id
                        ? 'bg-secondary/10 border-secondary/40 text-secondary'
                        : 'bg-transparent border-slate-700/30 text-slate-600 hover:border-slate-500 hover:text-slate-400'
                      }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ═══════════════════ ERROR DISPLAY ═══════════════════ */}
        {error && (
          <div className="p-2.5 bg-red-500/8 border border-red-500/20 text-red-400 text-xs rounded-xl text-center animate-in fade-in duration-200" role="alert">
            ⚠️ {error}
          </div>
        )}

        {/* ═══════════════════ RESULT AREA ═══════════════════ */}
        {result && (
          <div className="animate-in slide-in-from-bottom-4 fade-in duration-400">
            <ResultView result={result} isLoading={isLoading} />
          </div>
        )}

        {/* ═══════════════════ HISTORY PANEL ═══════════════════ */}
        {showHistory && history.length > 0 && (
          <div className="border-t border-slate-800/50 pt-3 animate-in slide-in-from-top-2 fade-in duration-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] font-semibold text-slate-500 flex items-center gap-1 uppercase tracking-widest">
                <History size={10} /> Recent
              </h3>
              <button
                onClick={() => { setHistory([]); setShowHistory(false); }}
                className="text-[9px] text-slate-600 hover:text-red-400 transition-colors"
              >
                Clear All
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {history.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => restoreFromHistory(item)}
                  className="w-full p-2 bg-slate-800/20 border border-slate-800/40 rounded-lg 
                    hover:bg-slate-800/40 hover:border-slate-700 transition-all text-left 
                    flex items-center justify-between group"
                >
                  <span className="text-[11px] text-slate-400 truncate max-w-[240px] group-hover:text-slate-200 transition-colors">
                    {item.original}
                  </span>
                  <span className="text-[9px] text-primary/70 bg-primary/8 px-1.5 py-0.5 rounded font-medium">
                    {FRAMEWORKS.find(fw => fw.id === item.framework)?.name || item.framework}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════ FOOTER ═══════════════════ */}
        <div className="text-center py-2 border-t border-slate-800/30">
          <p className="text-[9px] text-slate-700 font-mono">
            Built with Gemini · By John Pole · GDG Hudson Valley 2026
          </p>
        </div>
      </main>
    </div>
  );
};

export default App;