import { validateState } from './core.js';

// A missing map value with a retained clock is a deletion tombstone.
// Clocks are hybrid logical clocks: [observed wall time, logical counter, device].
// Once a remote clock is observed, a later local edit outranks it even if the
// local wall clock is behind. Truly offline concurrent edits use a device-ID
// tie break; their actual real-world order cannot be inferred without contact.
const ZERO = Object.freeze([0, 0, '']);
const MAPS = ['tasks', 'lessons', 'labSteps', 'notes'];
const SETTINGS = ['startDate', 'hours', 'name'];
const MODES = ['exam', 'practice', 'review'];
const MAX_CLOCK = Number.MAX_SAFE_INTEGER - 1;
const record = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const own = (v, k) => Object.hasOwn(v, k);
const safeKey = k => typeof k === 'string' && k.length > 0 && k.length <= 1024 && !['__proto__', 'prototype', 'constructor'].includes(k);
const lexical = (a, b) => a === b ? 0 : a < b ? -1 : 1;
const path = (...parts) => '/' + parts.map(p => String(p).replaceAll('~', '~0').replaceAll('/', '~1')).join('/');
const parts = p => p.slice(1).split('/').map(k => k.replaceAll('~1', '/').replaceAll('~0', '~'));
const dateMs = value => Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0;
const canonical = value => {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (record(value)) return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
};
const equal = (a, b) => canonical(a) === canonical(b);
const sortedObject = entries => Object.fromEntries([...entries].sort(([a], [b]) => lexical(a, b)));
const device = id => {
  if (typeof id !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(id)) throw new Error('Invalid sync device ID');
  return id;
};
function clock(value) {
  if (!Array.isArray(value) || value.length !== 3 || !Number.isSafeInteger(value[0]) || value[0] < 0 || value[0] > MAX_CLOCK || !Number.isSafeInteger(value[1]) || value[1] < 0 || value[1] > MAX_CLOCK || typeof value[2] !== 'string' || !/^[A-Za-z0-9._:-]{0,128}$/.test(value[2])) return null;
  return [...value];
}
function compare(a = ZERO, b = ZERO) { return a[0] - b[0] || a[1] - b[1] || lexical(a[2], b[2]); }
function nextClock(doc, id, now) {
  device(id);
  if (!Number.isFinite(now) || now < 0 || now > MAX_CLOCK) throw new Error('Invalid sync time');
  let max = doc.resetEpoch || ZERO;
  for (const c of Object.values(doc.clocks || {})) if (compare(c, max) > 0) max = c;
  const wall = Math.floor(now);
  if (wall > max[0]) return [wall, 0, id];
  if (max[1] < MAX_CLOCK) return [max[0], max[1] + 1, id];
  if (max[0] < MAX_CLOCK) return [max[0] + 1, 0, id];
  throw new Error('Sync clock exhausted');
}
function validPath(p) {
  if (typeof p !== 'string' || !p.startsWith('/') || p.length > 4096) return false;
  const a = parts(p);
  if (path(...a) !== p || !a.every(safeKey)) return false;
  if (a[0] === 'settings') return a.length === 2 && SETTINGS.includes(a[1]);
  if ([...MAPS, 'activity', 'attempts', 'history', 'completed'].includes(a[0])) return a.length === 2;
  if (a[0] !== 'session') return false;
  if (a.length === 1) return true;
  if (a.length === 3) return ['definition', 'index'].includes(a[2]);
  return a.length === 4 && ['answers', 'submitted', 'flagged'].includes(a[2]);
}
const safeMap = (value, accept, copy = v => v) => sortedObject(Object.entries(record(value) ? value : {}).filter(([k, v]) => safeKey(k) && accept(v)).map(([k, v]) => [k, copy(v)]));
const selection = v => Array.isArray(v) && v.length <= 10 && v.every(n => Number.isInteger(n) && n >= 0 && n < 10) && new Set(v).size === v.length;
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value;

