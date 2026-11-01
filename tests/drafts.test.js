import test from 'node:test';
import assert from 'node:assert/strict';
import {appendDraft,newTranscript,CHAT_LIMITS} from '../chat-store.js';
const result=(transcript,isFinal=true)=>Object.assign([{transcript}],{isFinal});

test('inserted prompts and restored questions append to a typed draft instead of replacing it',()=>{
  assert.equal(appendDraft('','请再简单一点'),'请再简单一点');
  assert.equal(appendDraft('   ','请再简单一点'),'请再简单一点');
  assert.equal(appendDraft('我自己的问题','请再简单一点'),'我自己的问题\n请再简单一点');
  assert.equal(appendDraft('我自己的问题\n','补充'),'我自己的问题\n补充');
  assert.equal(appendDraft('请再简单一点','请再简单一点'),'请再简单一点','clicking the same prompt twice does not duplicate it');
  assert.equal(appendDraft('typed','dictated',' '),'typed dictated');
  assert.equal(appendDraft('x'.repeat(CHAT_LIMITS.user),'more').length,CHAT_LIMITS.user);
});

test('dictation only appends results it has not delivered before',()=>{
  const results=[result('第一句'),result('第二句')];
  assert.equal(newTranscript(results,0),'第一句 第二句');
  assert.equal(newTranscript(results,1),'第二句');
  assert.equal(newTranscript([result('最终'),result('临时',false)],0),'最终');
  assert.equal(newTranscript([],0),'');
});
