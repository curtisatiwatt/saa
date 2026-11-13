export const STORAGE_KEY = 'saa-studio-v1';
export const DOMAIN_NAMES = {1:'安全架构',2:'弹性架构',3:'高性能架构',4:'成本优化'};
export const DOMAIN_WEIGHTS = {1:30,2:26,3:24,4:20};
export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function addDays(day, days) { const d=new Date(day+'T12:00:00'); d.setDate(d.getDate()+days); return localDay(d); }
export function daysBetween(a,b) { return Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/86400000); }
export function defaultState() { return { version:1, settings:{startDate:localDay(),hours:10,name:'Curtis'},tasks:{},lessons:{},labSteps:{},notes:{},attempts:[],history:[],activity:{},session:null }; }
const record = v => v && typeof v === 'object' && !Array.isArray(v);
const safeKey = k => !['__proto__','constructor','prototype'].includes(k);
function answerMap(v) { return Object.fromEntries(Object.entries(record(v)?v:{}).filter(([k,x])=>safeKey(k)&&Array.isArray(x)&&x.every(n=>Number.isInteger(n)&&n>=0&&n<10)&&new Set(x).size===x.length).map(([k,x])=>[k,[...x]])); }
function boolMap(v) { return Object.fromEntries(Object.entries(record(v)?v:{}).filter(([k,x])=>safeKey(k)&&typeof x==='boolean')); }
export function validateState(value) {
  if (!record(value) || value.version!==1 || !record(value.settings) || !Array.isArray(value.attempts) || !Array.isArray(value.history)) throw new Error('不是有效的 SAA Studio 备份文件');
  const s=defaultState();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value.settings.startDate) && !isNaN(Date.parse(value.settings.startDate)) && localDay(new Date(value.settings.startDate+'T12:00:00'))===value.settings.startDate) s.settings.startDate=value.settings.startDate;
  s.settings.hours = Math.min(25,Math.max(2,Number(value.settings.hours)||10));
  s.settings.name = String(value.settings.name||'Curtis').slice(0,30);
  for (const key of ['tasks','lessons','labSteps']) s[key]=boolMap(value[key]);
  s.notes=Object.fromEntries(Object.entries(record(value.notes)?value.notes:{}).filter(([k,v])=>safeKey(k)&&typeof v==='string').map(([k,v])=>[k,v.slice(0,20000)]));
  s.attempts=value.attempts.filter(a=>record(a)&&typeof a.questionId==='string'&&safeKey(a.questionId)&&typeof a.correct==='boolean'&&typeof a.at==='string'&&Array.isArray(a.selected)&&a.selected.every(n=>Number.isInteger(n)&&n>=0&&n<10)&&!isNaN(Date.parse(a.at))&&[1,2,3,4].includes(a.domain)).slice(-20000);
  s.history=value.history.filter(h=>record(h)&&typeof h.id==='string'&&Array.isArray(h.questionIds)&&h.questionIds.every(x=>typeof x==='string')&&record(h.answers)&&Number.isFinite(h.correct)&&Number.isFinite(h.total)&&h.total>0&&h.correct>=0&&h.correct<=h.total&&['exam','practice','review'].includes(h.mode)&&typeof h.finishedAt==='string'&&!isNaN(Date.parse(h.finishedAt))).slice(-500).map(h=>({...h,questionIds:[...new Set(h.questionIds.filter(safeKey))],answers:answerMap(h.answers),duration:Number.isFinite(h.duration)&&h.duration>=0?h.duration:0}));
  s.activity=Object.fromEntries(Object.entries(record(value.activity)?value.activity:{}).filter(([k,v])=>/^\d{4}-\d{2}-\d{2}$/.test(k)&&Number.isFinite(v)&&v>=0));
  const q=value.session;
  if (record(q)&&typeof q.id==='string'&&['exam','practice','review'].includes(q.mode)&&Array.isArray(q.questionIds)&&q.questionIds.length>0&&q.questionIds.length<=120&&q.questionIds.every(x=>typeof x==='string'&&safeKey(x))&&new Set(q.questionIds).size===q.questionIds.length&&record(q.answers)&&record(q.submitted)&&record(q.flagged)&&Number.isInteger(q.index)&&q.index>=0&&q.index<q.questionIds.length&&Number.isFinite(q.startedAt)&&(q.mode!=='exam'||Number.isFinite(q.deadline))) {
    s.session={...q,answers:answerMap(q.answers),submitted:boolMap(q.submitted),flagged:boolMap(q.flagged)};
  }
  return s;
}
export function sameAnswers(actual=[],expected=[]) { return actual.length===expected.length && new Set(actual).size===actual.length && [...actual].sort((a,b)=>a-b).every((a,i)=>a===[...expected].sort((a,b)=>a-b)[i]); }
export function shuffle(items,random=Math.random) { const a=[...items]; for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }
export function selectQuestions(questions,{mode='practice',domain='all',topic='all',difficulty='all',count=10,wrongIds=[]}={},random=Math.random) {
  if (mode==='exam') {
    const counts={1:20,2:17,3:15,4:13}; const selected=[];
    for(const [d,n] of Object.entries(counts)) { const pool=questions.filter(q=>q.domain===Number(d)); if(pool.length<n) throw new Error('该考纲领域的题目不足');selected.push(...shuffle(pool,random).slice(0,n)); }
    return shuffle(selected,random);
  }
  return shuffle(questions.filter(q=>(mode!=='review'||wrongIds.includes(q.id))&&(domain==='all'||q.domain===Number(domain))&&(topic==='all'||q.topic===topic)&&(difficulty==='all'||q.difficulty===difficulty)),random).slice(0,count);
}
export function latestAttempts(attempts) { const out=Object.create(null); for(const a of attempts) if(safeKey(a.questionId)) out[a.questionId]=a; return out; }
export function wrongQuestionIds(attempts) { return Object.values(latestAttempts(attempts)).filter(a=>!a.correct).map(a=>a.questionId); }
export function domainStats(attempts) { const result={};const latest=Object.values(latestAttempts(attempts));for(let d=1;d<=4;d++){const a=latest.filter(x=>x.domain===d);result[d]={total:a.length,correct:a.filter(x=>x.correct).length,percent:a.length?Math.round(a.filter(x=>x.correct).length/a.length*100):0};}return result; }
export function streak(activity,today=localDay()) { let day=activity[today]?today:addDays(today,-1);let n=0;while(activity[day]){n++;day=addDays(day,-1);}return n; }
export function makeSession(questions,mode='practice',now=Date.now()) {return {id:`${now}-${Math.random().toString(36).slice(2,8)}`,mode,questionIds:questions.map(q=>q.id),answers:{},submitted:{},flagged:{},index:0,startedAt:now,deadline:mode==='exam'?now+130*60*1000:null};}
export function scoreSession(session,questions) { const bank=new Map(questions.map(q=>[q.id,q]));let correct=0;const domains={}; for(const id of session.questionIds){const q=bank.get(id);if(!q)continue;const right=sameAnswers(session.answers[id]||[],q.answers);if(right)correct++;domains[q.domain]??={total:0,correct:0};domains[q.domain].total++;if(right)domains[q.domain].correct++;}return {correct,total:session.questionIds.length,percent:Math.round(correct/session.questionIds.length*100),domains}; }
export function planLength(hours) { return Math.ceil(80/hours); }
export function phaseWindow(index,hours) {return {start:Math.floor(index*10/hours*7),end:Math.ceil((index+1)*10/hours*7)-1};}
