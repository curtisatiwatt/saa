import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultState } from '../core.js';
import { createSyncClient, SYNC_STORAGE } from '../sync-client.js';
import { deriveKeys, decryptDocument } from '../sync-crypto.js';

const copy = value => structuredClone(value);
const initial = () => ({ ...defaultState(), settings: { name: 'Curtis', startDate: '2026-11-13', hours: 10 } });
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
function memoryStorage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
}
function storageBus() {
  const values=new Map(),listeners=new Map(),events=[];
  let enabled=false,writes=0;
  function write(sender,key,value){
    if((values.get(key)??null)===value)return;
    if(value===null)values.delete(key);else values.set(key,value);
    writes++;
    if(enabled&&key===SYNC_STORAGE)for(const [id,listener]of listeners)if(id!==sender)events.push(()=>listener(value));
  }
  return {
    forTab:id=>({getItem:key=>values.get(key)??null,setItem:(key,value)=>write(id,key,String(value)),removeItem:key=>write(id,key,null)}),
    listen:(id,client)=>listeners.set(id,value=>client.adoptStorage(value)),
    enable:()=>{enabled=true;},
    get writes(){return writes;},
    flush(limit=30){let delivered=0;while(events.length&&delivered<limit){events.shift()();delivered++;}assert.equal(events.length,0,'storage events must converge instead of echoing indefinitely');return delivered;},
  };
}
function server() {
  const spaces = new Map(), gates = [], requests = [];
  let conflicts = 0, forceConflicts = false;
  const response = (status, body = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => copy(body) });
  return {
    requests,
    get conflicts() { return conflicts; },
    forceConflicts(value) { forceConflicts = value; },
    holdNext(method) {
      const reached = deferred(), released = deferred();
      gates.push({ method, reached, released });
      return { reached: reached.promise, release: () => released.resolve() };
    },
    async fetcher(url, options) {
      assert.equal(url, 'https://sync.example.test/v1/progress');
      assert.equal(options.credentials, 'omit');
      const token = options.headers.Authorization?.slice(7);
      assert.match(token, /^[A-Za-z0-9_-]{43}$/);
      const body = options.body ? JSON.parse(options.body) : null;
      requests.push({ method: options.method, body: copy(body) });
      const gateIndex = gates.findIndex(g => g.method === options.method);
      if (gateIndex !== -1) {
        const [gate] = gates.splice(gateIndex, 1);
        gate.reached.resolve();
        // Deliberately ignore AbortSignal here: a response may race cancellation
        // in real transports. The client must still reject stale responses.
        await gate.released.promise;
      }
      const existing = spaces.get(token);
      if (options.method === 'POST') {
        if (existing) return response(409);
        spaces.set(token, { revision: 1, payload: copy(body.payload) });
      } else if (!existing) return response(404);
      else if (options.method === 'PUT') {
        if (forceConflicts || body.revision !== existing.revision) { conflicts++; return response(409); }
        spaces.set(token, { revision: existing.revision + 1, payload: copy(body.payload) });
      }
      return response(200, spaces.get(token));
    },
    async read(code) {
      const { token, key } = await deriveKeys(code);
      const saved = spaces.get(token);
      return saved ? { revision: saved.revision, doc: await decryptDocument(saved.payload, key) } : null;
    },
  };
}
function device(t, hub, id, { state = initial(), storage = memoryStorage(), time = 1000 } = {}) {
  let offline = false, now = time, visible = copy(state);
  const statuses = [];
  const client = createSyncClient({
    endpoint: 'https://sync.example.test/', storage, initialState: state, deviceId: id,
    now: () => now, onRemote: next => { visible = next; }, onStatus: value => statuses.push(value),
    fetcher: (...args) => offline ? Promise.reject(new TypeError('Failed to fetch')) : hub.fetcher(...args),
  });
  t.after(() => client.close());
  return {
    client, storage, statuses, visible: () => copy(visible),
    offline: value => { offline = value; },
    time: value => { now = value; },
    edit(change) { const next = client.getDocument().state; change(next); now += 10; visible = copy(next); client.changed(next); },
    reset() { now += 10; visible = initial(); client.reset(visible); },
  };
}
const quiz = () => ({ id: 'shared-quiz', mode: 'exam', questionIds: ['q1', 'q2'], answers: {}, submitted: {}, flagged: {}, index: 0, startedAt: 1000, deadline: 1000 + 130 * 60000 });
const finished = () => ({ id: 'shared-quiz', mode: 'exam', questionIds: ['q1', 'q2'], answers: { q1: [0] }, correct: 1, total: 2, duration: 10000, finishedAt: '2026-11-13T12:00:00Z' });

