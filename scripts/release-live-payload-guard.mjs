#!/usr/bin/env node
/**
 * Read-only, fail-closed release gate. Node >=24; no dependencies or network.
 * Inventory must be a retained COMPLETE live inventory, never regenerated from
 * the candidate. --old-public is the previous actual upload-stage/public, not
 * a git checkout (git cannot preserve untracked live payload).
 *
 * Source preflight: node scripts/release-live-payload-guard.mjs \
 *   --baseline-inventory /absolute/inventory-baseline.json \
 *   --old-public /absolute/previous/upload-stage/public
 * Final payload gate: add --candidate-public /absolute/new/upload-stage/public
 * and --candidate-catalog /absolute/new/upload-stage/src/lib/exhibition/public-books.json.
 * --candidate-site defaults to this script's site. JSON evidence goes to stdout;
 * optional --output FILE writes the same report. Exit 0=pass, 1=blocked.
 * A source-only pass is NOT certification of a staged/deployed payload.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

const APPROVED = {
  'love-treatment-epilogue': 43,
  'mom-dreamed-grownup': 27,
  'sangmung-haeon-back-to-sea': 65,
  'buildergarlic-garlic-robot-alli': 16,
  'sangmung-paper-boat-promise': 35,
  'bori-first-water-play': 29,
  'team04-huchu-berry': 34,
  'susu-popcorn-shop': 30,
};
// Deliberately narrow: policy changes require review, not an ad-hoc ignore flag.
const IGNORE_POLICY = [
  'public/exhibition/**', 'node_modules', '.git', '.next', '.vercel', '.env*',
  'coverage', 'out', 'build', '*.pem', '*.tsbuildinfo', 'scripts/finish-exhibition.ts',
];
const report = {
  schemaVersion: 1, guard: 'release-live-payload', at: new Date().toISOString(),
  ok: false, mode: null, inputs: {}, checks: {}, books: [], assets: [],
  excludedSourceFiles: [], failures: [],
};
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
// Live inventory hashes the schema-parsed object. Zod emits schema key order,
// which differs from source JSON for coverPageIndex/reviewNotice. Reorder only:
// never trim, drop unknown fields, or coerce values (those must fail the hash).
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
function metadataHash(book, version) {
  if (version === 'canonical-json-v1') return hash(JSON.stringify(canonical(book)));
  const reorder = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries([...keys.filter(k => Object.hasOwn(value, k)), ...Object.keys(value).filter(k => !keys.includes(k))].map(k => [k, value[k]]))
    : value;
  const value = reorder(book, ['slug', 'title', 'description', 'author', 'cover', 'coverPageIndex', 'reviewNotice', 'fullCover', 'readingPdf', 'pages']);
  const pageKeys = ['src', 'width', 'height', 'label'];
  for (const key of ['cover', 'fullCover']) if (Object.hasOwn(value, key)) value[key] = reorder(value[key], pageKeys);
  if (Array.isArray(value.pages)) value.pages = value.pages.map(page => reorder(page, pageKeys));
  return hash(JSON.stringify(value));
}
const fail = (code, detail) => report.failures.push({ code, detail });
function check(ok, code, detail) { if (!ok) fail(code, detail); return ok; }
function options(args) {
  const allowed = new Set(['baseline-inventory', 'old-public', 'candidate-site', 'candidate-public', 'candidate-catalog', 'output']);
  const out = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].slice(2);
    if (!args[i].startsWith('--') || !allowed.has(key) || !args[i + 1] || args[i + 1].startsWith('--') || key in out) {
      throw new Error(`Unknown, duplicate or incomplete argument: ${args[i]}`);
    }
    out[key] = path.resolve(args[i + 1]);
  }
  if (!out['baseline-inventory'] || !out['old-public']) throw new Error('--baseline-inventory and --old-public are required');
  out['candidate-site'] ??= path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  out['candidate-catalog'] ??= path.join(out['candidate-public'] ? path.dirname(out['candidate-public']) : out['candidate-site'], 'src/lib/exhibition/public-books.json');
  return out;
}
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function safeAsset(src) {
  return typeof src === 'string' && src.startsWith('/') && !/[\\%?#\x00-\x1f]/.test(src)
    && src.slice(1).split('/').every(part => part && part !== '.' && part !== '..');
}
function forbidden(src) {
  return /(?:^|\/)(?:exhibition|planet-friends|private(?:[-_][^/]*)?|originals?|\.git|\.next|\.vercel|node_modules)(?:\/|$)/i.test(src)
    || /(?:^|\/)\.env[^/]*$|\.(?:pem|key)$/i.test(src);
}
function walk(root, label) {
  const result = new Map();
  if (!fs.lstatSync(root).isDirectory() || fs.lstatSync(root).isSymbolicLink()) throw new Error(`${label}: root must be a real directory`);
  function visit(dir, rel = '') {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const name = `${rel}/${entry.name}`;
      const file = path.join(dir, entry.name);
      if (!safeAsset(name)) { fail('UNSAFE_PATH', `${label}:${name}`); continue; }
      if (entry.isSymbolicLink()) { fail('SYMLINK_FORBIDDEN', `${label}:${name}`); continue; }
      if (entry.isDirectory()) visit(file, name);
      else if (entry.isFile()) {
        const bytes = fs.readFileSync(file);
        result.set(name, { path: name, size: bytes.length, sha256: hash(bytes) });
      } else fail('SPECIAL_FILE_FORBIDDEN', `${label}:${name}`);
    }
  }
  visit(root);
  return result;
}
function compareAsset(actual, expected, code, label) {
  return check(actual && actual.size === expected.size && actual.sha256 === expected.sha256, code, `${label}:${expected.path}`);
}
function main(opts) {
  report.inputs = { ...opts };
  report.mode = opts['candidate-public'] ? 'staged-payload-and-source' : 'source-preflight-only';
  const baselineBytes = fs.readFileSync(opts['baseline-inventory']);
  const baseline = JSON.parse(baselineBytes);
  const version = baseline.metadataHashVersion;
  if (!check(version === undefined || version === 'canonical-json-v1', 'BASELINE_HASH_VERSION_UNSUPPORTED', String(version))) return;
  report.inputs.metadataHashVersion = version ?? 'legacy-live-schema-json';
  const candidate = readJson(opts['candidate-catalog']);
  const sourceCatalog = readJson(path.join(opts['candidate-site'], 'src/lib/exhibition/public-books.json'));
  report.inputs.baselineSha256 = hash(baselineBytes);
  report.inputs.candidateCatalogSha256 = hash(fs.readFileSync(opts['candidate-catalog']));
  if (!check(baseline.complete === true && Array.isArray(baseline.books) && Array.isArray(baseline.assets) && Array.isArray(baseline.catalogSlugs), 'BASELINE_INCOMPLETE', 'Require completed inventory with books, assets and catalogSlugs')) return;
  if (!check(Array.isArray(candidate) && Array.isArray(sourceCatalog), 'CATALOG_INVALID', 'Catalogs must be arrays')) return;
  const approved = Object.keys(APPROVED);
  check(isDeepStrictEqual(baseline.catalogSlugs, approved) && isDeepStrictEqual(baseline.books.map(b => b.slug), approved), 'BASELINE_APPROVED_BOOKS', 'Baseline must contain all eight approved books in order, including susu-popcorn-shop');
  check(isDeepStrictEqual(candidate.map(b => b?.slug), baseline.catalogSlugs), 'CATALOG_SLUGS_MISMATCH', { expected: baseline.catalogSlugs, actual: candidate.map(b => b?.slug) });
  check(isDeepStrictEqual(sourceCatalog.map(b => b?.slug), baseline.catalogSlugs), 'SOURCE_SLUGS_MISMATCH', 'Source must contain every approved live book in order');
  check(isDeepStrictEqual(candidate, sourceCatalog), 'SOURCE_CATALOG_MISMATCH', 'Candidate catalog must exactly equal source catalog');
  const inventoryAssets = new Map();
  for (const asset of baseline.assets) {
    if (!check(safeAsset(asset.path) && !forbidden(asset.path) && Number.isSafeInteger(asset.size) && asset.size > 0 && /^[a-f0-9]{64}$/.test(asset.sha256 ?? ''), 'BASELINE_ASSET_INVALID', asset.path)) continue;
    check(!inventoryAssets.has(asset.path), 'BASELINE_DUPLICATE_ASSET', asset.path);
    inventoryAssets.set(asset.path, asset);
  }
  const references = new Set();
  for (const expected of baseline.books) {
    check(/^[a-f0-9]{64}$/.test(expected.metadataHash ?? ''), 'BASELINE_METADATA_HASH_INVALID', expected.slug);
    if (version === 'canonical-json-v1') {
      check(expected.metadata && metadataHash(expected.metadata, version) === expected.metadataHash, 'BASELINE_METADATA_HASH_DRIFT', expected.slug);
      check(expected.metadata?.slug === expected.slug && expected.metadata?.title === expected.title && isDeepStrictEqual(expected.metadata?.pages, expected.pages), 'BASELINE_METADATA_INCONSISTENT', expected.slug);
    }
    check(expected.count === APPROVED[expected.slug] && Array.isArray(expected.pages) && expected.pages.length === expected.count, 'BASELINE_PAGE_COUNT', expected.slug);
    const book = candidate.find(b => b?.slug === expected.slug);
    const source = sourceCatalog.find(b => b?.slug === expected.slug);
    for (const [label, value] of [['candidate', book], ['source', source]]) {
      if (!check(Boolean(value), 'APPROVED_BOOK_MISSING', `${label}:${expected.slug}`)) continue;
      // Compare every field; canonicalization changes key order, never values.
      check(metadataHash(value, version) === expected.metadataHash, 'FULL_METADATA_MISMATCH', `${label}:${expected.slug}`);
      if (version === 'canonical-json-v1') check(isDeepStrictEqual(value, expected.metadata), 'FULL_METADATA_OBJECT_MISMATCH', `${label}:${expected.slug}`);
      check(Array.isArray(value.pages) && value.pages.length === expected.count, 'PAGE_COUNT_MISMATCH', `${label}:${expected.slug}`);
      check(isDeepStrictEqual(value.pages, expected.pages), 'PAGE_ORDER_OR_METADATA_MISMATCH', `${label}:${expected.slug}`);
    }
    if (!book || !Array.isArray(book.pages)) continue;
    const refs = [book.cover?.src, ...book.pages.map(p => p?.src), ...(book.fullCover ? [book.fullCover.src] : []), ...(book.readingPdf ? [book.readingPdf] : [])];
    for (const src of refs) {
      if (!check(safeAsset(src) && !forbidden(src) && src.startsWith(`/published-exhibition/${expected.slug}/`), 'CATALOG_ASSET_PATH_INVALID', String(src))) continue;
      references.add(src);
      check(inventoryAssets.has(src), 'BASELINE_REFERENCE_UNHASHED', src);
    }
    check(new Set(book.pages.map(p => p?.src)).size === book.pages.length, 'DUPLICATE_PAGE', expected.slug);
    report.books.push({ slug: expected.slug, pages: book.pages.length, metadataSha256: metadataHash(book, version), expectedMetadataSha256: expected.metadataHash, orderedSources: book.pages.map(p => p.src) });
  }
  const ignore = fs.readFileSync(path.join(opts['candidate-site'], '.vercelignore'), 'utf8').split(/\r?\n/).map(x => x.trim()).filter(x => x && !x.startsWith('#'));
  check(isDeepStrictEqual([...ignore].sort(), [...IGNORE_POLICY].sort()), 'PRIVATE_EXCLUSION_POLICY_CHANGED', { expected: IGNORE_POLICY, actual: ignore });
  const old = walk(opts['old-public'], 'old-public');
  const source = walk(path.join(opts['candidate-site'], 'public'), 'source-public');
  const effectiveSource = new Map();
  for (const [src, asset] of source) {
    if (src.startsWith('/exhibition/')) report.excludedSourceFiles.push(src);
    else effectiveSource.set(src, asset);
  }
  const payload = opts['candidate-public'] ? walk(opts['candidate-public'], 'candidate-public') : effectiveSource;
  for (const [label, files] of [['old-public', old], ['effective-source', effectiveSource], ['candidate-public', payload]]) {
    for (const src of files.keys()) check(!forbidden(src), 'PRIVATE_PAYLOAD_FORBIDDEN', `${label}:${src}`);
  }
  // All public files, not only the live image inventory: music, attachments,
  // fonts, GLBs, social images, and future retained assets are byte-preserved.
  for (const [src, expected] of old) {
    const sourceOK = compareAsset(effectiveSource.get(src), expected, 'SOURCE_ASSET_MISSING_OR_CHANGED', 'source');
    const payloadOK = compareAsset(payload.get(src), expected, 'PAYLOAD_ASSET_MISSING_OR_CHANGED', 'payload');
    report.assets.push({ ...expected, sourceOK, payloadOK, liveInventoried: inventoryAssets.has(src) });
  }
  // Exact set prevents a new private/original file being quietly uploaded under
  // an innocuous name. New public assets require an explicit baseline review.
  for (const [label, files] of [['source', effectiveSource], ['payload', payload]]) {
    for (const src of files.keys()) check(old.has(src), 'UNAPPROVED_PUBLIC_ASSET', `${label}:${src}`);
  }
  for (const asset of inventoryAssets.values()) {
    compareAsset(old.get(asset.path), asset, 'OLD_PAYLOAD_BASELINE_DRIFT', 'old-public');
    compareAsset(effectiveSource.get(asset.path), asset, 'SOURCE_BASELINE_DRIFT', 'source');
    compareAsset(payload.get(asset.path), asset, 'PAYLOAD_BASELINE_DRIFT', 'payload');
  }
  report.inputs.oldPublicManifestSha256 = hash(JSON.stringify([...old.values()].sort((a, b) => a.path.localeCompare(b.path))));
  report.checks = {
    approvedBooks: approved.length, candidateBooks: candidate.length,
    orderedPages: report.books.reduce((sum, book) => sum + book.pages, 0),
    referencedBookAssets: references.size, liveInventoryAssets: inventoryAssets.size,
    oldPublicAssets: old.size, sourcePublicAssets: source.size,
    effectiveSourceAssets: effectiveSource.size, candidatePublicAssets: payload.size,
    retainedAssetsOutsidePublishedBooks: [...old.keys()].filter(src => !src.startsWith('/published-exhibition/')).length,
    excludedSourceFiles: report.excludedSourceFiles.length,
    privateExclusions: 'Exact .vercelignore policy; no /exhibition originals in staged payload; no private/withdrawn or extra public assets; no symlinks',
    payloadInspected: Boolean(opts['candidate-public']),
  };
}

if (process.argv.slice(2).includes('--help')) {
  console.log('Usage: node release-live-payload-guard.mjs --baseline-inventory FILE --old-public DIR [--candidate-site DIR] [--candidate-catalog FILE] [--candidate-public DIR] [--output FILE]\nSource-only pass is preflight, not staged payload certification. Final gate must specify --candidate-public and staged --candidate-catalog. Exit 0=pass, 1=blocked. Node >=24.');
} else {
  let opts;
  try {
    opts = options(process.argv.slice(2));
    // Evidence must not overwrite any inspected input or source file.
    if (opts.output) {
      const output = path.resolve(fs.realpathSync(path.dirname(opts.output)), path.basename(opts.output));
      const protectedPaths = [opts['candidate-site'], opts['old-public'], opts['candidate-public'], opts['candidate-catalog'], opts['baseline-inventory']].filter(Boolean).map(p => fs.realpathSync(p));
      if (protectedPaths.some(p => output === p || output.startsWith(p + path.sep)) || (fs.existsSync(output) && fs.lstatSync(output).isSymbolicLink())) throw new Error('--output must be outside inspected input paths and cannot be a symlink');
    }
    main(opts);
  } catch (error) { fail('GUARD_INPUT_OR_IO_ERROR', error.message); }
  report.ok = report.failures.length === 0;
  let text = JSON.stringify(report, null, 2) + '\n';
  if (opts?.output && report.inputs['baseline-inventory']) {
    try { fs.writeFileSync(opts.output, text); }
    catch (error) { fail('EVIDENCE_WRITE_FAILED', error.message); report.ok = false; text = JSON.stringify(report, null, 2) + '\n'; }
  }
  process.stdout.write(text);
  process.exitCode = report.ok ? 0 : 1;
}
