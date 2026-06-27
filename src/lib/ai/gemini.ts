import {
  GoogleGenAI,
  Modality,
  type GoogleGenAIOptions,
  type Part,
} from "@google/genai/node";
import type { BookOptions } from "@/lib/books/types";
import { env } from "@/lib/env";
import type { AIProvider, ImageReference, StoryPlan } from "./types";
import { buildStoryPrompt, parseDataUrl, parseStoryPlan } from "./types";
import { placeholderIllustration } from "./png";

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!client) {
    if (env.geminiVertexProject && env.geminiVertexLocation) {
      client = new GoogleGenAI(vertexClientOptions());
    } else {
      client = new GoogleGenAI({ apiKey: env.geminiApiKey! });
    }
  }
  return client;
}

export const geminiProvider: AIProvider = {
  name: "gemini",

  async generateStory(topic, options): Promise<StoryPlan> {
    try {
      const response = await getClient().models.generateContent({
        model: env.geminiTextModel,
        contents: buildStoryPrompt(topic, options),
        config: { responseMimeType: "application/json" },
      });
      return parseStoryPlan(response.text ?? "", options.pageCount);
    } catch (err) {
      throw decorateVertexAuthError(err);
    }
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

function vertexClientOptions(): GoogleGenAIOptions {
  const credentials = vertexServiceAccountCredentials();
  return {
    vertexai: true,
    project: env.geminiVertexProject,
    location: env.geminiVertexLocation,
    ...(credentials
      ? { googleAuthOptions: { credentials } }
      : {}),
  };
}

type VertexCredentials = NonNullable<
  NonNullable<GoogleGenAIOptions["googleAuthOptions"]>["credentials"]
>;

function vertexServiceAccountCredentials(): VertexCredentials | undefined {
  const raw = env.googleVertexServiceAccountJson;
  if (!raw) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      "GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON must be a valid Google Cloud service account JSON object.",
    );
  }

  if (!isServiceAccountCredentials(parsed)) {
    throw new Error(
      "GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON must contain service account credentials with type, client_email, and private_key.",
    );
  }

  return parsed as VertexCredentials;
}

function isServiceAccountCredentials(value: unknown): value is {
  type: "service_account";
  client_email: string;
  private_key: string;
} {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.type === "service_account" &&
    typeof record.client_email === "string" &&
    typeof record.private_key === "string"
  );
}

function decorateVertexAuthError(err: unknown): Error {
  if (
    env.geminiVertexProject &&
    env.geminiVertexLocation &&
    !env.googleVertexServiceAccountJson &&
    err instanceof Error &&
    err.message.includes("Could not load the default credentials")
  ) {
    return new Error(
      "Google Cloud Gemini credentials are not configured. Set GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON in Vercel Production or provide Google Application Default Credentials for local runs.",
    );
  }
  return err instanceof Error ? err : new Error(String(err));
}
