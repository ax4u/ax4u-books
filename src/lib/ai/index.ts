import { resolveAiProvider } from "@/lib/env";
import type { AIProvider } from "./types";
import { mockProvider } from "./mock";
import { openaiProvider } from "./openai";
import { geminiProvider } from "./gemini";

/** Pick the active AI provider based on env + available keys. */
export function getAIProvider(): AIProvider {
  switch (resolveAiProvider()) {
    case "openai":
      return openaiProvider;
    case "gemini":
      return geminiProvider;
    default:
      return mockProvider;
  }
}

export type { AIProvider, StoryPlan } from "./types";
