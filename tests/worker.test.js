import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import worker, {LIMITS} from '../cloud/worker.js';

const schema = readFileSync(new URL('../cloud/schema.sql', import.meta.url), 'utf8');
const NOW = Date.UTC(2026, 10, 13, 12, 30, 0);
const ORIGIN = 'https://curtisatiwatt.github.io';
const token = (n = 1) => { const bytes = Buffer.alloc(32); bytes.writeUInt32BE(n); return bytes.toString('base64url'); };
const digest = value => createHash('sha256').update(value).digest('hex');
const payload = (n = 1, size = 32) => ({version:1, iv:Buffer.alloc(12, n).toString('base64url'), ciphertext:Buffer.alloc(size, n).toString('base64url')});

// A D1-shaped test double that executes the actual SQL and transactions in SQLite.
// It deliberately does not reimplement application rules in JavaScript maps.
class MockD1 {
  constructor() { this.sqlite = new DatabaseSync(':memory:'); this.sqlite.exec(schema); this.calls = 0; this.failInsert = false; }
  prepare(sql) {
    this.calls++;
    const db = this;
    const make = args => ({
      bind(...values) { return make(values); },
      async first(column) {
        const row = db.sqlite.prepare(sql).get(...args);
        return row ? (column ? row[column] : {...row}) : null;
      },
      async run() { return this.execute(); },
      execute() {
        if (db.failInsert && /^INSERT INTO progress/.test(sql)) throw new Error('private database error text');
        const result = db.sqlite.prepare(sql).run(...args);
        return {success:true, meta:{changes:Number(result.changes)}, results:[]};
      },
    });
    return make([]);
  }
  async batch(statements) {
    this.sqlite.exec('BEGIN IMMEDIATE');
    try {
      const results = statements.map(statement => statement.execute());
      this.sqlite.exec('COMMIT');
      return results;
    } catch (error) { this.sqlite.exec('ROLLBACK'); throw error; }
  }
  count(table) { return this.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n; }
  close() { this.sqlite.close(); }
}
function setup(t) {
  t.mock.method(Date, 'now', () => NOW);
  const db = new MockD1();
  t.after(() => db.close());
  return db;
}
function request(method = 'GET', options = {}) {
  const headers = new Headers({Origin:ORIGIN});
  if (options.token !== null) headers.set('Authorization', `Bearer ${options.token ?? token()}`);
  if (options.origin === null) headers.delete('Origin');
  else if (options.origin !== undefined) headers.set('Origin', options.origin);
  let body;
  if ('body' in options) { headers.set('Content-Type', 'application/json'); body = JSON.stringify(options.body); }
  if ('raw' in options) { headers.set('Content-Type', 'application/json'); body = options.raw; }
  for (const [key, value] of Object.entries(options.headers || {})) {
    if (value === null) headers.delete(key); else headers.set(key, value);
  }
  return new Request(`https://sync.example${options.path || '/v1/progress'}`, {method, headers, body, ...(body instanceof ReadableStream ? {duplex:'half'} : {})});
}
const call = (db, method, options) => worker.fetch(request(method, options), {DB:db});
async function expectError(response, status, code) {
  assert.equal(response.status, status);
  const body = await response.json();
  assert.equal(body.code, code);
  assert.equal(typeof body.error, 'string');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  return body;
}

