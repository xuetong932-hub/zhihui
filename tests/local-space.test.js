import test from 'node:test';
import assert from 'node:assert/strict';
import {PROFILE_KEY,OWNER_KEY,BACKUP_KEY,MAX_BACKUPS,LEARNING_KEYS,readOwner,bindOwner,ownership,checkUpload,readBackups,replaceLearningData,undoLastRestore,maskIdentity,hasLearningData,parseExport,summarizeSnapshot,snapshotValues,validateSnapshot} from '../local-space.js';
import {validProfile} from '../app.js';
import {CHAT_KEY} from '../chat-store.js';
import {KNOWLEDGE_KEY} from '../knowledge-store.js';
import {REVIEW_KEY} from '../review-store.js';
class Store{
  constructor(entries={},failOn=()=>false){this.map=new Map(Object.entries(entries));this.failOn=failOn;}
  getItem(key){return this.map.has(key)?this.map.get(key):null;}
  setItem(key,value){if(this.failOn(key,value))throw new Error('QuotaExceededError');this.map.set(key,String(value));}
  removeItem(key){this.map.delete(key);}
}
const alice={url:'https://a.supabase.co',userId:'alice',label:'al***@example.com'},bob={url:'https://a.supabase.co',userId:'bob',label:'bo***@example.com'};
const learning=text=>({[PROFILE_KEY]:JSON.stringify({version:1,owner:text}),[CHAT_KEY]:JSON.stringify({version:1,modules:{coding:[{id:'t',title:text,messages:[{id:'m',content:text}]}]}}),[KNOWLEDGE_KEY]:JSON.stringify({version:1,cards:[],ignored:[]}),[REVIEW_KEY]:JSON.stringify({version:1,events:[]})});
const cloudData=text=>Object.fromEntries(Object.entries(learning(text)).map(([key,value])=>[key,JSON.parse(value)]));
const chatTitle=storage=>JSON.parse(storage.getItem(CHAT_KEY)).modules.coding[0].title;

test('uploads refuse another account’s local records and require a claim for unlinked records',()=>{
  const empty=new Store({[PROFILE_KEY]:'{}'});
  assert.equal(ownership(empty,alice),'empty');assert.equal(checkUpload(empty,alice,false),'empty');
  const local=new Store(learning('alice notes'));
  assert.equal(ownership(local,alice),'unbound');
  assert.throws(()=>checkUpload(local,alice,false),error=>error.code==='claim-required');
  assert.equal(checkUpload(local,alice,true),'unbound');
  bindOwner(local,alice);
  assert.equal(ownership(local,alice),'mine');
  assert.equal(ownership(local,bob),'other');
  assert.throws(()=>checkUpload(local,bob,true),error=>error.code==='other-account');
  assert.equal(ownership(local,{...alice,url:'https://b.supabase.co'}),'other');
  assert.ok(hasLearningData(new Store({[CHAT_KEY]:'{broken'})),'unreadable records still count as someone’s data');
});

test('restoring another account keeps the previous owner’s records as a bounded local backup',()=>{
  const storage=new Store(learning('alice notes'));bindOwner(storage,alice);
  replaceLearningData(storage,cloudData('bob notes'),bob,new Date('2026-11-01T10:00:00Z'));
  assert.equal(chatTitle(storage),'bob notes');assert.equal(readOwner(storage).userId,'bob');
  const [backup]=readBackups(storage);
  assert.equal(backup.owner.userId,'alice');assert.equal(JSON.parse(backup.values[CHAT_KEY]).modules.coding[0].title,'alice notes');
  for(let i=0;i<MAX_BACKUPS+2;i++)replaceLearningData(storage,cloudData(`copy ${i}`),bob);
  assert.equal(readBackups(storage).length,MAX_BACKUPS);
  const fresh=new Store();replaceLearningData(fresh,cloudData('first'),alice);
  assert.equal(readBackups(fresh).length,0,'empty local data needs no backup');
});

test('undo swaps the newest backup back in and can be undone again',()=>{
  const storage=new Store(learning('alice notes'));bindOwner(storage,alice);
  replaceLearningData(storage,cloudData('bob notes'),bob);
  undoLastRestore(storage);
  assert.equal(chatTitle(storage),'alice notes');assert.equal(readOwner(storage).userId,'alice');
  assert.equal(ownership(storage,bob),'other','undoing does not let Bob upload Alice’s records');
  undoLastRestore(storage);
  assert.equal(chatTitle(storage),'bob notes');assert.equal(readOwner(storage).userId,'bob');
  assert.throws(()=>undoLastRestore(new Store()),error=>error.code==='no-backup');
});

