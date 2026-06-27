import type { BookOptions } from "@/lib/books/types";
import type { AIProvider, StoryPlan } from "./types";
import { placeholderIllustration } from "./png";

/**
 * Mock provider used when no AI keys are present. Produces deterministic
 * placeholder text and procedurally-drawn illustrations so the whole flow can
 * be demoed offline.
 */
export const mockProvider: AIProvider = {
  name: "mock",

  async generateStory(topic, options): Promise<StoryPlan> {
    const pages = Array.from({ length: options.pageCount }, (_, i) => {
      const n = i + 1;
      return {
        text:
          options.language.toLowerCase().startsWith("ko") ||
          options.language.includes("한")
            ? `(${n}쪽) "${topic}" 이야기가 펼쳐집니다. 작은 주인공이 한 걸음씩 모험을 떠나요.`
            : `(Page ${n}) The story of "${topic}" unfolds. Our little hero takes another step on the adventure.`,
        imagePrompt: `${options.style} children's book illustration, page ${n}, scene about ${topic}, warm and friendly, consistent character`,
      };
    });
    return {
      title: `${topic}`,
      characterSheet: [
        `Recurring protagonist: one small friendly childlike hero, same species, same round face, same warm expression, same simple outfit, same color palette on every page.`,
        `Art direction: ${options.style}, soft children's picture book look.`,
      ].join(" "),
      pages,
    };
  },

  async generateImage(prompt: string, _options: BookOptions): Promise<string> {
    void _options;
    const png = placeholderIllustration(prompt);
    return `data:image/png;base64,${png.toString("base64")}`;
  },
};
