import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultState } from '../core.js';
import { createDocument, updateDocument, mergeDocuments, sanitizeDocument, resetDocument } from '../sync-merge.js';

const copy = value => structuredClone(value);
const initial = () => ({ ...defaultState(), settings: { name: 'Curtis', startDate: '2026-11-13', hours: 10 } });
const base = () => createDocument(initial(), 'laptop', 100);
function edit(doc, id, now, change) {
  const state = copy(doc.state);
  change(state);
  return updateDocument(doc, state, id, now);
}
const quiz = (id = 'quiz-1', mode = 'exam') => ({
  id, mode, questionIds: ['q1', 'q2', 'q3'], answers: {}, submitted: {}, flagged: {}, index: 0,
  startedAt: 1000, deadline: mode === 'exam' ? 1000 + 130 * 60000 : null,
});
const answer = (sessionId, questionId, correct, at = '2026-11-13T12:00:00.000Z') => ({
  sessionId, questionId, correct, at, selected: correct ? [0] : [1], domain: 1, mode: 'practice',
});
const result = (id = 'quiz-1', finishedAt = '2026-11-13T12:00:00.000Z') => ({
  id, mode: 'exam', questionIds: ['q1', 'q2', 'q3'], answers: { q1: [0] }, correct: 1, total: 3,
  duration: 1000, finishedAt,
});
function frozen(value) {
  if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(frozen); }
  return value;
}

test('offline devices retain disjoint task, lesson, lab, note and setting edits', () => {
  const original = base();
  const laptop = edit(original, 'laptop', 200, s => { s.tasks.t1 = true; s.notes.q1 = 'Read the constraint'; s.settings.hours = 8; });
  const phone = edit(original, 'phone', 210, s => { s.lessons.l1 = true; s.labSteps['lab:step:0'] = true; s.notes.q2 = 'Use a role'; s.settings.name = 'Learner'; });
  const merged = mergeDocuments(laptop, phone);
  assert.deepEqual(merged.state.tasks, { t1: true });
  assert.deepEqual(merged.state.lessons, { l1: true });
  assert.deepEqual(merged.state.labSteps, { 'lab:step:0': true });
  assert.deepEqual(merged.state.notes, { q1: 'Read the constraint', q2: 'Use a role' });
  assert.equal(merged.state.settings.hours, 8);
  assert.equal(merged.state.settings.name, 'Learner');
  assert.deepEqual(mergeDocuments(phone, laptop), merged);
});

test('a later unchecked value wins over an older checked value', () => {
  const checked = edit(base(), 'laptop', 200, s => { s.tasks.t1 = true; });
  const unchecked = edit(checked, 'phone', 300, s => { s.tasks.t1 = false; });
  assert.equal(mergeDocuments(checked, unchecked).state.tasks.t1, false);
  assert.equal(mergeDocuments(unchecked, checked).state.tasks.t1, false);
});

test('deleting a manual override or note leaves a tombstone that prevents resurrection', () => {
  const saved = edit(base(), 'laptop', 200, s => { s.tasks.override = true; s.notes.q1 = 'Old note'; });
  const deleted = edit(saved, 'phone', 300, s => { delete s.tasks.override; delete s.notes.q1; });
  assert.ok(deleted.clocks['/tasks/override']);
  assert.ok(deleted.clocks['/notes/q1']);
  const merged = mergeDocuments(saved, deleted);
  assert.equal(Object.hasOwn(merged.state.tasks, 'override'), false);
  assert.equal(Object.hasOwn(merged.state.notes, 'q1'), false);
  const unrelated = edit(merged, 'laptop', 400, s => { s.tasks.other = true; });
  assert.equal(Object.hasOwn(mergeDocuments(unrelated, saved).state.tasks, 'override'), false);
});

test('hybrid clocks preserve causal writes despite a clock rollback or a slower device', () => {
  const remote = edit(base(), 'phone', 500000, s => { s.notes.q1 = 'Remote'; });
  const local = edit(mergeDocuments(base(), remote), 'laptop', 5, s => { s.notes.q1 = 'After observing remote'; });
  assert.deepEqual(local.clocks['/notes/q1'], [500000, 1, 'laptop']);
  assert.equal(mergeDocuments(remote, local).state.notes.q1, 'After observing remote');
  const again = edit(local, 'laptop', 1, s => { s.notes.q1 = 'Another later edit'; });
  assert.deepEqual(again.clocks['/notes/q1'], [500000, 2, 'laptop']);
});

