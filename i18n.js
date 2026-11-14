import { lessons, labs, weeks, resources } from './data/curriculum.js';
import { lessonsEn, labsEn, weeksEn, resourcesEn } from './data/curriculum.en.js';
import { securityQuestions } from './data/questions-security.js';
import { securityQuestionsEn } from './data/questions-security.en.js';
import { performanceQuestions } from './data/questions-performance.js';
import { performanceQuestionsEn } from './data/questions-performance.en.js';
import { uiTranslations } from './ui-en.js';

export const LANGUAGE_KEY = 'saa-studio-language';
export const LANGUAGES = ['zh', 'en', 'bi'];
const dictionary = new Map();
const normalize = value => String(value).trim().replace(/\s+/g, ' ');
export function registerTranslations(entries) {
  for (const [source, target] of Object.entries(entries)) {
    if (typeof target === 'string' && source.trim() && normalize(source) !== normalize(target)) {
      dictionary.set(normalize(source), normalize(target));
    }
  }
}
function registerPair(source, translated) {
  if (typeof source === 'string' && typeof translated === 'string') {
    registerTranslations({ [source]: translated });
    // Lesson rendering splits section bodies into paragraphs.
    const a = source.split('\n').filter(Boolean), b = translated.split('\n').filter(Boolean);
    if (a.length === b.length) a.forEach((line, index) => registerTranslations({ [line]: b[index] }));
  } else if (Array.isArray(source) && Array.isArray(translated)) {
    source.forEach((item, index) => registerPair(item, translated[index]));
    if (source.every(item => typeof item === 'string') && translated.every(item => typeof item === 'string')) {
      for (const separator of [' / ', ' · ']) registerTranslations({ [source.join(separator)]: translated.join(separator) });
    }
  } else if (source && translated && typeof source === 'object' && typeof translated === 'object') {
    for (const key of Object.keys(source)) {
      if (!['id', 'url', 'source', 'difficulty'].includes(key)) registerPair(source[key], translated[key]);
    }
  }
}
for (const [source, translated] of [[lessons, lessonsEn], [labs, labsEn], [weeks, weeksEn], [resources, resourcesEn], [securityQuestions, securityQuestionsEn], [performanceQuestions, performanceQuestionsEn]]) registerPair(source, translated);
registerTranslations(uiTranslations);
const shortPhaseTitles = ['Foundations & security', 'Compute & storage', 'Data & scaling', 'Events & failure handling', 'Delivery & recovery', 'Architecture project', 'Mock exam & review', 'Readiness & booking'];
weeks.forEach((week, index) => registerTranslations({ [week.title.split('与')[0].slice(0, 8)]: shortPhaseTitles[index] }));

