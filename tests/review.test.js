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
test('FSRS scheduling: misses recur in 10 minutes, first grades follow FSRS defaults, a recent miss keeps the next gap short',()=>{
  const now=new Date(2026,10,2,12);const wrong=scheduleReview([],'wrong',now);
  assert.equal(new Date(wrong.due)-now,600000);assert.equal(wrong.interval,0);
  assert.deepEqual(['guessed','understood','mastered'].map(rating=>scheduleReview([],rating,now).interval),[1,3,16],'first-review stabilities round to 1, 3 and 16 days');
  const settled=[{at:new Date(2026,9,1,9).toISOString(),rating:'understood'},{at:new Date(2026,9,5,9).toISOString(),rating:'understood'}];
  const missed=[...settled,{at:new Date(2026,10,1,9).toISOString(),rating:'wrong'}];
  assert.ok(scheduleReview(missed,'mastered',now).interval<scheduleReview(settled,'mastered',now).interval,'forgetting shortens the next gap');
  assert.ok(scheduleReview(settled,'mastered',now).interval>scheduleReview(settled,'guessed',now).interval);
  const data=emptyReviews();const event=recordReview(data,'a',{answer:'x',correct:false,explanation:'not yet',rating:'mastered'},now);
  assert.equal(event.rating,'wrong');assert.equal(loadReviews(JSON.stringify(data)).events.length,1);
});
test('backlog is batched at the fixed daily size (an old minutes setting is ignored); extra review is available; Sunday includes this week but no new-today material',()=>{
  const data=emptyReviews(),now=new Date(2026,10,1,12),cards=Array.from({length:10},(_,i)=>card(String(i)));
  assert.equal(reviewQueue(cards,data,profile,now).length,6,'about 10 minutes at 1.5 minutes per item, even though this profile once chose 5 minutes');
  assert.equal(reviewQueue(cards,data,{...profile,dailyMinutes:20},now).length,6);
  assert.equal(reviewQueue(cards,data,profile,now,{extra:true}).length,10);
  recordReview(data,'0',{answer:'ok',correct:true,explanation:'ok',rating:'mastered'},new Date(2026,9,31,12));
  assert.ok(reviewQueue(cards,data,profile,now,{extra:true}).some(item=>item.id==='0'));
  assert.ok(!reviewQueue([card('today','2026-11-01T08:00:00')],data,profile,now).length);
});
const plan10={...profile,dailyMinutes:10};
function session(cards,data,start,count){
  const order=[];for(let i=0;i<count;i++){const now=new Date(start.getTime()+i*60000),next=reviewQueue(cards,data,plan10,now)[0];if(!next)break;order.push(next.id);recordReview(data,next.id,{answer:'ok',correct:true,explanation:'ok',rating:'understood'},now);}
  return order;
}
function oldCards(data,n){
  return Array.from({length:n},(_,i)=>{const item=card(`old${i}`,'2026-10-20T09:00:00');data.events.push({id:`e${i}`,cardId:item.id,at:new Date(2026,9,21,9).toISOString(),answer:'ok',correct:true,explanation:'ok',rating:'understood',interval:3,due:new Date(2026,9,24).toISOString()});return item;});
}
test('the last study day comes first, but half of the daily plan stays with older due cards',()=>{
  const data=emptyReviews(),recent=Array.from({length:9},(_,i)=>card(`new${i}`,`2026-11-02T0${i}:00:00`)),cards=[...oldCards(data,9),...recent];
  const order=session(cards,data,new Date(2026,10,3,12),10);
  assert.equal(order.length,6,'the 10-minute plan suggests six items');
  assert.deepEqual(order.slice(0,3),['new0','new1','new2'],'yesterday’s content starts the session in learning order');
  assert.deepEqual(order.slice(3),['old0','old1','old2'],'older overdue cards still get their share');
});
test('one group fills unused slots of the other, and skipped days still start with the last study day',()=>{
  const onlyOld=emptyReviews();assert.equal(session(oldCards(onlyOld,9),onlyOld,new Date(2026,10,3,12),10).length,6);
  const onlyNew=emptyReviews(),fresh=Array.from({length:9},(_,i)=>card(`new${i}`,'2026-11-02T09:00:00'));
  assert.equal(session(fresh,onlyNew,new Date(2026,10,3,12),10).length,6);
  const gap=emptyReviews(),lastStudy=card('last','2026-10-28T09:00:00'),earlier=card('earlier','2026-10-27T09:00:00');
  assert.equal(reviewQueue([earlier,lastStudy],gap,plan10,new Date(2026,10,3,12))[0].id,'last','after days away, the most recent study day is still first');
});
test('same-day retries return first after ten minutes and extra practice keeps the order',()=>{
  const data=emptyReviews(),cards=[...oldCards(data,2),card('new0','2026-11-02T09:00:00'),card('new1','2026-11-02T10:00:00')],start=new Date(2026,10,3,12);
  recordReview(data,'new0',{answer:'?',correct:false,explanation:'not yet',rating:'wrong'},start);
  assert.equal(reviewQueue(cards,data,plan10,new Date(start.getTime()+5*60000))[0].id,'new1','a wrong answer waits about ten minutes');
  assert.equal(reviewQueue(cards,data,plan10,new Date(start.getTime()+11*60000))[0].id,'new0');
  assert.deepEqual(reviewQueue(cards,data,plan10,new Date(start.getTime()+11*60000),{extra:true}).map(item=>item.id),['new0','new1','old0','old1']);
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

test('rating hints show when each choice brings the card back, matching what recording would schedule', async () => {
  const { ratingPreview, recordReview, emptyReviews } = await import('../review-store.js');
  const now = new Date('2026-11-15T12:00:00');
  const fresh = ratingPreview(emptyReviews(), 'c1', ['wrong', 'unclear', 'understood', 'mastered'], {}, now);
  assert.equal(fresh.wrong, 0); assert.equal(fresh.unclear, 0);
  assert.ok(fresh.understood >= 1 && fresh.mastered > fresh.understood, 'easier ratings wait longer');
  const data = emptyReviews();
  for (const rating of ['understood', 'mastered']) {
    const copy = structuredClone(data);
    assert.equal(recordReview(copy, 'c1', { answer: '', correct: true, explanation: '', rating }, now).interval, fresh[rating]);
  }
  const judgedWrong = ratingPreview(emptyReviews(), 'c1', ['understood', 'mastered'], { correct: false }, now);
  assert.deepEqual(judgedWrong, { understood: 0, mastered: 0 }, 'a model-judged wrong answer comes back in 10 minutes whatever is chosen');
});