test('same-time concurrent edits have a deterministic device-ID tie break', () => {
  const original = base();
  const a = edit(original, 'device-a', 200, s => { s.notes.q1 = 'A'; });
  const z = edit(original, 'device-z', 200, s => { s.notes.q1 = 'Z'; });
  assert.equal(mergeDocuments(a, z).state.notes.q1, 'Z');
  assert.deepEqual(mergeDocuments(a, z), mergeDocuments(z, a));
});

test('map merges are associative, commutative and idempotent', () => {
  const original = base();
  const a = edit(original, 'a', 200, s => { s.notes.n1 = 'a'; s.tasks.t = true; });
  const b = edit(original, 'b', 300, s => { s.notes.n2 = 'b'; s.tasks.t = false; });
  const c = edit(a, 'c', 400, s => { delete s.notes.n1; s.lessons.l = true; });
  assert.deepEqual(mergeDocuments(mergeDocuments(a, b), c), mergeDocuments(a, mergeDocuments(b, c)));
  assert.deepEqual(mergeDocuments(a, a), sanitizeDocument(a));
});

test('attempts and completed sessions are unioned and duplicate events are reconciled', () => {
  const original = base();
  const a = edit(original, 'a', 200, s => { s.attempts.push(answer('s1', 'q1', false)); s.history.push(result('s1')); });
  const b = edit(original, 'b', 300, s => { s.attempts.push(answer('s2', 'q2', true)); s.history.push(result('s2')); });
  const both = mergeDocuments(a, b);
  assert.deepEqual(both.state.attempts.map(x => x.sessionId), ['s1', 's2']);
  assert.deepEqual(both.state.history.map(x => x.id), ['s1', 's2']);
  const corrected = edit(both, 'b', 400, s => { s.attempts[0] = answer('s1', 'q1', true); });
  const merged = mergeDocuments(a, corrected);
  assert.equal(merged.state.attempts.length, 2);
  assert.equal(merged.state.attempts.find(x => x.sessionId === 's1').correct, true);
  assert.equal(merged.state.history.length, 2);
});

test('legacy attempts without session IDs remain distinct by question and timestamp', () => {
  const state = initial();
  state.attempts = [answer(undefined, 'q1', false), answer(undefined, 'q1', true, '2026-11-13T13:00:00Z')];
  delete state.attempts[0].sessionId;
  delete state.attempts[1].sessionId;
  const doc = createDocument(state, 'legacy-device', 200);
  assert.equal(doc.state.attempts.length, 2);
  assert.deepEqual(doc.state.attempts.map(a => a.correct), [false, true]);
});

test('record chronology follows observed logical time when wall-clock timestamps go backward', () => {
  const first = edit(base(), 'phone', 500000, s => { s.attempts.push(answer('s1', 'q1', false, '2026-11-13T13:00:00Z')); });
  const next = edit(first, 'laptop', 1, s => { s.attempts.push(answer('s2', 'q1', true, '2026-11-13T12:00:00Z')); });
  assert.deepEqual(mergeDocuments(first, next).state.attempts.map(a => a.correct), [false, true]);
});

test('snapshot omission does not delete append-only history or attempts', () => {
  const doc = edit(base(), 'laptop', 200, s => { s.attempts.push(answer('s1', 'q1', true)); s.history.push(result('s1')); });
  const next = edit(doc, 'phone', 300, s => { s.attempts = []; s.history = []; });
  assert.equal(next.state.attempts.length, 1);
  assert.equal(next.state.history.length, 1);
});

test('activity merges by per-day maximum rather than double-counting synced activity', () => {
  const a = edit(base(), 'a', 200, s => { s.activity['2026-11-13'] = 3; s.activity['2026-11-12'] = 1; });
  const b = edit(base(), 'b', 300, s => { s.activity['2026-11-13'] = 5; s.activity['2026-11-14'] = 2; });
  assert.deepEqual(mergeDocuments(a, b).state.activity, { '2026-11-12': 1, '2026-11-13': 5, '2026-11-14': 2 });
});

test('the same active quiz merges independent answers, submissions, flags and the latest index', () => {
  const original = edit(base(), 'laptop', 200, s => { s.session = quiz(); });
  const a = edit(original, 'laptop', 300, s => { s.session.answers.q1 = [0]; s.session.submitted.q1 = true; s.session.index = 1; });
  const b = edit(original, 'phone', 400, s => { s.session.answers.q2 = [1, 2]; s.session.flagged.q2 = true; s.session.index = 2; });
  const merged = mergeDocuments(a, b);
  assert.deepEqual(merged.state.session.answers, { q1: [0], q2: [1, 2] });
  assert.deepEqual(merged.state.session.submitted, { q1: true });
  assert.deepEqual(merged.state.session.flagged, { q2: true });
  assert.equal(merged.state.session.index, 2);
  assert.equal(merged.state.session.deadline, quiz().deadline);
  assert.deepEqual(merged, mergeDocuments(b, a));
});

