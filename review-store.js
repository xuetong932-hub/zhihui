import { localDay } from './knowledge-store.js';
export const REVIEW_KEY='knowledge-review.reviews.v1';
export const emptyReviews=()=>({version:1,events:[]});
export function loadReviews(raw){
  if(!raw)return emptyReviews();const data=JSON.parse(raw);
  if(data?.version!==1||!Array.isArray(data.events)||!data.events.every(event=>typeof event.id==='string'&&typeof event.cardId==='string'&&Number.isFinite(Date.parse(event.at))&&Number.isFinite(Date.parse(event.due))&&Number.isInteger(event.interval)&&event.interval>=0&&event.interval<=180&&['wrong','unclear','guessed','understood','mastered'].includes(event.rating)&&typeof event.answer==='string'))throw new Error('invalid reviews');
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
export function reviewQueue(cards,data,profile,now=new Date(),{extra=false}={}){
  const today=localDay(now),weekStart=new Date(now);weekStart.setDate(weekStart.getDate()-((weekStart.getDay()+6)%7));weekStart.setHours(0,0,0,0);
  const completedToday=new Set(data.events.filter(event=>localDay(event.at)===today).map(event=>event.cardId));
  const candidates=cards.filter(card=>card.status==='active'&&card.extraction==='ready'&&profile.modules[card.module]?.enabled).map(card=>{
    const last=latestReview(data,card.id);const due=last?new Date(last.due):tomorrow(card.createdAt);
    const sunday=now.getDay()===0&&!completedToday.has(card.id)&&new Date(card.createdAt)>=weekStart&&localDay(card.createdAt)<today;
    const weak=last&&['wrong','unclear','guessed'].includes(last.rating);
    return {card,due,weak,sunday};
  }).filter(item=>item.due<=now||item.sunday||extra).sort((a,b)=>Number(b.weak)-Number(a.weak)||Number(Boolean(b.card.important))-Number(Boolean(a.card.important))||a.due-b.due);
  const limit=extra?100:Math.max(0,Math.floor(profile.dailyMinutes/1.5)-data.events.filter(event=>localDay(event.at)===today).length);
  return candidates.slice(0,limit).map(item=>item.card);
}
export function recordReview(data,cardId,{answer,correct,explanation,rating},now=new Date()){
  // Self-reported mastery never upgrades a model-judged incorrect answer.
  const effective=correct===false&&!['wrong','unclear'].includes(rating)?'wrong':rating;
  if(!['wrong','unclear','guessed','understood','mastered'].includes(effective))throw new Error('rating');
  const event={id:crypto.randomUUID(),cardId,at:now.toISOString(),answer,correct,explanation,rating:effective,...scheduleReview(latestReview(data,cardId),effective,now)};
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
