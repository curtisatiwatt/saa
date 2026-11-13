import test from 'node:test';
import assert from 'node:assert/strict';
import { securityQuestions } from '../data/questions-security.js';
import { performanceQuestions } from '../data/questions-performance.js';
import { lessons, labs, weeks, resources } from '../data/curriculum.js';

const questions = [...securityQuestions, ...performanceQuestions];
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const officialHosts = new Set(['docs.aws.amazon.com', 'aws.amazon.com', 'builder.aws.com', 'calculator.aws', 'skillbuilder.aws', 'workshops.aws']);
function officialUrl(value, label) {
  const url = new URL(value);
  assert.equal(url.protocol, 'https:', label);
  assert.ok(officialHosts.has(url.hostname), `${label}: unexpected source host ${url.hostname}`);
}
function uniqueIds(items, label) {
  assert.equal(new Set(items.map(item => item.id)).size, items.length, `${label}: duplicate ids`);
  assert.ok(items.every(item => item.id !== undefined && item.id !== ''), `${label}: missing id`);
}

test('the original bank provides enough unique questions across all exam domains', () => {
  assert.ok(questions.length >= 120);
  uniqueIds(questions, 'questions');
  assert.equal(new Set(questions.map(q => q.stem)).size, questions.length, 'duplicate scenario text');
  for (const [domain, minimum] of [[1, 20], [2, 17], [3, 15], [4, 13]]) {
    assert.ok(questions.filter(q => q.domain === domain).length >= minimum, `domain ${domain} cannot fill a mock exam`);
  }
  assert.ok(questions.filter(q => q.answers.length > 1).length >= 25, 'include substantial multiple-response practice');
});

test('all answer indices, option explanations and response counts are internally consistent', () => {
  for (const q of questions) {
    assert.ok([1, 2, 3, 4].includes(q.domain), q.id);
    assert.ok(['基础', '进阶'].includes(q.difficulty), q.id);
    for (const field of ['id', 'topic', 'stem', 'explanation', 'takeaway']) assert.ok(nonempty(q[field]), `${q.id}.${field}`);
    assert.ok(Array.isArray(q.options) && q.options.every(nonempty), `${q.id}.options`);
    assert.equal(new Set(q.options).size, q.options.length, `${q.id}: duplicate options`);
    assert.equal(q.optionExplanations.length, q.options.length, `${q.id}: missing option explanations`);
    assert.ok(q.optionExplanations.every(nonempty), `${q.id}: blank option explanation`);
    assert.ok(q.answers.length > 0 && q.answers.length < q.options.length, `${q.id}: invalid answer count`);
    assert.equal(new Set(q.answers).size, q.answers.length, `${q.id}: repeated answer index`);
    assert.ok(q.answers.every(index => Number.isInteger(index) && index >= 0 && index < q.options.length), `${q.id}: answer outside options`);
    if (q.answers.length > 1) {
      assert.ok(q.options.length >= 5, `${q.id}: multiple-response needs at least five options`);
      assert.match(q.stem, /选择(?:两|三|二|2|3)项|选择\s*[23]\s*项/, `${q.id}: selection count must be explicit`);
    } else assert.equal(q.options.length, 4, `${q.id}: single-response needs four options`);
    officialUrl(q.source, `${q.id}.source`);
  }
});

test('lessons include teaching text, decision guidance, checks and official references', () => {
  assert.ok(lessons.length >= 24);
  uniqueIds(lessons, 'lessons');
  assert.deepEqual(new Set(lessons.map(l => l.domain)), new Set([1, 2, 3, 4]));
  for (const lesson of lessons) {
    assert.ok(nonempty(lesson.title) && nonempty(lesson.subtitle), lesson.id);
    assert.ok(Number.isFinite(lesson.minutes) && lesson.minutes > 0, lesson.id);
    assert.ok(lesson.topics.length > 0 && lesson.topics.every(nonempty), lesson.id);
    assert.ok(lesson.sections.length >= 3, `${lesson.id}: substantive lesson sections`);
    for (const section of lesson.sections) assert.ok(nonempty(section.title) && nonempty(section.body), lesson.id);
    assert.ok(lesson.decisions.length >= 2, lesson.id);
    for (const decision of lesson.decisions) assert.ok(['when', 'choose', 'why'].every(k => nonempty(decision[k])), lesson.id);
    assert.ok(lesson.pitfalls.length > 0 && lesson.checks.length > 0, lesson.id);
    assert.ok(lesson.sources.length > 0, lesson.id);
    for (const source of lesson.sources) officialUrl(source.url, `${lesson.id}: ${source.title}`);
  }
});

