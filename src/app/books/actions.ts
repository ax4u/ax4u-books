"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { createBook } from "@/lib/books/store";
import { createBookCheckout } from "@/lib/polar/checkout";
import { env, isPolarConfigured, resolveAiProvider } from "@/lib/env";
import { isLocalDemoAllowed } from "@/lib/runtime-policy";

const schema = z.object({
  topic: z.string().min(2, "주제를 조금 더 자세히 입력해 주세요.").max(200),
  style: z.string().min(1).max(40),
  pageCount: z.coerce.number().int().min(4).max(16),
  ageGroup: z.string().min(1).max(20),
  language: z.string().min(1).max(20),
  characterName: z.string().trim().max(40, "주인공 이름은 40자 이내로 입력해 주세요.").optional(),
  characterTraits: z.string().trim().max(120, "주인공 특징은 120자 이내로 입력해 주세요.").optional(),
});

export type CreateState = { error?: string };

export async function createBookAction(
  _prev: CreateState,
  formData: FormData,
): Promise<CreateState> {
  let user;
  try {
    user = await getSessionUser();
  } catch {
    return { error: "로그인 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }
  if (!user) redirect("/login");

  const parsed = schema.safeParse({
    topic: formData.get("topic"),
    style: formData.get("style"),
    pageCount: formData.get("pageCount"),
    ageGroup: formData.get("ageGroup"),
    language: formData.get("language"),
    characterName: formData.get("characterName") ?? undefined,
    characterTraits: formData.get("characterTraits") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요." };
  }

  // Fail before persisting a book or opening checkout. Even local real payments
  // must never purchase mock illustrations; only the fully local demo may mock.
  const localDemo = isLocalDemoAllowed();
  if (resolveAiProvider() === "mock" && (!localDemo || isPolarConfigured)) {
    return { error: "AI 생성 서비스가 준비되지 않았습니다. 잠시 후 다시 시도해 주세요." };
  }
  if (!localDemo && (!isPolarConfigured || !env.polarWebhookSecret)) {
    return { error: "결제 서비스가 준비되지 않았습니다. 잠시 후 다시 시도해 주세요." };
  }

  const character = [
    parsed.data.characterName ? `이름: ${parsed.data.characterName}` : "",
    parsed.data.characterTraits ? `특징: ${parsed.data.characterTraits}` : "",
  ].filter(Boolean).join("; ");
  // The database topic is text; bounded fields keep the combined prompt <400 chars.
  const topic = character
    ? `${parsed.data.topic}\n\n주인공 설정: ${character}`
    : parsed.data.topic;

  let checkoutUrl: string;
  try {
    const book = await createBook({
      userId: user.id,
      topic,
      options: {
        style: parsed.data.style,
        pageCount: parsed.data.pageCount,
        ageGroup: parsed.data.ageGroup,
        language: parsed.data.language,
      },
    });
    const checkout = await createBookCheckout(book, user);
    checkoutUrl = checkout.url;
  } catch {
    // Upstream errors can contain payment credentials or private database data.
    return { error: "동화 결제를 준비하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }

  // Next.js redirect throws NEXT_REDIRECT, so it must remain outside try/catch.
  redirect(checkoutUrl);
}
