import test from 'node:test';
import assert from 'node:assert/strict';
import { securityQuestions } from '../data/questions-security.js';
import { securityQuestionsEn } from '../data/questions-security.en.js';
import { performanceQuestions } from '../data/questions-performance.js';
import { performanceQuestionsEn } from '../data/questions-performance.en.js';
import { lessons, labs, weeks, resources } from '../data/curriculum.js';
import { lessonsEn, labsEn, weeksEn, resourcesEn } from '../data/curriculum.en.js';
import { makeSession, scoreSession } from '../core.js';
import {
  LANGUAGE_KEY, LANGUAGES, getLanguage, setLanguage, toEnglish, tr,
  languagePicker, matchesLearningSearch, registerTranslations,
} from '../i18n.js';

const questions = [...securityQuestions, ...performanceQuestions];
const questionsEn = [...securityQuestionsEn, ...performanceQuestionsEn];
const chinese = /\p{Script=Han}/u;
const normalized = text => String(text).trim().replace(/\s+/g, ' ').toLowerCase();
const displayFields = ['topic', 'stem', 'options', 'explanation', 'optionExplanations', 'takeaway'];
const contentPairs = [
  ['lessons', lessons, lessonsEn], ['labs', labs, labsEn],
  ['weeks', weeks, weeksEn], ['resources', resources, resourcesEn],
];

function sameStructure(original, translated, path) {
  assert.equal(typeof translated, typeof original, `${path}: changed type`);
  if (Array.isArray(original)) {
    assert.ok(Array.isArray(translated), `${path}: expected an array`);
    assert.equal(translated.length, original.length, `${path}: changed length`);
    original.forEach((value, index) => sameStructure(value, translated[index], `${path}[${index}]`));
  } else if (original && typeof original === 'object') {
    assert.deepEqual(Object.keys(translated).sort(), Object.keys(original).sort(), `${path}: changed fields`);
    for (const key of Object.keys(original)) sameStructure(original[key], translated[key], `${path}.${key}`);
  } else if (typeof original !== 'string') {
    assert.equal(translated, original, `${path}: changed nontext data`);
  }
}

function assertEnglish(value, path) {
  if (typeof value === 'string') {
    assert.ok(value.trim().length, `${path}: empty English text`);
    assert.equal(chinese.test(value), false, `${path}: contains untranslated Chinese`);
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => assertEnglish(item, `${path}[${index}]`));
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) assertEnglish(item, `${path}.${key}`);
  }
}

function assertDictionaryPair(original, translated, path) {
  if (typeof original === 'string') {
    // AWS service capitalization can differ between independently authored
    // questions with the same Chinese phrase, without changing their meaning.
    if (chinese.test(original)) assert.equal(normalized(toEnglish(original)), normalized(translated), path);
  } else if (Array.isArray(original)) {
    original.forEach((value, index) => assertDictionaryPair(value, translated[index], `${path}[${index}]`));
  } else if (original && typeof original === 'object') {
    for (const key of Object.keys(original)) {
      if (!['id', 'url', 'source', 'difficulty'].includes(key)) {
        assertDictionaryPair(original[key], translated[key], `${path}.${key}`);
      }
    }
  }
}

test('all 120 translated questions preserve IDs, answer indices, option positions, and metadata', () => {
  assert.equal(securityQuestionsEn.length, 60);
  assert.equal(performanceQuestionsEn.length, 60);
  assert.equal(new Set(questionsEn.map(q => q.id)).size, 120);
  assert.deepEqual(questionsEn.map(q => q.id), questions.map(q => q.id));
  for (let index = 0; index < questions.length; index++) {
    const original = questions[index], translated = questionsEn[index];
    sameStructure(original, translated, original.id);
    for (const field of ['id', 'domain', 'difficulty', 'answers', 'source']) {
      assert.deepEqual(translated[field], original[field], `${original.id}.${field}`);
    }
    assert.equal(translated.optionExplanations.length, translated.options.length, original.id);
    assert.equal(new Set(translated.options).size, translated.options.length, original.id);
    assert.ok(translated.answers.every(i => Number.isInteger(i) && i >= 0 && i < translated.options.length), original.id);
    for (const field of displayFields) {
      assertEnglish(translated[field], `${original.id}.${field}`);
      assertDictionaryPair(original[field], translated[field], `${original.id}.${field}`);
    }
    assertEnglish(toEnglish(translated.difficulty), `${original.id}.displayDifficulty`);
    if (translated.answers.length > 1) {
      assert.ok(translated.options.length >= 5, original.id);
      const count = translated.answers.length;
      const word = { 2: 'two', 3: 'three' }[count];
      assert.match(translated.stem, new RegExp(`(?:choose|select)\\s+(?:${count}|${word})\\b`, 'i'), `${original.id}: missing selection count`);
    } else assert.equal(translated.options.length, 4, original.id);
  }
});