let language = 'zh';
try { const stored = globalThis.localStorage?.getItem(LANGUAGE_KEY); if (LANGUAGES.includes(stored)) language = stored; } catch { /* Local learning still works when storage is blocked. */ }
export const getLanguage = () => language;
export function setLanguage(value, { persist = true } = {}) {
  if (!LANGUAGES.includes(value)) return false;
  language = value;
  if (persist) { try { globalThis.localStorage?.setItem(LANGUAGE_KEY, value); } catch { /* Keep this session's language. */ } }
  return true;
}
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const patterns = [
  [/^准备好更进一步了吗，([\s\S]*)？$/, (_, name) => `Ready for your next step, ${name}?`],
  [/^(\d+) 周备考计划 · 每周 ([\d.]+) 小时$/, (_, weeks, hours) => `${weeks}-week study plan · ${hours} hours per week`],
  [/^建议目标窗口 (.+) · 达标后再预约考试$/, (_, date) => `Suggested target: ${toEnglish(date)} · Book when you are ready`],
  [/^(\d+) \/ (\d+) 项任务已完成$/, (_, done, total) => `${done} / ${total} tasks completed`],
  [/^(\d+) 道题的最近一次作答$/, (_, n) => `Latest answers to ${n} questions`],
  [/^第 (\d+) 阶段 \/ 共 (\d+) 阶段$/, (_, phase, total) => `Phase ${phase} of ${total}`],
  [/^第 (\d+) 阶段 · (.+)$/, (_, phase, title) => `Phase ${phase} · ${toEnglish(title)}`],
  [/^阶段 (\d+) · ([\d.]+) 小时$/, (_, phase, hours) => `Phase ${phase} · ${hours} hours`],
  [/^阶段 (\d+)$/, (_, n) => `Phase ${n}`],
  [/^考纲 (\d+)%$/, (_, n) => `Exam weight ${n}%`],
  [/^(\d+)% 正确 · 已练 (\d+) 题$/, (_, percent, n) => `${percent}% correct · ${n} practiced`],
  [/^已有 AWS 经验 · 共 ([\d.]+) 小时 · 按每周 ([\d.]+) 小时安排约 (\d+) 周$/, (_, total, hours, weeks) => `For learners with AWS experience · ${total} hours · About ${weeks} weeks at ${hours} hours/week`],
  [/^(\d+) \/ (\d+) 完成$/, (_, done, total) => `${done} / ${total} completed`],
  [/^(\d+) 节核心课程，把零散的服务连成完整的架构思路。$/, (_, n) => `${n} core lessons connect individual services into a coherent architecture.`],
  [/^(.+) · (\d+) MIN READ$/, (_, domain, minutes) => `${toEnglish(domain)} · ${minutes} MIN READ`],
  [/^(\d+) 道原创情景题 · 单选与多选 · 逐项解析 · 官方资料延伸阅读$/, (_, n) => `${n} original scenarios · Single and multiple answers · Option-by-option explanations · Official references`],
  [/^(.+)（考纲 (\d+)%）$/, (_, domain, weight) => `${toEnglish(domain)} (exam weight ${weight}%)`],
  [/^开始练习 · (\d+) 题$/, (_, n) => `Start practice · ${n} questions`],
  [/^当前筛选共 (\d+) 题 · 每组内不重复$/, (_, n) => `${n} questions match · No repeats within a session`],
  [/^(\d+) 次模考 · (\d+) 次已完成练习$/, (_, exams, total) => `${exams} mock exams · ${total} completed sessions`],
  [/^多选 · 选择 (\d+) 项$/, (_, n) => `Multiple answers · Choose ${n}`],
  [/^已(作答|提交) (\d+) \/ (\d+) 题$/, (_, action, done, total) => `${done} / ${total} ${action === '作答' ? 'answered' : 'submitted'}`],
  [/^第 (\d+) 题(，已标记)?$/, (_, n, flagged) => `Question ${n}${flagged ? ', flagged' : ''}`],
  [/^正确答案：(.+)$/, (_, answer) => `Correct answer: ${answer.replaceAll('、', ', ')}`],
  [/^(模拟考试|错题重练|专项练习)已完成$/, (_, mode) => `${toEnglish(mode)} completed`],
  [/^答对 (\d+) \/ (\d+) 题 · 用时 (\d+) 分钟$/, (_, correct, total, minutes) => `${correct} / ${total} correct · ${minutes} minutes`],
  [/^(\d+) \/ (\d+) 题$/, (_, correct, total) => `${correct} / ${total} questions`],
  [/^(\d+)\. ([\s\S]+)$/, (_, n, stem) => `${n}. ${toEnglish(stem)}`],
  [/^你的答案：(.+)$/, (_, answer) => `Your answer: ${toEnglish(answer).replaceAll('、', ', ')}`],
  [/^(\d+) 个实战实验，从架构设计到云上验证。每个步骤都有清晰的验收标准。$/, (_, n) => `${n} labs and design exercises, from architecture decisions to cloud verification. Every step has clear completion criteria.`],
  [/^(\d+)\/(\d+) 步骤已完成$/, (_, done, total) => `${done}/${total} steps completed`],
  [/^(\d+) \/ (\d+) 项完成（含资源清理）$/, (_, done, total) => `${done} / ${total} completed, including cleanup`],
  [/^重练错题 · (\d+) 题$/, (_, n) => `Practice mistakes · ${n} questions`],
  [/^最近正确率 (.+)$/, (_, result) => `Latest accuracy: ${toEnglish(result)}`],
  [/^([\d.]+) 小时 \/ 周 · 约 (\d+) 周完成$/, (_, hours, weeks) => `${hours} hours/week · About ${weeks} weeks`],
  [/^这道题需要选择 (\d+) 个答案。$/, (_, n) => `Choose ${n} answers for this question.`],
  [/^还有 (\d+) 题未(作答|提交)。结束后这些题计为未答，练习正确率分母包含全部题目。$/, (_, n, action) => `${n} questions have not been ${action === '作答' ? 'answered' : 'submitted'}. They will count as unanswered, and the session accuracy includes every question.`],
  [/^备份属于 ([\s\S]+)，包含 (\d+) 次作答、(\d+) 次完整练习。此操作会替换当前数据，建议先导出当前进度。$/, (_, name, attempts, sessions) => `This backup belongs to ${name} and contains ${attempts} answer records and ${sessions} completed sessions. It will replace current data. Export your current progress first.`],
  [/^完成步骤 (\d+)：([\s\S]+)$/, (_, n, title) => `Complete step ${n}: ${toEnglish(title)}`],
  [/^完成：([\s\S]+)$/, (_, title) => `Complete: ${toEnglish(title)}`],
  [/^打开 ([\s\S]+)$/, (_, title) => `Open ${toEnglish(title)}`],
  [/^(知识学习|动手实验|刷题练习|回顾复盘|学习任务) · (\d+) MIN$/, (_, kind, minutes) => `${toEnglish(kind)} · ${minutes} MIN`],
  [/^(.+月.+日) — (.+月.+日)$/, (_, start, end) => `${toEnglish(start)} — ${toEnglish(end)}`],
  [/^(\d{1,2})月(\d{1,2})日(?:\s+(.+))?$/, (_, month, day, time) => `${months[Number(month) - 1]} ${Number(day)}${time ? `, ${time}` : ''}`],
  [/^([\d.]+) 分钟$/, (_, n) => `${n} minutes`],
  [/^(\d+) 道题$/, (_, n) => `${n} questions`],
  [/^([\d.]+) 小时$/, (_, n) => `${n} hours`],
  [/^\/ ([\d.]+) 小时$/, (_, n) => `/ ${n} hours`],
];

