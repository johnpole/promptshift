export enum EnhancementFramework {
  CLEANUP = 'CLEANUP',
  CO_STAR = 'CO_STAR',
  CHAIN_OF_THOUGHT = 'CHAIN_OF_THOUGHT',
  PERSONA_BASED = 'PERSONA_BASED',
  STRUCTURED_OUTPUT = 'STRUCTURED_OUTPUT',
  SOCRATIC = 'SOCRATIC',
  AGENTIC = 'AGENTIC'
}

export enum Tone {
  NEUTRAL = 'NEUTRAL',
  PROFESSIONAL = 'PROFESSIONAL',
  CREATIVE = 'CREATIVE',
  ACADEMIC = 'ACADEMIC',
  CONCISE = 'CONCISE'
}

export interface EnhancementResult {
  original: string;
  enhanced: string;
  explanation: string;
  framework: EnhancementFramework;
  timestamp: number;
}

export interface FrameworkConfig {
  id: EnhancementFramework;
  name: string;
  description: string;
  icon: string;
}