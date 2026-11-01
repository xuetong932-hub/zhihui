import {localDay} from './knowledge-store.js';
const DEVICE_KEY='knowledge-review.device.v1';
export function createDeviceUI({locale,refresh,due,openReview}){
  const tr=(zh,en)=>locale()==='zh'?zh:en;
  let settings={version:1,enabled:false,time:'19:00',popup:true},message='';
  try{const saved=JSON.parse(localStorage.getItem(DEVICE_KEY));if(saved?.version===1&&typeof saved.enabled==='boolean'&&typeof saved.popup==='boolean'&&/^\d{2}:\d{2}$/.test(saved.time))settings=saved;}catch{}
  const save=()=>{try{localStorage.setItem(DEVICE_KEY,JSON.stringify(settings));return true;}catch{message=tr('无法保存设置。','Unable to save settings.');return false;}};
  async function notify(){
    if(!settings.enabled||!('Notification'in window)||Notification.permission!=='granted')return;
    try{const registration=await navigator.serviceWorker?.ready;if(registration)await registration.showNotification(tr('知回 · 复习时间到了','Knowledge Review · Time to review'),{body:tr('回来巩固一个知识点吧。','Revisit one idea today.'),tag:'knowledge-review-reminder',data:{url:'/'}});else new Notification(tr('复习时间到了','Time to review'));}catch{message=tr('系统通知未能发送。','System notification could not be sent.');}
  }
  function check(){
    if(!settings.enabled||!due())return;
    const now=new Date(),day=localDay(now),time=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    if(time>=settings.time&&localStorage.getItem('knowledge-review.last-notification')!==day){localStorage.setItem('knowledge-review.last-notification',day);void notify();}
  }
  setInterval(check,30000);window.addEventListener('focus',check);
  function openingPopup(){
    if(!settings.popup||!due())return;const day=localDay(new Date());if(sessionStorage.getItem('knowledge-review.popup-day')===day)return;
    sessionStorage.setItem('knowledge-review.popup-day',day);
    const dialog=document.createElement('dialog');dialog.className='review-dialog';dialog.innerHTML=`<h2>${tr('今日复习已准备好','Your review is ready')}</h2><p>${due()} ${tr('项知识等你巩固，可稍后再来。','ideas to revisit. You can return later.')}</p><div class="actions"><button class="secondary-button" id="reminder-later">${tr('稍后','Later')}</button><button class="primary-button" id="reminder-now">${tr('开始复习','Start review')}</button></div>`;
    document.body.append(dialog);dialog.querySelector('#reminder-later').onclick=()=>{dialog.close();dialog.remove();};dialog.querySelector('#reminder-now').onclick=()=>{dialog.close();dialog.remove();openReview();};dialog.addEventListener('cancel',()=>dialog.remove());dialog.showModal();
  }
  function view(){return `<section class="intro"><h1>${tr('设备与数据','Device and data')}</h1><p>${tr('提醒由你控制；问答数据可随时导出备份。','Control reminders and export your learning data.')}</p></section><section class="panel"><h2>${tr('复习提醒','Review reminders')}</h2><p>${tr('开启前将请求系统通知授权。当前网页仅在页面运行时检查提醒；关闭页面后的定时推送尚需云端推送服务。','Permission is requested before enabling notifications. This web version checks reminders while the page runs; closed-app scheduled push needs a cloud push service.')}</p><label class="check-row"><input type="checkbox" id="opening-popup" ${settings.popup?'checked':''}>${tr('打开时显示今日复习弹窗','Show due-review popup on opening')}</label><label class="field-label" for="reminder-time">${tr('当地时间','Local time')}</label><input id="reminder-time" type="time" value="${settings.time}"><div class="followups"><button class="secondary-button" id="enable-notifications">${tr('授权并开启系统提醒','Allow and enable notifications')}</button><button class="text-button" id="disable-notifications">${tr('关闭系统提醒','Disable notifications')}</button><button class="secondary-button" id="test-notification">${tr('测试已授权通知','Test authorized notification')}</button></div><p>${settings.enabled?tr('应用提醒已开启','App reminders enabled'):tr('应用提醒未开启','App reminders disabled')} · ${tr('浏览器授权：','Browser permission: ')}${'Notification'in window?Notification.permission:tr('不支持','Unsupported')}</p></section><section class="panel"><h2>${tr('数据备份','Data backup')}</h2><p>${tr('导出学习设置、文字问答、知识卡片和复习记录；不包含 API Key、录音或登录凭据。文件可能含私人问答，请妥善保存。','Exports settings, text Q&A, knowledge cards and reviews. No API keys, audio or login credentials. Keep private Q&A files safe.')}</p><button class="secondary-button" id="export-learning">${tr('导出 JSON 备份','Export JSON backup')}</button></section><section class="panel"><h2>${tr('跨设备同步','Cross-device sync')}</h2><p>${tr('云端服务尚未配置，当前数据仅在本浏览器。账号、区域和同步冲突处理已预留；不会把本地保存显示为云同步成功。','Cloud service is not configured. Data stays in this browser. Account, region and conflict handling are reserved; local saves are not shown as cloud sync.')}</p></section><p role="status">${message}</p>`;}
  function bind(){
    document.querySelector('#opening-popup').onchange=event=>{settings.popup=event.target.checked;save();};
    document.querySelector('#reminder-time').onchange=event=>{if(/^\d{2}:\d{2}$/.test(event.target.value)){settings.time=event.target.value;save();}};
    document.querySelector('#enable-notifications').onclick=async()=>{if(!('Notification'in window)){message=tr('浏览器不支持系统通知。','Notifications unsupported.');refresh();return;}const permission=await Notification.requestPermission();settings.enabled=permission==='granted';save();refresh();};
    document.querySelector('#disable-notifications').onclick=()=>{settings.enabled=false;save();refresh();};
    document.querySelector('#test-notification').onclick=()=>notify();
    document.querySelector('#export-learning').onclick=()=>{
      const keys=['knowledge-review.profile.v1','knowledge-review.chats.v1','knowledge-review.knowledge.v1','knowledge-review.reviews.v1'];
      try{const backup={version:1,exportedAt:new Date().toISOString(),data:Object.fromEntries(keys.map(key=>[key,JSON.parse(localStorage.getItem(key))]))};const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`knowledge-review-${localDay(new Date())}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch{message=tr('导出失败，请检查存储数据。','Export failed. Check stored data.');refresh();}
    };
  }
  return {view,bind,openingPopup};
}