function cleanState(value) {
  // validateState is the application schema authority. Set a deterministic
  // fallback for an invalid start date before calling it (no today's-date drift).
  const input = record(value) && record(value.settings) ? { ...value, settings: { ...value.settings, startDate: validDate(value.settings.startDate) ? value.settings.startDate : '1970-01-01' } } : value;
  const s = validateState(input);
  const state = {
    version: 1,
    settings: { startDate: s.settings.startDate, hours: s.settings.hours, name: s.settings.name },
    tasks: safeMap(s.tasks, v => typeof v === 'boolean'),
    lessons: safeMap(s.lessons, v => typeof v === 'boolean'),
    labSteps: safeMap(s.labSteps, v => typeof v === 'boolean'),
    notes: safeMap(s.notes, v => typeof v === 'string'),
    attempts: [], history: [], activity: {}, session: null,
  };
  state.attempts = s.attempts.filter(a => safeKey(a.questionId) && selection(a.selected) && (a.sessionId === undefined || safeKey(a.sessionId))).map(a => ({
    questionId: a.questionId, selected: [...a.selected], correct: a.correct, domain: a.domain, at: a.at,
    ...(MODES.includes(a.mode) ? { mode: a.mode } : {}), ...(a.sessionId === undefined ? {} : { sessionId: a.sessionId }),
  }));
  state.history = s.history.filter(h => safeKey(h.id) && h.questionIds.length > 0 && h.questionIds.length <= 120 && h.questionIds.every(safeKey) && Number.isInteger(h.correct) && h.total === h.questionIds.length).map(h => ({
    id: h.id, mode: h.mode, questionIds: [...h.questionIds],
    answers: safeMap(h.answers, selection, v => [...v]), correct: h.correct, total: h.total,
    finishedAt: h.finishedAt, duration: h.duration,
  }));
  state.activity = sortedObject(Object.entries(s.activity).filter(([day, n]) => validDate(day) && Number.isFinite(n) && n >= 0));
  const q = s.session;
  if (q && safeKey(q.id) && q.questionIds.every(safeKey) && Number.isSafeInteger(q.startedAt) && q.startedAt >= 0 && (q.mode !== 'exam' || (Number.isSafeInteger(q.deadline) && q.deadline >= q.startedAt))) {
    const ids = new Set(q.questionIds);
    const restrictedMap = (v, accept, copy) => safeMap(Object.fromEntries(Object.entries(v).filter(([k]) => ids.has(k))), accept, copy);
    state.session = {
      id: q.id, mode: q.mode, questionIds: [...q.questionIds],
      answers: restrictedMap(q.answers, selection, v => [...v]),
      submitted: restrictedMap(q.submitted, v => typeof v === 'boolean'),
      flagged: restrictedMap(q.flagged, v => typeof v === 'boolean'),
      index: q.index, startedAt: q.startedAt,
      deadline: q.mode === 'exam' ? Math.min(q.deadline, q.startedAt + 130 * 60 * 1000) : null,
    };
  }
  return state;
}

// An attempt is one answer to one question in a session. Older backups without
// session IDs use question + timestamp so independent historical attempts remain.
function attemptKey(a) { return JSON.stringify(a.sessionId === undefined ? ['legacy', a.questionId, a.at] : ['session', a.sessionId, a.questionId]); }
const historyKey = h => h.id;
const definition = s => ({ id: s.id, mode: s.mode, questionIds: s.questionIds, startedAt: s.startedAt, deadline: s.deadline });
function registers(state) {
  const out = new Map();
  for (const key of SETTINGS) out.set(path('settings', key), state.settings[key]);
  for (const name of [...MAPS, 'activity']) for (const [key, value] of Object.entries(state[name])) out.set(path(name, key), value);
  for (const a of state.attempts) out.set(path('attempts', attemptKey(a)), a);
  for (const h of state.history) out.set(path('history', h.id), h);
  out.set('/session', state.session?.id ?? null);
  if (state.session) {
    const s = state.session;
    out.set(path('session', s.id, 'definition'), definition(s));
    out.set(path('session', s.id, 'index'), s.index);
    for (const name of ['answers', 'submitted', 'flagged']) for (const [key, value] of Object.entries(s[name])) out.set(path('session', s.id, name, key), value);
  }
  return out;
}
function choose(a, b, p, av, bv) {
  const ac = a.clocks[p], bc = b.clocks[p];
  const aknown = ac !== undefined || av.has(p), bknown = bc !== undefined || bv.has(p);
  if (!aknown) return bv.has(p) ? { present: true, value: bv.get(p) } : { present: false };
  if (!bknown) return av.has(p) ? { present: true, value: av.get(p) } : { present: false };
  const cmp = compare(ac, bc);
  if (cmp !== 0) {
    const values = cmp > 0 ? av : bv;
    return values.has(p) ? { present: true, value: values.get(p) } : { present: false };
  }
  // Equal-clock conflicting inputs are deterministic. Prefer tombstones over
  // values so a retained deletion cannot be undone by a malformed duplicate.
  if (!av.has(p) || !bv.has(p)) return { present: false };
  return { present: true, value: lexical(canonical(av.get(p)), canonical(bv.get(p))) >= 0 ? av.get(p) : bv.get(p) };
}
function mergeClocks(a, b) {
  const all = new Set([...Object.keys(a), ...Object.keys(b)]);
  return sortedObject([...all].map(p => [p, [...(compare(a[p], b[p]) >= 0 ? a[p] || ZERO : b[p])]]));
}
function unionRecords(a, b, name, keyOf, timeOf, clocks, limit) {
  const found = new Map();
  for (const doc of [a, b]) for (const value of doc.state[name]) {
    const key = keyOf(value), existing = found.get(key), c = doc.clocks[path(name, key)] || ZERO;
    if (!existing || compare(c, existing.clock) > 0 || (compare(c, existing.clock) === 0 && lexical(canonical(value), canonical(existing.value)) > 0)) found.set(key, { value, clock: c });
  }
  return [...found.entries()].sort(([ka, a], [kb, b]) => compare(clocks[path(name, ka)], clocks[path(name, kb)]) || dateMs(timeOf(a.value)) - dateMs(timeOf(b.value)) || lexical(ka, kb)).slice(-limit).map(([, entry]) => entry.value);
}

