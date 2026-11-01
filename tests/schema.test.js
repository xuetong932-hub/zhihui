import test from 'node:test';
import assert from 'node:assert/strict';
import {loadChats,emptyChats,CHAT_KEY} from '../chat-store.js';
import {emptyKnowledge,addKnowledge,loadKnowledge} from '../knowledge-store.js';
import {emptyReviews,recordReview,loadReviews} from '../review-store.js';
import {validateSnapshot,MAX_SNAPSHOT_CHARS} from '../local-space.js';
import {validProfile} from '../app.js';
const at='2026-11-01T01:00:00.000Z';
const profile={version:1,locale:'zh',dailyMinutes:10,adultVerification:{isAdult:true,verifiedAt:at,method:'self-declared-birthdate'},modules:{coding:{enabled:true,level:'beginner'},english:{enabled:false,level:'beginner'},work:{enabled:false,level:'beginner'},life:{enabled:false,level:'beginner'}}};
const longUrl='https://example.com/'+'a'.repeat(400);
function appChats(){
  const chats=emptyChats();
  chats.modules.coding.push({id:'t',title:'什么是闭包'.slice(0,60),createdAt:at,messages:[
    {id:'u',role:'user',status:'done',content:'问'.repeat(8000),createdAt:at},
    {id:'a',role:'assistant',status:'done',content:'答'.repeat(60000),createdAt:at,provider:'qwen-cn',model:'qwen-plus',sources:[{url:longUrl,title:longUrl},{url:'javascript:alert(1)',title:'x'}],searchStatus:'sources-returned',truncated:false,usage:{inputTokens:1,outputTokens:2}},
    {id:'f',role:'user',status:'failed',error:'unauthorized',content:'再问',createdAt:at}]});
  return chats;
}
function appKnowledge(){
  const data=emptyKnowledge();
  const card=addKnowledge(data,{id:'a',threadId:'t',sourceModule:'coding',question:'问'.repeat(8000),answer:'答'.repeat(60000),createdAt:at,sources:[{url:longUrl,title:longUrl},{url:'javascript:alert(1)',title:'x'}]},null);
  card.important=true;card.reason='wrong';
  return data;
}
function appReviews(){
  const data=emptyReviews();
  recordReview(data,'card',{answer:'答'.repeat(4000),correct:false,explanation:'讲'.repeat(6000),rating:'unclear'},new Date(at));
  return data;
}
const storage=value=>({getItem:()=>JSON.stringify(value)});

test('records written by the app at maximum sizes still load, and unsafe sources are cleaned',()=>{
  const chats=loadChats(storage(appChats()));
  assert.equal(chats.issue,false);
  assert.deepEqual(chats.chats.modules.coding[0].messages[1].sources.map(source=>source.title.length),[300],'long titles are truncated and javascript: URLs dropped');
  const knowledge=loadKnowledge(JSON.stringify(appKnowledge()));
  assert.equal(knowledge.cards[0].summary.length,2400);
  assert.equal(knowledge.cards[0].origins[0].sources.length,1);
  assert.equal(loadReviews(JSON.stringify(appReviews())).events.length,1);
});

test('malformed or oversized stored records are rejected instead of rendered',()=>{
  const chatCases=[
    data=>{data.modules.coding[0].messages[0].content+='问';},
    data=>{data.modules.coding[0].messages[1].content+='答';},
    data=>{data.modules.coding[0].title={};},
    data=>{data.modules.coding[0].messages[1].searchStatus='verified';},
    data=>{data.modules.coding[0].messages[1].model={html:'<b>'};},
  ];
  for(const mutate of chatCases){const data=appChats();mutate(data);assert.equal(loadChats(storage(data)).issue,true);}
  const cardCases=[
    data=>{data.cards[0].summary+='x';},
    data=>{data.cards[0].title='x'.repeat(121);},
    data=>{data.cards[0].reason='<img>';},
    data=>{data.cards[0].origins[0].answer+='答';},
    data=>{data.cards[0].origins[0].sources='https://example.com';},
    data=>{data.cards[0].updatedAt='not a date';},
    data=>{data.cards.push({...data.cards[0]});},
  ];
  for(const mutate of cardCases){const data=appKnowledge();mutate(data);assert.throws(()=>loadKnowledge(JSON.stringify(data)));}
  const reviewCases=[
    data=>{delete data.events[0].explanation;},
    data=>{data.events[0].correct='yes';},
    data=>{data.events[0].answer+='答';},
    data=>{data.events[0].explanation+='讲';},
    data=>{data.events[0].cardId='';},
  ];
  for(const mutate of reviewCases){const data=appReviews();mutate(data);assert.throws(()=>loadReviews(JSON.stringify(data)));}
});

test('whole snapshots use the same loaders, report which part failed, and enforce a size limit',()=>{
  const snapshot=()=>({version:1,createdAt:at,profile,chats:appChats(),knowledge:appKnowledge(),reviews:appReviews()});
  assert.ok(validateSnapshot(snapshot(),validProfile));
  assert.ok(validateSnapshot({...snapshot(),chats:null,knowledge:null,reviews:null},validProfile),'a fresh device has no stores yet');
  const code=value=>{try{validateSnapshot(value,validProfile);return 'ok';}catch(error){return error.code;}};
  assert.equal(code({...snapshot(),version:2}),'format');
  const {reviews,...missing}=snapshot();assert.equal(code(missing),'format');
  assert.equal(code({...snapshot(),profile:{...profile,adultVerification:{isAdult:false}}}),'profile');
  assert.equal(code({...snapshot(),chats:{version:1}}),'chats');
  assert.equal(code({...snapshot(),knowledge:{version:1,cards:[{}],ignored:[]}}),'knowledge');
  assert.equal(code({...snapshot(),reviews:{version:1,events:[{id:'x'}]}}),'reviews');
  assert.equal(code({...snapshot(),padding:'x'.repeat(MAX_SNAPSHOT_CHARS)}),'too-large');
  assert.equal(CHAT_KEY,'knowledge-review.chats.v1');
});
