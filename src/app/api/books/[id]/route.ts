import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { deleteBookAssets } from "@/lib/books/assets";
import { deleteBook, getBook, updateBook } from "@/lib/books/store";

const updateSchema = z.object({
  title: z.string().max(120).nullable().optional(),
  pages: z
    .array(
      z.object({
        index: z.number().int().min(0),
        text: z.string().min(1).max(2000),
        imagePrompt: z.string().max(4000).nullable().optional(),
      }),
    )
    .optional(),
});

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const book = await getBook(id);
  if (!book || book.userId !== user.id) {
    return new Response("Not found", { status: 404 });
  }

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload" },
      { status: 400 },
    );
  }

  const patches = new Map(
    (parsed.data.pages ?? []).map((page) => [page.index, page]),
  );
  const pages = book.pages.map((page) => {
    const patch = patches.get(page.index);
    if (!patch) return page;
    return {
      ...page,
      text: patch.text.trim(),
      imagePrompt: patch.imagePrompt?.trim() || page.imagePrompt,
    };
  });

  const updated = await updateBook(id, {
    title: parsed.data.title === undefined ? book.title : parsed.data.title,
    pages,
    pdfPath: null,
  });

  return Response.json({ ok: true, book: updated });
}

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const book = await getBook(id);
  if (!book || book.userId !== user.id) {
    return new Response("Not found", { status: 404 });
  }

  await deleteBookAssets(book).catch((err) => {
    console.warn(`[books] asset cleanup failed for ${id}:`, err);
  });
  await deleteBook(id, { userId: user.id });

  return Response.json({ ok: true });
}
