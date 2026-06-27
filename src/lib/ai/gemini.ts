import { GoogleGenAI, Modality, type Part } from "@google/genai";
import type { BookOptions } from "@/lib/books/types";
import { env } from "@/lib/env";
import type { AIProvider, ImageReference, StoryPlan } from "./types";
import { buildStoryPrompt, parseDataUrl, parseStoryPlan } from "./types";
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

  async generateImage(
    prompt: string,
    _options: BookOptions,
    references: ImageReference[] = [],
  ): Promise<string> {
    void _options;
    try {
      const response = await getClient().models.generateContent({
        model: env.geminiImageModel, // Nano Banana 2 (gemini-3-pro-image-preview)
        contents: buildGeminiImageContents(prompt, references),
        config: { responseModalities: [Modality.IMAGE] },
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

function buildGeminiImageContents(
  prompt: string,
  references: ImageReference[],
) {
  if (references.length === 0) return prompt;

  const parts: Part[] = [
    {
      text: [
        prompt,
        ``,
        `REFERENCE IMAGES PROVIDED: ${references.map((ref) => ref.label).join(", ")}.`,
        `Use them only to preserve recurring character identity, exact outfit, proportions, palette, and illustration style.`,
        `Create a new composition for the current page; do not copy the previous page layout.`,
      ].join("\n"),
    },
  ];

  for (const reference of references) {
    const parsed = parseDataUrl(reference.dataUrl);
    if (!parsed) throw new Error(`Invalid image reference: ${reference.label}`);
    parts.push({
      inlineData: { mimeType: parsed.mimeType, data: parsed.base64 },
    });
  }

  return [{ role: "user", parts }];
}
