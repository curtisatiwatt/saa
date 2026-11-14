const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', {fatal:true});
const CONTEXT = encoder.encode('SAA Studio encrypted progress v1');
export function encode64(bytes) {
  let binary=''; for(const byte of new Uint8Array(bytes)) binary+=String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export function decode64(value) {
  if(typeof value!=='string'||!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid encoding');
  return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
}
export function generateSyncCode() { return 'SAA1-'+encode64(crypto.getRandomValues(new Uint8Array(32))); }
export function normalizeSyncCode(input) {
  const code=String(input).trim();
  if(!/^SAA1-[A-Za-z0-9_-]{43}$/.test(code)) throw new Error('INVALID_CODE');
  const raw=decode64(code.slice(5));
  if(raw.length!==32||encode64(raw)!==code.slice(5)) throw new Error('INVALID_CODE');
  return code;
}
export async function deriveKeys(input) {
  const code=normalizeSyncCode(input);
  const material=await crypto.subtle.importKey('raw',decode64(code.slice(5)),'HKDF',false,['deriveKey','deriveBits']);
  const params=info=>({name:'HKDF',hash:'SHA-256',salt:CONTEXT,info:encoder.encode(info)});
  const key=await crypto.subtle.deriveKey(params('encryption'),material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const token=encode64(await crypto.subtle.deriveBits(params('authentication'),material,256));
  return {key,token};
}
export async function encryptDocument(document,key) {
  const plain=encoder.encode(JSON.stringify(document));
  if(plain.length>1024*1024-16) throw new Error('SPACE_FULL');
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:CONTEXT},key,plain);
  return {version:1,iv:encode64(iv),ciphertext:encode64(ciphertext)};
}
export async function decryptDocument(payload,key) {
  if(!payload||payload.version!==1||typeof payload.ciphertext!=='string'||payload.ciphertext.length>1398102) throw new Error('INVALID_CLOUD_DATA');
  const iv=decode64(payload.iv); if(iv.length!==12) throw new Error('INVALID_CLOUD_DATA');
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:CONTEXT},key,decode64(payload.ciphertext));
  return JSON.parse(decoder.decode(plain));
}
