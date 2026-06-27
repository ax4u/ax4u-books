import type { BookOptions } from "@/lib/books/types";

/** A planned story: a title plus per-page text and an illustration prompt. */
export type StoryPlan = {
  title: string;
  /** Stable visual specification prepended to every illustration prompt. */
  characterSheet: string;
  pages: {
    text: string;
    imagePrompt: string;
  }[];
};

export type ImageReference = {
  dataUrl: string;
  label: string;
};

export interface AIProvider {
  readonly name: "openai" | "gemini" | "mock";
  /** Turn a topic into a structured story plan. */
  generateStory(topic: string, options: BookOptions): Promise<StoryPlan>;
  /** Produce one illustration. Returns a `data:image/png;base64,...` URL. */
  generateImage(
    prompt: string,
    options: BookOptions,
    references?: ImageReference[],
  ): Promise<string>;
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
    `Before writing pages, create a "characterSheet" in English. It must lock`,
    `the exact visual identity of every recurring character: name, species/age,`,
    `body size, fur/skin color, face shape, eye shape, distinctive marks, exact`,
    `clothing, accessories, and scale relative to other characters. Never let`,
    `a recurring character change species, age, outfit, colors, or proportions.`,
    ``,
    `For each page also write an "imagePrompt": a vivid English description of`,
    `only the page's scene, pose, setting, camera, mood, and action. Do not`,
    `redesign recurring characters inside page prompts; rely on characterSheet.`,
    ``,
    `Respond with ONLY valid JSON in exactly this shape:`,
    `{"title": string, "characterSheet": string, "pages": [{"text": string, "imagePrompt": string}]}`,
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
  const characterSheet = String(parsed.characterSheet ?? "").trim();
  const pages = parsed.pages
    .slice(0, pageCount)
    .map((p) => ({
      text: String(p.text ?? "").trim(),
      imagePrompt: String(p.imagePrompt ?? p.text ?? "").trim(),
    }));
  return { title: String(parsed.title).trim(), characterSheet, pages };
}

export function buildConsistentImagePrompt({
  characterSheet,
  pagePrompt,
  options,
  pageNumber,
}: {
  characterSheet: string;
  pagePrompt: string;
  options: BookOptions;
  pageNumber: number;
}): string {
  return [
    `Children's picture book illustration, page ${pageNumber}.`,
    ``,
    `LOCKED CHARACTER BIBLE - follow exactly on every page:`,
    characterSheet || fallbackCharacterSheet(options),
    ``,
    `PAGE SCENE:`,
    pagePrompt,
    ``,
    `CONTINUITY RULES:`,
    `- Keep every recurring character's species, face, body proportions, fur/skin colors, outfit, accessories, and relative size identical to the character bible and reference images.`,
    `- Do not age characters up or down. Do not change clothing colors. Do not add duplicate versions of the same character.`,
    `- Preserve the same ${options.style} children's book art direction, line quality, palette, and rendering style.`,
    `- Avoid readable text, logos, labels, signs, speech bubbles, and UI-like elements unless explicitly required by the scene.`,
    `- Compose a fresh scene for this page; use references only for character identity and style, not for copying the previous composition.`,
  ].join("\n");
}

function fallbackCharacterSheet(options: BookOptions): string {
  return [
    `No separate character sheet was returned by the story model.`,
    `Infer the recurring characters from the page prompt, then keep their`,
    `visual identity stable across the full ${options.style} picture book.`,
  ].join(" ");
}

export function parseDataUrl(
  dataUrl: string,
): { mimeType: string; base64: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/s);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
}
