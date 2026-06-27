import { getSessionUser } from "@/lib/auth";
import { bufferToArrayBuffer, readStoredAsset } from "@/lib/books/assets";
import { getBook } from "@/lib/books/store";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const book = await getBook(id);
  if (!book || book.userId !== user.id || !book.coverImagePath) {
    return new Response("Not found", { status: 404 });
  }

  const asset = await readStoredAsset(book.coverImagePath);
  if (!asset) return new Response("Not found", { status: 404 });

  return new Response(bufferToArrayBuffer(asset.bytes), {
    headers: {
      "Cache-Control": "private, max-age=300",
      "Content-Length": String(asset.bytes.byteLength),
      "Content-Type": asset.mimeType,
    },
  });
}
