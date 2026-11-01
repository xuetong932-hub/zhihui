import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeSnapshots,possibleDuplicates} from '../snapshot-merge.js';
import {validateSnapshot,likelyDuplicate,readLocalSnapshot,PROFILE_KEY,NEW_ACCOUNT_MS} from '../local-space.js';
import {CHAT_KEY} from '../chat-store.js';
import {validProfile} from '../app.js';
const t=minute=>`2026-11-01T01:${String(minute).padStart(2,'0')}:00.000Z`;
const profile=(enabled,level='beginner',dailyMinutes=10)=>({version:1,locale:'zh',dailyMinutes,adultVerification:{isAdult:true,verifiedAt:t(0),method:'self-declared-birthdate'},modules:Object.fromEntries(['coding','english','work','life'].map(id=>[id,{enabled:enabled.includes(id),level}]))});
const message=(id,role,minute,content=id)=>({id,role,status:'done',content,createdAt:t(minute)});
const card=(id,question,updatedAt,extra={})=>({id,module:'coding',title:id,summary:'解释',category:'',example:'',createdAt:t(0),updatedAt,status:'active',extraction:'ready',important:false,origins:[{id:`o-${id}`,threadId:'shared',question,answer:'答',createdAt:t(0),sourceModule:'coding'}],...extra});
const event=(id,minute)=>({id,cardId:'c1',at:t(minute),answer:'a',correct:true,explanation:'e',rating:'understood',interval:1,due:t(minute)});
function local(){
  return {version:1,profile:profile(['coding']),
    chats:{version:1,modules:{coding:[{id:'shared',title:'共同对话',messages:[message('m1','user',1),message('m2','assistant',2)]}],english:[],work:[],life:[]}},
    knowledge:{version:1,cards:[card('c1','什么是闭包',t(5)),card('dupA','什么是作用域',t(1))],ignored:['x']},
    reviews:{version:1,events:[event('e1',3)]}};
}
function other(){
  return {version:1,profile:profile(['coding','english'],'advanced',20),
    chats:{version:1,modules:{coding:[{id:'shared',title:'',messages:[message('m1','user',1),message('m2','assistant',2),message('m3','user',7),message('m4','assistant',8)]},{id:'new',title:'另一台设备',messages:[message('n1','user',4)]}],english:[],work:[],life:[]}},
    knowledge:{version:1,cards:[{...card('c1','什么是闭包',t(9)),title:'较新的标题',important:true,origins:[{id:'o-c1',threadId:'shared',question:'什么是闭包',answer:'答',createdAt:t(0),sourceModule:'coding'},{id:'o-extra',threadId:'new',question:'闭包是什么？',answer:'答',createdAt:t(4),sourceModule:'coding'}]},card('dupB','什么是作用域？',t(2))],ignored:['y']},
    reviews:{version:1,events:[event('e1',3),event('e2',6)]}};
}

test('merging keeps every record from both sides and resolves card edits by recency',()=>{
  const {snapshot,stats}=mergeSnapshots(local(),other());
  assert.ok(validateSnapshot(snapshot,validProfile));
  assert.equal(snapshot.profile.dailyMinutes,10,'settings come from the kept side');
  assert.equal(snapshot.profile.modules.coding.level,'beginner');
  assert.equal(snapshot.profile.modules.english.enabled,true,'a module enabled on either side stays enabled');
  const [shared,added]=snapshot.chats.modules.coding;
  assert.deepEqual(shared.messages.map(item=>item.id),['m1','m2','m3','m4']);assert.equal(shared.title,'共同对话');assert.equal(added.id,'new');
  const c1=snapshot.knowledge.cards.find(item=>item.id==='c1');
  assert.equal(c1.title,'较新的标题');assert.equal(c1.important,true);assert.deepEqual(c1.origins.map(item=>item.id),['o-c1','o-extra']);
  assert.deepEqual(snapshot.knowledge.ignored,['x','y']);
  assert.deepEqual(snapshot.reviews.events.map(item=>item.id),['e1','e2']);
  assert.deepEqual(stats,{threads:1,messages:3,cards:1,events:1,conflicts:1,possibleDuplicates:1});
});

test('merging is idempotent and never changes its inputs',()=>{
  const keep=local(),before=JSON.stringify(keep),incoming=other(),incomingBefore=JSON.stringify(incoming);
  const once=mergeSnapshots(keep,incoming).snapshot,twice=mergeSnapshots(once,incoming);
  assert.equal(JSON.stringify(keep),before);assert.equal(JSON.stringify(incoming),incomingBefore);
  assert.deepEqual({...twice.stats,possibleDuplicates:0},{threads:0,messages:0,cards:0,events:0,conflicts:0,possibleDuplicates:0});
  assert.deepEqual({...twice.snapshot,createdAt:null},{...once,createdAt:null});
  assert.deepEqual(mergeSnapshots({version:1,profile:profile(['coding']),chats:null,knowledge:null,reviews:null},{version:1,profile:null,chats:null,knowledge:null,reviews:null}).snapshot.chats,null);
});

test('cards that look like duplicates are reported, not merged automatically',()=>{
  const {snapshot}=mergeSnapshots(local(),other());
  assert.ok(snapshot.knowledge.cards.some(item=>item.id==='dupA')&&snapshot.knowledge.cards.some(item=>item.id==='dupB'));
  assert.equal(possibleDuplicates(snapshot.knowledge),1);
  assert.equal(possibleDuplicates({cards:[card('a','q'),{...card('b','q'),status:'deleted'}]}),0,'deleted cards are ignored');
});

test('a just-created account on a device owned by another account is flagged as a likely duplicate',()=>{
  const owner={url:'https://a.supabase.co',userId:'alice',label:'al***@example.com'},now=Date.parse('2026-11-01T10:00:00Z');
  const fresh={url:'https://a.supabase.co',userId:'bob'},created='2026-11-01T09:58:00Z';
  assert.equal(likelyDuplicate(owner,fresh,created,now),true);
  assert.equal(likelyDuplicate(owner,{...fresh,userId:'alice'},created,now),false,'same account');
  assert.equal(likelyDuplicate(owner,fresh,new Date(now-NEW_ACCOUNT_MS-1).toISOString(),now),false,'older accounts are not flagged');
  assert.equal(likelyDuplicate(owner,{...fresh,url:'https://b.supabase.co'},created,now),false,'another project is a different service');
  assert.equal(likelyDuplicate(null,fresh,created,now),false);assert.equal(likelyDuplicate(owner,fresh,undefined,now),false);
});

test('local snapshots are read as stored; broken local JSON blocks merging',()=>{
  const store=values=>({getItem:key=>values[key]??null});
  assert.equal(readLocalSnapshot(store({[PROFILE_KEY]:JSON.stringify(profile(['coding']))})).chats,null);
  assert.throws(()=>readLocalSnapshot(store({[CHAT_KEY]:'{broken'})),error=>error.code==='local');
});