test('answer deletion and unflagging propagate within the same active quiz', () => {
  const original = edit(base(), 'a', 200, s => { s.session = quiz(); s.session.answers.q1 = [0]; s.session.flagged.q1 = true; });
  const deleted = edit(original, 'b', 300, s => { delete s.session.answers.q1; s.session.flagged.q1 = false; });
  const merged = mergeDocuments(original, deleted);
  assert.equal(Object.hasOwn(merged.state.session.answers, 'q1'), false);
  assert.equal(merged.state.session.flagged.q1, false);
});

test('updating or merging an active exam never extends its deadline', () => {
  const original = edit(base(), 'a', 200, s => { s.session = quiz(); });
  const edited = edit(original, 'b', 300, s => { s.session.deadline += 600000; s.session.startedAt += 600000; s.session.answers.q1 = [0]; });
  assert.equal(edited.state.session.deadline, quiz().deadline);
  assert.equal(edited.state.session.startedAt, quiz().startedAt);
  assert.equal(mergeDocuments(original, edited).state.session.deadline, quiz().deadline);
});

test('a later quiz-start marker wins over a newer answer to an older active quiz', () => {
  const first = edit(base(), 'a', 200, s => { s.session = quiz('first'); });
  const second = edit(first, 'b', 300, s => { s.session = quiz('second'); });
  const lateOldAnswer = edit(first, 'a', 900, s => { s.session.answers.q1 = [0]; });
  assert.equal(mergeDocuments(second, lateOldAnswer).state.session.id, 'second');
  assert.deepEqual(mergeDocuments(second, lateOldAnswer), mergeDocuments(lateOldAnswer, second));
});

test('an empty new device does not cancel an existing active quiz', () => {
  const active = edit(base(), 'laptop', 200, s => { s.session = quiz(); });
  const empty = createDocument(initial(), 'phone', 900);
  assert.equal(mergeDocuments(active, empty).state.session.id, 'quiz-1');
});

test('explicitly clearing an active quiz propagates without a completed record', () => {
  const active = edit(base(), 'a', 200, s => { s.session = quiz(); });
  const cancelled = edit(active, 'b', 300, s => { s.session = null; });
  assert.equal(mergeDocuments(cancelled, active).state.session, null);
});

test('a completed quiz cannot be resurrected by an offline device', () => {
  const active = edit(base(), 'a', 200, s => { s.session = quiz(); });
  const completed = edit(active, 'b', 300, s => { s.session = null; s.history.push(result()); s.attempts.push(answer('quiz-1', 'q1', true)); });
  const offline = edit(active, 'a', 900, s => { s.session.answers.q2 = [1]; });
  const merged = mergeDocuments(offline, completed);
  assert.equal(merged.state.session, null);
  assert.equal(merged.state.history.length, 1);
  assert.equal(merged.state.attempts.length, 1);
  assert.ok(merged.clocks['/completed/quiz-1']);
});

test('completion tombstones survive the 500-result display-history cap', () => {
  const active = edit(base(), 'a', 200, s => { s.session = quiz('old'); });
  const completed = edit(active, 'a', 300, s => { s.session = null; s.history.push(result('old')); });
  const many = edit(completed, 'a', 400, s => {
    for (let i = 0; i < 500; i++) s.history.push(result(`new-${i}`, new Date(Date.UTC(2026, 10, 14, 0, i)).toISOString()));
  });
  assert.equal(many.state.history.length, 500);
  assert.equal(many.state.history.some(h => h.id === 'old'), false);
  assert.ok(many.clocks['/completed/old']);
  assert.equal(mergeDocuments(many, active).state.session, null);
});

test('an explicit reset dominates old-epoch data, including later offline writes', () => {
  const old = edit(base(), 'a', 200, s => { s.tasks.t1 = true; s.notes.q1 = 'Old'; s.history.push(result()); });
  const reset = resetDocument(old, initial(), 'b', 300);
  const offline = edit(old, 'a', 9000000, s => { s.tasks.t2 = true; s.notes.q1 = 'Offline after reset'; });
  const merged = mergeDocuments(reset, offline);
  assert.deepEqual(merged.state.tasks, {});
  assert.deepEqual(merged.state.notes, {});
  assert.deepEqual(merged.state.history, []);
  assert.deepEqual(merged.resetEpoch, reset.resetEpoch);
  const after = edit(merged, 'a', 1, s => { s.tasks.new = true; });
  assert.deepEqual(mergeDocuments(after, offline).state.tasks, { new: true });
});

test('concurrent resets resolve deterministically and do not resurrect either old epoch', () => {
  const old = edit(base(), 'a', 200, s => { s.notes.old = 'old'; });
  const stateA = initial(); stateA.settings.name = 'A';
  const stateB = initial(); stateB.settings.name = 'B';
  const a = resetDocument(old, stateA, 'a', 300), b = resetDocument(old, stateB, 'b', 300);
  assert.equal(mergeDocuments(a, b).state.settings.name, 'B');
  assert.deepEqual(mergeDocuments(a, b), mergeDocuments(b, a));
});

test('JSON pointer escaping keeps distinct map keys and their tombstones separate', () => {
  const doc = edit(base(), 'a', 200, s => { s.notes['a/b'] = 'slash'; s.notes['a~1b'] = 'tilde'; });
  const removed = edit(doc, 'b', 300, s => { delete s.notes['a/b']; });
  assert.deepEqual(mergeDocuments(doc, removed).state.notes, { 'a~1b': 'tilde' });
  assert.ok(removed.clocks['/notes/a~1b']);
  assert.ok(removed.clocks['/notes/a~01b']);
});

test('sanitization strips dangerous keys, invalid clocks, invalid sessions and extra payloads', () => {
  const doc = base();
  doc.state.tasks = JSON.parse('{"__proto__":true,"constructor":true,"safe":true}');
  doc.state.extra = { token: 'must-not-survive' };
  doc.state.activity['2026-02-30'] = 2;
  doc.state.session = { ...quiz(), questionIds: ['q1', 'q1'] };
  doc.clocks['/tasks/__proto__'] = [200, 0, 'a'];
  doc.clocks['/notes/constructor'] = [200, 0, 'a'];
  doc.clocks['/settings/locale'] = [200, 0, 'a'];
  doc.clocks['/tasks/bad'] = [Infinity, 0, 'a'];
  doc.clocks['/notes/bad~2escape'] = [200, 0, 'a'];
  const clean = sanitizeDocument(doc);
  assert.deepEqual(clean.state.tasks, { safe: true });
  assert.equal(Object.hasOwn(clean.state, 'extra'), false);
  assert.equal(clean.state.session, null);
  assert.equal(Object.hasOwn(clean.state.activity, '2026-02-30'), false);
  for (const key of ['/tasks/__proto__', '/notes/constructor', '/settings/locale', '/tasks/bad', '/notes/bad~2escape']) assert.equal(Object.hasOwn(clean.clocks, key), false);
  assert.equal(Object.prototype.polluted, undefined);
  assert.deepEqual(sanitizeDocument(clean), clean);
});

test('sanitization and document edits never mutate caller-owned objects', () => {
  const state = frozen(initial());
  const first = frozen(createDocument(state, 'a', 100));
  const other = edit(first, 'b', 200, s => { s.tasks.t = true; });
  assert.doesNotThrow(() => mergeDocuments(first, frozen(other)));
  assert.doesNotThrow(() => sanitizeDocument(first));
  assert.doesNotThrow(() => resetDocument(first, state, 'b', 300));
  assert.deepEqual(first.state.tasks, {});
});

test('invalid envelopes, reset epochs, device IDs and times fail explicitly', () => {
  for (const doc of [null, {}, { ...base(), format: 2 }, { ...base(), resetEpoch: [-1, 0, 'a'] }]) assert.throws(() => sanitizeDocument(doc));
  assert.throws(() => createDocument(initial(), '', 1));
  assert.throws(() => createDocument(initial(), 'a', NaN));
  assert.throws(() => updateDocument(base(), initial(), 'bad device', 1));
});

test('sync preserves the application’s 20,000-attempt cap', () => {
  const state = initial();
  state.attempts = Array.from({ length: 20001 }, (_, i) => answer(`s-${i}`, 'q1', true, new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString()));
  const doc = createDocument(state, 'a', 100);
  assert.equal(doc.state.attempts.length, 20000);
  assert.equal(doc.state.attempts[0].sessionId, 's-1');
  assert.equal(doc.state.attempts.at(-1).sessionId, 's-20000');
});
