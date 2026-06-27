/**
 * One-time migration for legacy books whose page images are stored as base64
 * data URLs inside books.pages. Uploads each image to Supabase Storage and
 * rewrites pages to store only private Storage paths.
 */
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const conn = process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING;
const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!conn || !supabaseUrl || !serviceRoleKey) {
  console.error(
    "[migrate-assets] POSTGRES_URL, SUPABASE_URL and service role key are required.",
  );
  process.exit(1);
}

const BUCKET = "book-assets";
const db = new pg.Client({
  connectionString: stripSslMode(conn),
  ssl: { rejectUnauthorized: false },
});
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

await db.connect();

try {
  const { rows } = await db.query(`
    select id, pages
    from public.books
    where pages::text like '%data:image/%'
    order by created_at asc
  `);

  console.log(`[migrate-assets] found ${rows.length} legacy books`);

  for (const row of rows) {
    const pages = Array.isArray(row.pages) ? row.pages : [];
    let changed = false;

    for (const page of pages) {
      if (!page?.image || page.imagePath) continue;
      const parsed = parseDataUrl(page.image);
      if (!parsed) continue;

      const path = `books/${row.id}/pages/${page.index}.${extensionForMime(
        parsed.mimeType,
      )}`;
      const { error } = await supabase.storage.from(BUCKET).upload(
        path,
        parsed.bytes,
        {
          cacheControl: "31536000",
          contentType: parsed.mimeType,
          upsert: true,
        },
      );
      if (error) throw new Error(`upload ${path}: ${error.message}`);

      const dimensions = imageDimensions(parsed.mimeType, parsed.bytes);
      page.image = null;
      page.imagePath = path;
      page.imageMime = parsed.mimeType;
      page.imageWidth = dimensions?.width ?? null;
      page.imageHeight = dimensions?.height ?? null;
      page.imageBytes = parsed.bytes.byteLength;
      changed = true;
    }

    if (!changed) continue;
    const cover = pages.find((page) => page.imagePath)?.imagePath ?? null;
    await db.query(
      `
        update public.books
        set pages = $2::jsonb,
            cover_image_path = $3,
            pdf_path = null,
            updated_at = now()
        where id = $1
      `,
      [row.id, JSON.stringify(pages), cover],
    );
    console.log(`[migrate-assets] migrated ${row.id}`);
  }

  console.log("[migrate-assets] complete");
} finally {
  await db.end().catch(() => {});
}

function stripSslMode(value) {
  try {
    const url = new URL(value);
    url.searchParams.delete("sslmode");
    url.searchParams.delete("ssl");
    return url.toString();
  } catch {
    return value;
  }
}

function parseDataUrl(dataUrl) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/s);
  if (!match) return null;
  return { mimeType: match[1], bytes: Buffer.from(match[2], "base64") };
}

function extensionForMime(mimeType) {
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  if (mimeType.includes("webp")) return "webp";
  return "png";
}

function imageDimensions(mimeType, bytes) {
  if (mimeType.includes("png") && bytes.length >= 24) {
    return {
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
    };
  }
  return null;
}
