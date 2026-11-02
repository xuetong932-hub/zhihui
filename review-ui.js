import {REVIEW_KEY,emptyReviews,loadReviews,reviewQueue,recordReview,suggestedLevel,dailyPlan,streakDays,sessionStars,latestReview} from './review-store.js';
import {localDay} from './knowledge-store.js';
const CELEBRATED_KEY='knowledge-review.celebrated-day';
import {escapeHtml as e,renderAnswer} from './chat-store.js';
export function createReviewUI({locale,profile,cards,markWeak,call,refresh,adaptLevel,modules=()=>[],openModule=()=>{},goHome=()=>{}}){
  // This visit's results, used by the completion popup.
  const session={reviewed:0,correct:0,unclear:0,guessed:0};
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
    const plan=dailyPlan(data,profile()),used=Math.round(plan.used/60);
    return tr(`今天已复习约 ${used} 分钟。每天分批安排约 ${plan.dayItems} 道题（按你最近的答题用时估算），积压内容会分几天补上；当天答错的题不受限制。可以跳过，也可以用“自主加练”继续。`,`About ${used} minutes reviewed today. Review is batched at about ${plan.dayItems} items a day (estimated from your recent answer time), so backlogs spread over several days; same-day retries are not limited. Skip anytime, or continue with Extra practice.`);
  }
  function view(){
    const count=queue().length;
    return `<section class="intro"><span class="eyebrow">${tr('今日复习','Today’s review')}</span><h1>${tr('一次，只弄懂一个知识点。','One idea at a time.')}</h1><p>${new Date().getDay()===0?tr('周日回顾：本周知识与历史薄弱点。你仍可自由提问。','Sunday recap: this week’s ideas and older weak points. New questions remain available.'):tr('先从上次学习的新内容开始，再穿插到期和薄弱的旧知识；未答对的约 10 分钟后再练。','Start with what you learned last time, then older due and weak ideas. Missed items return in about 10 minutes.')}</p></section>
      <section class="panel review-session ${current?'answering':''}"><div class="review-setup"><div class="section-heading"><h2>${count} ${tr('项可安排','available')}</h2><button class="text-button" id="review-extra">${tr('自主加练（含未到期知识）','Extra practice (including not-yet-due ideas)')}</button></div><p>${planText()}</p><label>${tr('答题方式','Answer mode')}<select id="review-mode" ${busy||current?'disabled':''}><option value="text" ${mode==='text'?'selected':''}>${tr('文字回答','Written answer')}</option><option value="choice" ${mode==='choice'?'selected':''}>${tr('选择题','Multiple choice')}</option></select></label></div>
      ${!current?`<div class="empty-state"><h3>${count?tr('准备好了吗？','Ready to start?'):tr('当前计划已完成，或暂未到复习时间','Plan complete, or nothing is due yet')}</h3><p>${tr('新知识默认从次日开始复习。未理解的内容约 10 分钟后再练，并进入后续跨天复习。','New knowledge starts tomorrow. Difficult ideas return in about 10 minutes and on later days.')}</p>${count?`<button id="review-start" class="primary-button">${tr('开始复习','Start review')}</button>`:''}</div>`:`<article class="review-card"><div class="review-progress"><span>${tr(`还剩 ${count} 题`,`${count} left`)}</span><span>${mode==='choice'?tr('选择题','Multiple choice'):tr('文字回答','Written answer')}</span></div><span class="eyebrow">${e(current.category)}</span><h3>${e(mode==='choice'?question?.question||tr('准备题目','Preparing a question'):tr('请用自己的话解释：','Explain in your own words:')+current.title)}</h3>
      ${mode==='choice'&&question?`<div class="choice-options">${question.options.map((option,index)=>`<label class="check-row"><input type="radio" name="review-option" value="${index}" ${String(index)===answer?'checked':''} ${grade||busy?'disabled':''}><span>${e(option)}</span></label>`).join('')}</div>`:mode==='text'?`<label class="field-label" for="review-answer">${tr('你的理解','Your understanding')}</label><textarea id="review-answer" maxlength="4000" ${grade||busy?'disabled':''}>${e(answer)}</textarea>`:''}
      ${!grade?`<div class="actions review-bar"><button class="secondary-button" id="review-skip" ${busy?'disabled':''}>${tr('跳过本题','Skip this item')}</button><button class="primary-button" id="review-submit" ${busy?'disabled':''}>${tr(mode==='choice'&&!question?'重试出题':'提交回答',mode==='choice'&&!question?'Retry question':'Submit answer')}</button></div>`:`<div class="review-feedback${grade.correct?' is-correct':''}">${grade.correct?'<span class="review-burst" aria-hidden="true"><i>★</i><i>✓</i><i>★</i></span>':''}<h3>${grade.correct?tr('核心理解正确','Core understanding is correct'):tr('还有需要弄懂的地方','Let’s work on this')}</h3><div class="message-content">${renderAnswer(grade.explanation)}</div><details><summary>${tr('查看知识卡片解释','Show card explanation')}</summary><div class="message-content">${renderAnswer(current.summary)}</div></details><p>${tr('如模型判断有误，可先修正知识卡片后再次复习；不按固定措辞判分。','If the judgment is wrong, correct the card and review again. Exact wording is not required.')}</p><div class="followups review-bar ${grade.saved?'':'rating-bar'}">${grade.saved?`<button class="primary-button" data-review-next>${tr('继续复习','Continue review')}</button>`:[['guessed','我猜对了','I guessed'],['unclear','还是不懂','Still unclear'],['understood','理解了','Understood'],['mastered','已经掌握','Mastered']].map(([id,zh,en])=>`<button class="secondary-button" data-review-rating="${id}" ${busy?'disabled':''}>${tr(zh,en)}</button>`).join('')}</div></div>`}</article>`}
      <p class="verified" role="status">${busy?tr('正在处理…','Working…'):''}</p><p class="error" role="alert">${e(error)}</p></section>`;
  }
  // Completion popup when today's planned review is done: stars, results, streak, then choose a module to ask in.
  // Shown once per day; retries due in about 10 minutes are mentioned rather than blocking the celebration.
  function celebrate(){
    const today=localDay(new Date());
    try{if(localStorage.getItem(CELEBRATED_KEY)===today)return;localStorage.setItem(CELEBRATED_KEY,today);}catch{/* Still celebrate this time. */}
    const stars=sessionStars(session),streak=streakDays(data.events),now=Date.now();
    const pending=new Set(data.events.filter(event=>localDay(event.at)===today&&['wrong','unclear'].includes(event.rating)&&new Date(event.due)>now).map(event=>event.cardId)).size;
    const dialog=document.createElement('dialog');dialog.className='celebrate-dialog';
    dialog.innerHTML=`<div class="confetti" aria-hidden="true">${Array.from({length:28},(_,i)=>`<i style="--x:${(i*37)%100}%;--d:${(i%7)*0.12}s;--c:${['#2f6fb0','#c0392b','#2e7d4f','#d68910','#7b4fa6'][i%5]}"></i>`).join('')}</div>
      <p class="celebrate-eyebrow">${tr('今日复习','Today’s review')}</p><h2>${tr('通关！','Level complete!')}</h2>
      <div class="celebrate-stars" aria-label="${tr(`${stars} 颗星`,`${stars} stars`)}">${[1,2,3].map(n=>`<span class="${n<=stars?'on':''}" style="--n:${n}">★</span>`).join('')}</div>
      <div class="celebrate-stats"><div><strong>${session.reviewed}</strong><span>${tr('复习','Reviewed')}</span></div><div><strong>${session.correct}</strong><span>${tr('答对','Correct')}</span></div><div><strong>${session.unclear}</strong><span>${tr('还不懂','Unclear')}</span></div></div>
      <p class="celebrate-streak">${streak>1?tr(`已连续复习 ${streak} 天 🔥`,`${streak}-day streak 🔥`):tr('今天开始连续复习 🔥','Your streak starts today 🔥')}</p>
      ${pending?`<p class="celebrate-note">${tr(`还有 ${pending} 题约 10 分钟后再练一次。`,`${pending} missed ideas come back in about 10 minutes.`)}</p>`:''}
      <h3>${tr('接下来，想问点什么？','What would you like to ask next?')}</h3>
      <div class="celebrate-modules">${modules().map(item=>`<button class="secondary-button" data-celebrate-module="${e(item.id)}">${e(item.name)} →</button>`).join('')}</div>
      <div class="celebrate-actions"><button class="text-button" data-celebrate="extra">${tr('再练一会儿','Practise a bit more')}</button><button class="text-button" data-celebrate="home">${tr('回首页','Back to home')}</button></div>`;
    const close=()=>{dialog.close();dialog.remove();};
    dialog.querySelectorAll('[data-celebrate-module]').forEach(button=>button.onclick=()=>{close();openModule(button.dataset.celebrateModule);});
    dialog.querySelector('[data-celebrate="extra"]').onclick=()=>{close();extra=true;visited.clear();skipped.clear();refresh();};
    dialog.querySelector('[data-celebrate="home"]').onclick=()=>{close();goHome();};
    dialog.addEventListener('cancel',()=>dialog.remove());
    document.body.append(dialog);dialog.showModal();
  }
  function next(){current=null;question=null;grade=null;answer='';refresh();if(!extra&&session.reviewed&&!queue().length)celebrate();}
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
      visited.add(current.id);session.reviewed++;if(event.correct===true&&['understood','mastered'].includes(event.rating))session.correct++;else if(event.rating==='guessed')session.guessed++;else session.unclear++;
      const currentModule=profile().modules[current.module],recommended=suggestedLevel(cards(),data.events,current.module,currentModule.level,currentModule.adaptedAt||'');
      if(recommended!==currentModule.level)adaptLevel?.(current.module,recommended,event.at);
      if(['wrong','unclear'].includes(event.rating))markWeak(current.id,event.rating);
      if(rating==='unclear'){grade.saved=true;const result=await request('explain');if(result)grade={...grade,explanation:result.explanation,saved:true};refresh();return;}
      next();
    });
  }
  // For the library's memory view: all review events and today's planned cards.
  // Home-page preview of today's queue, in the order review will ask it.
  const preview=()=>queue().map(card=>{const last=latestReview(data,card.id);return {card,last:last?.at||'',kind:!last?'new':['wrong','unclear','guessed'].includes(last.rating)?'weak':'due'};});
  return {view,bind,reload:load,count:()=>queue().length,preview,events:()=>data,dueIds:()=>new Set(reviewQueue(cards(),data,profile(),new Date()).map(card=>card.id)),get busy(){return busy;}};
}