/** Validate and clone a sync document. Throws on an invalid envelope/state. */
export function sanitizeDocument(value) {
  if (!record(value) || value.format !== 1 || !record(value.clocks)) throw new Error('Invalid sync document');
  if (Object.keys(value.clocks).length > 100000) throw new Error('Sync document contains too many clocks');
  const resetEpoch = value.resetEpoch === undefined ? [...ZERO] : clock(value.resetEpoch);
  if (!resetEpoch) throw new Error('Invalid sync reset epoch');
  const state = cleanState(value.state);
  const clocks = sortedObject(Object.entries(value.clocks).filter(([p, c]) => validPath(p) && clock(c)).map(([p, c]) => [p, clock(c)]));
  const doc = { format: 1, state, clocks, resetEpoch };
  // Missing clocks are accepted for migration, but never guessed from the local
  // wall time. Explicit tombstones already present in clocks are retained.
  for (const [p, v] of registers(state)) if (!(p === '/session' && v === null) && !own(clocks, p)) clocks[p] = [...ZERO];
  for (const h of state.history) {
    const p = path('completed', h.id);
    if (!own(clocks, p)) clocks[p] = [...(clocks[path('history', h.id)] || ZERO)];
  }
  state.attempts = unionRecords(doc, doc, 'attempts', attemptKey, a => a.at, clocks, 20000);
  state.history = unionRecords(doc, doc, 'history', historyKey, h => h.finishedAt, clocks, 500);
  if (state.session && own(clocks, path('completed', state.session.id))) state.session = null;
  doc.clocks = sortedObject(Object.entries(clocks));
  return doc;
}

function fromState(state, stamp, resetEpoch = ZERO) {
  const normalized = cleanState(state);
  const clocks = {};
  for (const [p, value] of registers(normalized)) if (!(p === '/session' && value === null)) clocks[p] = [...stamp];
  for (const h of normalized.history) clocks[path('completed', h.id)] = [...stamp];
  return sanitizeDocument({ format: 1, state: normalized, clocks, resetEpoch: [...resetEpoch] });
}

/** Create a document for existing local data; creating is not a global reset. */
export function createDocument(state, deviceId, now = Date.now()) {
  return fromState(state, nextClock({ clocks: {}, resetEpoch: ZERO }, deviceId, now));
}

/** Record local edits relative to a prior (possibly merged) document. */
export function updateDocument(value, newState, deviceId, now = Date.now()) {
  const before = sanitizeDocument(value), next = cleanState(newState);
  const stamp = nextClock(before, deviceId, now);
  // A quiz's identity, question order and timer are immutable while it is active.
  if (next.session && before.state.session?.id === next.session.id) Object.assign(next.session, definition(before.state.session));
  const previous = registers(before.state), current = registers(next);
  const clocks = { ...before.clocks };
  const changed = new Set([...previous.keys(), ...current.keys()]);
  for (const p of changed) {
    const category = parts(p)[0];
    // Attempts/history are append/union collections. Omission during a capped
    // snapshot is not a request to delete; only resetDocument clears them.
    if (['attempts', 'history', 'activity'].includes(category) && !current.has(p)) continue;
    // A different active quiz is selected by its marker. Keep old quiz clocks,
    // but do not turn its individual fields into deletion tombstones.
    if (category === 'session' && parts(p).length > 1 && parts(p)[1] !== next.session?.id) continue;
    if (previous.has(p) !== current.has(p) || !equal(previous.get(p), current.get(p))) clocks[p] = [...stamp];
  }
  for (const h of next.history) if (!own(clocks, path('completed', h.id))) clocks[path('completed', h.id)] = [...stamp];
  const updated = { format: 1, state: next, clocks, resetEpoch: [...before.resetEpoch] };
  // Preserve append-only records and the maximum observed activity count.
  next.attempts = unionRecords(before, updated, 'attempts', attemptKey, a => a.at, clocks, 20000);
  next.history = unionRecords(before, updated, 'history', historyKey, h => h.finishedAt, clocks, 500);
  for (const [day, amount] of Object.entries(before.state.activity)) next.activity[day] = Math.max(amount, next.activity[day] || 0);
  return sanitizeDocument(updated);
}