test('health is unauthenticated; CORS permits only exact approved origins and headers', async t => {
  const db = setup(t);
  for (const origin of [ORIGIN, 'http://localhost:4187', 'http://127.0.0.1:4187']) {
    const response = await call(db, 'GET', {path:'/health', token:null, origin});
    assert.equal(response.status, 200);
    assert.equal((await response.json()).ok, true);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
    assert.equal(response.headers.get('Access-Control-Allow-Credentials'), null);
  }
  for (const origin of ['https://evil.example', ORIGIN + '.evil.example', 'http://localhost:4173', 'null']) {
    const response = await call(db, 'GET', {path:'/health', token:null, origin});
    await expectError(response, 403, 'origin_not_allowed');
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  }
  const preflight = await call(db, 'OPTIONS', {token:null, headers:{'Access-Control-Request-Method':'PUT', 'Access-Control-Request-Headers':'authorization, Content-Type'}});
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  assert.equal(preflight.headers.get('Access-Control-Allow-Headers'), 'Authorization, Content-Type');
  for (const options of [
    {origin:null, headers:{'Access-Control-Request-Method':'GET'}},
    {headers:{'Access-Control-Request-Method':'DELETE'}},
    {headers:{'Access-Control-Request-Method':'PUT','Access-Control-Request-Headers':'Authorization, X-Secret'}},
  ]) await expectError(await call(db, 'OPTIONS', options), 403, 'preflight_not_allowed');
  assert.equal(db.calls, 0);
});

test('authorization rejects malformed, noncanonical, short, and oversized bearer tokens before D1 access', async t => {
  const db = setup(t);
  for (const authorization of [null, '', 'Basic abc', 'Bearer a', `Bearer ${'A'.repeat(42)}`, `Bearer ${'A'.repeat(44)}`, `Bearer ${'A'.repeat(42)}B`, `Bearer ${token()}=`, `Bearer ${token()} extra`, `Bearer ${'A'.repeat(4096)}`]) {
    const response = await call(db, 'GET', {headers:{Authorization:authorization}});
    await expectError(response, 401, 'invalid_authorization');
    assert.equal(response.headers.get('WWW-Authenticate'), 'Bearer');
  }
  assert.equal(db.calls, 0);
});

test('missing-space reads and updates never create rows or rate-limit tombstones', async t => {
  const db = setup(t);
  for (let i = 1; i <= 20; i++) {
    await expectError(await call(db, 'GET', {token:token(i)}), 404, 'not_found');
    await expectError(await call(db, 'PUT', {token:token(i), body:{payload:payload(), revision:1}}), 404, 'not_found');
  }
  assert.equal(db.count('progress'), 0);
  assert.equal(db.count('create_limits'), 0);
});

test('create, fetch, and CAS update preserve opaque payloads and never store the raw token or IP', async t => {
  const db = setup(t);
  const initial = payload(1);
  const created = await call(db, 'POST', {body:{payload:initial}, headers:{'CF-Connecting-IP':'203.0.113.17'}});
  assert.equal(created.status, 201);
  assert.deepEqual(await created.json(), {revision:1, payload:initial, updatedAt:new Date(NOW).toISOString()});
  const stored = db.sqlite.prepare('SELECT * FROM progress').get();
  assert.equal(stored.id, digest(token()));
  assert.equal(stored.payload, JSON.stringify(initial));
  assert.equal(JSON.stringify(stored).includes(token()), false);
  const ipRows = db.sqlite.prepare('SELECT * FROM create_limits').all();
  assert.equal(ipRows.length, 1);
  assert.match(ipRows[0].ip_hash, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(ipRows).includes('203.0.113.17'), false);
  const fetched = await call(db, 'GET');
  assert.deepEqual((await fetched.json()).payload, initial);
  const next = payload(2);
  const updated = await call(db, 'PUT', {body:{payload:next, revision:1}});
  assert.equal(updated.status, 200);
  assert.deepEqual(await updated.json(), {revision:2,payload:next,updatedAt:new Date(NOW).toISOString()});
  await expectError(await call(db, 'PUT', {body:{payload:initial,revision:1}}), 409, 'revision_conflict');
  await expectError(await call(db, 'POST', {body:{payload:initial}}), 409, 'already_exists');
  const final = await (await call(db, 'GET')).json();
  assert.equal(final.revision, 2);
  assert.deepEqual(final.payload, next);
  assert.equal(db.count('progress'), 1);
});