test('a new space encrypts local progress and a blank device adopts cloud preferences', async t => {
  const hub = server(), state = initial();
  state.settings.name = 'Cloud learner'; state.settings.hours = 8;
  state.tasks.first = true; state.notes.q1 = 'Private learning note';
  const a = device(t, hub, 'a', { state });
  const code = await a.client.connect('', { create: true });
  const b = device(t, hub, 'b', { time: 9000 });
  await b.client.connect(code);
  assert.equal(a.client.status().phase, 'synced');
  assert.equal(b.client.status().phase, 'synced');
  assert.equal(b.client.getDocument().state.settings.name, 'Cloud learner');
  assert.equal(b.client.getDocument().state.settings.hours, 8);
  assert.equal(b.client.getDocument().state.notes.q1, 'Private learning note');
  assert.ok(hub.requests.every(r => !JSON.stringify(r.body).includes('Private learning note')));
  assert.ok(!JSON.stringify([...a.statuses, ...b.statuses]).includes(code), 'status callbacks must never disclose recovery codes');
});

test('two offline devices retain concurrent tasks and notes after reconnecting', async t => {
  const hub = server(), a = device(t, hub, 'a'), b = device(t, hub, 'b');
  const code = await a.client.connect('', { create: true }); await b.client.connect(code);
  a.offline(true); b.offline(true);
  a.edit(s => { s.tasks.a = true; s.notes.q1 = 'Laptop note'; });
  b.edit(s => { s.tasks.b = true; s.notes.q2 = 'Phone note'; });
  await Promise.all([a.client.syncNow(), b.client.syncNow()]);
  assert.equal(a.client.status().error, 'OFFLINE');
  assert.equal(b.client.status().error, 'OFFLINE');
  a.offline(false); b.offline(false);
  await a.client.syncNow(); await b.client.syncNow(); await a.client.syncNow();
  const expected = { a: true, b: true };
  assert.deepEqual(a.client.getDocument().state.tasks, expected);
  assert.deepEqual(b.client.getDocument().state.tasks, expected);
  assert.deepEqual((await hub.read(code)).doc.state.notes, { q1: 'Laptop note', q2: 'Phone note' });
});

test('pending offline changes survive browser reload and reuse the same recovery code', async t => {
  const hub = server(), a = device(t, hub, 'a');
  const code = await a.client.connect('', { create: true });
  a.offline(true); a.edit(s => { s.tasks.offline = true; s.notes.q1 = 'Saved offline'; });
  await a.client.syncNow();
  const snapshot = a.client.getDocument().state; a.client.close();
  const restored = device(t, hub, 'new-random-device', { state: snapshot, storage: a.storage, time: 500 });
  assert.equal(restored.client.getCode(), code);
  await restored.client.syncNow();
  assert.equal(restored.client.status().phase, 'synced');
  assert.equal((await hub.read(code)).doc.state.notes.q1, 'Saved offline');
});

