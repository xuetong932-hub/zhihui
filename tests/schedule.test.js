import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewQueue,recordReview,emptyReviews,loadReviews,dailyPlan,itemSeconds,addDays,validReviewEvent} from '../review-store.js';
// Each test file runs in its own process, so changing TZ here does not affect other files.
const zone=name=>{process.env.TZ=name;};
const plan10={dailyMinutes:10,modules:{coding:{enabled:true}}};
const card=(id,createdAt)=>({id,createdAt,module:'coding',status:'active',extraction:'ready'});
const answer=(data,id,at,rating='understood',seconds)=>recordReview(data,id,{answer:'ok',correct:!['wrong','unclear'].includes(rating),explanation:'ok',rating,seconds},new Date(at));
const ids=(cards,data,at,options)=>reviewQueue(cards,data,plan10,new Date(at),options).map(item=>item.id);

test('after flying west, a card reviewed “yesterday” is not due again on the same local day',()=>{
  zone('Asia/Singapore');
  const data=emptyReviews(),item=card('a','2026-11-01T02:00:00Z');
  answer(data,'a','2026-11-02T02:00:00Z','guessed'); // Mon 10:00 in Singapore; stored due is Tue 00:00 SGT = Mon 16:00 UTC
  zone('Europe/London');
  assert.deepEqual(ids([item],data,'2026-11-02T17:00:00Z'),[],'Mon 17:00 in London is still the review day');
  assert.deepEqual(ids([item],data,'2026-11-03T00:30:00Z'),['a'],'due once Tuesday starts locally');
  zone('UTC');
});

test('daylight-saving changes do not move day-based due dates',()=>{
  zone('America/New_York'); // DST ends 2026-11-01 02:00; spring forward 2026-03-08
  assert.equal(addDays('2026-10-31',1),'2026-11-01');assert.equal(addDays('2026-11-01',1),'2026-11-02');assert.equal(addDays('2026-03-07',1),'2026-03-08');assert.equal(addDays('2026-02-28',1),'2026-03-01');
  const data=emptyReviews(),item=card('a','2026-10-29T16:00:00Z');
  answer(data,'a','2026-10-31T16:00:00Z'); // Sat noon, interval 1
  assert.deepEqual(ids([item],data,'2026-11-01T03:59:00Z'),[],'23:59 Saturday is not yet due');
  assert.deepEqual(ids([item],data,'2026-11-01T04:30:00Z'),['a'],'00:30 Sunday local is due, across the 25-hour day');
  const spring=emptyReviews();answer(spring,'a','2026-03-07T17:00:00Z');
  assert.deepEqual(ids([item],spring,'2026-03-08T05:30:00Z'),['a'],'00:30 on the 23-hour day is due');
  zone('UTC');
});

test('a long absence is caught up in daily batches without starving any card',()=>{
  zone('UTC');
  const data=emptyReviews(),cards=Array.from({length:60},(_,i)=>card(`c${i}`,'2026-10-01T09:00:00Z')),seen=new Set(),perDay=[];
  for(let day=0;day<12&&seen.size<60;day++){
    let count=0;
    for(let i=0;i<20;i++){const at=new Date(Date.UTC(2026,9,20+day,9,i)),next=reviewQueue(cards,data,plan10,at)[0];if(!next)break;answer(data,next.id,at);seen.add(next.id);count++;}
    perDay.push(count);
  }
  assert.ok(perDay.every(count=>count<=6),`no day exceeds the plan: ${perDay}`);
  assert.equal(seen.size,60,'every overdue card is reached');
  assert.ok(perDay.length<=10,`backlog cleared in ${perDay.length} days`);
});

test('the plan uses measured answer time, and same-day retries are offered after the plan is used',()=>{
  zone('UTC');
  const data=emptyReviews(),cards=Array.from({length:30},(_,i)=>card(`c${i}`,'2026-10-01T09:00:00Z'));
  for(let i=0;i<5;i++)answer(data,`c${i}`,`2026-10-30T09:0${i}:00Z`,'understood',40);
  assert.equal(itemSeconds(data.events),40);assert.equal(dailyPlan(data,plan10,new Date('2026-11-02T09:00:00Z')).dayItems,15);
  const day=emptyReviews();answer(day,'c0','2026-11-02T09:00:00Z','wrong',300);answer(day,'c1','2026-11-02T09:05:00Z','understood',300);
  const plan=dailyPlan(day,plan10,new Date('2026-11-02T09:20:00Z'));
  assert.equal(plan.used,600);assert.equal(plan.remainingItems,0);
  assert.deepEqual(ids(cards,day,'2026-11-02T09:20:00Z'),['c0'],'only the missed card returns once 10 planned minutes are used');
  assert.equal(dailyPlan(emptyReviews(),plan10).dayItems,6,'unmeasured history keeps the 1.5-minute estimate');
  assert.equal(itemSeconds([{seconds:5},{seconds:5},{seconds:5}]),30);assert.equal(itemSeconds([{seconds:900},{seconds:900},{seconds:900}]),300);
});

test('Sunday adds this week’s not-yet-due cards but keeps retries first and excludes cards learned today',()=>{
  zone('UTC');
  const data=emptyReviews(),friday=card('fri','2026-10-30T09:00:00Z'),missed=card('miss','2026-10-29T09:00:00Z'),today=card('today','2026-11-01T08:00:00Z');
  answer(data,'fri','2026-10-31T09:00:00Z','mastered'); // interval 3: not due until Tuesday
  answer(data,'miss','2026-11-01T09:00:00Z','wrong');
  const queue=ids([friday,missed,today],data,'2026-11-01T09:15:00Z');
  assert.equal(queue[0],'miss');assert.ok(queue.includes('fri'));assert.ok(!queue.includes('today'));
});

test('measured seconds are capped and validated; older events without seconds still load',()=>{
  const data=emptyReviews();
  assert.equal(answer(data,'a','2026-11-01T09:00:00Z','understood',5000).seconds,600);
  assert.equal(answer(data,'b','2026-11-01T09:00:00Z','understood').seconds,undefined);
  assert.equal(loadReviews(JSON.stringify(data)).events.length,2);
  const event=data.events[1];
  for(const seconds of [601,-1,1.5,'60'])assert.equal(validReviewEvent({...event,seconds}),false);
});

import { streakDays, sessionStars } from '../review-store.js';
test('streak counts consecutive review days back from today (or yesterday); stars ignore guesses', () => {
  zone('UTC');
  const at = day => ({ at: `2026-11-${day}T09:00:00Z` });
  assert.equal(streakDays([at('01'), at('02'), at('03')], new Date('2026-11-03T20:00:00Z')), 3);
  assert.equal(streakDays([at('01'), at('02')], new Date('2026-11-03T08:00:00Z')), 2, 'not reviewed yet today keeps yesterday’s streak');
  assert.equal(streakDays([at('01'), at('03')], new Date('2026-11-03T20:00:00Z')), 1);
  assert.equal(streakDays([], new Date('2026-11-03T20:00:00Z')), 0);
  assert.deepEqual([sessionStars({ reviewed: 5, correct: 4 }), sessionStars({ reviewed: 4, correct: 2 }), sessionStars({ reviewed: 3, correct: 0 }), sessionStars({ reviewed: 0, correct: 0 })], [3, 2, 1, 0]);
});
