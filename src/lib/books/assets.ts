import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/env";
import type { BookPage } from "./types";

const BUCKET = "book-assets";

type ParsedDataUrl = {
  mimeType: string;
  bytes: Buffer;
};

export type StoredAsset = {
  path: string;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
};

export async function storePageImage(
  bookId: string,
  pageIndex: number,
  dataUrl: string,
): Promise<StoredAsset | null> {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed || !isSupabaseAdminConfigured) return null;

  const path = `books/${bookId}/pages/${pageIndex}.${extensionForMime(
    parsed.mimeType,
  )}`;
  return uploadAsset(path, parsed);
}

export async function storeBookPdf(
  bookId: string,
  pdf: Uint8Array,
): Promise<string | null> {
  if (!isSupabaseAdminConfigured) return null;
  const path = `books/${bookId}/book.pdf`;
  const stored = await uploadAsset(path, {
    mimeType: "application/pdf",
    bytes: Buffer.from(pdf),
  });
  return stored.path;
}

export async function readStoredAsset(path: string): Promise<{
  bytes: Buffer;
  mimeType: string;
} | null> {
  if (!isSupabaseAdminConfigured) return null;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase!.storage.from(BUCKET).download(path);
  if (error) throw new Error(`readStoredAsset: ${error.message}`);
  if (!data) return null;

  const bytes = Buffer.from(await data.arrayBuffer());
  return {
    bytes,
    mimeType: data.type || mimeForPath(path),
  };
}

export async function pageImageDataUrl(page: BookPage): Promise<string | null> {
  if (page.image) return page.image;
  if (!page.imagePath) return null;

  const asset = await readStoredAsset(page.imagePath);
  if (!asset) return null;
  return `data:${asset.mimeType};base64,${asset.bytes.toString("base64")}`;
}

export function dataUrlToBuffer(dataUrl: string): ParsedDataUrl | null {
  return parseDataUrl(dataUrl);
}

export function bufferToArrayBuffer(bytes: Buffer): ArrayBuffer {
  const body = new Uint8Array(bytes.byteLength);
  body.set(bytes);
  return body.buffer;
}

async function uploadAsset(
  path: string,
  parsed: ParsedDataUrl,
): Promise<StoredAsset> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase!.storage
    .from(BUCKET)
    .upload(path, parsed.bytes, {
      cacheControl: "31536000",
      contentType: parsed.mimeType,
      upsert: true,
    });
  if (error) throw new Error(`uploadAsset: ${error.message}`);

  const dimensions = imageDimensions(parsed.mimeType, parsed.bytes);
  return {
    path,
    mimeType: parsed.mimeType,
    byteSize: parsed.bytes.byteLength,
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null,
  };
}

function parseDataUrl(dataUrl: string): ParsedDataUrl | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/s);
  if (!match) return null;
  return {
    mimeType: match[1],
    bytes: Buffer.from(match[2], "base64"),
  };
}

function extensionForMime(mimeType: string): string {
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("pdf")) return "pdf";
  return "png";
}

function mimeForPath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".pdf")) return "application/pdf";
  return "image/png";
}

function imageDimensions(
  mimeType: string,
  bytes: Buffer,
): { width: number; height: number } | null {
  if (mimeType.includes("png") && bytes.length >= 24) {
    return {
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
    };
  }

  if (
    (mimeType.includes("jpeg") || mimeType.includes("jpg")) &&
    bytes.length >= 4
  ) {
    return jpegDimensions(bytes);
  }

  return null;
}

function jpegDimensions(bytes: Buffer): { width: number; height: number } | null {
  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    const length = bytes.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        height: bytes.readUInt16BE(offset + 5),
        width: bytes.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + length;
  }
  return null;
}
