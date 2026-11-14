import test from 'node:test';
import assert from 'node:assert/strict';
import {generateSyncCode,normalizeSyncCode,deriveKeys,encryptDocument,decryptDocument} from '../sync-crypto.js';

test('pairing code derives reproducible, separate encryption and authentication keys',async()=>{
  const code=generateSyncCode(); assert.equal(normalizeSyncCode(' '+code+' '),code);
  const a=await deriveKeys(code),b=await deriveKeys(code);
  assert.equal(a.token,b.token); assert.notEqual(a.token,code.slice(5)); assert.equal(a.key.extractable,false);
  const source={notes:{private:'学习笔记'},tasks:{one:true}};
  const first=await encryptDocument(source,a.key),second=await encryptDocument(source,a.key);
  assert.notEqual(first.iv,second.iv); assert.notEqual(first.ciphertext,second.ciphertext);
  assert.deepEqual(await decryptDocument(first,b.key),source);
  assert.ok(!JSON.stringify(first).includes('学习笔记'));
});
test('wrong keys and tampered ciphertext are rejected',async()=>{
  const a=await deriveKeys(generateSyncCode()),b=await deriveKeys(generateSyncCode());
  const payload=await encryptDocument({tasks:{one:true}},a.key);
  await assert.rejects(decryptDocument(payload,b.key));
  const modified={...payload,ciphertext:(payload.ciphertext[0]==='A'?'B':'A')+payload.ciphertext.slice(1)};
  await assert.rejects(decryptDocument(modified,a.key));
  assert.throws(()=>normalizeSyncCode('short'),/INVALID_CODE/);
});
