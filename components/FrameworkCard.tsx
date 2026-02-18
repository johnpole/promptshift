import React from 'react';
import { FrameworkConfig } from '../types';
import * as Icons from 'lucide-react';

interface FrameworkCardProps {
  framework: FrameworkConfig;
  isSelected: boolean;
  onClick: () => void;
}

const FrameworkCard: React.FC<FrameworkCardProps> = ({ framework, isSelected, onClick }) => {
  // Dynamic Icon rendering
  const IconComponent = (Icons as any)[framework.icon] || Icons.HelpCircle;

  return (
    <button
      onClick={onClick}
      className={`
        relative flex flex-col items-start p-4 rounded-xl border transition-all duration-200 text-left w-full h-full
        ${isSelected 
          ? 'bg-primary/10 border-primary shadow-[0_0_15px_rgba(99,102,241,0.3)]' 
          : 'bg-surface border-slate-700 hover:border-slate-500 hover:bg-slate-700/50'
        }
      `}
    >
      <div className={`p-2 rounded-lg mb-3 ${isSelected ? 'bg-primary text-white' : 'bg-slate-800 text-slate-400'}`}>
        <IconComponent size={20} />
      </div>
      <h3 className={`font-semibold text-sm mb-1 ${isSelected ? 'text-white' : 'text-slate-200'}`}>
        {framework.name}
      </h3>
      <p className="text-xs text-slate-400 leading-relaxed">
        {framework.description}
      </p>
      
      {isSelected && (
        <div className="absolute top-2 right-2">
          <span className="flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
          </span>
        </div>
      )}
    </button>
  );
};

export default FrameworkCard;