test('concurrent updates using the same revision have exactly one winner', async t => {
  const db = setup(t);
  await call(db, 'POST', {body:{payload:payload()}});
  const responses = await Promise.all([
    call(db, 'PUT', {body:{payload:payload(2),revision:1}}),
    call(db, 'PUT', {body:{payload:payload(3),revision:1}}),
  ]);
  assert.deepEqual(responses.map(response => response.status).sort(), [200,409]);
  const winner = await responses.find(response => response.status === 200).json();
  const loser = await responses.find(response => response.status === 409).json();
  assert.equal(loser.code, 'revision_conflict');
  const final = await (await call(db, 'GET')).json();
  assert.equal(final.revision, 2);
  assert.deepEqual(final.payload, winner.payload);
});

test('strict JSON shape, IV, ciphertext, and revision validation reject invalid writes without creating records', async t => {
  const db = setup(t);
  const invalid = [
    null, [], {}, {payload:payload(),encryptionKey:'never-send-this'},
    {payload:{...payload(),key:'unexpected'}}, {payload:{...payload(),version:2}},
    {payload:{...payload(),iv:Buffer.alloc(11).toString('base64url')}},
    {payload:{...payload(),iv:Buffer.alloc(13).toString('base64url')}},
    {payload:{...payload(),iv:'A'.repeat(15)+'='}},
    {payload:{...payload(),ciphertext:'A'.repeat(21)+'B'}},
    {payload:{...payload(),ciphertext:Buffer.alloc(15).toString('base64url')}},
    {payload:{...payload(),ciphertext:'***'}},
  ];
  for (const body of invalid) assert.equal((await call(db, 'POST', {body})).status, 400);
  for (const revision of [0,-1,1.5,'1',null,Number.MAX_SAFE_INTEGER]) {
    await expectError(await call(db, 'PUT', {body:{payload:payload(),revision}}), 400, 'invalid_revision');
  }
  await expectError(await call(db, 'POST', {raw:'{broken'}), 400, 'invalid_json');
  await expectError(await call(db, 'POST', {body:{payload:payload()},headers:{'Content-Type':'text/plain'}}), 415, 'unsupported_media_type');
  await expectError(await call(db, 'POST', {body:{payload:payload()},headers:{'Content-Encoding':'gzip'}}), 415, 'unsupported_encoding');
  assert.equal(db.count('progress'), 0);
  assert.equal(db.count('create_limits'), 0);
});

test('ciphertext accepts the exact 1 MiB decoded boundary and rejects one byte more', async t => {
  const db = setup(t);
  const maximum = payload(1, LIMITS.ciphertextBytes);
  const accepted = await call(db, 'POST', {body:{payload:maximum}});
  assert.equal(accepted.status, 201);
  assert.equal((await accepted.json()).payload.ciphertext, maximum.ciphertext);
  await expectError(await call(db, 'POST', {token:token(2),body:{payload:payload(2,LIMITS.ciphertextBytes+1)}}), 413, 'ciphertext_too_large');
  assert.equal(db.count('progress'), 1);
});

test('streamed body limits do not trust Content-Length and cancel oversized input', async t => {
  const db = setup(t);
  let cancelled = false;
  const stream = new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(900000)); controller.enqueue(new Uint8Array(900000)); },
    cancel() { cancelled = true; },
  });
  const response = await call(db, 'POST', {raw:stream,headers:{'Content-Length':'1'}});
  await expectError(response, 413, 'body_too_large');
  assert.equal(cancelled, true);
  await expectError(await call(db, 'POST', {body:{payload:payload()},headers:{'Content-Length':String(LIMITS.bodyBytes+1)}}), 413, 'body_too_large');
  assert.equal(db.calls, 0);
});

test('per-space requests are bounded, expose Retry-After, and reset in a new fixed window', async t => {
  const db = setup(t);
  await call(db, 'POST', {body:{payload:payload()}});
  for (let i = 1; i < LIMITS.spaceRequestsPerMinute; i++) assert.equal((await call(db, 'GET')).status, 200);
  const limited = await call(db, 'GET');
  await expectError(limited, 429, 'space_rate_limit');
  assert.equal(limited.headers.get('Retry-After'), '60');
  assert.equal(limited.headers.get('Access-Control-Expose-Headers'), 'Retry-After');
  const row = db.sqlite.prepare('SELECT request_count FROM progress').get();
  assert.equal(row.request_count, LIMITS.spaceRequestsPerMinute);
  db.sqlite.prepare('UPDATE progress SET request_window = ?').run(Math.floor(NOW/60000)-1);
  assert.equal((await call(db, 'GET')).status, 200);
  assert.equal(db.sqlite.prepare('SELECT request_count FROM progress').get().request_count, 1);
});