test('a completed quiz on one device prevents a stale active quiz from reappearing', async t => {
  const hub = server(), a = device(t, hub, 'a'), b = device(t, hub, 'b');
  const code = await a.client.connect('', { create: true });
  a.edit(s => { s.session = quiz(); }); await a.client.syncNow(); await b.client.connect(code);
  a.offline(true); b.offline(true);
  a.edit(s => {
    s.session = null; s.history.push(finished());
    s.attempts.push({ questionId: 'q1', selected: [0], correct: true, domain: 1, at: '2026-11-13T12:00:00Z', mode: 'exam', sessionId: 'shared-quiz' });
  });
  b.edit(s => { s.session.answers.q2 = [1]; s.notes.q2 = 'Needs review'; });
  a.offline(false); b.offline(false);
  await a.client.syncNow(); await b.client.syncNow(); await a.client.syncNow();
  for (const client of [a.client, b.client]) {
    assert.equal(client.getDocument().state.session, null);
    assert.equal(client.getDocument().state.history.length, 1);
    assert.equal(client.getDocument().state.attempts.length, 1);
    assert.equal(client.getDocument().state.notes.q2, 'Needs review');
  }
});

test('a deliberate reset propagates and defeats an old offline device with a faster clock', async t => {
  const hub = server(), a = device(t, hub, 'a'), b = device(t, hub, 'b');
  const code = await a.client.connect('', { create: true });
  a.edit(s => { s.tasks.old = true; s.notes.q1 = 'Old note'; });
  await a.client.syncNow(); await b.client.connect(code);
  b.offline(true); b.time(9000000); b.edit(s => { s.tasks.offline = true; });
  a.reset(); await a.client.syncNow();
  b.offline(false); await b.client.syncNow();
  assert.deepEqual(b.client.getDocument().state.tasks, {});
  assert.deepEqual(b.client.getDocument().state.notes, {});
  assert.deepEqual((await hub.read(code)).doc.state.tasks, {});
});

test('joining with existing local progress replays it into a previously reset cloud epoch', async t => {
  const hub = server(), a = device(t, hub, 'a');
  const code = await a.client.connect('', { create: true });
  a.reset(); a.edit(s => { s.tasks.cloud = true; s.settings.name = 'Cloud owner'; }); await a.client.syncNow();
  const local = initial(); local.tasks.local = true; local.notes.q1 = 'Pre-existing local note'; local.settings.name = 'Default local name';
  const b = device(t, hub, 'b', { state: local, time: 1 });
  await b.client.connect(code); await a.client.syncNow();
  assert.deepEqual(a.client.getDocument().state.tasks, { cloud: true, local: true });
  assert.equal(a.client.getDocument().state.notes.q1, 'Pre-existing local note');
  assert.equal(b.client.getDocument().state.settings.name, 'Cloud owner');
  assert.deepEqual(a.client.getDocument().resetEpoch, b.client.getDocument().resetEpoch);
});

test('edits made while space creation is in flight are not overwritten by the POST snapshot', async t => {
  const hub = server(), a = device(t, hub, 'a');
  const gate = hub.holdNext('POST'), connection = a.client.connect('', { create: true });
  await gate.reached;
  a.edit(s => { s.tasks.duringCreate = true; s.notes.q1 = 'Typed during creation'; s.settings.hours = 6; });
  gate.release();
  const code = await connection;
  assert.equal(a.client.getDocument().state.tasks.duringCreate, true);
  assert.equal(a.visible().notes.q1, 'Typed during creation');
  assert.equal((await hub.read(code)).doc.state.settings.hours, 6);
});

test('joining preserves edits and explicit deletions made while awaiting the cloud response', async t => {
  const hub = server(), a = device(t, hub, 'a');
  a.edit(s => { s.tasks.cloud = true; s.notes.q1 = 'Cloud old note'; });
  const code = await a.client.connect('', { create: true });
  const local = initial(); local.notes.q1 = 'Local old note';
  const b = device(t, hub, 'b', { state: local });
  const gate = hub.holdNext('GET'), connection = b.client.connect(code);
  await gate.reached;
  b.edit(s => { delete s.notes.q1; s.tasks.duringJoin = true; s.settings.hours = 4; });
  gate.release(); await connection;
  const cloud = (await hub.read(code)).doc.state;
  assert.deepEqual(cloud.tasks, { cloud: true, duringJoin: true });
  assert.equal(Object.hasOwn(cloud.notes, 'q1'), false);
  assert.equal(cloud.settings.hours, 4);
});