test('independent answer fixtures catch option rotation errors in both translated banks', () => {
  const expected = {
    'sec-001': ['Attach an IAM instance role with least-privilege S3 permissions to EC2, and let the SDK obtain temporary credentials'],
    'sec-002': ['The request is denied because an applicable explicit Deny overrides an Allow'],
    'perf-001': ['Choose an SSD EBS volume that can deliver the required IOPS', 'Check the EC2 instance limits for EBS bandwidth and IOPS'],
    'perf-002': ['An Amazon EFS Regional file system'],
    'perf-004': ['Use FSx for Lustre with an S3 data repository association'],
    'perf-006': ['Distribute the images through CloudFront', 'Use versioned filenames and appropriate Cache-Control settings'],
    'perf-039': ['S3 Glacier Deep Archive'],
  };
  for (const [id, options] of Object.entries(expected)) {
    const q = questionsEn.find(question => question.id === id);
    assert.deepEqual(q.answers.map(index => q.options[index]).sort(), [...options].sort(), id);
  }
});

test('a saved quiz grades identically in both languages without mutating answers or order', () => {
  const before = JSON.stringify([questions, questionsEn]);
  const session = makeSession(questions, 'exam', 1700000000000);
  session.answers = Object.fromEntries(questions.map(q => [q.id, [...q.answers]]));
  assert.equal(scoreSession(session, questions).correct, 120);
  assert.deepEqual(scoreSession(session, questionsEn), scoreSession(session, questions));
  // Include a wrong response, an unanswered response, and partial multi-select.
  const first = questions[0];
  session.answers[first.id] = [first.options.findIndex((_, index) => !first.answers.includes(index))];
  delete session.answers[questions[1].id];
  const multi = questions.find(q => q.answers.length > 1 && ![first.id, questions[1].id].includes(q.id));
  session.answers[multi.id] = [multi.answers[0]];
  const saved = JSON.stringify(session);
  assert.equal(scoreSession(session, questionsEn).correct, 117);
  assert.deepEqual(scoreSession(session, questionsEn), scoreSession(session, questions));
  assert.equal(JSON.stringify(session), saved);
  assert.equal(JSON.stringify([questions, questionsEn]), before);
});

test('translated curriculum preserves the complete learning structure and completion identifiers', () => {
  assert.equal(lessonsEn.length, 24);
  assert.equal(labsEn.length, 12);
  assert.equal(weeksEn.length, 8);
  for (const [label, original, translated] of contentPairs) {
    sameStructure(original, translated, label);
    assert.deepEqual(translated.map(item => item.id), original.map(item => item.id), label);
    assertEnglish(translated, label);
    assertDictionaryPair(original, translated, label);
  }
  for (let i = 0; i < lessons.length; i++) {
    for (const key of ['id', 'domain', 'minutes', 'topics', 'sources']) {
      assert.deepEqual(lessonsEn[i][key], lessons[i][key], `lesson ${i}.${key}`);
    }
    lessons[i].sections.forEach((section, j) => {
      const zhParagraphs = section.body.split('\n').filter(Boolean);
      const enParagraphs = lessonsEn[i].sections[j].body.split('\n').filter(Boolean);
      assert.equal(enParagraphs.length, zhParagraphs.length);
      zhParagraphs.forEach((paragraph, k) => assert.equal(normalized(toEnglish(paragraph)), normalized(enParagraphs[k])));
    });
  }
  for (let i = 0; i < labs.length; i++) {
    for (const key of ['id', 'minutes', 'services', 'sources']) assert.deepEqual(labsEn[i][key], labs[i][key]);
  }
  for (let i = 0; i < weeks.length; i++) {
    for (const key of ['id', 'hours', 'lessonIds', 'labIds']) assert.deepEqual(weeksEn[i][key], weeks[i][key]);
    weeks[i].tasks.forEach((task, j) => {
      for (const key of ['id', 'kind', 'minutes', 'lessonId', 'lessonIds', 'labId']) {
        assert.deepEqual(weeksEn[i].tasks[j][key], task[key], `${task.id}.${key}`);
      }
    });
  }
  assert.equal(weeksEn.flatMap(w => w.tasks).reduce((total, task) => total + task.minutes, 0), 4800);
  resources.forEach((resource, i) => assert.equal(resourcesEn[i].url, resource.url));
});

