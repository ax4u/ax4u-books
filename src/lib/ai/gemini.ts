import { GoogleGenAI } from "@google/genai";
import type { BookOptions } from "@/lib/books/types";
import { env } from "@/lib/env";
import type { AIProvider, StoryPlan } from "./types";
import { buildStoryPrompt, parseStoryPlan } from "./types";
import { placeholderIllustration } from "./png";

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!client) client = new GoogleGenAI({ apiKey: env.geminiApiKey! });
  return client;
}

export const geminiProvider: AIProvider = {
  name: "gemini",

  async generateStory(topic, options): Promise<StoryPlan> {
    const response = await getClient().models.generateContent({
      model: env.geminiTextModel,
      contents: buildStoryPrompt(topic, options),
      config: { responseMimeType: "application/json" },
    });
    return parseStoryPlan(response.text ?? "", options.pageCount);
  },

  async generateImage(prompt: string, _options: BookOptions): Promise<string> {
    void _options;
    try {
      const response = await getClient().models.generateContent({
        model: env.geminiImageModel, // Nano Banana 2 (gemini-3-pro-image-preview)
        contents: prompt,
      });
      const parts = response.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        const data = part.inlineData?.data;
        if (data) {
          const mime = part.inlineData?.mimeType ?? "image/png";
          return `data:${mime};base64,${data}`;
        }
      }
      throw new Error("Gemini image: no inline image data returned");
    } catch (err) {
      console.error("[gemini] image generation failed, using placeholder:", err);
      const png = placeholderIllustration(prompt);
      return `data:image/png;base64,${png.toString("base64")}`;
    }
  },
};
