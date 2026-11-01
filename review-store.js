import { localDay } from './knowledge-store.js';
export const REVIEW_KEY='knowledge-review.reviews.v1';
export const emptyReviews=()=>({version:1,events:[]});
// Limits follow what the app writes: answers ≤4,000 characters, model explanations ≤6,000.
export const REVIEW_LIMITS={events:50000,id:100,answer:4000,explanation:6000,seconds:600};
// Without measured history an item is estimated at 1.5 minutes.
export const DEFAULT_ITEM_SECONDS=90;
const text=(value,max)=>typeof value==='string'&&value.length<=max;
export function validReviewEvent(event){
  return Boolean(event&&typeof event==='object'&&text(event.id,REVIEW_LIMITS.id)&&event.id&&text(event.cardId,REVIEW_LIMITS.id)&&event.cardId
    &&Number.isFinite(Date.parse(event.at))&&Number.isFinite(Date.parse(event.due))&&Number.isInteger(event.interval)&&event.interval>=0&&event.interval<=180
    &&['wrong','unclear','guessed','understood','mastered'].includes(event.rating)&&text(event.answer,REVIEW_LIMITS.answer)
    &&typeof event.correct==='boolean'&&text(event.explanation,REVIEW_LIMITS.explanation)
    &&(event.seconds===undefined||(Number.isInteger(event.seconds)&&event.seconds>=0&&event.seconds<=REVIEW_LIMITS.seconds)));
}
// Calendar arithmetic on local dates, so daylight-saving shifts never move a day boundary.
export function addDays(day,count){const [year,month,date]=day.split('-').map(Number);return localDay(new Date(year,month-1,date+count));}
const dayStart=day=>{const [year,month,date]=day.split('-').map(Number);return new Date(year,month-1,date);};
// Day intervals are compared as local calendar days where the user is now; only 10-minute retries use an exact time.
export function dueInfo(card,last){
  if(!last)return {day:addDays(localDay(card.createdAt),1)};
  if(last.interval===0)return {at:new Date(last.due)};
  return {day:addDays(localDay(last.at),last.interval)};
}
const isDue=(info,now)=>info.at?info.at<=now:info.day<=localDay(now);
const dueTime=info=>info.at||dayStart(info.day);
const spent=event=>Number.isInteger(event.seconds)?event.seconds:DEFAULT_ITEM_SECONDS;
// Median of the latest measured answers, clamped so one slow or rushed item barely moves the plan.
export function itemSeconds(events){
  const measured=events.filter(event=>Number.isInteger(event.seconds)).slice(-30).map(event=>event.seconds).sort((a,b)=>a-b);
  if(measured.length<3)return DEFAULT_ITEM_SECONDS;
  return Math.min(300,Math.max(30,measured[Math.floor(measured.length/2)]));
}
export function dailyPlan(data,profile,now=new Date()){
  const today=localDay(now),todayEvents=data.events.filter(event=>localDay(event.at)===today);
  const budget=profile.dailyMinutes*60,used=todayEvents.reduce((sum,event)=>sum+spent(event),0),estimate=itemSeconds(data.events);
  return {budget,used,estimate,dayItems:Math.floor(budget/estimate),remainingItems:Math.floor(Math.max(0,budget-used)/estimate),todayEvents};
}
export function loadReviews(raw){
  if(!raw)return emptyReviews();const data=JSON.parse(raw);
  if(data?.version!==1||!Array.isArray(data.events)||data.events.length>REVIEW_LIMITS.events||!data.events.every(validReviewEvent))throw new Error('invalid reviews');
  return data;
}
export function tomorrow(value){const date=new Date(value);date.setDate(date.getDate()+1);date.setHours(0,0,0,0);return date;}
export function latestReview(data,id){return data.events.filter(event=>event.cardId===id).sort((a,b)=>b.at.localeCompare(a.at)).at(0);}
export function scheduleReview(previous,rating,now=new Date()){
  const date=new Date(now);let interval=0;
  if(rating==='wrong'||rating==='unclear')return {interval:0,due:new Date(date.getTime()+10*60000).toISOString()};
  if(rating==='guessed')return {interval:1,due:tomorrow(date).toISOString()};
  interval=rating==='mastered'?Math.max(3,Math.round((previous?.interval||1)*2.4)):Math.max(1,Math.round((previous?.interval||0)*1.8));
  interval=previous&&['wrong','unclear'].includes(previous.rating)?1:Math.min(interval,180);date.setDate(date.getDate()+interval);date.setHours(0,0,0,0);return {interval,due:date.toISOString()};
}
// Queue order: today's retries, then cards from the last study day before today ("yesterday's content"),
// then older due and weak cards. Retries are always offered: a missed idea belongs to today's review even
// after the plan is used. Recent cards may use at most half of the day's plan, counted against reviews
// already done today, so older cards are never starved. Either group fills the other's unused slots.
// The plan is time-based (measured answer time); extra practice keeps the order without any cap.
export function reviewQueue(cards,data,profile,now=new Date(),{extra=false}={}){
  const today=localDay(now),weekStart=new Date(now);weekStart.setDate(weekStart.getDate()-((weekStart.getDay()+6)%7));weekStart.setHours(0,0,0,0);
  const plan=dailyPlan(data,profile,now),todayEvents=plan.todayEvents,completedToday=new Set(todayEvents.map(event=>event.cardId));
  const eligible=cards.filter(card=>card.status==='active'&&card.extraction==='ready'&&profile.modules[card.module]?.enabled);
  const recentDay=eligible.map(card=>localDay(card.createdAt)).filter(day=>day<today).sort().at(-1);
  const candidates=eligible.map(card=>{
    const last=latestReview(data,card.id),info=dueInfo(card,last),due=dueTime(info);
    const sunday=now.getDay()===0&&!completedToday.has(card.id)&&new Date(card.createdAt)>=weekStart&&localDay(card.createdAt)<today;
    const weak=Boolean(last&&['wrong','unclear','guessed'].includes(last.rating));
    const retry=Boolean(last&&localDay(last.at)===today&&['wrong','unclear'].includes(last.rating));
    return {card,due,weak,sunday,retry,ready:isDue(info,now),recent:!retry&&localDay(card.createdAt)===recentDay};
  }).filter(item=>item.ready||(item.sunday&&!item.retry)||extra);
  const important=(a,b)=>Number(Boolean(b.card.important))-Number(Boolean(a.card.important));
  const retries=candidates.filter(item=>item.retry).sort((a,b)=>a.due-b.due);
  const recent=candidates.filter(item=>item.recent).sort((a,b)=>important(a,b)||a.due-b.due||a.card.createdAt.localeCompare(b.card.createdAt));
  const older=candidates.filter(item=>!item.retry&&!item.recent).sort((a,b)=>Number(b.weak)-Number(a.weak)||important(a,b)||a.due-b.due);
  if(extra)return [...retries,...recent,...older].slice(0,100).map(item=>item.card);
  const open=plan.remainingItems;
  const recentIds=new Set(eligible.filter(card=>localDay(card.createdAt)===recentDay).map(card=>card.id));
  const recentQuota=Math.max(0,Math.ceil(plan.dayItems/2)-todayEvents.filter(event=>recentIds.has(event.cardId)).length);
  const recentTake=Math.min(recent.length,Math.max(recentQuota,open-older.length),open);
  return [...retries.filter(item=>item.ready),...recent.slice(0,recentTake),...older.slice(0,open-recentTake)].map(item=>item.card);
}
export function recordReview(data,cardId,{answer,correct,explanation,rating,seconds},now=new Date()){
  // Self-reported mastery never upgrades a model-judged incorrect answer.
  const effective=correct===false&&!['wrong','unclear'].includes(rating)?'wrong':rating;
  if(!['wrong','unclear','guessed','understood','mastered'].includes(effective))throw new Error('rating');
  const event={id:crypto.randomUUID(),cardId,at:now.toISOString(),answer,correct,explanation,rating:effective,...scheduleReview(latestReview(data,cardId),effective,now)};
  // Time on the item, capped so a question left open while away does not count as study time.
  if(Number.isFinite(seconds))event.seconds=Math.min(REVIEW_LIMITS.seconds,Math.max(0,Math.round(seconds)));
  data.events.push(event);return event;
}
export function suggestedLevel(cards,events,module,current,since=''){
  const ids=new Set(cards.filter(card=>card.module===module).map(card=>card.id));
  const recent=events.filter(event=>ids.has(event.cardId)&&event.at>since).slice(-5);
  const levels=['beginner','some','advanced'],index=levels.indexOf(current);
  if(index<0)return current;
  if(recent.length>=3&&recent.slice(-3).every(event=>['wrong','unclear'].includes(event.rating)))return levels[Math.max(0,index-1)];
  if(recent.length===5&&recent.every(event=>event.correct===true&&['understood','mastered'].includes(event.rating)))return levels[Math.min(2,index+1)];
  return current;
}