test('labs provide actionable steps, verification, deliverables, costs and cleanup', () => {
  assert.ok(labs.length >= 12);
  uniqueIds(labs, 'labs');
  for (const lab of labs) {
    for (const field of ['title', 'goal', 'cost', 'deliverable']) assert.ok(nonempty(lab[field]), `${lab.id}.${field}`);
    assert.ok(lab.steps.length >= 4, `${lab.id}: insufficient steps`);
    for (const step of lab.steps) assert.ok(['title', 'detail', 'verify'].every(k => nonempty(step[k])), `${lab.id}: incomplete step`);
    assert.ok(lab.cleanup.length > 0 && lab.cleanup.every(nonempty), `${lab.id}: cleanup missing`);
    assert.ok(lab.sources.length > 0, lab.id);
    for (const source of lab.sources) officialUrl(source.url, `${lab.id}: ${source.title}`);
  }
});

test('all eight phases total exactly 80 hours, with 600 minutes of checkable work each', () => {
  assert.equal(weeks.length, 8);
  assert.deepEqual(weeks.map(w => w.id), [1, 2, 3, 4, 5, 6, 7, 8]);
  uniqueIds(weeks.flatMap(w => w.tasks), 'tasks');
  let minutes = 0;
  for (const week of weeks) {
    assert.equal(week.hours, 10, `phase ${week.id}`);
    const phaseMinutes = week.tasks.reduce((sum, task) => sum + task.minutes, 0);
    assert.equal(phaseMinutes, 600, `phase ${week.id}: time budget`);
    minutes += phaseMinutes;
    assert.ok(nonempty(week.title) && nonempty(week.focus) && nonempty(week.milestone), `phase ${week.id}`);
    for (const task of week.tasks) {
      assert.ok(['learn', 'lab', 'practice', 'review'].includes(task.kind), task.id);
      assert.ok(Number.isInteger(task.minutes) && task.minutes > 0, task.id);
      assert.ok(nonempty(task.title) && nonempty(task.detail), task.id);
    }
  }
  assert.equal(minutes, 80 * 60);
});

test('curriculum navigation references resolve and the plan covers every lesson and lab', () => {
  const lessonIds = new Set(lessons.map(l => l.id));
  const labIds = new Set(labs.map(l => l.id));
  const plannedLessons = new Set();
  const plannedLabs = new Set();
  for (const week of weeks) {
    for (const id of week.lessonIds) { assert.ok(lessonIds.has(id), `unknown ${id}`); plannedLessons.add(id); }
    for (const id of week.labIds) { assert.ok(labIds.has(id), `unknown ${id}`); plannedLabs.add(id); }
    for (const task of week.tasks) {
      if (task.lessonId) {
        assert.ok(lessonIds.has(task.lessonId), task.id);
        assert.ok(week.lessonIds.includes(task.lessonId), `${task.id}: lesson not in phase`);
      }
      if (task.labId) {
        assert.ok(labIds.has(task.labId), task.id);
        assert.ok(week.labIds.includes(task.labId), `${task.id}: lab not in phase`);
      }
    }
  }
  assert.deepEqual(plannedLessons, lessonIds);
  assert.deepEqual(plannedLabs, labIds);
});

test('resource catalog links to identifiable official learning material', () => {
  uniqueIds(resources, 'resources');
  assert.ok(resources.length >= 5);
  for (const resource of resources) {
    assert.ok(['title', 'description', 'category'].every(k => nonempty(resource[k])), resource.id);
    officialUrl(resource.url, resource.id);
  }
});
