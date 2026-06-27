import { getSessionUser } from "@/lib/auth";
import {
  bufferToArrayBuffer,
  readStoredAsset,
  storeBookPdf,
} from "@/lib/books/assets";
import { getBook, updateBook } from "@/lib/books/store";
import { generateBookPdf } from "@/lib/pdf/generate";

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
  if (book.status !== "completed") {
    return new Response("Book is not ready yet", { status: 409 });
  }

  const filename = `${(book.title || book.topic || "storybook")
    .replace(/[^\p{L}\p{N}_ -]/gu, "")
    .slice(0, 60)
    .trim() || "storybook"}.pdf`;

  if (book.pdfPath) {
    const cached = await readStoredAsset(book.pdfPath);
    if (cached) return pdfResponse(cached.bytes, filename);
  }

  const pdf = await generateBookPdf(book);
  const storedPath = await storeBookPdf(book.id, pdf);
  if (storedPath) {
    await updateBook(book.id, { pdfPath: storedPath });
  }

  return pdfResponse(Buffer.from(pdf), filename);
}

function pdfResponse(pdf: Buffer, filename: string) {
  return new Response(bufferToArrayBuffer(pdf), {
    status: 200,
    headers: {
      "Cache-Control": "private, max-age=300",
      "Content-Length": String(pdf.byteLength),
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
