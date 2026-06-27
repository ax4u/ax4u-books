import type { BookOptions } from "@/lib/books/types";

/** A planned story: a title plus per-page text and an illustration prompt. */
export type StoryPlan = {
  title: string;
  pages: {
    text: string;
    imagePrompt: string;
  }[];
};

export interface AIProvider {
  readonly name: "openai" | "gemini" | "mock";
  /** Turn a topic into a structured story plan. */
  generateStory(topic: string, options: BookOptions): Promise<StoryPlan>;
  /** Produce one illustration. Returns a `data:image/png;base64,...` URL. */
  generateImage(prompt: string, options: BookOptions): Promise<string>;
}

/** Shared instruction used to coax structured JSON out of a text model. */
export function buildStoryPrompt(topic: string, options: BookOptions): string {
  return [
    `You are an author and illustrator of children's picture books.`,
    `Write a complete, age-appropriate picture book for the topic: "${topic}".`,
    ``,
    `Constraints:`,
    `- Target age group: ${options.ageGroup}`,
    `- Language for ALL story text: ${options.language} (write naturally in this language)`,
    `- Exactly ${options.pageCount} pages.`,
    `- Each page: 1-3 short sentences suitable for the age group.`,
    `- Keep a clear narrative arc (beginning, middle, satisfying end).`,
    `- Illustration art style: ${options.style}.`,
    ``,
    `For each page also write an "imagePrompt": a vivid English description of`,
    `the illustration for that page, including characters, setting, mood and the`,
    `"${options.style}" art style. Keep characters visually consistent across pages.`,
    ``,
    `Respond with ONLY valid JSON in exactly this shape:`,
    `{"title": string, "pages": [{"text": string, "imagePrompt": string}]}`,
  ].join("\n");
}

/** Best-effort extraction of a StoryPlan from a raw model string. */
export function parseStoryPlan(raw: string, pageCount: number): StoryPlan {
  let jsonText = raw.trim();
  // Strip ```json fences if present.
  const fence = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) jsonText = fence[1].trim();
  // Fall back to the outermost braces.
  if (!jsonText.startsWith("{")) {
    const start = jsonText.indexOf("{");
    const end = jsonText.lastIndexOf("}");
    if (start !== -1 && end !== -1) jsonText = jsonText.slice(start, end + 1);
  }

  const parsed = JSON.parse(jsonText) as Partial<StoryPlan>;
  if (!parsed.title || !Array.isArray(parsed.pages)) {
    throw new Error("Story plan JSON missing title or pages");
  }
  const pages = parsed.pages
    .slice(0, pageCount)
    .map((p) => ({
      text: String(p.text ?? "").trim(),
      imagePrompt: String(p.imagePrompt ?? p.text ?? "").trim(),
    }));
  return { title: String(parsed.title).trim(), pages };
}
