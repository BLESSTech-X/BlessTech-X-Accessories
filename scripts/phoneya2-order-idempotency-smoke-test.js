#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'functions', 'api', 'orders.js'), 'utf8')
  .replace(/^export\s+async\s+function/gm, 'async function');

const databaseUrl = 'https://db.test';
const siteUrl = 'https://phoneya2.pages.dev';
const idempotencyKey = '123e4567-e89b-42d3-a456-426614174000';
const body = {
  name: 'Test Customer',
  email: 'test@example.com',
  phone: '+260977000000',
  address: 'Test address, Lusaka',
  note: '',
  items: [{ slug: 'emoji-📱', quantity: 1 }],
  idempotency_key: idempotencyKey
};
const canonicalRequest = {
  name: body.name.trim(),
  email: body.email.trim().toLowerCase(),
  phone: body.phone.trim(),
  address: body.address.trim(),
  note: body.note.trim(),
  items: [{ slug: 'emoji-📱', quantity: 1 }]
};

async function fingerprint(value) {
  const digest = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
async function main() {
const requestFingerprint = await fingerprint(canonicalRequest);

let mode = 'fresh';
const calls = [];
const assetPaths = [];
const quietConsole = { log() {}, warn() {}, error() {} };

async function mockFetch(input, init = {}) {
  const url = typeof input === 'string' ? input : input.url;
  const method = String(init.method || 'GET').toUpperCase();
  calls.push({ url, method, body: typeof init.body === 'string' ? init.body : '' });

  if (url.startsWith(databaseUrl + '/rest/v1/orders?')) {
    if (mode === 'missing-migration') return new Response('request_fingerprint column missing', { status: 400 });
    if (mode === 'existing-replay' || mode === 'existing-mismatch') {
      return new Response(JSON.stringify([{
        id: 'existing-order-id',
        order_number: 'PY2-TEST-1',
        total_amount: 100,
        request_fingerprint: mode === 'existing-replay' ? requestFingerprint : 'f'.repeat(64)
      }]), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
  }

  if (url.startsWith(databaseUrl + '/rest/v1/rpc/create_phoneya2_order')) {
    if (mode === 'rpc-conflict') {
      return new Response(JSON.stringify({ message: 'Idempotency key was already used for different order details' }), {
        status: 400, headers: { 'content-type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({
      id: 'new-order-id', order_number: 'PY2-TEST-2', total_amount: 100, currency: 'ZMW', replayed: false
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }

  if (url.startsWith(databaseUrl + '/auth/v1/invite')) {
    return new Response(JSON.stringify({ message: 'test account already exists' }), {
      status: 422, headers: { 'content-type': 'application/json' }
    });
  }
  if (url.startsWith(databaseUrl + '/rest/v1/email_activity')) return new Response(null, { status: 201 });
  // External notifications are deliberately unavailable in this isolated smoke test.
  return new Response(JSON.stringify({ message: 'mock external service unavailable' }), {
    status: 503, headers: { 'content-type': 'application/json' }
  });
}

const context = {
  fetch: mockFetch,
  Response,
  URL,
  Headers,
  Request,
  crypto: webcrypto,
  TextEncoder,
  console: quietConsole
};
vm.runInNewContext(source + '\nthis.__phoneya2OrderHandler = onRequest;', context, { filename: 'functions/api/orders.js' });
const handler = context.__phoneya2OrderHandler;

const assets = {
  async fetch(request) {
    const pathname = decodeURIComponent(new URL(request.url).pathname);
    assetPaths.push(pathname);
    if (pathname === '/content/products/index.json') {
      return new Response(JSON.stringify(['emoji-📱']), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (pathname === '/content/products/emoji-📱.md') {
      return new Response('---\ntitle: Emoji Phone\nprice: 100\nstock: 10\nimage: /x.png\n---\n', { status: 200 });
    }
    return new Response('not found', { status: 404 });
  }
};

async function submit(nextMode) {
  mode = nextMode;
  calls.length = 0;
  assetPaths.length = 0;
  const request = new Request(siteUrl + '/api/orders', {
    method: 'POST',
    headers: { origin: siteUrl, 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const response = await handler({
    request,
    env: { SUPABASE_URL: databaseUrl, SUPABASE_SERVICE_ROLE_KEY: 'test-only-secret', ASSETS: assets }
  });
  return { status: response.status, data: await response.json(), calls: [...calls], assets: [...assetPaths] };
}

const replay = await submit('existing-replay');
assert.equal(replay.status, 200, 'Matching retry should return success.');
assert.equal(replay.data.replayed, true, 'Matching retry must be identified as a replay.');
assert.equal(replay.data.order_number, 'PY2-TEST-1', 'Matching retry must return the original order number.');
assert.equal(replay.assets.length, 0, 'Replay lookup must happen before reading the current catalogue.');
assert.ok(!replay.calls.some(call => call.url.includes('/rpc/create_phoneya2_order')), 'Replay must not create a second order.');
assert.ok(!replay.calls.some(call => call.url.includes('/auth/v1/invite')), 'Replay must not repeat account invitation side effects.');

const mismatch = await submit('existing-mismatch');
assert.equal(mismatch.status, 409, 'Existing key with a different fingerprint must be rejected.');

const missingMigration = await submit('missing-migration');
assert.equal(missingMigration.status, 503, 'Missing database migration must fail closed.');
assert.ok(!missingMigration.calls.some(call => call.url.includes('/rpc/create_phoneya2_order')), 'Missing migration must not fall back to the legacy RPC.');

const fresh = await submit('fresh');
assert.equal(fresh.status, 201, 'A fresh valid request should create an order.');
const rpcCall = fresh.calls.find(call => call.url.includes('/rpc/create_phoneya2_order'));
assert.ok(rpcCall, 'Fresh request must call the database transaction RPC.');
const rpcBody = JSON.parse(rpcCall.body);
assert.equal(rpcBody.p_idempotency_key, idempotencyKey, 'RPC must receive the idempotency key.');
assert.match(rpcBody.p_request_fingerprint, /^[0-9a-f]{64}$/, 'RPC must receive a SHA-256 request fingerprint.');
assert.ok(fresh.assets.includes('/content/products/emoji-📱.md'), 'Unicode product slug must load through checkout validation.');

const rpcConflict = await submit('rpc-conflict');
assert.equal(rpcConflict.status, 409, 'Concurrent key reuse reported by the database must return HTTP 409.');

console.log('PhoneYa2 idempotency smoke tests passed.');
console.log('Verified matching replay, mismatched key, missing migration fail-closed, fresh order RPC, Unicode product slug, and concurrent conflict mapping.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
