import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyKnowledge,addKnowledge,mergeCards,loadKnowledge,localDay} from '../knowledge-store.js';
import {parseKnowledge,extractKnowledge} from '../knowledge-service.mjs';
import {defaultConfig} from '../providers.js';
const origin=(id,question='什么是闭包？',sourceModule='coding')=>({id,threadId:'thread',question,sourceModule,answer:'测试原始回答',createdAt:'2026-11-01T01:00:00Z'});
const ready={learnable:true,module:'coding',title:'闭包',summary:'保留外部变量的函数',category:'函数',example:'背包',duplicateId:null};
test('exact repeated questions merge, remain idempotent, retain dates, and stay module scoped',()=>{
  const data=emptyKnowledge(); const card=addKnowledge(data,origin('a'),ready);
  addKnowledge(data,origin('b','什么是闭包!'),ready);
  assert.equal(data.cards.length,1);assert.equal(card.origins.length,2);assert.equal(card.important,true);
  addKnowledge(data,origin('b'),ready);assert.equal(card.origins.length,2);
  addKnowledge(data,origin('c','什么是闭包？','english'),{...ready,module:'english'});assert.equal(data.cards.length,2);
  assert.equal(localDay(new Date(2026,10,1,0,10)),'2026-11-01');
});
test('semantic match merges only a validated same-module candidate and keeps pending failures',()=>{
  const data=emptyKnowledge();const first=addKnowledge(data,origin('a'),ready);
  const pending=addKnowledge(data,origin('b','外部函数结束后变量为何还在？'),null);assert.equal(pending.extraction,'pending');
  addKnowledge(data,origin('b','外部函数结束后变量为何还在？'),{...ready,duplicateId:first.id});
  assert.equal(first.origins.length,2);assert.equal(pending.status,'merged');
  first.status='paused';addKnowledge(data,origin('c'),ready);assert.equal(first.status,'paused');
});
test('trash and ignored items do not resurrect during history backfill; manual merge preserves all origins',()=>{
  const data=emptyKnowledge();const card=addKnowledge(data,origin('a'),ready);card.status='deleted';
  addKnowledge(data,origin('a'),ready);assert.equal(card.status,'deleted');
  addKnowledge(data,origin('greeting','你好'),{learnable:false});assert.equal(addKnowledge(data,origin('greeting'),null),null);
  const target=addKnowledge(data,origin('b','新问题'),ready);const source=addKnowledge(data,origin('c','另一个问题'),ready);
  mergeCards(data,target.id,source.id);assert.equal(target.origins.length,2);assert.equal(source.status,'merged');
  assert.throws(()=>mergeCards(data,target.id,target.id));
  assert.equal(loadKnowledge(JSON.stringify(data)).cards.length,3);
  assert.throws(()=>loadKnowledge('{broken'));
});
test('AI extraction schema rejects invalid output and invented duplicate IDs',async()=>{
  assert.throws(()=>parseKnowledge('not json',[],['coding']));
  assert.throws(()=>parseKnowledge(JSON.stringify({...ready,module:'work'}),[],['coding']));
  assert.equal(parseKnowledge(JSON.stringify({...ready,duplicateId:'invented'}),[],['coding']).duplicateId,null);
  const result=await extractKnowledge({config:defaultConfig(),apiKey:'test-only-not-real',consent:true,module:'coding',level:'beginner',locale:'zh',question:'闭包是什么',answer:'测试回答',enabled:['coding'],candidates:[]},{fetchImpl:async(url,options)=>{
    const body=JSON.parse(options.body);assert.equal(body.parameters.enable_search,false);assert.match(body.input.messages[0].content,/JSON/);
    return Response.json({output:{choices:[{message:{content:JSON.stringify(ready)},finish_reason:'stop'}]}});
  }});assert.equal(result.title,'闭包');
});
