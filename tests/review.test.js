import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewQueue,scheduleReview,recordReview,emptyReviews,loadReviews,suggestedLevel} from '../review-store.js';
import {reviewTask} from '../review-service.mjs';
import {encryptBackup,decryptBackup} from '../cloud-ui.js';
import {defaultConfig} from '../providers.js';
const profile={dailyMinutes:5,modules:{coding:{enabled:true},english:{enabled:false}}};
const card=(id,date='2026-10-30T09:00:00')=>({id,createdAt:new Date(date).toISOString(),module:'coding',status:'active',extraction:'ready'});
test('new cards start tomorrow; paused, pending and disabled modules do not enter review',()=>{
  const now=new Date(2026,10,2,12),data=emptyReviews();
  assert.equal(reviewQueue([card('new','2026-11-02T08:00:00')],data,profile,now).length,0);
  assert.equal(reviewQueue([card('yesterday','2026-11-01T08:00:00'),{...card('paused'),status:'paused'},{...card('pending'),extraction:'pending'},{...card('english'),module:'english'}],data,profile,now).length,1);
});
test('wrong answers recur today, guessed answers tomorrow, and recent mistakes prevent long interval jumps',()=>{
  const now=new Date(2026,10,2,12);const wrong=scheduleReview(null,'wrong',now);
  assert.equal(new Date(wrong.due)-now,600000);assert.equal(scheduleReview(null,'guessed',now).interval,1);
  assert.equal(scheduleReview({interval:20,rating:'wrong'},'mastered',now).interval,1);
  const data=emptyReviews();const event=recordReview(data,'a',{answer:'x',correct:false,explanation:'not yet',rating:'mastered'},now);
  assert.equal(event.rating,'wrong');assert.equal(loadReviews(JSON.stringify(data)).events.length,1);
});
test('backlog obeys daily plan and extra review is available; Sunday includes this week but no new-today material',()=>{
  const data=emptyReviews(),now=new Date(2026,10,1,12),cards=Array.from({length:10},(_,i)=>card(String(i)));
  assert.equal(reviewQueue(cards,data,profile,now).length,3);assert.equal(reviewQueue(cards,data,profile,now,{extra:true}).length,10);
  recordReview(data,'0',{answer:'ok',correct:true,explanation:'ok',rating:'mastered'},new Date(2026,9,31,12));
  assert.ok(reviewQueue(cards,data,profile,now,{extra:true}).some(item=>item.id==='0'));
  assert.ok(!reviewQueue([card('today','2026-11-01T08:00:00')],data,profile,now).length);
});
test('grading keeps semantic boolean and rejects malformed multiple-choice questions',async()=>{
  const input={config:defaultConfig(),apiKey:'test-only-not-real',consent:true,module:'coding',level:'beginner',locale:'zh',task:'grade',card:{title:'闭包',summary:'核心解释',example:'背包'},answer:'我的理解'};
  const fetchImpl=async(url,options)=>{assert.equal(JSON.parse(options.body).parameters.enable_search,false);return Response.json({output:{choices:[{message:{content:JSON.stringify({correct:true,explanation:'核心理解正确'})},finish_reason:'stop'}]}});};
  assert.equal((await reviewTask(input,{fetchImpl})).correct,true);
  await assert.rejects(reviewTask({...input,task:'question'},{fetchImpl}),error=>error.code==='review');
});
test('encrypted cloud backups round-trip, reject wrong passphrases and detect tampering',async()=>{
  const source={version:1,secretKey:'not-a-real-test-key',text:'知识卡片'};const envelope=await encryptBackup(source,'long-test-passphrase');
  assert.ok(!JSON.stringify(envelope).includes(source.secretKey));assert.deepEqual(await decryptBackup(envelope,'long-test-passphrase'),source);
  await assert.rejects(decryptBackup(envelope,'wrong-passphrase'));await assert.rejects(encryptBackup(source,'short'));
  const bytes=envelope.ciphertext.split('');bytes[0]=bytes[0]==='A'?'B':'A';await assert.rejects(decryptBackup({...envelope,ciphertext:bytes.join('')},'long-test-passphrase'));
});
test('difficulty adapts only from sufficient feedback within its own module',()=>{
  const cards=[card('coding'),{...card('english'),module:'english'}];
  const events=Array.from({length:5},(_,i)=>({cardId:'coding',at:`2026-11-0${i+1}`,correct:true,rating:'understood'}));
  assert.equal(suggestedLevel(cards,events,'coding','beginner'),'some');
  assert.equal(suggestedLevel(cards,events,'english','beginner'),'beginner');
  assert.equal(suggestedLevel(cards,events,'coding','some','2026-11-05'),'some');
  assert.equal(suggestedLevel(cards,events.slice(-3).map(event=>({...event,rating:'unclear'})),'coding','advanced'),'some');
});