/** Merge two replicas without mutating either input. */
export function mergeDocuments(left, right) {
  const a = sanitizeDocument(left), b = sanitizeDocument(right);
  const epoch = compare(a.resetEpoch, b.resetEpoch);
  // A deliberate reset supersedes all changes in an older epoch, even if an
  // offline device's wall clock is far ahead. New edits must use the reset base.
  if (epoch !== 0) return epoch > 0 ? a : b;
  const clocks = mergeClocks(a.clocks, b.clocks);
  const av = registers(a.state), bv = registers(b.state);
  const state = cleanState(a.state);
  const allPaths = new Set([...Object.keys(clocks), ...av.keys(), ...bv.keys()]);
  for (const name of ['settings', ...MAPS]) {
    const entries = [];
    for (const p of allPaths) {
      const tokens = parts(p);
      if (tokens.length !== 2 || tokens[0] !== name) continue;
      const selected = choose(a, b, p, av, bv);
      if (selected.present) entries.push([tokens[1], selected.value]);
    }
    state[name] = sortedObject(entries);
  }
  state.attempts = unionRecords(a, b, 'attempts', attemptKey, x => x.at, clocks, 20000);
  state.history = unionRecords(a, b, 'history', historyKey, x => x.finishedAt, clocks, 500);
  state.activity = sortedObject([...new Set([...Object.keys(a.state.activity), ...Object.keys(b.state.activity)])].map(day => [day, Math.max(a.state.activity[day] || 0, b.state.activity[day] || 0)]));
  // An initial document with no quiz has no clear marker. It therefore cannot
  // accidentally cancel an existing quiz merely by joining from a new device.
  if (!own(a.clocks, '/session') && !a.state.session) av.delete('/session');
  if (!own(b.clocks, '/session') && !b.state.session) bv.delete('/session');
  const marker = choose(a, b, '/session', av, bv);
  const id = marker.present ? marker.value : null;
  state.session = null;
  if (id && !own(clocks, path('completed', id))) {
    const sa = a.state.session?.id === id ? a.state.session : null;
    const sb = b.state.session?.id === id ? b.state.session : null;
    if (sa && sb) {
      const selectedDefinition = choose(a, b, path('session', id, 'definition'), av, bv).value;
      const s = { ...selectedDefinition, questionIds: [...selectedDefinition.questionIds], answers: {}, submitted: {}, flagged: {}, index: 0 };
      // A merge must never restart or extend an exam's original countdown.
      s.startedAt = Math.min(sa.startedAt, sb.startedAt);
      s.deadline = s.mode === 'exam' ? Math.min(sa.deadline, sb.deadline) : null;
      const ids = new Set(s.questionIds);
      for (const name of ['answers', 'submitted', 'flagged']) {
        const entries = [];
        for (const p of allPaths) {
          const t = parts(p);
          if (t.length !== 4 || t[0] !== 'session' || t[1] !== id || t[2] !== name || !ids.has(t[3])) continue;
          const selected = choose(a, b, p, av, bv);
          if (selected.present) entries.push([t[3], selected.value]);
        }
        s[name] = sortedObject(entries);
      }
      const selectedIndex = choose(a, b, path('session', id, 'index'), av, bv);
      s.index = Math.max(0, Math.min(s.questionIds.length - 1, selectedIndex.present ? selectedIndex.value : 0));
      state.session = s;
    } else if (sa || sb) state.session = sa || sb;
  }
  return sanitizeDocument({ format: 1, state, clocks, resetEpoch: a.resetEpoch });
}

/** Intentionally replace all progress and establish a new replicated reset epoch. */
export function resetDocument(value, state, deviceId, now = Date.now()) {
  const previous = sanitizeDocument(value);
  const stamp = nextClock(previous, deviceId, now);
  return fromState(state, stamp, stamp);
}
