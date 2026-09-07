/** TEST ONLY isolated runner. No dependency install, migration, deploy or production writes.
 * --prepare copies current source/public to a new /tmp workspace, excluding .env/.next/.git.
 * --start ALSO starts local Next dev. Only the coordinating parent/operator should run it.
 * Never run npm run build: that project command runs migrations.
 */
import { cpSync, copyFileSync, constants, existsSync, mkdtempSync, mkdirSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { assertFixtureBase, startFixtureServer, FIXTURE_MARKER } from './gobibi-subpages-fixtures.mjs';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export function isolatedEnvironment(inherited, base, fixtureOrigin, guard) {
  assertFixtureBase(base, '1'); assertFixtureBase(fixtureOrigin, '1');
  return {
    PATH: inherited.PATH || '/usr/local/bin:/usr/bin:/bin', HOME: inherited.HOME || '/tmp', LANG: 'C.UTF-8',
    NODE_ENV: 'development', VERCEL_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1',
    NODE_OPTIONS: `--require=${guard}`, GOBIBI_QA_ISOLATED: '1',
    NEXT_PUBLIC_APP_URL: base, NEXT_PUBLIC_SUPABASE_URL: fixtureOrigin, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'gobibi-test-only-anon',
    // UI readiness only. Browser POST /api/printing/quote is fulfilled locally. The
    // egress preload still refuses Sweetbook if a request ever reaches the server.
    PRINTING_ENABLED: 'true', SWEETBOOK_ENV: 'sandbox', SWEETBOOK_API_KEY: 'TEST_ONLY_NOT_A_PROVIDER_KEY', PRINTING_APP_ORIGIN: base,
  };
}

export function prepareIsolatedProject(source = repository) {
  const root = mkdtempSync(join(tmpdir(), 'gobibi-subpages-isolated-'));
  for (const name of ['src', 'public']) cpSync(join(source, name), join(root, name), { recursive: true, mode: constants.COPYFILE_FICLONE });
  for (const name of ['package.json', 'package-lock.json', 'tsconfig.json', 'next-env.d.ts', 'next.config.ts', 'postcss.config.mjs']) {
    if (existsSync(join(source, name))) copyFileSync(join(source, name), join(root, name));
  }
  // --webpack below supports this existing dependency symlink; no install/download.
  symlinkSync(realpathSync(join(source, 'node_modules')), join(root, 'node_modules'), 'dir');
  mkdirSync(join(root, 'scripts'));
  for (const name of ['gobibi-subpages-fixtures.mjs', 'gobibi-subpages-egress.cjs']) copyFileSync(join(source, 'scripts', name), join(root, 'scripts', name));
  const marker = { fixture: FIXTURE_MARKER, root, source, createdAt: new Date().toISOString(), note: 'TEST ONLY snapshot; no dotenv, DB, real credentials, or deploy fixtures.' };
  writeFileSync(join(root, 'gobibi-qa-isolation.json'), JSON.stringify(marker, null, 2));
  return marker;
}

async function main() {
  if (!process.argv.includes('--prepare') && !process.argv.includes('--start')) {
    console.log('Usage: node scripts/gobibi-subpages-runner.mjs --prepare | --start\n--start: explicitly starts isolated Next dev + read-only loopback fixture; never production.');
    return;
  }
  const marker = prepareIsolatedProject();
  if (!process.argv.includes('--start')) { console.log(JSON.stringify(marker, null, 2)); return; }
  const port = Number(process.env.QA_APP_PORT || 3199);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('QA_APP_PORT must be 1024..65535');
  const base = `http://127.0.0.1:${port}`;
  const fixture = await startFixtureServer({ port: 0 });
  const env = isolatedEnvironment({ PATH: process.env.PATH, HOME: marker.root }, base, fixture.origin, join(marker.root, 'scripts/gobibi-subpages-egress.cjs'));
  const child = spawn(process.execPath, [join(marker.root, 'node_modules/next/dist/bin/next'), 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', String(port)], { cwd: marker.root, env, stdio: 'inherit' });
  const manifest = { ...marker, base, fixtureOrigin: fixture.origin, pid: child.pid, guard: true, syntheticPrintingReadiness: true };
  const manifestPath = join(marker.root, 'gobibi-qa-isolation.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({ ...manifest, manifestPath, run: `BASE=${base} QA_MODE=fixture GOBIBI_QA_ISOLATED=1 QA_MANIFEST=${manifestPath} node scripts/gobibi-subpages-browser.mjs` }, null, 2));
  let ending = false;
  const close = async () => {
    if (ending) return; ending = true;
    child.kill('SIGTERM');
    await fixture.close();
  };
  process.once('SIGINT', () => { void close(); });
  process.once('SIGTERM', () => { void close(); });
  child.once('error', error => { console.error(error); process.exitCode = 1; void close(); });
  child.once('exit', code => { process.exitCode = code || 0; void close(); });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
