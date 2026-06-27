"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { createBook } from "@/lib/books/store";
import { createBookCheckout } from "@/lib/polar/checkout";

const schema = z.object({
  topic: z.string().min(2, "주제를 조금 더 자세히 입력해 주세요.").max(200),
  style: z.string().min(1).max(40),
  pageCount: z.coerce.number().int().min(4).max(16),
  ageGroup: z.string().min(1).max(20),
  language: z.string().min(1).max(20),
});

export type CreateState = { error?: string };

export async function createBookAction(
  _prev: CreateState,
  formData: FormData,
): Promise<CreateState> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const parsed = schema.safeParse({
    topic: formData.get("topic"),
    style: formData.get("style"),
    pageCount: formData.get("pageCount"),
    ageGroup: formData.get("ageGroup"),
    language: formData.get("language"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요." };
  }

  const book = await createBook({
    userId: user.id,
    topic: parsed.data.topic,
    options: {
      style: parsed.data.style,
      pageCount: parsed.data.pageCount,
      ageGroup: parsed.data.ageGroup,
      language: parsed.data.language,
    },
  });

  const { url } = await createBookCheckout(book, user);
  redirect(url);
}
