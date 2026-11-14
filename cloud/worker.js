/**
 * SAA Studio encrypted progress storage. D1 binding: DB.
 * Deploy with compatibility_date 2026-11-13 and Workers Logs/Traces enabled.
 * The browser keeps the encryption key. The server handles only opaque ciphertext.
 * A random 32-byte bearer token grants read/write access; only its SHA-256 is stored.
 */
export const LIMITS = Object.freeze({
  bodyBytes: 1_572_864,
  ciphertextBytes: 1_048_576,
  spaceRequestsPerMinute: 120,
  createsPerHour: 5,
  spaces: 1000,
});
const ORIGINS = new Set([
  'https://curtisatiwatt.github.io',
  'http://127.0.0.1:4187',
  'http://localhost:4187',
]);
const encoder = new TextEncoder();
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
class HttpError extends Error {
  constructor(status, code, message, headers = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}
function fail(status, code, message, headers) { throw new HttpError(status, code, message, headers); }
function json(data, status, origin, extra = {}) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Vary': 'Origin',
    ...extra,
  };
  if (origin && ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Expose-Headers'] = 'Retry-After';
  }
  return new Response(JSON.stringify(data), {status, headers});
}
function objectWithKeys(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}
// Check canonical unpadded base64url without allocating a decoded megabyte string.
function base64urlBytes(value) {
  if (typeof value !== 'string' || !BASE64URL.test(value) || value.length % 4 === 1) return -1;
  const remainder = value.length % 4;
  const last = ALPHABET.indexOf(value[value.length - 1]);
  if ((remainder === 2 && (last & 15)) || (remainder === 3 && (last & 3))) return -1;
  return Math.floor(value.length * 3 / 4);
}
async function hash(value) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}
async function authenticate(request) {
  const authorization = request.headers.get('Authorization') || '';
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(authorization);
  if (!match || base64urlBytes(match[1]) !== 32) {
    fail(401, 'invalid_authorization', 'A valid 32-byte bearer token is required.', {'WWW-Authenticate': 'Bearer'});
  }
  return hash(match[1]);
}
async function readBody(request) {
  if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    fail(415, 'unsupported_media_type', 'Use application/json.');
  }
  const encoding = request.headers.get('Content-Encoding');
  if (encoding && encoding.toLowerCase() !== 'identity') fail(415, 'unsupported_encoding', 'Compressed request bodies are not supported.');
  const length = request.headers.get('Content-Length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > LIMITS.bodyBytes)) {
    fail(413, 'body_too_large', 'The request body exceeds the size limit.');
  }
  if (!request.body) fail(400, 'invalid_json', 'A JSON request body is required.');
  const reader = request.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > LIMITS.bodyBytes) {
        await reader.cancel().catch(() => {});
        fail(413, 'body_too_large', 'The request body exceeds the size limit.');
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    fail(400, 'invalid_body', 'The request body could not be read.');
  } finally { reader.releaseLock(); }
  const combined = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(combined)); }
  catch { fail(400, 'invalid_json', 'The request body must be valid UTF-8 JSON.'); }
}
function validateBody(body, method) {
  const keys = method === 'PUT' ? ['payload', 'revision'] : ['payload'];
  if (!objectWithKeys(body, keys)) fail(400, 'invalid_body', 'The request has missing or unexpected fields.');
  const payload = body.payload;
  if (!objectWithKeys(payload, ['version', 'iv', 'ciphertext']) || payload.version !== 1) {
    fail(400, 'invalid_payload', 'Use an encrypted version 1 payload with iv and ciphertext.');
  }
  if (typeof payload.iv !== 'string' || payload.iv.length !== 16 || base64urlBytes(payload.iv) !== 12) {
    fail(400, 'invalid_iv', 'The IV must contain exactly 12 bytes encoded as unpadded base64url.');
  }
  // AES-GCM includes a 16-byte authentication tag, even for an empty plaintext.
  if (typeof payload.ciphertext !== 'string' || payload.ciphertext.length > Math.ceil(LIMITS.ciphertextBytes * 4 / 3)) {
    fail(413, 'ciphertext_too_large', 'The encrypted payload exceeds the size limit.');
  }
  const size = base64urlBytes(payload.ciphertext);
  if (size < 16) fail(400, 'invalid_ciphertext', 'Ciphertext must be canonical base64url and include an authentication tag.');
  if (size > LIMITS.ciphertextBytes) fail(413, 'ciphertext_too_large', 'The encrypted payload exceeds the size limit.');
  if (method === 'PUT' && (!Number.isSafeInteger(body.revision) || body.revision < 1 || body.revision >= Number.MAX_SAFE_INTEGER)) {
    fail(400, 'invalid_revision', 'A positive safe-integer revision is required.');
  }
  return body;
}
function retrySeconds(now, duration) { return Math.max(1, Math.ceil(((Math.floor(now / duration) + 1) * duration - now) / 1000)); }
async function spendSpaceRequest(db, id, now) {
  const minute = Math.floor(now / 60000);
  const result = await db.prepare(`UPDATE progress
    SET request_count = CASE WHEN request_window = ?1 THEN request_count + 1 ELSE 1 END,
        request_window = ?1
    WHERE id = ?2 AND (request_window <> ?1 OR request_count < ?3)`)
    .bind(minute, id, LIMITS.spaceRequestsPerMinute).run();
  if (result.meta.changes === 1) return;
  const exists = await db.prepare('SELECT id FROM progress WHERE id = ?1').bind(id).first();
  if (!exists) fail(404, 'not_found', 'No cloud progress exists for this token.');
  fail(429, 'space_rate_limit', 'Too many requests for this space. Try again shortly.', {'Retry-After': String(retrySeconds(now, 60000))});
}
async function createSpace(db, request, id, body, now) {
  const existing = await db.prepare('SELECT id FROM progress WHERE id = ?1').bind(id).first();
  if (existing) {
    await spendSpaceRequest(db, id, now);
    fail(409, 'already_exists', 'This cloud space already exists. Fetch it before updating.');
  }
  const total = await db.prepare('SELECT COUNT(*) AS total FROM progress').first();
  if (total.total >= LIMITS.spaces) fail(503, 'capacity_reached', 'Cloud space capacity has been reached.', {'Retry-After':'3600'});
  const hour = Math.floor(now / 3600000);
  // Cloudflare supplies/overwrites CF-Connecting-IP; never trust X-Forwarded-For.
  const suppliedIp = request.headers.get('CF-Connecting-IP') || '';
  const ip = /^[0-9a-fA-F:.]{3,45}$/.test(suppliedIp) ? suppliedIp : 'unknown';
  const ipHash = await hash(`create:${hour}:${ip}`);
  const updatedAt = new Date(now).toISOString();
  const stored = JSON.stringify(body.payload);
  // D1 batch is a transaction: parallel creates cannot overrun either limit.
  const results = await db.batch([
    db.prepare('DELETE FROM create_limits WHERE window_start < ?1').bind(hour),
    db.prepare(`INSERT INTO create_limits (ip_hash, window_start, attempts) VALUES (?1, ?2, 1)
      ON CONFLICT(ip_hash) DO UPDATE SET
        attempts = CASE WHEN window_start = ?2 THEN MIN(attempts + 1, ?3) ELSE 1 END,
        window_start = ?2`).bind(ipHash, hour, LIMITS.createsPerHour + 1),
    db.prepare(`INSERT INTO progress (id, payload, revision, updated_at, request_window, request_count)
      SELECT ?1, ?2, 1, ?3, ?4, 1
      WHERE (SELECT COUNT(*) FROM progress) < ?5
        AND (SELECT attempts FROM create_limits WHERE ip_hash = ?6 AND window_start = ?7) <= ?8
      ON CONFLICT(id) DO NOTHING`)
      .bind(id, stored, updatedAt, Math.floor(now / 60000), LIMITS.spaces, ipHash, hour, LIMITS.createsPerHour),
  ]);
  if (results[2].meta.changes === 1) return {revision:1, payload:body.payload, updatedAt};
  if (await db.prepare('SELECT id FROM progress WHERE id = ?1').bind(id).first()) {
    fail(409, 'already_exists', 'This cloud space already exists. Fetch it before updating.');
  }
  const limit = await db.prepare('SELECT attempts FROM create_limits WHERE ip_hash = ?1').bind(ipHash).first();
  if (limit?.attempts > LIMITS.createsPerHour) {
    fail(429, 'create_rate_limit', 'Too many cloud-space creation attempts. Try again later.', {'Retry-After':String(retrySeconds(now, 3600000))});
  }
  fail(503, 'capacity_reached', 'Cloud space capacity has been reached.', {'Retry-After':'3600'});
}
async function handle(request, env, origin) {
  const path = new URL(request.url).pathname;
  if (origin && !ORIGINS.has(origin)) fail(403, 'origin_not_allowed', 'This origin is not permitted.');
  if (path !== '/health' && path !== '/v1/progress') fail(404, 'route_not_found', 'Route not found.');
  const methods = path === '/health' ? ['GET'] : ['GET', 'POST', 'PUT'];
  if (request.method === 'OPTIONS') {
    const requestedMethod = request.headers.get('Access-Control-Request-Method');
    const requestedHeaders = (request.headers.get('Access-Control-Request-Headers') || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
    if (!origin || !methods.includes(requestedMethod) || requestedHeaders.some(value => !['authorization', 'content-type'].includes(value))) {
      fail(403, 'preflight_not_allowed', 'This cross-origin request is not permitted.');
    }
    return new Response(null, {status:204, headers:{
      'Access-Control-Allow-Origin':origin,
      'Access-Control-Allow-Methods':methods.join(', ') + ', OPTIONS',
      'Access-Control-Allow-Headers':'Authorization, Content-Type',
      'Access-Control-Max-Age':'86400',
      'Vary':'Origin, Access-Control-Request-Method, Access-Control-Request-Headers',
      'Cache-Control':'no-store',
    }});
  }
  if (!methods.includes(request.method)) fail(405, 'method_not_allowed', 'Method not allowed.', {Allow:methods.join(', ') + ', OPTIONS'});
  if (path === '/health') return json({ok:true, service:'saa-progress', version:1}, 200, origin);
  const id = await authenticate(request);
  if (!env?.DB) fail(503, 'not_configured', 'Cloud storage is not configured.');
  const now = Date.now();
  if (request.method === 'POST') {
    const body = validateBody(await readBody(request), 'POST');
    return json(await createSpace(env.DB, request, id, body, now), 201, origin);
  }
  const body = request.method === 'PUT' ? validateBody(await readBody(request), 'PUT') : null;
  await spendSpaceRequest(env.DB, id, now);
  if (request.method === 'GET') {
    const row = await env.DB.prepare('SELECT payload, revision, updated_at FROM progress WHERE id = ?1').bind(id).first();
    if (!row) fail(404, 'not_found', 'No cloud progress exists for this token.');
    return json({revision:row.revision, payload:JSON.parse(row.payload), updatedAt:row.updated_at}, 200, origin);
  }
  const updatedAt = new Date(now).toISOString();
  const result = await env.DB.prepare(`UPDATE progress SET payload = ?1, revision = revision + 1, updated_at = ?2
    WHERE id = ?3 AND revision = ?4`).bind(JSON.stringify(body.payload), updatedAt, id, body.revision).run();
  if (result.meta.changes !== 1) fail(409, 'revision_conflict', 'Cloud progress changed. Fetch the latest revision before retrying.');
  return json({revision:body.revision + 1, payload:body.payload, updatedAt}, 200, origin);
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    try { return await handle(request, env, origin); }
    catch (error) {
      if (error instanceof HttpError) return json({error:error.message, code:error.code}, error.status, origin, error.headers);
      // Do not log request headers, IP addresses, tokens, payloads, or D1 error text.
      console.error(JSON.stringify({event:'progress_storage_failure', method:request.method}));
      return json({error:'Cloud storage is temporarily unavailable.', code:'storage_unavailable'}, 503, origin, {'Retry-After':'5'});
    }
  },
};
