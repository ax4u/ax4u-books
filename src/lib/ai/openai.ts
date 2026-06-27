import OpenAI from "openai";
import type { BookOptions } from "@/lib/books/types";
import { env } from "@/lib/env";
import type { AIProvider, StoryPlan } from "./types";
import { buildStoryPrompt, parseStoryPlan } from "./types";
import { placeholderIllustration } from "./png";

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: env.openaiApiKey });
  return client;
}

export const openaiProvider: AIProvider = {
  name: "openai",

  async generateStory(topic, options): Promise<StoryPlan> {
    const completion = await getClient().chat.completions.create({
      model: env.openaiTextModel,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You write structured children's picture books and reply with strict JSON only.",
        },
        { role: "user", content: buildStoryPrompt(topic, options) },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "";
    return parseStoryPlan(raw, options.pageCount);
  },

  async generateImage(prompt: string, _options: BookOptions): Promise<string> {
    void _options;
    try {
      const result = await getClient().images.generate({
        model: env.openaiImageModel, // gpt-image-2
        prompt,
        size: "1024x1024",
        n: 1,
      });
      const b64 = result.data?.[0]?.b64_json;
      if (b64) return `data:image/png;base64,${b64}`;
      throw new Error("OpenAI image: no b64_json returned");
    } catch (err) {
      console.error("[openai] image generation failed, using placeholder:", err);
      const png = placeholderIllustration(prompt);
      return `data:image/png;base64,${png.toString("base64")}`;
    }
  },
};
