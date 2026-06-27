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
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const book = await getBook(id);
  if (!book || book.userId !== user.id) {
    return new Response("Not found", { status: 404 });
  }

  const coverPage = [...book.pages]
    .sort((a, b) => a.index - b.index)
    .find((page) => page.imagePath || page.image);
  const paths = [
    book.coverImagePath,
    ...book.pages
      .sort((a, b) => a.index - b.index)
      .map((page) => page.imagePath),
  ].filter((path, index, all): path is string =>
    Boolean(path && all.indexOf(path) === index),
  );

  for (const path of paths) {
    try {
      const asset = await readStoredAsset(path);
      if (asset) return assetResponse(asset.bytes, asset.mimeType);
    } catch {
      // Try the next known image path; old rows may contain stale cover paths.
    }
  }

  if (coverPage?.image) {
    const parsed = dataUrlToBuffer(coverPage.image);
    if (!parsed) return new Response("Invalid image", { status: 422 });
    await persistInlinePageImage(book, coverPage).catch((err) => {
      console.warn("[books] inline cover migration skipped:", err);
    });
    return assetResponse(parsed.bytes, parsed.mimeType);
  }

  return new Response("Not found", { status: 404 });
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
