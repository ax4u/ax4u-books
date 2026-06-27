import { promises as fs } from "node:fs";
import path from "node:path";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { pageImageDataUrl } from "@/lib/books/assets";
import type { Book } from "@/lib/books/types";

const PAGE_W = 595; // A4 portrait, points
const PAGE_H = 842;
const MARGIN = 48;

/**
 * Render a completed book into a PDF (cover + one page per spread).
 *
 * Korean (and other non-Latin) text needs an embedded Unicode font. The app
 * ships one in `public/fonts/`; otherwise we fall back to Helvetica and strip
 * characters it can't encode. We embed the Unicode font without subsetting
 * because some PDF viewers render subset Korean fonts incorrectly.
 */
export async function generateBookPdf(book: Book): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  const custom = await loadUnicodeFont();
  let font: PDFFont;
  let bold: PDFFont;
  let unicode = false;
  if (custom) {
    font = await doc.embedFont(custom, { subset: false });
    bold = font;
    unicode = true;
  } else {
    font = await doc.embedFont(StandardFonts.Helvetica);
    bold = await doc.embedFont(StandardFonts.HelveticaBold);
  }

  const safe = (s: string) => (unicode ? s : toWinAnsi(s));

  // ---- Cover ----
  const cover = doc.addPage([PAGE_W, PAGE_H]);
  cover.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_W,
    height: PAGE_H,
    color: rgb(0.97, 0.96, 0.99),
  });

  const firstImagePage = book.pages.find((p) => p.image || p.imagePath);
  const firstImage = firstImagePage ? await pageImageDataUrl(firstImagePage) : null;
  if (firstImage) {
    const img = await embedImage(doc, firstImage);
    if (img) {
      const size = PAGE_W - MARGIN * 2;
      drawImageFit(cover, img, MARGIN, PAGE_H - MARGIN - size, size, size);
    }
  }

  const title = safe(book.title || book.topic);
  drawWrapped(cover, title, bold, 28, {
    x: MARGIN,
    yTop: PAGE_H * 0.32,
    maxWidth: PAGE_W - MARGIN * 2,
    lineHeight: 36,
    color: rgb(0.15, 0.13, 0.3),
  });
  cover.drawText(safe("AX4U — AI Picture Book"), {
    x: MARGIN,
    y: MARGIN,
    size: 11,
    font,
    color: rgb(0.5, 0.5, 0.55),
  });

  // ---- Story pages ----
  for (const page of [...book.pages].sort((a, b) => a.index - b.index)) {
    const pdfPage = doc.addPage([PAGE_W, PAGE_H]);
    pdfPage.drawRectangle({
      x: 0,
      y: 0,
      width: PAGE_W,
      height: PAGE_H,
      color: rgb(1, 1, 1),
    });

    const imgSize = PAGE_W - MARGIN * 2;
    const pageImage = await pageImageDataUrl(page);
    if (pageImage) {
      const img = await embedImage(doc, pageImage);
      if (img) {
        drawImageFit(
          pdfPage,
          img,
          MARGIN,
          PAGE_H - MARGIN - imgSize,
          imgSize,
          imgSize,
        );
      }
    }

    drawWrapped(pdfPage, safe(page.text), font, 15, {
      x: MARGIN,
      yTop: PAGE_H - MARGIN - imgSize - 28,
      maxWidth: PAGE_W - MARGIN * 2,
      lineHeight: 22,
      color: rgb(0.1, 0.1, 0.12),
    });

    pdfPage.drawText(String(page.index + 1), {
      x: PAGE_W / 2,
      y: MARGIN / 2,
      size: 10,
      font,
      color: rgb(0.6, 0.6, 0.6),
    });
  }

  return doc.save();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadUnicodeFont(): Promise<Buffer | null> {
  const dir = path.join(process.cwd(), "public", "fonts");
  try {
    const files = await fs.readdir(dir);
    const candidates = files
      .filter((f) => /\.(ttf|otf)$/i.test(f))
      .sort(compareFontPriority);
    const font = candidates[0];
    if (!font) return null;
    return await fs.readFile(path.join(dir, font));
  } catch {
    return null;
  }
}

function compareFontPriority(a: string, b: string): number {
  return fontPriority(a) - fontPriority(b) || a.localeCompare(b);
}

function fontPriority(name: string): number {
  const lower = name.toLowerCase();
  if (lower.includes("noto") && lower.includes("kr")) return 0;
  if (lower.includes("nanum")) return 1;
  if (lower.includes("kr") || lower.includes("korean")) return 2;
  return 3;
}

async function embedImage(
  doc: PDFDocument,
  dataUrl: string,
): Promise<PDFImage | null> {
  try {
    const match = dataUrl.match(/^data:(image\/\w+);base64,(.*)$/s);
    if (!match) return null;
    const [, mime, b64] = match;
    const bytes = Buffer.from(b64, "base64");
    return mime.includes("jpeg") || mime.includes("jpg")
      ? await doc.embedJpg(bytes)
      : await doc.embedPng(bytes);
  } catch (err) {
    console.error("[pdf] failed to embed image:", err);
    return null;
  }
}

function drawImageFit(
  page: ReturnType<PDFDocument["addPage"]>,
  img: PDFImage,
  x: number,
  y: number,
  boxW: number,
  boxH: number,
) {
  const scale = Math.min(boxW / img.width, boxH / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  page.drawImage(img, {
    x: x + (boxW - w) / 2,
    y: y + (boxH - h) / 2,
    width: w,
    height: h,
  });
}

function drawWrapped(
  page: ReturnType<PDFDocument["addPage"]>,
  text: string,
  font: PDFFont,
  size: number,
  opts: {
    x: number;
    yTop: number;
    maxWidth: number;
    lineHeight: number;
    color: ReturnType<typeof rgb>;
  },
) {
  const lines = wrapText(text, font, size, opts.maxWidth);
  let y = opts.yTop;
  for (const line of lines) {
    page.drawText(line, { x: opts.x, y, size, font, color: opts.color });
    y -= opts.lineHeight;
  }
}

/** Word-wrap that also handles space-less scripts (e.g. Korean) per-character. */
function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    const tokens = paragraph.includes(" ")
      ? paragraph.split(/(\s+)/)
      : [...paragraph];
    let current = "";
    for (const token of tokens) {
      const candidate = current + token;
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
        lines.push(current.trimEnd());
        current = token.trimStart();
      } else {
        current = candidate;
      }
    }
    if (current.trim()) lines.push(current.trimEnd());
  }
  return lines;
}

/** Strip characters Helvetica (WinAnsi) cannot encode, to avoid throwing. */
function toWinAnsi(s: string): string {
  // Keep printable ASCII + common Latin-1; replace the rest with a space.
  return s.replace(/[^\u0000-\u00ff]/g, (ch) => (/\s/.test(ch) ? " " : ""));
}