test('same-quiz progress is combined when an existing local device first joins', async t => {
  const hub = server(), cloud = initial(), local = initial();
  cloud.session = quiz(); cloud.session.answers.q1 = [0];
  local.session = quiz(); local.session.answers.q2 = [1];
  const a = device(t, hub, 'a', { state: cloud }), b = device(t, hub, 'b', { state: local });
  const code = await a.client.connect('', { create: true }); await b.client.connect(code);
  assert.deepEqual(b.client.getDocument().state.session.answers, { q1: [0], q2: [1] });
});

test('CAS conflicts trigger a fresh merge and preserve both concurrent updates', async t => {
  const hub = server(), a = device(t, hub, 'a'), b = device(t, hub, 'b');
  const code = await a.client.connect('', { create: true }); await b.client.connect(code);
  a.edit(s => { s.notes.q1 = 'A'; }); b.edit(s => { s.notes.q2 = 'B'; });
  const gate = hub.holdNext('PUT'), pendingA = a.client.syncNow();
  await gate.reached;
  await b.client.syncNow();
  gate.release(); await pendingA; await b.client.syncNow();
  assert.ok(hub.conflicts >= 1);
  assert.deepEqual((await hub.read(code)).doc.state.notes, { q1: 'A', q2: 'B' });
  assert.deepEqual(a.client.getDocument().state.notes, b.client.getDocument().state.notes);
});

test('continuous CAS contention reports BUSY while retaining local changes for retry', async t => {
  const hub = server(), a = device(t, hub, 'a');
  const code = await a.client.connect('', { create: true });
  hub.forceConflicts(true); a.edit(s => { s.notes.q1 = 'Keep this'; });
  await a.client.syncNow();
  assert.equal(a.client.status().error, 'BUSY');
  assert.equal(a.client.getDocument().state.notes.q1, 'Keep this');
  hub.forceConflicts(false); await a.client.syncNow();
  assert.equal((await hub.read(code)).doc.state.notes.q1, 'Keep this');
});

test('disconnect cancels a pending connection even if its response arrives later', async t => {
  const hub = server(), a = device(t, hub, 'a'), b = device(t, hub, 'b');
  const code = await a.client.connect('', { create: true });
  const gate = hub.holdNext('GET'), pending = b.client.connect(code);
  await gate.reached; b.client.disconnect(); gate.release();
  await assert.rejects(pending, /CANCELLED/);
  assert.equal(b.client.status().phase, 'disconnected');
  assert.equal(b.client.getCode(), '');
  assert.equal(b.storage.getItem(SYNC_STORAGE), null);
});

test('close prevents an in-flight exchange from applying a late response', async t => {
  const hub = server(), a = device(t, hub, 'a'), b = device(t, hub, 'b');
  const code = await a.client.connect('', { create: true }); await b.client.connect(code);
  a.edit(s => { s.notes.new = 'Remote update'; }); await a.client.syncNow();
  const gate = hub.holdNext('GET'), pending = b.client.syncNow();
  await gate.reached; b.client.close(); const count = b.statuses.length; gate.release(); await pending;
  assert.equal(b.statuses.length, count);
  assert.equal(Object.hasOwn(b.client.getDocument().state.notes, 'new'), false);
});

test('an old exchange cannot overwrite a newly connected different space', async t => {
  const hub = server(), a = device(t, hub, 'a'), other = device(t, hub, 'other'), b = device(t, hub, 'b');
  a.edit(s => { s.notes.spaceA = 'A'; }); other.edit(s => { s.notes.spaceB = 'B'; });
  const codeA = await a.client.connect('', { create: true }), codeB = await other.client.connect('', { create: true });
  await b.client.connect(codeA);
  const gate = hub.holdNext('GET'), old = b.client.syncNow();
  await gate.reached; b.client.disconnect();
  await b.client.connect(codeB); gate.release(); await old;
  assert.equal(b.client.getCode(), codeB);
  assert.equal(b.client.status().phase, 'synced');
  assert.equal(b.client.getDocument().state.notes.spaceB, 'B');
});

