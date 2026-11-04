import {escapeHtml as esc} from './chat-store.js';
import { pick, intlLocale, currentLocale } from './i18n.js';
// Administrator user list. The server function checks the admin role on every call and returns
// partially hidden email and phone; this page only displays what the server returns.
export function createAdminUI({locale,refresh,auth}){
  const tr = (zh, en, vars) => pick(zh, en, vars);
  let rows=null,search='',message='',busy=false,loadedAt=null;
  const regionName=code=>({CN:tr('中国大陆','Chinese mainland'),HK:tr('中国香港','Hong Kong, China'),MO:tr('中国澳门','Macao, China'),TW:tr('中国台湾','Taiwan, China'),SG:tr('新加坡','Singapore'),MY:tr('马来西亚','Malaysia'),US:tr('美国','United States'),GB:tr('英国','United Kingdom'),CA:tr('加拿大','Canada'),AU:tr('澳大利亚','Australia'),JP:tr('日本','Japan'),KR:tr('韩国','South Korea'),OTHER:tr('其他','Other')})[code]||code||'';
  const time=value=>value?new Date(value).toLocaleString(intlLocale(currentLocale())):'—';
  async function load(){
    if(busy)return;busy=true;message='';refresh();
    try{const result=await auth.adminUsers(search.trim().slice(0,40));rows=Array.isArray(result)?result:[];loadedAt=new Date();}
    catch(error){rows=null;message=error.code==='not_admin'||error.status===403?tr('当前账号没有管理员权限。','This account is not an administrator.'):tr('用户列表加载失败，请稍后重试。','Could not load users. Try again later.');}
    finally{busy=false;refresh();}
  }
  function view(){
    return `<section class="intro"><span class="eyebrow">${tr('管理','Admin')}</span><h1>${tr('用户列表','Users')}</h1><p>${tr('仅管理员可见。邮箱和手机号由服务端部分隐藏；生日不会保存，因此不显示。','Visible to administrators only. Email and phone are partially hidden by the server; birthdays are not stored and are not shown.')}</p></section>
      <section class="panel"><div class="library-controls"><label>${tr('按用户名搜索','Search by username')}<input id="admin-search" type="text" maxlength="40" value="${esc(search)}"></label><button class="secondary-button" id="admin-refresh" ${busy?'disabled':''}>${tr('搜索 / 刷新','Search / refresh')}</button></div>
      <p class="muted">${rows?tr('共 {v0} 位用户（最多显示 500 位）· 更新于 {v1}', '{v0} users (up to 500 shown) · updated {v1}', { v0: rows.length, v1: time(loadedAt) }):''}</p>
      ${rows?.length?`<div class="table-wrap"><table class="admin-table"><thead><tr><th>${tr('用户名','Username')}</th><th>${tr('国家或地区','Country or region')}</th><th>${tr('邮箱','Email')}</th><th>${tr('手机号','Phone')}</th><th>${tr('注册时间','Registered')}</th><th>${tr('最近登录','Last sign-in')}</th><th>${tr('成年确认','Age check')}</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${esc(row.username||'')}</td><td>${esc(regionName(row.region))}</td><td>${esc(row.email||'—')}</td><td>${esc(row.phone||'—')}</td><td>${esc(time(row.registered_at))}</td><td>${esc(time(row.last_sign_in_at))}</td><td>${row.eligibility==='adult'?tr('已通过','Passed'):row.eligibility==='denied'?tr('未通过','Denied'):tr('未完成','Missing')}</td></tr>`).join('')}</tbody></table></div>`:rows?`<p>${tr('没有符合条件的用户。','No matching users.')}</p>`:''}
      <p class="verified" role="status">${busy?tr('正在加载…','Loading…'):''}</p><p class="error" role="alert">${esc(message)}</p></section>`;
  }
  function bind(){
    const input=document.querySelector('#admin-search');if(input){input.oninput=()=>{search=input.value;};input.onkeydown=event=>{if(event.key==='Enter')void load();};}
    document.querySelector('#admin-refresh').onclick=()=>load();
  }
  return {view,bind,open:()=>{if(!rows)void load();},get busy(){return busy;}};
}