test('storage failures leave records, owner and backups unchanged',()=>{
  const original=learning('alice notes');
  const full=new Store(original,key=>key===BACKUP_KEY);bindOwner(full,alice);
  assert.throws(()=>replaceLearningData(full,cloudData('bob notes'),bob));
  assert.equal(chatTitle(full),'alice notes');assert.equal(readOwner(full).userId,'alice');assert.equal(full.getItem(BACKUP_KEY),null);
  let writes=0;const partial=new Store(original,key=>key===KNOWLEDGE_KEY&&++writes===1);bindOwner(partial,alice);
  assert.throws(()=>replaceLearningData(partial,cloudData('bob notes'),bob));
  assert.equal(chatTitle(partial),'alice notes');assert.equal(readOwner(partial).userId,'alice');assert.equal(partial.getItem(BACKUP_KEY),null);
});

const validProfileValue={version:1,locale:'zh',dailyMinutes:10,adultVerification:{isAdult:true,verifiedAt:'2026-11-01T01:00:00Z',method:'self-declared-birthdate'},modules:{coding:{enabled:true,level:'beginner'},english:{enabled:false,level:'beginner'},work:{enabled:false,level:'beginner'},life:{enabled:false,level:'beginner'}}};
const exportFile=values=>JSON.stringify({version:1,exportedAt:'2026-11-01T02:00:00Z',data:Object.fromEntries(LEARNING_KEYS.map(key=>[key,values[key]===undefined?null:values[key]]))},null,2);
const exported=()=>({[PROFILE_KEY]:validProfileValue,[CHAT_KEY]:{version:1,modules:{coding:[{id:'t',title:'导入的问题',messages:[{id:'u',role:'user',status:'done',content:'导入的问题',createdAt:'2026-11-01T01:00:00Z'},{id:'a',role:'assistant',status:'done',content:'回答',createdAt:'2026-11-01T01:00:01Z'}]}],english:[],work:[],life:[]}},[KNOWLEDGE_KEY]:{version:1,cards:[],ignored:[]},[REVIEW_KEY]:{version:1,events:[]}});

test('Device page exports parse back into a validated snapshot with a readable summary',()=>{
  const snapshot=validateSnapshot(parseExport(exportFile(exported())),validProfile);
  assert.equal(snapshot.exportedAt,'2026-11-01T02:00:00Z');
  assert.deepEqual(summarizeSnapshot(snapshot),{threads:1,messages:2,cards:0,reviews:0});
  const partial=parseExport(exportFile({[PROFILE_KEY]:validProfileValue}));
  assert.equal(partial.chats,null,'stores never created on the old device import as empty');
  assert.ok(validateSnapshot(partial,validProfile));
  for(const text of ['not json','{}',JSON.stringify({version:2,data:{}}),JSON.stringify({version:1,data:{[PROFILE_KEY]:validProfileValue}})])assert.throws(()=>parseExport(text),error=>error.code==='format');
  assert.throws(()=>parseExport('x'.repeat(20000001)),error=>error.code==='too-large');
  const badChats=exported();badChats[CHAT_KEY].modules.coding[0].messages[0].content='问'.repeat(8001);
  assert.throws(()=>validateSnapshot(parseExport(exportFile(badChats)),validProfile),error=>error.code==='chats');
});

test('importing replaces local data, leaves it unlinked from any account, and can be undone',()=>{
  const storage=new Store(learning('alice notes'));bindOwner(storage,alice);
  replaceLearningData(storage,snapshotValues(parseExport(exportFile(exported()))),null);
  assert.equal(chatTitle(storage),'导入的问题');assert.equal(readOwner(storage),null);
  assert.equal(ownership(storage,alice),'unbound','uploading imported data needs an explicit claim');
  assert.equal(readBackups(storage)[0].owner.userId,'alice');
  undoLastRestore(storage);
  assert.equal(chatTitle(storage),'alice notes');assert.equal(readOwner(storage).userId,'alice');
});

test('legacy single-slot backups are still readable and undoable',()=>{
  const storage=new Store({...learning('restored'),[BACKUP_KEY]:JSON.stringify(learning('before legacy restore'))});
  assert.equal(readBackups(storage).length,1);
  undoLastRestore(storage);
  assert.equal(chatTitle(storage),'before legacy restore');assert.equal(storage.getItem(OWNER_KEY),null);
  assert.equal(maskIdentity('alice@example.com'),'al***@example.com');assert.equal(maskIdentity('+8613800000000'),'+86***0000');
});
