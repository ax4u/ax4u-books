import { chromium } from '/home/hermes/.hermes/profiles/sejongchief/workspace/imageclass_flipbook/browser-runtime/node_modules/playwright/index.mjs';
import * as THREE from 'three';
import { capsuleSeparation } from '../src/app/whale-flight/pod-physics.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base = process.env.BASE || 'http://127.0.0.1:3230';
const output = process.env.QA_OUTPUT || '/home/hermes/.hermes/profiles/sejongchief/cache/sky100-graceful-qa';
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: '/home/hermes/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome', headless: true,
  args: ['--no-sandbox', '--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const expected = { blue: 20, humpback: 20, sperm: 20, orca: 20, porpoise: 20 };
const results = [], errors = [], snapshots = [];
async function sample(page) { return page.locator('canvas').evaluate(c => ({ ...c.dataset })); }
function check(d) {
  const animals = JSON.parse(d.whaleModels);
  assert.equal(animals.length, 100); assert.deepEqual(JSON.parse(d.whaleCounts), expected);
  assert.equal(new Set(animals.map(x => x.modeluuid)).size, 100);
  assert.equal(new Set(animals.map(x => x.rootuuid)).size, 100);
  assert.equal(d.cameraMode, 'quiet-observer'); assert.equal(d.motionEdition, 'graceful-v2');
  assert.equal(d.heroEye, undefined); assert.equal(d.cameraBlend, undefined);
  assert.deepEqual(JSON.parse(d.cameraPosition), [0, 0, 28]);
  assert.ok(Number(d.cameraFov) >= 52, 'no telephoto lens');
  const bodies = animals.map(x => ({
    spec: { id: x.id, species: x.species, length: x.colliderLength, radius: x.radius, mass: x.mass, speed: x.baseSpeed },
    position: new THREE.Vector3(...x.position), velocity: new THREE.Vector3(...x.velocity), quaternion: new THREE.Quaternion(...x.quaternion).normalize()
  }));
  let minSeparation = Infinity;
  for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) minSeparation = Math.min(minSeparation, capsuleSeparation(bodies[i], bodies[j]).distance);
  assert.ok(minSeparation > -.005, `rendered capsules overlap ${minSeparation}`);
  for (let i = 0; i < animals.length; i++) {
    const x = animals[i], b = bodies[i];
    assert.ok([...x.position, ...x.velocity, ...x.quaternion, x.animationTime].every(Number.isFinite));
    assert.ok(x.activitySamples >= 10); assert.ok(x.colliderLength >= x.visualExtent + 2 * x.radius - .00001);
    assert.ok(x.motionSample.length > 0); assert.notEqual(x.mode, 'sprint');
    assert.ok(new THREE.Vector3(0, 1, 0).applyQuaternion(b.quaternion).y > .92, 'upright whale, no tumbling');
    assert.ok(-x.position[2] > 70, 'normal viewing distance, no fly-into-camera');
  }
  return { animals, minSeparation, visible: animals.filter(x => x.visible).length };
}
try {
  const viewports = process.env.QA_QUICK ? [{ width: 1200, height: 750 }] : [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 844, height: 390 }];
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce',
      ...(process.env.QA_VIDEO ? { recordVideo: { dir: output + '/videos', size: { width: 1200, height: 750 } } } : {}) });
    const requests = [];
    if (base.includes('127.0.0.1')) await context.route('**/_vercel/insights/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    await context.route('**/api/**', r => { errors.push('UNEXPECTED_API ' + r.request().url()); return r.abort(); });
    context.on('request', r => { if (r.url().endsWith('.glb')) requests.push(r.url()); });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(base + '/whale-flight', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('canvas')?.dataset.flightReady === 'true', {}, { timeout: 60000 });
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('canvas')).opacity) > .999, {}, { timeout: 10000 });
    assert.equal(await page.locator('[data-species], [data-view="compare"], [data-whale-label]').count(), 0);
    const before = await sample(page), start = check(before);
    assert.ok(start.visible >= 75, `wide view should have distributed whales: ${start.visible}`);
    await page.screenshot({ path: `${output}/${viewport.width}x${viewport.height}-start.png` });
    snapshots.push({ viewport, phase: 'start', dataset: before });
    await page.getByRole('button', { name: '비행 시작', exact: true }).click();
    const wallStart = Date.now();
    const phases = process.env.QA_QUICK ? [2, 5] : [2, 5, 9];
    let latest;
    for (const seconds of phases) {
      await page.waitForFunction(t => Number(document.querySelector('canvas')?.dataset.flightTime) >= t, seconds, { timeout: 100000 });
      const d = await sample(page), current = check(d); latest = d;
      assert.equal(d.cameraFov, before.cameraFov, 'field of view stays unchanged throughout the old zoom cycle');
      assert.deepEqual(JSON.parse(d.cameraPosition), JSON.parse(before.cameraPosition));
      assert.ok(current.animals.every((x, i) => JSON.stringify(x.position) !== JSON.stringify(start.animals[i].position)), 'all 100 move independently');
      assert.ok(current.animals.every((x, i) => x.animationTime > start.animals[i].animationTime), 'all 100 fluke animations advance');
      for (const species of Object.keys(expected)) assert.ok(current.animals.filter(x => x.species === species).some(x =>
        JSON.stringify(x.motionSample) !== JSON.stringify(start.animals.find(y => y.id === x.id).motionSample)), species + ' native bone deformation');
      snapshots.push({ viewport, phase: seconds, dataset: d });
      await page.screenshot({ path: `${output}/${viewport.width}x${viewport.height}-${seconds}s.png` });
    }
    await page.mouse.move(viewport.width * .95, viewport.height * .9);
    await page.waitForTimeout(700);
    assert.deepEqual(JSON.parse((await sample(page)).cameraPosition), [0, 0, 28], 'pointer cannot start automatic camera movement');
    await page.getByRole('button', { name: '비행 일시정지', exact: true }).click();
    const paused = await sample(page); await page.waitForTimeout(400);
    assert.equal((await sample(page)).flightTime, paused.flightTime);
    assert.equal(requests.length, 4); assert.equal(new Set(requests).size, 4);
    results.push({ viewport, counts: expected, all100Move: true, all100Animate: true, all5Deform: true,
      cameraMode: latest.cameraMode, cameraFov: latest.cameraFov, cameraConstant: true, noEyeZoom: true,
      visible: start.visible, depthRange: JSON.parse(before.depthRange), minSeparation: check(latest).minSeparation,
      activeSeconds: Number(latest.flightTime), wallSeconds: (Date.now() - wallStart) / 1000,
      softwareWebGLFps: (Number(latest.flightFrames) - Number(before.flightFrames)) / ((Date.now() - wallStart) / 1000),
      drawCalls: Number(before.drawCalls), triangles: Number(before.triangles) });
    await fs.writeFile(output + '/snapshots.json', JSON.stringify(snapshots));
    await context.close();
  }
  assert.deepEqual(errors, []);
  const report = { status: 'PASS', base, results, errors };
  await fs.writeFile(output + '/result.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
} catch (error) {
  await fs.writeFile(output + '/failure.json', JSON.stringify({ base, error: String(error), stack: error.stack, results, errors }, null, 2));
  console.error(error); process.exitCode = 1;
} finally { await browser.close(); }