test('parallel creates enforce five per hashed IP per hour, and another IP has its own allowance', async t => {
  const db = setup(t);
  const responses = await Promise.all(Array.from({length:8}, (_, i) => call(db, 'POST', {token:token(i+1),body:{payload:payload()},headers:{'CF-Connecting-IP':'198.51.100.9'}})));
  assert.equal(responses.filter(response => response.status === 201).length, 5);
  assert.equal(responses.filter(response => response.status === 429).length, 3);
  for (const response of responses.filter(response => response.status === 429)) {
    assert.equal(response.headers.get('Retry-After'), '1800');
    assert.equal((await response.json()).code, 'create_rate_limit');
  }
  assert.equal(db.count('progress'), 5);
  assert.equal(db.count('create_limits'), 1);
  assert.equal((await call(db, 'POST', {token:token(99),body:{payload:payload()},headers:{'CF-Connecting-IP':'198.51.100.10'}})).status, 201);
  assert.equal(db.count('progress'), 6);
});

test('parallel creates cannot exceed the 1000-space cap and a full store does not grow limiter rows', async t => {
  const db = setup(t);
  const insert = db.sqlite.prepare('INSERT INTO progress(id,payload,revision,updated_at,request_window,request_count) VALUES(?,?,1,?,0,0)');
  for (let i = 1; i < LIMITS.spaces; i++) insert.run(digest(`seed-${i}`),JSON.stringify(payload()),new Date(NOW).toISOString());
  const responses = await Promise.all([1,2].map(i => call(db, 'POST', {token:token(i),body:{payload:payload()},headers:{'CF-Connecting-IP':`192.0.2.${i}`}})));
  assert.deepEqual(responses.map(response => response.status).sort(), [201,503]);
  assert.equal(db.count('progress'), LIMITS.spaces);
  const before = db.count('create_limits');
  await expectError(await call(db, 'POST', {token:token(50),body:{payload:payload()},headers:{'CF-Connecting-IP':'192.0.2.50'}}), 503, 'capacity_reached');
  assert.equal(db.count('create_limits'), before);
});

test('creation transactions roll back rate data after storage failures and errors do not leak internals', async t => {
  const db = setup(t);
  const logs = [];
  t.mock.method(console, 'error', value => logs.push(value));
  db.failInsert = true;
  const response = await call(db, 'POST', {body:{payload:payload()},headers:{'CF-Connecting-IP':'203.0.113.1'}});
  const body = await expectError(response, 503, 'storage_unavailable');
  assert.equal(response.headers.get('Retry-After'), '5');
  assert.equal(JSON.stringify(body).includes('private database'), false);
  assert.deepEqual(logs, [JSON.stringify({event:'progress_storage_failure',method:'POST'})]);
  assert.equal(db.count('progress'), 0);
  assert.equal(db.count('create_limits'), 0);
});

test('stale IP windows are pruned only during valid creation, and routes fail explicitly', async t => {
  const db = setup(t);
  db.sqlite.prepare('INSERT INTO create_limits(ip_hash,window_start,attempts) VALUES(?,?,1)').run(digest('old'), Math.floor(NOW/3600000)-1);
  assert.equal((await call(db, 'POST', {body:{payload:payload()}})).status, 201);
  assert.equal(db.count('create_limits'), 1);
  assert.equal(db.sqlite.prepare('SELECT id FROM progress').all().length, 1);
  await expectError(await call(db, 'DELETE'), 405, 'method_not_allowed');
  await expectError(await call(db, 'GET', {path:'/missing'}), 404, 'route_not_found');
  const unconfigured = await worker.fetch(request('GET'), {});
  await expectError(unconfigured, 503, 'not_configured');
});
