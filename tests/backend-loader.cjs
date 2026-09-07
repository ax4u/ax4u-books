/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS test harness. */
// Execute real TypeScript route/service code with explicit offline boundaries.
// Never load .env files, real service clients or AI providers in this harness.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function load(entry, mocks = {}, runtime = {}) {
  const cache = new Map();
  function visit(file) {
    file = path.resolve(root, file);
    if (!path.extname(file)) file += '.ts';
    if (cache.has(file)) return cache.get(file).exports;
    // eslint-disable-next-line @next/next/no-assign-module-variable -- Isolated CJS module object in the test VM, not Next runtime.
    const module = { exports: {} };
    cache.set(file, module);
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
      fileName: file,
    }).outputText;
    const localRequire = (id) => {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (id === '@/lib/env' || id.includes('/supabase/') || id.includes('/ai/') || id === '@polar-sh/sdk/webhooks') {
        throw new Error(`Unmocked external boundary: ${id}`);
      }
      if (id.startsWith('@/')) return visit('src/' + id.slice(2));
      if (id.startsWith('.')) return visit(path.resolve(path.dirname(file), id));
      return require(id);
    };
    const compile = vm.runInThisContext(`(function(require,module,exports,process){${source}\n})`, { filename: file });
    compile(localRequire, module, module.exports, { env: { NODE_ENV: 'test', ...runtime } });
    return module.exports;
  }
  return visit(entry);
}
module.exports = { load };
