import {escapeHtml as esc} from './chat-store.js';
import { pick, intlLocale, currentLocale } from './i18n.js';
// Administrator page: the user list, and moderation of reported learning-square posts and comments. The server
// functions check the admin role on every call and return partially hidden email and phone; this page only
// displays what the server returns.
export function createAdminUI({locale,refresh,auth}){
  const tr = (zh, en, vars) => pick(zh, en, vars);
  let rows=null,search='',message='',busy=false,loadedAt=null;
  let reports=null,reportBusy=false,reportMessage='';
  const regionName=code=>({CN:tr('中国大陆','Chinese mainland'),HK:tr('中国香港','Hong Kong, China'),MO:tr('中国澳门','Macao, China'),TW:tr('中国台湾','Taiwan, China'),SG:tr('新加坡','Singapore'),MY:tr('马来西亚','Malaysia'),US:tr('美国','United States'),GB:tr('英国','United Kingdom'),CA:tr('加拿大','Canada'),AU:tr('澳大利亚','Australia'),JP:tr('日本','Japan'),KR:tr('韩国','South Korea'),OTHER:tr('其他','Other')})[code]||code||'';
  const reasonName=code=>({spam:tr('垃圾广告','Spam or advertising'),abuse:tr('冒犯或骚扰','Offensive or harassing'),harm:tr('不实或有害信息','False or harmful'),other:tr('其他','Other')})[code]||code;
  const time=value=>value?new Date(value).toLocaleString(intlLocale(currentLocale())):'—';
  const failText=error=>error.code==='not_admin'||error.status===403?tr('当前账号没有管理员权限。','This account is not an administrator.'):tr('加载失败，请稍后重试。','Could not load. Try again later.');
  async function load(){
    if(busy)return;busy=true;message='';refresh();
    try{const result=await auth.adminUsers(search.trim().slice(0,40));rows=Array.isArray(result)?result:[];loadedAt=new Date();}
    catch(error){rows=null;message=error.code==='not_admin'||error.status===403?tr('当前账号没有管理员权限。','This account is not an administrator.'):tr('用户列表加载失败，请稍后重试。','Could not load users. Try again later.');}
    finally{busy=false;refresh();}
  }
  async function loadReports(){
    if(reportBusy||!auth.square)return;reportBusy=true;reportMessage='';refresh();
    try{const result=await auth.square.adminReports();reports=Array.isArray(result)?result:[];}
    catch(error){reports=null;reportMessage=failText(error);}
    finally{reportBusy=false;refresh();}
  }
  async function moderate(kind,id,action){
    if(action==='delete'&&!window.confirm(tr('永久删除这条内容？','Delete this permanently?')))return;
    reportBusy=true;reportMessage='';refresh();
    try{await auth.square.moderate(kind,id,action);reportBusy=false;await loadReports();}
    catch(error){reportBusy=false;reportMessage=failText(error);refresh();}
  }
  function reportsView(){
    const item=row=>`<div class="admin-report ${row.hidden?'is-hidden':''}"><div class="square-meta"><strong>${esc(row.author_name||'')}</strong><span class="muted">${row.kind==='post'?tr('帖子','Post'):tr('评论','Comment')} · ${esc(time(row.created_at))}</span><span class="pill">${row.hidden?tr('已隐藏','Hidden'):tr('显示中','Visible')}</span><span class="pill">${tr('{n} 次举报','{n} reports',{n:Number(row.reports)||0})}</span></div>
      <p class="square-body">${esc(row.body||'')}</p>${Array.isArray(row.reasons)&&row.reasons.length?`<p class="field-hint">${tr('原因：','Reasons:')} ${row.reasons.map(reason=>esc(reasonName(reason))).join(' · ')}</p>`:''}
      <div class="actions">${row.hidden?`<button class="secondary-button" data-moderate="restore" data-kind="${esc(row.kind)}" data-id="${esc(row.id)}" ${reportBusy?'disabled':''}>${tr('恢复显示','Restore')}</button>`:`<button class="secondary-button" data-moderate="hide" data-kind="${esc(row.kind)}" data-id="${esc(row.id)}" ${reportBusy?'disabled':''}>${tr('隐藏','Hide')}</button><button class="text-button" data-moderate="restore" data-kind="${esc(row.kind)}" data-id="${esc(row.id)}" ${reportBusy?'disabled':''}>${tr('忽略举报','Dismiss reports')}</button>`}<button class="text-button danger" data-moderate="delete" data-kind="${esc(row.kind)}" data-id="${esc(row.id)}" ${reportBusy?'disabled':''}>${tr('删除','Delete')}</button></div></div>`;
    return `<section class="panel admin-square"><div class="section-heading"><h2>${tr('广场管理','Square moderation')}</h2><button class="secondary-button" id="admin-reports-refresh" ${reportBusy?'disabled':''}>${tr('刷新','Refresh')}</button></div>
      <p class="muted">${tr('被举报或已隐藏的帖子和评论。同一条被 3 人举报后会自动隐藏，等你处理。','Reported or hidden posts and comments. An item reported by 3 people is hidden automatically until you decide.')}</p>
      ${reports?.length?reports.map(item).join(''):reports?`<p>${tr('没有待处理的内容。','Nothing to review.')}</p>`:''}
      <p class="verified" role="status">${reportBusy?tr('正在加载…','Loading…'):''}</p><p class="error" role="alert">${esc(reportMessage)}</p></section>`;
  }
  function view(){
    return `<section class="intro"><span class="eyebrow">${tr('管理','Admin')}</span><h1>${tr('用户列表','Users')}</h1><p>${tr('仅管理员可见。邮箱和手机号由服务端部分隐藏；生日不会保存，因此不显示。','Visible to administrators only. Email and phone are partially hidden by the server; birthdays are not stored and are not shown.')}</p></section>
      <section class="panel"><div class="library-controls"><label>${tr('按用户名搜索','Search by username')}<input id="admin-search" type="text" maxlength="40" value="${esc(search)}"></label><button class="secondary-button" id="admin-refresh" ${busy?'disabled':''}>${tr('搜索 / 刷新','Search / refresh')}</button></div>
      <p class="muted">${rows?tr('共 {v0} 位用户（最多显示 500 位）· 更新于 {v1}', '{v0} users (up to 500 shown) · updated {v1}', { v0: rows.length, v1: time(loadedAt) }):''}</p>
      ${rows?.length?`<div class="table-wrap"><table class="admin-table"><thead><tr><th>${tr('用户名','Username')}</th><th>${tr('国家或地区','Country or region')}</th><th>${tr('邮箱','Email')}</th><th>${tr('手机号','Phone')}</th><th>${tr('注册时间','Registered')}</th><th>${tr('最近登录','Last sign-in')}</th><th>${tr('成年确认','Age check')}</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${esc(row.username||'')}</td><td>${esc(regionName(row.region))}</td><td>${esc(row.email||'—')}</td><td>${esc(row.phone||'—')}</td><td>${esc(time(row.registered_at))}</td><td>${esc(time(row.last_sign_in_at))}</td><td>${row.eligibility==='adult'?tr('已通过','Passed'):row.eligibility==='denied'?tr('未通过','Denied'):tr('未完成','Missing')}</td></tr>`).join('')}</tbody></table></div>`:rows?`<p>${tr('没有符合条件的用户。','No matching users.')}</p>`:''}
      <p class="verified" role="status">${busy?tr('正在加载…','Loading…'):''}</p><p class="error" role="alert">${esc(message)}</p></section>
      ${reportsView()}`;
  }
  function bind(){
    const input=document.querySelector('#admin-search');if(input){input.oninput=()=>{search=input.value;};input.onkeydown=event=>{if(event.key==='Enter')void load();};}
    document.querySelector('#admin-refresh').onclick=()=>load();
    const refreshReports=document.querySelector('#admin-reports-refresh');if(refreshReports)refreshReports.onclick=()=>loadReports();
    document.querySelectorAll('[data-moderate]').forEach(button=>{button.onclick=()=>moderate(button.dataset.kind,button.dataset.id,button.dataset.moderate);});
  }
  return {view,bind,open:()=>{if(!rows)void load();if(!reports)void loadReports();},get busy(){return busy||reportBusy;}};
}