// Translation is deliberately exact or pattern-anchored. It never substitutes
// arbitrary words inside user-authored content or evaluates translation strings.
export function toEnglish(value) {
  const text = normalize(value);
  if (!text) return text;
  if (dictionary.has(text)) return dictionary.get(text);
  for (const [pattern, replacement] of patterns) {
    const match = text.match(pattern);
    if (match) return replacement(...match);
  }
  return text;
}
export function tr(value, mode = language) {
  const text = String(value ?? '');
  if (mode === 'zh') return text;
  const english = toEnglish(text);
  if (mode === 'en') return english;
  return normalize(text) === english ? text : `${text} / ${english}`;
}
export function languagePicker() {
  return `<label class="language-picker" data-i18n-ignore><span class="language-picker-label">语言 / Language</span><select id="language-select" aria-label="语言 / Language">${[['zh', '中文'], ['en', 'English'], ['bi', '中英 / Bilingual']].map(([value, label]) => `<option value="${value}"${language === value ? ' selected' : ''}>${label}</option>`).join('')}</select></label>`;
}
export function matchesLearningSearch(value, query) {
  const needle = normalize(query).toLocaleLowerCase();
  if (!needle) return true;
  const fields = [value.title, value.subtitle, ...(value.topics || [])];
  return fields.some(text => `${text} ${toEnglish(text)}`.toLocaleLowerCase().includes(needle));
}

const originalText = new WeakMap();
const originalAttributes = new WeakMap();
const excludedText = 'script,style,textarea,code,pre,[contenteditable="true"],[data-i18n-ignore]';
const translatableAttributes = ['aria-label', 'placeholder', 'title', 'alt'];
export function translatePage(root = globalThis.document) {
  if (!root?.querySelectorAll) return;
  const doc = root.ownerDocument || root;
  // Restore our wrappers before retranslating the same dialog or document.
  for (const pair of [...root.querySelectorAll('[data-i18n-pair]')]) {
    if (pair.firstChild) pair.replaceWith(pair.firstChild);
  }
  // Entity decoding can leave adjacent text nodes; translate complete visible text.
  root.normalize?.();
  const walker = doc.createTreeWalker(root, 4);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const parent = node.parentElement;
    if (!parent || parent.closest(excludedText) || !node.textContent.trim()) continue;
    const source = originalText.has(node) ? originalText.get(node) : node.textContent;
    originalText.set(node, source);
    const english = toEnglish(source);
    const unchanged = normalize(source) === english;
    const leading = source.match(/^\s*/)[0], trailing = source.match(/\s*$/)[0];
    if (parent.tagName === 'OPTION' && !parent.hasAttribute('value')) parent.setAttribute('value', parent.value);
    node.textContent = language === 'en' && !unchanged ? `${leading}${english}${trailing}` : source;
    if (language === 'bi' && !unchanged) {
      if (parent.closest('option,title')) {
        // Native option labels cannot contain spans.
        node.textContent = `${leading}${normalize(source)} / ${english}${trailing}`;
      } else {
        const pair = doc.createElement('span');
        pair.className = 'i18n-pair';
        pair.setAttribute('data-i18n-pair', '');
        pair.setAttribute('lang', 'zh-CN');
        node.replaceWith(pair);
        pair.append(node);
        const secondary = doc.createElement('span');
        secondary.className = 'i18n-en';
        secondary.setAttribute('lang', 'en');
        secondary.textContent = english;
        pair.append(secondary);
      }
    }
  }
  const elements = [...root.querySelectorAll(translatableAttributes.map(key => `[${key}]`).join(','))];
  if (root.nodeType === 1) elements.unshift(root);
  for (const element of elements) {
    if (element.closest('[data-i18n-ignore]')) continue;
    const saved = originalAttributes.get(element) || {};
    for (const key of translatableAttributes) {
      if (!element.hasAttribute(key)) continue;
      if (!(key in saved)) saved[key] = element.getAttribute(key);
      element.setAttribute(key, tr(saved[key]));
    }
    originalAttributes.set(element, saved);
  }
  if (doc.documentElement) {
    doc.documentElement.lang = language === 'en' ? 'en' : 'zh-CN';
    doc.documentElement.dataset.language = language;
    doc.title = tr('SAA Studio · 架构师学习工作台');
  }
}
