import { getSessionUser } from "@/lib/auth";
import {
  bufferToArrayBuffer,
  dataUrlToBuffer,
  readStoredAsset,
} from "@/lib/books/assets";
import { persistInlinePageImage } from "@/lib/books/legacy";
import { getBook } from "@/lib/books/store";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string; index: string }> },
) {
  const { id, index } = await ctx.params;
  const pageIndex = Number(index);
  if (!Number.isInteger(pageIndex) || pageIndex < 0) {
    return new Response("Invalid page index", { status: 400 });
  }

  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const book = await getBook(id);
  if (!book || book.userId !== user.id) {
    return new Response("Not found", { status: 404 });
  }

  const page = book.pages.find((p) => p.index === pageIndex);
  if (!page) return new Response("Not found", { status: 404 });

  if (page.image) {
    const parsed = dataUrlToBuffer(page.image);
    if (!parsed) return new Response("Invalid image", { status: 422 });
    await persistInlinePageImage(book, page).catch((err) => {
      console.warn("[books] inline image migration skipped:", err);
    });
    return assetResponse(parsed.bytes, parsed.mimeType);
  }

  if (!page.imagePath) return new Response("Not found", { status: 404 });
  const asset = await readStoredAsset(page.imagePath);
  if (!asset) return new Response("Not found", { status: 404 });
  return assetResponse(asset.bytes, asset.mimeType);
}

function assetResponse(bytes: Buffer, mimeType: string) {
  return new Response(bufferToArrayBuffer(bytes), {
    headers: {
      "Cache-Control": "private, max-age=300",
      "Content-Length": String(bytes.byteLength),
      "Content-Type": mimeType,
    },
  });
}
