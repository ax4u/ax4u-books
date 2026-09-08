import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// Run only read-only public requests. Set SHARE_BASES to comma-separated origins.
const bases = (process.env.SHARE_BASES || '').split(',').filter(Boolean);
assert.ok(bases.length, 'SHARE_BASES is required; e.g. http://127.0.0.1:3131');
for (const base of bases) assert.match(base, /^https?:\/\/[^/]+$/);
const assetPath = '/social/gobibi-keyvisual-v2.jpg';
const expectedImage = 'https://gobibi.art' + assetPath;
const expectedHash = createHash('sha256').update(readFileSync(new URL('../public' + assetPath, import.meta.url))).digest('hex');
const paths = ['/', '/exhibition', '/exhibition/planet-friends', '/login'];
const agents = {
  kakao: 'facebookexternalhit/1.1; kakaotalk-scrap/1.0',
  facebook: 'facebookexternalhit/1.1',
  twitter: 'Twitterbot/1.0',
  discord: 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
};
function metadata(html) {
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1];
  assert.ok(head, 'server-rendered head is required for non-JS crawlers');
  const tags = {};
  for (const tag of head.match(/<meta\b[^>]*>/gi) || []) {
    const attrs = Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
    const key = attrs.property || attrs.name;
    if (key) (tags[key] ||= []).push(attrs.content);
  }
  return tags;
}
async function get(url, ua) {
  const response = await fetch(url, {headers:{'User-Agent': ua}, signal:AbortSignal.timeout(45000), redirect:'error'});
  assert.equal(response.status, 200, url);
  return response;
}
const results = [];
for (const base of bases) {
  for (const [agent, ua] of Object.entries(agents)) {
    await Promise.all(paths.map(async path => {
      const response = await get(base + path, ua);
      const tags = metadata(await response.text());
      assert.deepEqual(tags['og:image'], [expectedImage], base + path + ' ' + agent);
      assert.deepEqual(tags['twitter:image'], [expectedImage]);
      assert.deepEqual(tags['og:image:width'], ['1200']);
      assert.deepEqual(tags['og:image:height'], ['630']);
      assert.deepEqual(tags['og:image:type'], ['image/jpeg']);
      assert.deepEqual(tags['twitter:card'], ['summary_large_image']);
      assert.ok(tags['og:title']?.[0]?.includes('GOBIBI'));
      assert.ok(tags['og:description']?.[0]);
      results.push({base, path, agent, image:expectedImage, pass:true});
    }));
  }
  const response = await get(base + assetPath, agents.kakao);
  assert.match(response.headers.get('content-type'), /^image\/jpeg/);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(createHash('sha256').update(bytes).digest('hex'), expectedHash, base + ' deployed image bytes');
  console.log(JSON.stringify({base, imageStatus:200, bytes:bytes.length, sha256:expectedHash, pass:true}));
}
console.log(JSON.stringify({verifiedAt:new Date().toISOString(), checks:results.length, passed:results.filter(r=>r.pass).length, results}, null, 2));