test('UI dictionary translates source links, counts, quiz feedback, aria labels, and date ranges', () => {
  const cases = {
    '学习总览': 'Overview',
    '主导航': 'Main navigation',
    '跳到主要内容': 'Skip to main content',
    '答案选项': 'Answer choices',
    '搜索服务或知识点': 'Search services or concepts',
    '阅读 AWS 官方资料': 'Read the official AWS documentation',
    '继续阅读官方资料': 'Continue with official documentation',
    '基础': 'Foundational',
    '进阶': 'Intermediate',
    '12 / 40 项任务已完成': '12 / 40 tasks completed',
    '8 周备考计划 · 每周 10 小时': '8-week study plan · 10 hours per week',
    '阶段 2 · 7.5 小时': 'Phase 2 · 7.5 hours',
    '第 3 阶段 / 共 8 阶段': 'Phase 3 of 8',
    '86% 正确 · 已练 65 题': '86% correct · 65 practiced',
    '开始练习 · 20 题': 'Start practice · 20 questions',
    '当前筛选共 120 题 · 每组内不重复': '120 questions match · No repeats within a session',
    '2 次模考 · 5 次已完成练习': '2 mock exams · 5 completed sessions',
    '多选 · 选择 3 项': 'Multiple answers · Choose 3',
    '已作答 4 / 65 题': '4 / 65 answered',
    '已提交 3 / 20 题': '3 / 20 submitted',
    '第 12 题，已标记': 'Question 12, flagged',
    '正确答案：A、D': 'Correct answer: A, D',
    '你的答案：未作答': 'Your answer: Unanswered',
    '答对 55 / 65 题 · 用时 110 分钟': '55 / 65 correct · 110 minutes',
    '3/5 步骤已完成': '3/5 steps completed',
    '5 / 7 项完成（含资源清理）': '5 / 7 completed, including cleanup',
    '这道题需要选择 2 个答案。': 'Choose 2 answers for this question.',
    '11月13日': 'November 13',
    '11月13日 17:23': 'November 13, 17:23',
    '11月13日 — 11月19日': 'November 13 — November 19',
    '建议目标窗口 11月13日 — 11月19日 · 达标后再预约考试': 'Suggested target: November 13 — November 19 · Book when you are ready',
  };
  for (const [source, english] of Object.entries(cases)) assert.equal(toEnglish(source), english, source);
  assert.equal(toEnglish(`1. ${questions[0].stem}`), `1. ${questionsEn[0].stem}`);
  assert.equal(toEnglish(`完成步骤 1：${labs[0].steps[0].title}`), `Complete step 1: ${labsEn[0].steps[0].title}`);
  assert.equal(toEnglish(`打开 ${lessons[0].title}`), `Open ${lessonsEn[0].title}`);
});

test('language choices persist independently of progress and bilingual output avoids duplicate service names', () => {
  const previousLanguage = getLanguage();
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const writes = [];
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { setItem: (key, value) => writes.push([key, value]) } });
  try {
    assert.deepEqual(LANGUAGES, ['zh', 'en', 'bi']);
    assert.equal(setLanguage('en'), true);
    assert.equal(getLanguage(), 'en');
    assert.equal(tr('学习总览'), 'Overview');
    assert.deepEqual(writes, [[LANGUAGE_KEY, 'en']]);
    assert.equal(LANGUAGE_KEY, 'saa-studio-language');
    assert.equal(setLanguage('unsupported'), false);
    assert.equal(getLanguage(), 'en');
    assert.equal(setLanguage('bi', { persist: false }), true);
    assert.equal(writes.length, 1);
    assert.equal(tr('学习总览'), '学习总览 / Overview');
    assert.equal(tr('AWS Lambda'), 'AWS Lambda');
    assert.equal(tr('我的私有笔记 123'), '我的私有笔记 123');
    assert.equal(tr('学习总览', 'zh'), '学习总览');
    const picker = languagePicker();
    assert.match(picker, /<label\b/);
    assert.match(picker, /aria-label="语言 \/ Language"/);
    assert.match(picker, /<option value="bi" selected>/);
    for (const mode of LANGUAGES) assert.match(picker, new RegExp(`<option value="${mode}"`));
    // User-defined names are interpolated without translating their characters.
    assert.equal(toEnglish('准备好更进一步了吗，小陈？'), 'Ready for your next step, 小陈?');
  } finally {
    setLanguage(previousLanguage, { persist: false });
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
    else delete globalThis.localStorage;
  }
});

test('storage failures do not prevent an in-session language switch', () => {
  const previousLanguage = getLanguage();
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('Storage blocked'); } });
  try {
    assert.equal(setLanguage('en'), true);
    assert.equal(getLanguage(), 'en');
  } finally {
    setLanguage(previousLanguage, { persist: false });
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
    else delete globalThis.localStorage;
  }
});

test('course search works in Chinese, English, and AWS service names', () => {
  assert.equal(matchesLearningSearch(lessons[0], '从需求到架构'), true);
  assert.equal(matchesLearningSearch(lessons[0], 'FROM REQUIREMENTS'), true);
  assert.equal(matchesLearningSearch(lessons[0], 'well-architected'), true);
  assert.equal(matchesLearningSearch(lessons[0], 'not-a-course-xyz'), false);
  assert.equal(matchesLearningSearch(lessons[0], '  '), true);
});

test('additional feature dictionaries can register exact translations without substring substitution', () => {
  registerTranslations({ '测试专用同步状态': 'Test-only sync status' });
  assert.equal(toEnglish('  测试专用同步状态  '), 'Test-only sync status');
  assert.equal(toEnglish('笔记：测试专用同步状态'), '笔记：测试专用同步状态');
  assert.equal(toEnglish('already English'), 'already English');
});
