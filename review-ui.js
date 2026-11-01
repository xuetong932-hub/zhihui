import {REVIEW_KEY,emptyReviews,loadReviews,reviewQueue,recordReview,suggestedLevel,dailyPlan} from './review-store.js';
import {escapeHtml as e,renderAnswer} from './chat-store.js';
export function createReviewUI({locale,profile,cards,markWeak,call,refresh,adaptLevel}){
  const tr=(zh,en)=>locale()==='zh'?zh:en;
  let data=emptyReviews(),snapshot=null,error='',blocked=false,busy=false,extra=false,mode='text',current=null,question=null,answer='',grade=null;
  function load(){
    data=emptyReviews();snapshot=null;error='';blocked=false;extra=false;current=null;question=null;answer='';grade=null;skipped.clear();visited.clear();
    try{snapshot=localStorage.getItem(REVIEW_KEY);data=loadReviews(snapshot);}catch{blocked=true;error=tr('复习记录无法读取，未覆盖原数据。','Review records could not be read. Original data retained.');}
  }
  const skipped=new Set(),visited=new Set();
  load();
  const queue=()=>reviewQueue(cards().filter(card=>!skipped.has(card.id)&&(!extra||!visited.has(card.id))),data,profile(),new Date(),{extra});
  async function request(task){busy=true;error='';refresh();try{return await call(task,current,answer);}catch{error=tr('模型请求未完成，请检查 Key 和网络后重试。没有把本次记作答错。','Request incomplete. Check your key and network; this was not recorded as a wrong answer.');return null;}finally{busy=false;refresh();}}
  // Answer time starts once the question is on screen; question generation is not counted.
  let startedAt=0;
  async function begin(){current=queue()[0]||null;question=null;grade=null;answer='';error='';if(current&&mode==='choice'){question=await request('question');}startedAt=Date.now();refresh();}
  function planText(){
    const plan=dailyPlan(data,profile()),used=Math.round(plan.used/60),per=Math.round(plan.estimate/6)/10;
    return tr(`今天已复习约 ${used} 分钟，计划 ${profile().dailyMinutes} 分钟。题量按你最近的答题用时估算（约每题 ${per} 分钟，暂无记录时按 1.5 分钟）；当天答错的题不受计划限制。计划只是建议，可以跳过或继续。`,`About ${used} of ${profile().dailyMinutes} planned minutes reviewed today. Item count uses your recent answer time (about ${per} min per item; 1.5 min until measured). Same-day retries are always offered. The plan is a suggestion; skip or continue anytime.`);
  }
  function view(){
    const count=queue().length;
    return `<section class="intro"><span class="eyebrow">${tr('今日复习','Today’s review')}</span><h1>${tr('一次，只弄懂一个知识点。','One idea at a time.')}</h1><p>${new Date().getDay()===0?tr('周日回顾：本周知识与历史薄弱点。你仍可自由提问。','Sunday recap: this week’s ideas and older weak points. New questions remain available.'):tr('先从上次学习的新内容开始，再穿插到期和薄弱的旧知识；未答对的约 10 分钟后再练。','Start with what you learned last time, then older due and weak ideas. Missed items return in about 10 minutes.')}</p></section>
      <section class="panel"><div class="section-heading"><h2>${count} ${tr('项可安排','available')}</h2><button class="text-button" id="review-extra">${tr('自主加练（含未到期知识）','Extra practice (including not-yet-due ideas)')}</button></div><p>${planText()}</p><label>${tr('答题方式','Answer mode')}<select id="review-mode" ${busy||current?'disabled':''}><option value="text" ${mode==='text'?'selected':''}>${tr('文字回答','Written answer')}</option><option value="choice" ${mode==='choice'?'selected':''}>${tr('选择题','Multiple choice')}</option></select></label>
      ${!current?`<div class="empty-state"><h3>${count?tr('准备好了吗？','Ready to start?'):tr('当前计划已完成，或暂未到复习时间','Plan complete, or nothing is due yet')}</h3><p>${tr('新知识默认从次日开始复习。未理解的内容约 10 分钟后再练，并进入后续跨天复习。','New knowledge starts tomorrow. Difficult ideas return in about 10 minutes and on later days.')}</p>${count?`<button id="review-start" class="primary-button">${tr('开始复习','Start review')}</button>`:''}</div>`:`<article><span class="eyebrow">${e(current.category)}</span><h3>${e(mode==='choice'?question?.question||tr('准备题目','Preparing a question'):tr('请用自己的话解释：','Explain in your own words:')+current.title)}</h3>
      ${mode==='choice'&&question?`<div class="choice-options">${question.options.map((option,index)=>`<label class="check-row"><input type="radio" name="review-option" value="${index}" ${String(index)===answer?'checked':''} ${grade||busy?'disabled':''}><span>${e(option)}</span></label>`).join('')}</div>`:mode==='text'?`<label class="field-label" for="review-answer">${tr('你的理解','Your understanding')}</label><textarea id="review-answer" maxlength="4000" ${grade||busy?'disabled':''}>${e(answer)}</textarea>`:''}
      ${!grade?`<div class="actions"><button class="secondary-button" id="review-skip" ${busy?'disabled':''}>${tr('跳过本题','Skip this item')}</button><button class="primary-button" id="review-submit" ${busy?'disabled':''}>${tr(mode==='choice'&&!question?'重试出题':'提交回答',mode==='choice'&&!question?'Retry question':'Submit answer')}</button></div>`:`<div class="review-feedback"><h3>${grade.correct?tr('核心理解正确','Core understanding is correct'):tr('还有需要弄懂的地方','Let’s work on this')}</h3><div class="message-content">${renderAnswer(grade.explanation)}</div><details><summary>${tr('查看知识卡片解释','Show card explanation')}</summary><div class="message-content">${renderAnswer(current.summary)}</div></details><p>${tr('如模型判断有误，可先修正知识卡片后再次复习；不按固定措辞判分。','If the judgment is wrong, correct the card and review again. Exact wording is not required.')}</p><div class="followups">${grade.saved?`<button class="primary-button" data-review-next>${tr('继续复习','Continue review')}</button>`:[['guessed','我猜对了','I guessed'],['unclear','还是不懂','Still unclear'],['understood','理解了','Understood'],['mastered','已经掌握','Mastered']].map(([id,zh,en])=>`<button class="secondary-button" data-review-rating="${id}" ${busy?'disabled':''}>${tr(zh,en)}</button>`).join('')}</div></div>`}</article>`}
      <p class="verified" role="status">${busy?tr('正在处理…','Working…'):''}</p><p class="error" role="alert">${e(error)}</p></section>`;
  }
  function next(){current=null;question=null;grade=null;answer='';refresh();}
  function bind(){
    document.querySelector('#review-mode').onchange=event=>{mode=event.target.value;};
    document.querySelector('#review-extra').onclick=()=>{extra=true;visited.clear();skipped.clear();refresh();};
    const start=document.querySelector('#review-start');if(start)start.onclick=()=>begin();
    const advance=document.querySelector('[data-review-next]');if(advance)advance.onclick=()=>next();
    const input=document.querySelector('#review-answer');if(input)input.oninput=event=>{answer=event.target.value;};
    document.querySelectorAll('[name="review-option"]').forEach(input=>input.onchange=()=>{answer=input.value;});
    const skip=document.querySelector('#review-skip');if(skip)skip.onclick=()=>{skipped.add(current.id);next();};
    const submit=document.querySelector('#review-submit');if(submit)submit.onclick=async()=>{
      if(busy||blocked)return;
      if(mode==='choice'&&!question){question=await request('question');startedAt=Date.now();refresh();return;}
      if(!answer.trim()){error=tr('请先作答。','Answer first.');refresh();return;}
      if(mode==='choice')grade={correct:Number(answer)===question.correctIndex,explanation:question.explanation};
      else grade=await request('grade');refresh();
    };
    document.querySelectorAll('[data-review-rating]').forEach(button=>button.onclick=async()=>{
      if(busy||blocked)return;if(grade.saved){next();return;}const rating=button.dataset.reviewRating;
      const before=data.events.length;
      const event=recordReview(data,current.id,{answer:mode==='choice'?question.options[Number(answer)]:answer,correct:grade.correct,explanation:grade.explanation,rating,seconds:startedAt?(Date.now()-startedAt)/1000:undefined});
      try{if(localStorage.getItem(REVIEW_KEY)!==snapshot)throw new Error('conflict');const raw=JSON.stringify(data);localStorage.setItem(REVIEW_KEY,raw);snapshot=raw;}
      catch{data.events.splice(before);error=tr('保存失败或其他页面已更新，请复制回答后刷新。','Save failed or another page updated records. Copy your answer before reloading.');refresh();return;}
      visited.add(current.id);
      const currentModule=profile().modules[current.module],recommended=suggestedLevel(cards(),data.events,current.module,currentModule.level,currentModule.adaptedAt||'');
      if(recommended!==currentModule.level)adaptLevel?.(current.module,recommended,event.at);
      if(['wrong','unclear'].includes(event.rating))markWeak(current.id,event.rating);
      if(rating==='unclear'){grade.saved=true;const result=await request('explain');if(result)grade={...grade,explanation:result.explanation,saved:true};refresh();return;}
      next();
    });
  }
  return {view,bind,reload:load,count:()=>queue().length,get busy(){return busy;}};
}
