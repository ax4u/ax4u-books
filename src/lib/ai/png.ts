import zlib from "node:zlib";

/**
 * Minimal dependency-free PNG encoder (8-bit RGB). Used to synthesize
 * placeholder illustrations in mock mode and as a fallback when an image API
 * call fails, so the rest of the pipeline (and the PDF) always has real bytes.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

type PixelFn = (x: number, y: number) => [number, number, number];

export function encodePng(
  width: number,
  height: number,
  pixel: PixelFn,
): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const raw = Buffer.alloc(height * (1 + width * 3));
  let o = 0;
  for (let y = 0; y < height; y++) {
    raw[o++] = 0; // filter type: none
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixel(x, y);
      raw[o++] = r & 0xff;
      raw[o++] = g & 0xff;
      raw[o++] = b & 0xff;
    }
  }
  const idat = zlib.deflateSync(raw);

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** A soft, deterministic gradient + dots illustration keyed by a seed string. */
export function placeholderIllustration(
  seed: string,
  width = 768,
  height = 768,
): Buffer {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  }
  const hue = (h >>> 0) % 360;
  const [r1, g1, b1] = hslToRgb(hue / 360, 0.55, 0.78);
  const [r2, g2, b2] = hslToRgb(((hue + 40) % 360) / 360, 0.6, 0.55);

  return encodePng(width, height, (x, y) => {
    const t = (x / width + y / height) / 2;
    let r = Math.round(r1 + (r2 - r1) * t);
    let g = Math.round(g1 + (g2 - g1) * t);
    let b = Math.round(b1 + (b2 - b1) * t);
    // Scatter a few soft highlight blobs.
    const bx = (h % 5) + 1;
    const cx = ((x * bx) % width) - width / 2;
    const cy = ((y * bx) % height) - height / 2;
    if (cx * cx + cy * cy < 2600) {
      r = Math.min(255, r + 40);
      g = Math.min(255, g + 40);
      b = Math.min(255, b + 40);
    }
    return [r, g, b];
  });
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h * 12) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [
    Math.round(f(0) * 255),
    Math.round(f(8) * 255),
    Math.round(f(4) * 255),
  ];
}
