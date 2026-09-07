/* TEST ONLY: preload in the isolated Next child. Not a deployable module. */
/* eslint-disable @typescript-eslint/no-require-imports */
const net = require('node:net');
const allowed = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
function check(host) {
  if (!allowed.has(String(host || 'localhost'))) throw new Error(`GOBIBI_QA_EGRESS_BLOCKED: ${host}`);
}
const originalConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const normalized = Array.isArray(args[0]) ? args[0] : args;
  const options = normalized[0];
  if (options && typeof options === 'object') {
    if (options.path) throw new Error('GOBIBI_QA_EGRESS_BLOCKED: unix socket');
    check(options.host || options.hostname || 'localhost');
  } else if (typeof options === 'number') check(typeof normalized[1] === 'string' ? normalized[1] : 'localhost');
  else throw new Error('GOBIBI_QA_EGRESS_BLOCKED: unknown socket target');
  return originalConnect.apply(this, args);
};
const originalFetch = globalThis.fetch;
globalThis.fetch = function (input, options) {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  check(url.hostname);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('GOBIBI_QA_EGRESS_BLOCKED: non-HTTP fetch');
  return originalFetch(input, options);
};