test('duplicate connect calls cannot create multiple simultaneous spaces', async t => {
  const hub = server(), a = device(t, hub, 'a');
  const gate = hub.holdNext('POST'), pending = a.client.connect('', { create: true });
  await gate.reached;
  await assert.rejects(a.client.connect('', { create: true }), /ALREADY_CONNECTING/);
  gate.release(); await pending;
  assert.equal(hub.requests.filter(r => r.method === 'POST').length, 1);
});

test('same-code storage updates merge local pending changes instead of replacing them', async t => {
  const hub = server(), a = device(t, hub, 'a'), b = device(t, hub, 'b');
  const code = await a.client.connect('', { create: true }); await b.client.connect(code);
  a.edit(s => { s.tasks.a = true; }); b.edit(s => { s.tasks.b = true; });
  a.client.adoptStorage(b.storage.getItem(SYNC_STORAGE));
  assert.deepEqual(a.client.getDocument().state.tasks, { a: true, b: true });
});

test('shared tabs converge without metadata echoes and propagate a reset', async t => {
  const hub=server(),bus=storageBus();
  const a=device(t,hub,'a',{storage:bus.forTab('a'),time:1000});
  await a.client.connect('',{create:true});
  // Tabs opened before first pairing can have different in-memory device IDs.
  const saved=JSON.parse(a.storage.getItem(SYNC_STORAGE));saved.deviceId='b';
  a.storage.setItem(SYNC_STORAGE,JSON.stringify(saved));
  const b=device(t,hub,'b',{storage:bus.forTab('b'),time:2000});
  await b.client.syncNow();
  bus.listen('a',a.client);bus.listen('b',b.client);bus.enable();
  a.edit(s=>{s.tasks.a=true;});b.edit(s=>{s.tasks.b=true;});
  const before=bus.writes;
  assert.ok(bus.flush()<10);
  assert.ok(bus.writes-before<5,'tab-specific device IDs and sync timestamps must not be echoed');
  assert.deepEqual(a.client.getDocument().state.tasks,{a:true,b:true});
  assert.deepEqual(b.client.getDocument().state.tasks,{a:true,b:true});
  assert.equal(a.client.status().lastSync,2000);
  a.reset();bus.flush();
  assert.deepEqual(b.client.getDocument().state.tasks,{});
  assert.deepEqual(a.client.getDocument().resetEpoch,b.client.getDocument().resetEpoch);
  const writes=bus.writes;
  a.client.adoptStorage(a.storage.getItem(SYNC_STORAGE));
  b.client.adoptStorage(b.storage.getItem(SYNC_STORAGE));
  assert.equal(bus.writes,writes,'re-delivering the same envelope must be read-only');
});

test('disconnect in another tab cancels pending requests and cannot restore removed credentials', async t => {
  const hub=server(),bus=storageBus(),a=device(t,hub,'a',{storage:bus.forTab('a')});
  await a.client.connect('',{create:true});
  const b=device(t,hub,'b',{storage:bus.forTab('b')});
  bus.listen('a',a.client);bus.listen('b',b.client);bus.enable();
  b.edit(s=>{s.notes.kept='Keep local work';});bus.flush();
  const gate=hub.holdNext('GET'),pending=b.client.syncNow();await gate.reached;
  a.client.disconnect();bus.flush();
  assert.equal(b.client.status().connected,false);
  assert.equal(b.client.getCode(),'');
  assert.equal(b.client.getDocument().state.notes.kept,'Keep local work');
  gate.release();await pending;
  b.edit(s=>{s.tasks.local=true;});bus.flush();
  assert.equal(b.storage.getItem(SYNC_STORAGE),null);
  assert.equal(b.client.status().phase,'disconnected');
  assert.equal(b.client.getDocument().state.tasks.local,true);
});

