import {localDay} from './knowledge-store.js';
import {LEARNING_KEYS,MAX_BACKUPS,MAX_IMPORT_BYTES,parseExport,validateSnapshot,summarizeSnapshot,snapshotValues,replaceLearningData,canUndo,undoLastRestore,readOwner,readLocalSnapshot} from './local-space.js';
import {mergeSnapshots} from './snapshot-merge.js';
import {reminderCalendar} from './habit.js';
import {downloadText} from './viz-edit.js';
import { pick, intlLocale, currentLocale } from './i18n.js';
const DEVICE_KEY='knowledge-review.device.v1';
const esc=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
export function createDeviceUI({locale,refresh,due,openReview,validateProfile,reloadLocal,owner}){
  const tr = (zh, en, vars) => pick(zh, en, vars);
  let settings={version:1,enabled:false,time:'19:00',popup:true},message='';
  // A checked file waiting for confirmation; nothing is written before the user confirms.
  let pending=null,importConsent=false,reading=false;
  function importError(code){
    const part={profile:tr('学习设置','settings'),chats:tr('问答记录','chats'),knowledge:tr('知识库','knowledge library'),reviews:tr('复习记录','review records')}[code];
    if(code==='too-large')return tr('文件过大，超过本浏览器可保存的数据量，未导入。','The file is too large for this browser’s storage. Nothing was imported.');
    if(part)return tr('文件中的{part}未通过校验，未导入任何内容。', 'The file’s {part} failed validation. Nothing was imported.', { part });
    return tr('这不是本 App 导出的 JSON 备份，或文件已损坏，未导入。','This is not a JSON backup exported by this app, or it is damaged. Nothing was imported.');
  }
  function mergeText(){
    const s=pending.mergeStats;
    if(!s)return `<p>${tr('本机现有数据无法读取，只能替换（原数据仍会先备份）。','Local data cannot be read, so only replacement is available (it is still backed up first).')}</p>`;
    return `<p>${tr('合并将新增：对话 {v0} 个、消息 {v1} 条、知识卡片 {v2} 张、复习记录 {v3} 条。', 'Merging adds {v0} conversations, {v1} messages, {v2} cards and {v3} review records.', { v0: s.threads, v1: s.messages, v2: s.cards, v3: s.events })}${s.conflicts?tr('两边内容不同的同一条记录 {v0} 处：卡片保留较新的修改，其他保留本机版本。', ' {v0} records differ on both sides: cards keep the newer edit, others keep the local version.', { v0: s.conflicts }):''}${s.possibleDuplicates?tr('有 {v0} 张卡片可能与其他卡片重复，可在知识库手动合并。', ' {v0} cards may duplicate others; merge them manually in the library.', { v0: s.possibleDuplicates }):''}</p>`;
  }
  function importView(){
    const summary=pending&&summarizeSnapshot(pending.snapshot),date=pending?.snapshot.exportedAt?new Date(pending.snapshot.exportedAt).toLocaleString(intlLocale(currentLocale())):tr('未知','unknown');
    return `<h3>${tr('导入 JSON 备份','Import a JSON backup')}</h3><p>${tr('只接受本 App“导出 JSON 备份”生成的文件，文件只在本浏览器内读取，不会上传。可选择<strong>合并</strong>（保留本机设置，加入文件中本机没有的记录）或<strong>替换</strong>（用文件覆盖本机数据）。两种方式都会先把当前本机记录保存为本机备份（最近 {MAX_BACKUPS} 份），可撤销。', 'Only files from “Export JSON backup” in this app are accepted. The file is read in this browser and never uploaded. Choose <strong>merge</strong> (keep local settings and add records missing locally) or <strong>replace</strong> (overwrite local data). Either way, current local records are kept as a local backup (latest {MAX_BACKUPS}) and can be undone.', { MAX_BACKUPS })}</p>
      <label class="field-label" for="import-file">${tr('选择备份文件','Choose a backup file')}</label><input id="import-file" type="file" accept=".json,application/json" ${reading?'disabled':''}>
      ${pending?`<div class="sharing-notice"><p><strong>${esc(pending.name)}</strong> · ${tr('导出时间','Exported')} ${esc(date)}</p><p>${tr('对话 {v0} 个、问答消息 {v1} 条、知识卡片 {v2} 张、复习记录 {v3} 条。', '{v0} conversations, {v1} messages, {v2} knowledge cards, {v3} review records.', { v0: summary.threads, v1: summary.messages, v2: summary.cards, v3: summary.reviews })}</p>${mergeText()}<label class="check-row"><input id="import-consent" type="checkbox" ${importConsent?'checked':''}>${tr('我确认文件中的记录属于我，可用于合并或替换本机学习数据','I confirm the records in this file are mine and may be merged into or replace local learning data')}</label><div class="followups">${pending.mergeStats?`<button class="primary-button" id="import-merge">${tr('合并到本机数据','Merge into local data')}</button>`:''}<button class="secondary-button" id="import-confirm">${tr('替换本机数据','Replace local data')}</button><button class="text-button" id="import-cancel">${tr('取消','Cancel')}</button></div></div>`:''}
      ${canUndo(localStorage,owner())?`<button class="text-button" id="import-undo">${tr('撤销上次替换（换回本机备份，可再次撤销）','Undo last replacement (swap in local backup; reversible)')}</button>`:''}`;
  }
  try{const saved=JSON.parse(localStorage.getItem(DEVICE_KEY));if(saved?.version===1&&typeof saved.enabled==='boolean'&&typeof saved.popup==='boolean'&&/^\d{2}:\d{2}$/.test(saved.time))settings=saved;}catch{}
  const save=()=>{try{localStorage.setItem(DEVICE_KEY,JSON.stringify(settings));return true;}catch{message=tr('无法保存设置。','Unable to save settings.');return false;}};
  async function notify(){
    if(!settings.enabled||!('Notification'in window)||Notification.permission!=='granted')return;
    try{const registration=await navigator.serviceWorker?.ready;if(registration)await registration.showNotification(tr('知回 · 复习时间到了','KnowBack · Time to review'),{body:tr('回来巩固一个知识点吧。','Revisit one idea today.'),tag:'knowledge-review-reminder',data:{url:'/'}});else new Notification(tr('复习时间到了','Time to review'));}catch{message=tr('系统通知未能发送。','System notification could not be sent.');}
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
  function view(){return `<section class="intro"><h1>${tr('设备与数据','Device and data')}</h1><p>${tr('提醒由你控制；问答数据可随时导出备份。','Control reminders and export your learning data.')}</p></section><section class="panel"><h2>${tr('复习提醒','Review reminders')}</h2><p>${tr('开启前将请求系统通知授权。当前网页仅在页面运行时检查提醒；关闭页面后的定时推送尚需云端推送服务。','Permission is requested before enabling notifications. This web version checks reminders while the page runs; closed-app scheduled push needs a cloud push service.')}</p><label class="check-row"><input type="checkbox" id="opening-popup" ${settings.popup?'checked':''}>${tr('打开时显示今日复习弹窗','Show due-review popup on opening')}</label><label class="field-label" for="reminder-time">${tr('当地时间','Local time')}</label><input id="reminder-time" type="time" value="${settings.time}">
        <div class="calendar-reminder"><h3>${tr('添加到手机日历（推荐）','Add to your phone’s calendar (recommended)')}</h3><p>${tr('在系统日历里添加一个每天 {v0} 的“知回 · 每日复习”提醒。由日历准时提醒，关掉知回也能收到；不需要通知授权，也不会上传任何数据。', 'Adds a daily “KnowBack · Daily review” event at {v0} to your calendar. Your calendar alerts you on time even when this app is closed; no permission needed and nothing is uploaded.', { v0: settings.time })}</p><button class="primary-button" id="add-calendar">${tr('添加到日历','Add to calendar')}</button><p class="field-hint">${tr('改了时间后，请删除日历里原来的事件，再重新添加。','After changing the time, delete the old calendar event and add it again.')}</p></div>
        <h3>${tr('系统通知（App 打开时）','System notifications (while the app is open)')}</h3><div class="followups"><button class="secondary-button" id="enable-notifications">${tr('授权并开启系统提醒','Allow and enable notifications')}</button><button class="text-button" id="disable-notifications">${tr('关闭系统提醒','Disable notifications')}</button><button class="secondary-button" id="test-notification">${tr('测试已授权通知','Test authorized notification')}</button></div><p>${settings.enabled?tr('应用提醒已开启','App reminders enabled'):tr('应用提醒未开启','App reminders disabled')} · ${tr('浏览器授权：','Browser permission: ')}${'Notification'in window?Notification.permission:tr('不支持','Unsupported')}</p></section><section class="panel"><h2>${tr('数据备份','Data backup')}</h2><p>${tr('导出学习设置、文字问答、知识卡片和复习记录；不包含 API Key、录音或登录凭据。文件可能含私人问答，请妥善保存。','Exports settings, text Q&A, knowledge cards and reviews. No API keys, audio or login credentials. Keep private Q&A files safe.')}</p><button class="secondary-button" id="export-learning">${tr('导出 JSON 备份','Export JSON backup')}</button>${importView()}</section><section class="panel"><h2>${tr('跨设备同步','Cross-device sync')}</h2><p>${tr('学习记录默认保存在本浏览器。可在“账号”页用同步口令加密上传，并在其他设备下载恢复；不会自动同步。','Learning records stay in this browser by default. Use the Account page to encrypt and upload them with a sync passphrase and restore them on other devices; nothing syncs automatically.')}</p></section><p role="status">${message}</p>`;}
  function bind(){
    document.querySelector('#opening-popup').onchange=event=>{settings.popup=event.target.checked;save();};
    document.querySelector('#reminder-time').onchange=event=>{if(/^\d{2}:\d{2}$/.test(event.target.value)){settings.time=event.target.value;save();refresh();}};
    // The .ics file opens in the phone's calendar app (or downloads on a computer); the event links back to 知回.
    document.querySelector('#add-calendar').onclick=()=>downloadText(reminderCalendar({time:settings.time,locale:locale(),url:location.origin+location.pathname}),tr('知回每日复习.ics','knowback-daily.ics'),'text/calendar');
    document.querySelector('#enable-notifications').onclick=async()=>{if(!('Notification'in window)){message=tr('浏览器不支持系统通知。','Notifications unsupported.');refresh();return;}const permission=await Notification.requestPermission();settings.enabled=permission==='granted';save();refresh();};
    document.querySelector('#disable-notifications').onclick=()=>{settings.enabled=false;save();refresh();};
    document.querySelector('#test-notification').onclick=()=>notify();
    document.querySelector('#export-learning').onclick=()=>{
      try{const backup={version:1,exportedAt:new Date().toISOString(),data:Object.fromEntries(LEARNING_KEYS.map(key=>[key,JSON.parse(localStorage.getItem(key))]))};const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`knowledge-review-${localDay(new Date())}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch{message=tr('导出失败，请检查存储数据。','Export failed. Check stored data.');refresh();}
    };
    const file=document.querySelector('#import-file');if(file)file.onchange=async()=>{
      const chosen=file.files?.[0];if(!chosen)return;pending=null;importConsent=false;message='';
      if(chosen.size>MAX_IMPORT_BYTES){message=importError('too-large');refresh();return;}
      reading=true;refresh();
      try{const snapshot=validateSnapshot(parseExport(await chosen.text()),validateProfile);let mergeStats=null;try{mergeStats=mergeSnapshots(readLocalSnapshot(localStorage),snapshot).stats;}catch{/* Only replacement is offered. */}pending={name:chosen.name.slice(0,200),snapshot,mergeStats};message=tr('文件已通过校验，确认后才会替换本机数据。','The file passed validation. Local data changes only after you confirm.');}
      catch(error){message=importError(error.code);}
      finally{reading=false;refresh();}
    };
    const consent=document.querySelector('#import-consent');if(consent)consent.onchange=()=>{importConsent=consent.checked;};
    const cancel=document.querySelector('#import-cancel');if(cancel)cancel.onclick=()=>{pending=null;importConsent=false;message='';refresh();};
    const confirm=document.querySelector('#import-confirm');if(confirm)confirm.onclick=()=>{
      if(!pending)return;if(!importConsent){message=tr('请先勾选确认替换。','Confirm the replacement first.');refresh();return;}
      try{replaceLearningData(localStorage,snapshotValues(pending.snapshot),owner());}
      catch{message=tr('本机存储空间不足或不可写，未替换任何记录。','Local storage is full or unavailable. Nothing was replaced.');refresh();return;}
      pending=null;importConsent=false;reloadLocal();message=tr('已导入并载入备份数据；替换前的本机记录已保存为本机备份。','Backup imported and loaded. The replaced local records are kept as a backup.');refresh();
    };
    const merge=document.querySelector('#import-merge');if(merge)merge.onclick=()=>{
      if(!pending)return;if(!importConsent){message=tr('请先勾选确认。','Confirm first.');refresh();return;}
      let merged;
      try{merged=validateSnapshot(mergeSnapshots(readLocalSnapshot(localStorage),pending.snapshot).snapshot,validateProfile);}
      catch(error){message=error.code==='too-large'?importError('too-large'):tr('合并结果未通过校验，未做任何更改。可改用替换。','The merged result failed validation. Nothing was changed. Try replacing instead.');refresh();return;}
      // Merged data keeps the current account link: the user confirmed the file's records are theirs.
      try{replaceLearningData(localStorage,snapshotValues(merged),readOwner(localStorage));}
      catch{message=tr('本机存储空间不足或不可写，未做任何更改。','Local storage is full or unavailable. Nothing was changed.');refresh();return;}
      pending=null;importConsent=false;reloadLocal();message=tr('已合并并载入；合并前的本机记录已保存为本机备份。','Merged and loaded. The previous local records are kept as a backup.');refresh();
    };
    const undo=document.querySelector('#import-undo');if(undo)undo.onclick=()=>{
      try{undoLastRestore(localStorage,new Date(),owner());}catch{message=tr('撤销未完成，本机记录未改变。','Undo incomplete. Local records were not changed.');refresh();return;}
      pending=null;importConsent=false;reloadLocal();message=tr('已换回本机备份；被换下的记录也保留为备份，可再次撤销。','Local backup swapped in. The replaced records are kept as a backup and can be swapped back.');refresh();
    };
  }
  return {view,bind,openingPopup};
}
