import { resolveAiProvider } from "@/lib/env";
import { isLocalDemoAllowed } from "@/lib/runtime-policy";
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
      if (!isLocalDemoAllowed()) {
        throw new Error("AI 생성 서비스가 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.");
      }
      return mockProvider;
  }
}

export type { AIProvider, StoryPlan } from "./types";
