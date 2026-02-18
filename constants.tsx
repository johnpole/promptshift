import { EnhancementFramework, FrameworkConfig, Tone } from './types';

export const FRAMEWORKS: FrameworkConfig[] = [
  {
    id: EnhancementFramework.AGENTIC,
    name: "Agentic",
    description: "For AI agents & CLI. Defines Role, Tools, Context, Constraints.",
    icon: "Bot"
  },
  {
    id: EnhancementFramework.CO_STAR,
    name: "CO-STAR",
    description: "Context, Objective, Style, Tone, Audience, Response format.",
    icon: "LayoutTemplate"
  },
  {
    id: EnhancementFramework.CHAIN_OF_THOUGHT,
    name: "CoT",
    description: "Step-by-step reasoning for logic & complex tasks.",
    icon: "BrainCircuit"
  },
  {
    id: EnhancementFramework.STRUCTURED_OUTPUT,
    name: "Structured",
    description: "JSON, CSV, or code output with defined schemas.",
    icon: "Sparkles"
  },
  {
    id: EnhancementFramework.PERSONA_BASED,
    name: "Persona",
    description: "Assigns an expert role: 'Act as a Senior Dev...'",
    icon: "UserCircle"
  },
  {
    id: EnhancementFramework.CLEANUP,
    name: "Polish",
    description: "Grammar, typos, clarity — no structure change.",
    icon: "ShieldCheck"
  },
  {
    id: EnhancementFramework.SOCRATIC,
    name: "Socratic",
    description: "AI asks guiding questions instead of direct answers.",
    icon: "MessageSquareQuote"
  }
];

export const TONES: { id: Tone; label: string }[] = [
  { id: Tone.NEUTRAL, label: "Neutral" },
  { id: Tone.PROFESSIONAL, label: "Professional" },
  { id: Tone.CREATIVE, label: "Creative" },
  { id: Tone.ACADEMIC, label: "Academic" },
  { id: Tone.CONCISE, label: "Concise" },
];

/**
 * Quick-start templates for guided prompt entry.
 * These eliminate the "blank page" problem and serve as great demo examples.
 */
export const QUICK_TEMPLATES = [
  {
    label: "🚀 Build REST API",
    prompt: "Build a REST API for user management with CRUD operations",
  },
  {
    label: "🧪 Write Unit Tests",
    prompt: "Write unit tests for my authentication service",
  },
  {
    label: "🅰️ Angular Component",
    prompt: "Create an Angular component for a dashboard with charts",
  },
  {
    label: "☕ Spring Boot Service",
    prompt: "Create a Spring Boot service with JPA and PostgreSQL",
  },
];