test('a replacement-space event cancels old credentials without deleting the replacement', async t => {
  const hub=server(),bus=storageBus(),a=device(t,hub,'a',{storage:bus.forTab('a')});
  const oldCode=await a.client.connect('',{create:true});
  const b=device(t,hub,'b',{storage:bus.forTab('b')});
  const replacement=device(t,hub,'replacement');
  const newCode=await replacement.client.connect('',{create:true});
  assert.notEqual(newCode,oldCode);
  bus.listen('b',b.client);bus.enable();
  b.edit(s=>{s.notes.kept='Local note';});
  const gate=hub.holdNext('GET'),pending=b.client.syncNow();await gate.reached;
  const envelope=replacement.storage.getItem(SYNC_STORAGE);
  a.storage.setItem(SYNC_STORAGE,envelope);bus.flush();
  assert.equal(b.client.status().connected,false);
  assert.equal(b.client.getDocument().state.notes.kept,'Local note');
  assert.equal(b.storage.getItem(SYNC_STORAGE),envelope);
  gate.release();await pending;
  b.edit(s=>{s.tasks.local=true;});b.client.disconnect();
  assert.equal(b.storage.getItem(SYNC_STORAGE),envelope);
  assert.equal(JSON.parse(b.storage.getItem(SYNC_STORAGE)).code,newCode);
});

test('an edit before the removal storage event arrives cannot resurrect credentials', async t => {
  const hub=server(),bus=storageBus(),a=device(t,hub,'a',{storage:bus.forTab('a')});
  await a.client.connect('',{create:true});
  const b=device(t,hub,'b',{storage:bus.forTab('b')});
  // Deliberately leave the event queued while the second tab saves an edit.
  bus.listen('b',b.client);bus.enable();a.client.disconnect();
  b.edit(s=>{s.notes.offline='Saved after disconnect';});
  assert.equal(b.storage.getItem(SYNC_STORAGE),null);
  assert.equal(b.client.status().connected,false);
  assert.equal(b.client.getDocument().state.notes.offline,'Saved after disconnect');
  bus.flush();
});

test('same-space storage events do not cancel a tab that is still joining', async t => {
  const hub=server(),bus=storageBus();
  const a=device(t,hub,'a',{storage:bus.forTab('a')}),b=device(t,hub,'b',{storage:bus.forTab('b')});
  const code=await a.client.connect('',{create:true});
  bus.listen('b',b.client);bus.enable();
  const gate=hub.holdNext('GET'),joining=b.client.connect(code);await gate.reached;
  a.client.adoptStorage(a.storage.getItem(SYNC_STORAGE));
  a.edit(s=>{s.notes.shared='Existing tab updated';});await a.client.syncNow();bus.flush();
  gate.release();await joining;
  assert.equal(b.client.getCode(),code);
  assert.equal(b.client.getDocument().state.notes.shared,'Existing tab updated');
});

test('a pending connection cannot overwrite a replacement before its storage event arrives', async t => {
  const hub=server(),a=device(t,hub,'a'),replacement=device(t,hub,'replacement');
  const code=await a.client.connect('',{create:true});
  await replacement.client.connect('',{create:true});
  const b=device(t,hub,'b');
  b.edit(s=>{s.notes.local='Retain before joining';});
  const gate=hub.holdNext('GET'),joining=b.client.connect(code);await gate.reached;
  const envelope=replacement.storage.getItem(SYNC_STORAGE);
  b.storage.setItem(SYNC_STORAGE,envelope);
  gate.release();await assert.rejects(joining,/CANCELLED/);
  assert.equal(b.client.status().connected,false);
  assert.equal(b.storage.getItem(SYNC_STORAGE),envelope);
  assert.equal(b.client.getDocument().state.notes.local,'Retain before joining');
});

test('a malformed saved document cannot leave a partially restored connection active', t => {
  const hub = server(), storage = memoryStorage();
  storage.setItem(SYNC_STORAGE, JSON.stringify({ code: 'SAA1-' + 'A'.repeat(43), doc: { format: 99 } }));
  const a = device(t, hub, 'a', { storage });
  assert.equal(a.client.getCode(), '');
  assert.equal(a.client.status().connected, false);
  assert.equal(a.client.status().error, 'LOCAL_SYNC_DATA');
});
