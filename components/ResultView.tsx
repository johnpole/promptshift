import React, { useState } from 'react';
import { Copy, Check, Wand2, ArrowDown, RotateCcw } from 'lucide-react';
import { EnhancementResult } from '../types';

interface ResultViewProps {
  result: EnhancementResult | null;
  isLoading: boolean;
}

const ResultView: React.FC<ResultViewProps> = ({ result, isLoading }) => {
  const [copied, setCopied] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);

  const handleCopy = () => {
    if (result) {
      navigator.clipboard.writeText(result.enhanced);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center">
        <div className="relative mb-4">
          <div className="absolute inset-0 bg-gradient-to-r from-primary to-secondary blur-2xl opacity-20 animate-pulse" />
          <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/20 flex items-center justify-center">
            <Wand2 className="text-primary w-7 h-7 animate-spin" style={{ animationDuration: '3s' }} />
          </div>
        </div>
        <h3 className="text-sm font-semibold text-white mb-1">Enhancing your prompt...</h3>
        <p className="text-[11px] text-slate-500 max-w-xs leading-relaxed">
          Applying framework structure, fixing grammar, and optimizing for LLM interpretability.
        </p>
        {/* Shimmer loading skeleton */}
        <div className="w-full mt-4 space-y-2">
          <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full w-3/4 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 animate-pulse rounded-full" />
          </div>
          <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full w-1/2 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 animate-pulse rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="flex flex-col gap-2.5 animate-in fade-in slide-in-from-bottom-3 duration-400">

      {/* ── Original (Collapsible) ── */}
      <button
        onClick={() => setShowOriginal(!showOriginal)}
        className="flex items-center gap-1.5 text-[10px] text-slate-600 hover:text-slate-400 transition-colors group"
        aria-expanded={showOriginal}
        aria-controls="original-prompt"
      >
        <RotateCcw size={10} className="group-hover:text-slate-400" />
        <span className="uppercase tracking-widest font-semibold">Original</span>
        <ArrowDown size={9} className={`transition-transform ${showOriginal ? 'rotate-180' : ''}`} />
      </button>

      {showOriginal && (
        <div
          id="original-prompt"
          className="p-2.5 bg-slate-900/50 border border-slate-800/40 rounded-xl text-[11px] text-slate-500 font-mono leading-relaxed animate-in slide-in-from-top-2 fade-in duration-200"
        >
          {result.original}
        </div>
      )}

      {/* ── Enhanced Output ── */}
      <div className="relative rounded-xl overflow-hidden">
        {/* Glow border */}
        <div className="absolute -inset-[1px] bg-gradient-to-br from-primary/30 via-accent/10 to-secondary/30 rounded-xl blur-[1px]" />

        <div className="relative bg-slate-900/90 backdrop-blur border border-slate-700/30 rounded-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800/50">
            <div className="flex items-center gap-1.5">
              <Wand2 size={12} className="text-primary" />
              <span className="text-[10px] font-bold text-white uppercase tracking-wider">Enhanced</span>
              <span className="text-[9px] text-slate-600 font-mono bg-slate-800/50 px-1.5 py-0.5 rounded">
                {result.framework.replace(/_/g, ' ')}
              </span>
            </div>
            <button
              onClick={handleCopy}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all duration-300 ${copied
                  ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                  : 'bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 hover:border-primary/40'
                }`}
              aria-label={copied ? "Copied to clipboard" : "Copy enhanced prompt"}
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          {/* Content */}
          <div className="p-3 max-h-[200px] overflow-y-auto custom-scrollbar">
            <pre className="whitespace-pre-wrap font-mono text-[11px] text-slate-200 leading-relaxed">
              {result.enhanced}
            </pre>
          </div>
        </div>
      </div>

      {/* ── Enhancement Explanation ── */}
      <div className="flex items-start gap-2 p-2.5 bg-accent/5 border border-accent/10 rounded-xl">
        <div className="w-4 h-4 rounded-md bg-accent/15 flex items-center justify-center flex-none mt-0.5">
          <Wand2 size={9} className="text-accent" />
        </div>
        <div>
          <span className="text-[9px] font-bold text-accent uppercase tracking-wider block mb-0.5">What changed</span>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            {result.explanation}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResultView;