import test from 'node:test';
import assert from 'node:assert/strict';
import {
  localDay, addDays, daysBetween, defaultState, validateState, sameAnswers, shuffle,
  selectQuestions, latestAttempts, wrongQuestionIds, domainStats, streak, makeSession,
  scoreSession, planLength, phaseWindow,
} from '../core.js';
import { securityQuestions } from '../data/questions-security.js';
import { performanceQuestions } from '../data/questions-performance.js';

const bank = [...securityQuestions, ...performanceQuestions];
const sample = [
  { id: 'one', domain: 1, answers: [2] },
  { id: 'multi', domain: 2, answers: [0, 3] },
  { id: 'unanswered', domain: 2, answers: [1] },
];
const attempt = (questionId, correct, domain = 1) => ({ questionId, correct, domain,
  selected: correct ? [0] : [1], at: '2026-11-13T15:00:00.000Z' });
const completeHistory = (answers = { one: [2] }) => ({
  id: 'history-1', mode: 'practice', questionIds: ['one'], answers,
  correct: 1, total: 1, duration: 60000, finishedAt: '2026-11-13T15:00:00.000Z',
});

test('scoring requires the exact multi-select set, independent of ordering', () => {
  assert.equal(sameAnswers([3, 0], [0, 3]), true);
  assert.equal(sameAnswers([0], [0, 3]), false);
  assert.equal(sameAnswers([0, 3, 2], [0, 3]), false);
  assert.equal(sameAnswers([0, 0], [0, 3]), false);
  assert.equal(sameAnswers(['0', 3], [0, 3]), false);
  assert.equal(sameAnswers([], [0]), false);
  const selected = [3, 0];
  sameAnswers(selected, [0, 3]);
  assert.deepEqual(selected, [3, 0], 'grading must not reorder saved answers');
});

test('scoreSession counts unanswered questions and reports per-domain results', () => {
  const session = makeSession(sample, 'exam', 1000);
  session.answers = { one: [2], multi: [3, 0] };
  assert.deepEqual(scoreSession(session, sample), {
    correct: 2, total: 3, percent: 67,
    domains: { 1: { total: 1, correct: 1 }, 2: { total: 2, correct: 1 } },
  });
  session.answers.multi = [0, 0];
  assert.equal(scoreSession(session, sample).correct, 1, 'duplicate choices cannot earn credit');
});

test('a mock exam draws 65 unique questions with the intended domain allocation', () => {
  const originalIds = bank.map(q => q.id);
  const selected = selectQuestions(bank, { mode: 'exam' }, () => 0.37);
  assert.equal(selected.length, 65);
  assert.equal(new Set(selected.map(q => q.id)).size, 65);
  assert.deepEqual(Object.fromEntries([1, 2, 3, 4].map(d =>
    [d, selected.filter(q => q.domain === d).length])), { 1: 20, 2: 17, 3: 15, 4: 13 });
  assert.deepEqual(bank.map(q => q.id), originalIds, 'selection must not reorder the bank');
});

test('mock exams fail clearly when any domain has too few questions', () => {
  assert.throws(() => selectQuestions(bank.filter(q => q.domain !== 4), { mode: 'exam' }), /不足/);
});

test('practice combines domain, topic, difficulty, and size filters', () => {
  const target = bank.find(q => q.domain === 1 && q.difficulty === '基础');
  const options = { domain: '1', topic: target.topic, difficulty: '基础', count: 3 };
  const expected = bank.filter(q => q.domain === 1 && q.topic === target.topic && q.difficulty === '基础');
  const chosen = selectQuestions(bank, options, () => 0.4);
  assert.equal(chosen.length, Math.min(3, expected.length));
  assert.ok(chosen.every(q => expected.some(e => e.id === q.id)));
  assert.deepEqual(selectQuestions(bank, { topic: 'a topic that does not exist' }), []);
});

test('review draws only the requested wrong questions and respects filters', () => {
  const wrong = [bank[0].id, bank[1].id, bank.at(-1).id];
  const selected = selectQuestions(bank, { mode: 'review', wrongIds: wrong, domain: '1', count: 20 });
  assert.deepEqual(new Set(selected.map(q => q.id)), new Set(wrong.slice(0, 2)));
  assert.deepEqual(selectQuestions(bank, { mode: 'review', wrongIds: [] }), []);
});

test('shuffle returns a permutation without mutating the source', () => {
  const values = [1, 2, 3, 4, 5];
  const shuffled = shuffle(values, () => 0);
  assert.deepEqual(values, [1, 2, 3, 4, 5]);
  assert.deepEqual([...shuffled].sort(), values);
  assert.notDeepEqual(shuffled, values);
});

test('wrong questions and domain statistics use each question’s latest result', () => {
  const attempts = [attempt('a', false), attempt('b', true, 2), attempt('a', true), attempt('b', false, 2), attempt('c', true, 2)];
  assert.equal(latestAttempts(attempts).a.correct, true);
  assert.deepEqual(wrongQuestionIds(attempts), ['b']);
  assert.deepEqual(domainStats(attempts), {
    1: { total: 1, correct: 1, percent: 100 },
    2: { total: 2, correct: 1, percent: 50 },
    3: { total: 0, correct: 0, percent: 0 },
    4: { total: 0, correct: 0, percent: 0 },
  });
});

test('date helpers preserve local calendar days across months, years, and DST dates', () => {
  assert.equal(localDay(new Date(2026, 10, 13, 23, 59)), '2026-11-13');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2024-02-28', 1), '2024-02-29');
  assert.equal(addDays('2026-03-08', 1), '2026-03-09');
  assert.equal(addDays('2026-11-01', -1), '2026-10-31');
  assert.equal(daysBetween('2026-03-07', '2026-03-09'), 2);
  assert.equal(daysBetween('2026-11-02', '2026-10-31'), -2);
});

test('streak allows today to be pending, but ends at the first missing day', () => {
  const activity = { '2026-11-09': 1, '2026-11-11': 2, '2026-11-12': 1 };
  assert.equal(streak(activity, '2026-11-13'), 2);
  assert.equal(streak({ ...activity, '2026-11-13': 1 }, '2026-11-13'), 3);
  assert.equal(streak(activity, '2026-11-14'), 0);
  assert.equal(streak({}, '2026-11-13'), 0);
  assert.equal(streak({ '2026-11-13': 0 }, '2026-11-13'), 0);
});

test('exam deadlines remain absolute while practice has no countdown deadline', () => {
  const start = Date.UTC(2026, 10, 13, 15);
  const exam = makeSession(sample, 'exam', start);
  assert.equal(exam.startedAt, start);
  assert.equal(exam.deadline, start + 130 * 60 * 1000);
  assert.equal(makeSession(sample, 'practice', start).deadline, null);
  assert.deepEqual(exam.questionIds, ['one', 'multi', 'unanswered']);
  assert.deepEqual(exam.answers, {});
});

test('80-hour scheduling scales calendar length without changing phase work', () => {
  assert.equal(planLength(10), 8);
  assert.equal(planLength(8), 10);
  assert.equal(planLength(4), 20);
  assert.equal(planLength(12), 7);
  assert.deepEqual(phaseWindow(0, 10), { start: 0, end: 6 });
  assert.deepEqual(phaseWindow(7, 10), { start: 49, end: 55 });
  assert.deepEqual(phaseWindow(1, 5), { start: 14, end: 27 });
  for (const hours of [4, 6, 8, 10, 12, 15, 20]) {
    const windows = Array.from({ length: 8 }, (_, i) => phaseWindow(i, hours));
    assert.equal(windows[0].start, 0);
    assert.ok(windows.every(w => w.end >= w.start));
    assert.ok(windows.slice(1).every((w, i) => w.start <= windows[i].end + 1), 'no scheduling gaps');
    assert.ok(windows.at(-1).end < planLength(hours) * 7);
  }
});

test('defaultState creates independent mutable collections', () => {
  const first = defaultState();
  const second = defaultState();
  first.tasks['task-a'] = true;
  first.attempts.push(attempt('a', true));
  assert.deepEqual(second.tasks, {});
  assert.deepEqual(second.attempts, []);
  assert.equal(second.version, 1);
});

test('valid backup round-trips saved progress, a running exam and completed results', () => {
  const original = defaultState();
  original.settings = { startDate: '2026-11-13', hours: 8, name: '学习者' };
  original.tasks = { 'w1-learn': true };
  original.lessons = { 'lesson-01': true };
  original.labSteps = { 'lab-01:step:0': true };
  original.notes = { 'sec-001': '角色使用临时凭证。' };
  original.attempts = [attempt('one', true)];
  original.history = [completeHistory()];
  original.activity = { '2026-11-13': 3 };
  original.session = makeSession(sample, 'exam', 1000);
  original.session.answers = { one: [2] };
  original.session.flagged = { multi: true };
  const restored = validateState(JSON.parse(JSON.stringify(original)));
  assert.deepEqual(restored, original);
});

test('backup validation rejects unsupported roots and versions', () => {
  for (const invalid of [null, [], {}, { ...defaultState(), version: 2 }, { ...defaultState(), attempts: {} }, { ...defaultState(), settings: null }]) {
    assert.throws(() => validateState(invalid), /备份/);
  }
});

test('backup validation bounds preferences and strips invalid progress values', () => {
  const value = defaultState();
  value.settings = { startDate: '2026-02-30', hours: 100, name: 'x'.repeat(100) };
  value.tasks = { done: true, pending: false, injected: 'true' };
  value.notes = { good: 'x'.repeat(21000), invalid: 5 };
  value.activity = { '2026-11-13': 2, 'not-a-day': 3, '2026-11-12': -1 };
  const restored = validateState(value);
  assert.equal(restored.settings.startDate, localDay());
  assert.equal(restored.settings.hours, 25);
  assert.equal(restored.settings.name.length, 30);
  assert.deepEqual(restored.tasks, { done: true, pending: false });
  assert.equal(restored.notes.good.length, 20000);
  assert.equal(Object.hasOwn(restored.notes, 'invalid'), false);
  assert.deepEqual(restored.activity, { '2026-11-13': 2 });
});

test('malformed sessions are discarded instead of being resumed', () => {
  const good = makeSession(sample, 'exam', 1000);
  const malformed = [
    { ...good, mode: 'unsupported' }, { ...good, questionIds: [] },
    { ...good, questionIds: ['one', 'one'] }, { ...good, index: -1 },
    { ...good, index: 3 }, { ...good, index: 0.5 },
    { ...good, startedAt: '1000' }, { ...good, deadline: null },
    { ...good, answers: [] }, { ...good, submitted: [] },
  ];
  for (const session of malformed) {
    assert.equal(validateState({ ...defaultState(), session }).session, null, JSON.stringify(session));
  }
});

test('resumable sessions sanitize malformed answer and status entries', () => {
  const session = makeSession(sample, 'practice', 1000);
  session.answers = { one: [2], multi: 'not an array', unanswered: [1.5] };
  session.submitted = { one: true, multi: 'yes' };
  session.flagged = { one: false, multi: 1 };
  const restored = validateState({ ...defaultState(), session }).session;
  assert.deepEqual(restored.answers, { one: [2] });
  assert.deepEqual(restored.submitted, { one: true });
  assert.deepEqual(restored.flagged, { one: false });
});

test('completed result answers cannot retain shapes that crash result review', () => {
  const malformed = ['bad', 3, {}, null, [1.5], [false]];
  for (const answer of malformed) {
    const restored = validateState({ ...defaultState(), history: [completeHistory({ one: answer })] });
    for (const history of restored.history) {
      const normalized = history.answers.one || [];
      assert.ok(Array.isArray(normalized), `unsafe restored answer: ${JSON.stringify(answer)}`);
      assert.ok(normalized.every(Number.isInteger));
      assert.doesNotThrow(() => sameAnswers(normalized, [2]));
    }
  }
});

test('JSON prototype keys cannot become saved progress or answer map entries', () => {
  const poisoned = JSON.parse('{"__proto__":true,"constructor":true,"prototype":true,"safe":true}');
  const session = makeSession(sample, 'practice', 1000);
  session.answers = JSON.parse('{"__proto__":[0],"constructor":[1],"one":[2]}');
  session.submitted = poisoned;
  session.flagged = poisoned;
  const restored = validateState({ ...defaultState(), tasks: poisoned, lessons: poisoned, labSteps: poisoned,
    notes: JSON.parse('{"__proto__":"bad","constructor":"bad","safe":"note"}'), session });
  for (const map of [restored.tasks, restored.lessons, restored.labSteps, restored.notes,
    restored.session.answers, restored.session.submitted, restored.session.flagged]) {
    for (const key of ['__proto__', 'constructor', 'prototype']) assert.equal(Object.hasOwn(map, key), false);
  }
  assert.equal(Object.prototype.polluted, undefined);
});

test('dangerous question IDs cannot alter the prototype of the latest-attempt index', () => {
  const latest = latestAttempts([attempt('__proto__', false), attempt('constructor', false), attempt('safe', true)]);
  assert.ok(Object.getPrototypeOf(latest) === Object.prototype || Object.getPrototypeOf(latest) === null);
  assert.equal(latest.safe.correct, true);
  assert.equal(Object.prototype.questionId, undefined);
});

test('malformed attempt records and impossible result scores do not survive import', () => {
  const restored = validateState({ ...defaultState(),
    attempts: [attempt('good', true), null, { ...attempt('bad', false), selected: 'A' }, { ...attempt('bad-domain', false), domain: 9 }],
    history: [completeHistory(), { ...completeHistory(), correct: 3 }, { ...completeHistory(), total: 0 }],
  });
  assert.deepEqual(restored.attempts.map(a => a.questionId), ['good']);
  assert.equal(restored.history.length, 1);
});
