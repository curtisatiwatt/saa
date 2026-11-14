import {validateState} from './core.js';
import {createDocument,updateDocument,mergeDocuments,sanitizeDocument,resetDocument} from './sync-merge.js';
import {deriveKeys,generateSyncCode,normalizeSyncCode,encryptDocument,decryptDocument} from './sync-crypto.js';

export const SYNC_STORAGE='saa-studio-sync-v1';
const clone=value=>JSON.parse(JSON.stringify(value));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const MAPS=['tasks','lessons','labSteps','notes'];
export function hasProgress(s) {
  return !!(['tasks','lessons','labSteps','notes','activity'].some(k=>Object.keys(s[k]).length)||s.attempts.length||s.history.length||s.session);
}

// Storage and transport are injected so offline and concurrent-device behavior
// can be exercised without exposing the recovery code to a real server.
export function createSyncClient({endpoint,storage,initialState,onRemote=()=>{},onStatus=()=>{},validateRemoteState=()=>{},fetcher=globalThis.fetch,now=Date.now,deviceId=crypto.randomUUID()}) {
  let current=validateState(initialState),doc=createDocument(current,deviceId,now()),code='',keys=null,revision=0,lastSync=null;
  let phase='disconnected',error='',running=null,connecting=null,timer=null,closed=false,epoch=0;
  const requests=new Set();
  try {
    const saved=JSON.parse(storage.getItem(SYNC_STORAGE)||'null');
    if(saved?.code){
      const restoredCode=normalizeSyncCode(saved.code);
      const restoredDoc=sanitizeDocument(saved.doc);
      const restoredDevice=saved.deviceId||deviceId;
      doc=updateDocument(restoredDoc,current,restoredDevice,now());
      deviceId=restoredDevice;code=restoredCode;
      revision=Number.isSafeInteger(saved.revision)&&saved.revision>=0?saved.revision:0;
      lastSync=Number.isFinite(saved.lastSync)?saved.lastSync:null;phase='pending';
    }
  } catch {code='';keys=null;phase='error';error='LOCAL_SYNC_DATA';}
  function status(){return {phase,error,connected:!!code,configured:!!endpoint,lastSync,revision};}
  function emit(next,message=''){phase=next;error=message;onStatus(status());}
  function active(generation){return !closed&&generation===epoch;}
  function ensureActive(generation){if(!active(generation))throw new Error('CANCELLED');}
  function persist({newConnection=false}={}){
    if(!code)return;
    const stored=storage.getItem(SYNC_STORAGE);
    // A storage event can still be queued when an edit or request completes.
    // Never restore credentials another tab has already removed or replaced.
    if(!newConnection&&JSON.parse(stored||'null')?.code!==code){disconnect({removeStorage:false});throw new Error('CANCELLED');}
    const serialized=JSON.stringify({code,deviceId,doc,revision,lastSync});
    if(stored!==serialized)storage.setItem(SYNC_STORAGE,serialized);
  }
  function apply(incoming){
    const next=sanitizeDocument(incoming);validateRemoteState(next.state);doc=next;
    if(!same(current,next.state)){current=clone(next.state);onRemote(clone(current));}
  }
  async function request(method,body,credentials){
    const controller=new AbortController();requests.add(controller);
    const timeout=setTimeout(()=>controller.abort(),15000);
    try {
      const response=await fetcher(endpoint.replace(/\/$/,'')+'/v1/progress',{method,headers:{Authorization:'Bearer '+credentials.token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:controller.signal,cache:'no-store',credentials:'omit'});
      if(!response.ok){const e=new Error(response.status===404?'SPACE_NOT_FOUND':response.status===429?'RATE_LIMIT':response.status===413?'SPACE_FULL':response.status===409?'CONFLICT':'SYNC_UNAVAILABLE');e.status=response.status;throw e;}
      const raw=await response.json();if(!Number.isSafeInteger(raw.revision)||raw.revision<1||!raw.payload)throw new Error('INVALID_CLOUD_DATA');return raw;
    } finally {clearTimeout(timeout);requests.delete(controller);}
  }
  function schedule(delay=1500){clearTimeout(timer);if(code&&!closed)timer=setTimeout(()=>{void syncNow();},delay);}
  async function exchange(generation){
    ensureActive(generation);emit('syncing');
    const credentials=keys||await deriveKeys(code);
    ensureActive(generation);keys=credentials;
    for(let tries=0;tries<5;tries++){
      ensureActive(generation);
      const remote=await request('GET',undefined,credentials);
      ensureActive(generation);
      const decoded=sanitizeDocument(await decryptDocument(remote.payload,credentials.key));validateRemoteState(decoded.state);
      ensureActive(generation);
      apply(mergeDocuments(doc,decoded));
      ensureActive(generation);revision=remote.revision;persist();
      if(same(doc,decoded)){lastSync=now();persist();emit('synced');return false;}
      const sent=clone(doc),payload=await encryptDocument(sent,credentials.key);
      ensureActive(generation);
      try {
        const acknowledged=await request('PUT',{revision,payload},credentials);
        ensureActive(generation);
        revision=acknowledged.revision;lastSync=now();persist();
        const dirty=!same(sent,doc);emit(dirty?'pending':'synced');return dirty;
      } catch(e){if(e.status!==409)throw e;}
    }
    throw new Error('BUSY');
  }
  async function syncNow(){
    clearTimeout(timer);if(!code||!endpoint||closed)return;
    if(running?.generation===epoch){running.rerun=true;return running.promise;}
    const job={generation:epoch,promise:null,rerun:false};running=job;
    job.promise=(async()=>{
      try{job.rerun=(await exchange(job.generation))||job.rerun;}
      catch(e){if(active(job.generation)){emit('error',e.message==='Failed to fetch'||e.name==='AbortError'?'OFFLINE':e.message);schedule(30000);}}
      finally{if(running===job)running=null;if(active(job.generation)&&job.rerun)schedule(300);}
    })();
    return job.promise;
  }
  function replayLocal(remote,baseline){
    // Joining is an explicit merge of existing local progress into the cloud
    // epoch, not creation of an older-epoch replica. Cloud preferences win unless
    // the user changed a preference while the connection request was pending.
    if(!same(doc.resetEpoch,baseline.resetEpoch))return resetDocument(mergeDocuments(remote,doc),current,deviceId,now());
    const next=clone(remote.state);
    if(hasProgress(current)){
      for(const name of MAPS)Object.assign(next[name],current[name]);
      next.attempts.push(...current.attempts);next.history.push(...current.history);
      for(const [day,n]of Object.entries(current.activity))next.activity[day]=Math.max(next.activity[day]||0,n);
      if(current.session){
        if(next.session?.id===current.session.id){
          for(const name of ['answers','submitted','flagged']){
            Object.assign(next.session[name],current.session[name]);
            if(baseline.state.session?.id===current.session.id)for(const key of Object.keys(baseline.state.session[name]))if(!Object.hasOwn(current.session[name],key))delete next.session[name][key];
          }
          next.session.index=current.session.index;
        }else next.session=clone(current.session);
      }
    }
    // Even if the user deleted their last item while awaiting the response,
    // replay those explicit deletions instead of silently adopting stale data.
    for(const name of MAPS)for(const key of Object.keys(baseline.state[name]))if(!Object.hasOwn(current[name],key))delete next[name][key];
    for(const key of ['name','hours','startDate'])if(!same(current.settings[key],baseline.state.settings[key]))next.settings[key]=current.settings[key];
    if(baseline.state.session&&!current.session&&next.session?.id===baseline.state.session.id)next.session=null;
    return updateDocument(remote,next,deviceId,now());
  }
  async function connect(input,{create=false}={}){
    if(closed)throw new Error('CLOSED');
    if(!endpoint)throw new Error('NOT_CONFIGURED');
    if(code)throw new Error('ALREADY_CONNECTED');
    if(connecting)throw new Error('ALREADY_CONNECTING');
    const candidate=create?generateSyncCode():normalizeSyncCode(input);
    const operation={generation:++epoch,candidate,storageCode:JSON.parse(storage.getItem(SYNC_STORAGE)||'null')?.code||''};connecting=operation;
    const baseline=clone(doc);emit('connecting');
    try {
      const candidateKeys=await deriveKeys(candidate);ensureActive(operation.generation);
      let next;
      if(create){
        // Preserve the existing document's clocks. Re-stamping a snapshot here
        // could tie with or overwrite an edit made while POST is in flight.
        const sent=clone(doc),payload=await encryptDocument(sent,candidateKeys.key);
        ensureActive(operation.generation);
        const result=await request('POST',{payload},candidateKeys);
        ensureActive(operation.generation);revision=result.revision;
        next=mergeDocuments(sent,doc);
      }else{
        const result=await request('GET',undefined,candidateKeys);ensureActive(operation.generation);
        const remote=sanitizeDocument(await decryptDocument(result.payload,candidateKeys.key));validateRemoteState(remote.state);ensureActive(operation.generation);
        revision=result.revision;next=replayLocal(remote,baseline);
      }
      ensureActive(operation.generation);
      const storedCode=JSON.parse(storage.getItem(SYNC_STORAGE)||'null')?.code||'';
      if(storedCode!==operation.storageCode&&storedCode!==candidate){disconnect({removeStorage:false});throw new Error('CANCELLED');}
      code=candidate;keys=candidateKeys;apply(next);
      ensureActive(operation.generation);lastSync=null;persist({newConnection:true});emit('pending');await syncNow();
      ensureActive(operation.generation);return candidate;
    }catch(e){if(active(operation.generation))emit('error',e.message);throw e;}
    finally{if(connecting===operation)connecting=null;}
  }
  function changed(next){
    current=validateState(next);doc=updateDocument(doc,current,deviceId,now());
    if(code){try{persist();emit('pending');schedule();}catch{if(code)emit('error','LOCAL_STORAGE');}}
  }
  function reset(next){
    current=validateState(next);doc=resetDocument(doc,current,deviceId,now());
    if(code){try{persist();emit('pending');schedule();}catch{if(code)emit('error','LOCAL_STORAGE');}}
  }
  function cancelRequests(){for(const controller of requests)controller.abort();}
  function disconnect({removeStorage=true}={}){
    const previousCode=code;
    epoch++;connecting=null;code='';keys=null;revision=0;lastSync=null;clearTimeout(timer);cancelRequests();
    doc=createDocument(current,deviceId,now());
    try{
      // Do not delete a replacement space that another tab has just connected.
      if(removeStorage){const saved=JSON.parse(storage.getItem(SYNC_STORAGE)||'null');if(!saved?.code||saved.code===previousCode)storage.removeItem(SYNC_STORAGE);}
      emit('disconnected');
    }catch{emit('error','LOCAL_STORAGE');}
  }
  function adoptStorage(raw){
    if(closed)return;
    try{
      const saved=JSON.parse(raw||'null');
      // Updates from the space currently being joined are not a credential
      // replacement. The connection's GET/exchange will merge their document.
      if(!code&&connecting&&saved?.code===connecting.candidate)return;
      if(!saved?.code||saved.code!==code){
        // Credential changes belong to the whole browser. Keep this tab's local
        // work, cancel its old requests, and require an explicit reconnect.
        if(code||connecting)disconnect({removeStorage:false});
        return;
      }
      if(!code)return;
      const incoming=sanitizeDocument(saved.doc);validateRemoteState(incoming.state);
      const merged=mergeDocuments(doc,incoming),changed=!same(doc,merged);
      apply(merged);
      if(Number.isSafeInteger(saved.revision)&&saved.revision>=0)revision=Math.max(revision,saved.revision);
      if(Number.isFinite(saved.lastSync))lastSync=lastSync===null?saved.lastSync:Math.max(lastSync,saved.lastSync);
      // Echo only a real merged contribution. Tab-specific device IDs and sync
      // timestamps must not bounce indefinitely between storage-event handlers.
      if(!same(merged,incoming))persist();
      if(changed){emit('pending');schedule();}
    }
    catch(e){if(e.message!=='CANCELLED')emit('error','LOCAL_SYNC_DATA');}
  }
  return {status,connect,syncNow,changed,reset,disconnect,adoptStorage,getCode:()=>code,getDocument:()=>clone(doc),start:()=>{if(code)void syncNow();},close:()=>{closed=true;epoch++;connecting=null;clearTimeout(timer);cancelRequests();},generateSyncCode};
}
