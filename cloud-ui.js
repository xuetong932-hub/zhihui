import {loadChats,CHAT_KEY} from './chat-store.js';
import {loadKnowledge,KNOWLEDGE_KEY} from './knowledge-store.js';
import {loadReviews,REVIEW_KEY} from './review-store.js';
import {validConfig} from './providers.js';
const PROFILE_KEY='knowledge-review.profile.v1',CLOUD_KEY='knowledge-review.cloud.v1';
const encode=bytes=>btoa(String.fromCharCode(...bytes));
const decode=value=>Uint8Array.from(atob(value),char=>char.charCodeAt(0));
async function derive(passphrase,salt){const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(passphrase),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:310000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
export async function encryptBackup(data,passphrase){
  if(passphrase.length<12)throw new Error('Use a passphrase of at least 12 characters');
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),key=await derive(passphrase,salt);
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(data)));
  // Chunk encoding avoids argument limits for larger learning histories.
  let binary='';const bytes=new Uint8Array(encrypted);for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return {version:1,salt:encode(salt),iv:encode(iv),ciphertext:btoa(binary)};
}
export async function decryptBackup(envelope,passphrase){
  if(envelope?.version!==1||typeof envelope.ciphertext!=='string'||envelope.ciphertext.length>14000000)throw new Error('Invalid backup');
  const salt=decode(envelope.salt),iv=decode(envelope.iv);if(salt.length!==16||iv.length!==12)throw new Error('Invalid backup');
  const key=await derive(passphrase,salt),plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv},key,decode(envelope.ciphertext));return JSON.parse(new TextDecoder().decode(plaintext));
}
export function createCloudUI({locale,profile,validateProfile,getModelKey,acceptModelKey,refresh}){
  const tr=(zh,en)=>locale()==='zh'?zh:en;
  let config={url:'',publicKey:''},session=null,identity='',kind='email',otp='',secret='',includeKey=false,restoreConsent=false,deleteConsent=false,message='',busy=false;
  let revision=null;try{const value=JSON.parse(localStorage.getItem(CLOUD_KEY));if(value?.url&&value.publicKey)config=value;}catch{}
  function valid(){
    if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.url)||config.publicKey.length<=10||config.publicKey.startsWith('sb_secret_'))return false;
    if(config.publicKey.startsWith('eyJ')){try{const part=config.publicKey.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');if(JSON.parse(atob(part)).role!=='anon')return false;}catch{return false;}}
    return true;
  }
  async function api(path,method='GET',body,extra={}){
    if(!valid())throw new Error(tr('请先填写 Supabase 项目 URL 和公开 Key。','Configure your Supabase URL and public key.'));
    const response=await fetch(config.url+path,{method,headers:{apikey:config.publicKey,Authorization:`Bearer ${session?.access_token||config.publicKey}`,'Content-Type':'application/json',...extra},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});
    if(!response.ok)throw new Error(tr(`云服务请求失败（${response.status}），请检查配置、验证码或重新登录。`,`Cloud request failed (${response.status}). Check configuration, code, or sign in again.`));
    const raw=await response.text();return raw?JSON.parse(raw):null;
  }
  async function run(action){if(busy)return;busy=true;message='';refresh();try{await action();}catch(error){message=error.message;}finally{busy=false;refresh();}}
  function packageData(){if(includeKey&&!getModelKey()?.apiKey)throw new Error(tr('请先配置模型 Key，或取消同步 Key。','Configure a model key first, or uncheck key sync.'));return {version:1,createdAt:new Date().toISOString(),profile:JSON.parse(localStorage.getItem(PROFILE_KEY)),chats:JSON.parse(localStorage.getItem(CHAT_KEY)),knowledge:JSON.parse(localStorage.getItem(KNOWLEDGE_KEY)),reviews:JSON.parse(localStorage.getItem(REVIEW_KEY)),...(includeKey?{model:getModelKey()}: {})};}
  function validate(data){
    if(data?.version!==1||!['profile','chats','knowledge','reviews'].every(key=>Object.hasOwn(data,key))||!validateProfile(data.profile))throw new Error('Invalid profile');
    if(data.chats){const loaded=loadChats({getItem:()=>JSON.stringify(data.chats)});if(loaded.issue)throw new Error('Invalid chats');}
    loadKnowledge(data.knowledge?JSON.stringify(data.knowledge):null);loadReviews(data.reviews?JSON.stringify(data.reviews):null);
    if(data.model&&(!validConfig(data.model.config)||typeof data.model.apiKey!=='string'||!/^[\x21-\x7e]{8,512}$/.test(data.model.apiKey)))throw new Error('Invalid model key in backup');
  }
  function view(){const esc=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);return `<section class="intro"><h1>${tr('账号与加密同步','Account and encrypted sync')}</h1><p>${tr('需要你自己的 Supabase 项目，先按项目内 cloud-setup.md 配置登录与数据库。未配置时不会发送数据。','Requires your Supabase project. Follow cloud-setup.md for auth and database setup. Nothing is sent before configuration.')}</p></section><section class="panel"><label>${tr('项目 URL','Project URL')}<input id="cloud-url" type="url" value="${esc(config.url)}" placeholder="https://your-project.supabase.co"></label><label>${tr('公开 Key（不能填服务端密钥）','Public key (never a server secret)')}<input id="cloud-public" type="text" value="${esc(config.publicKey)}"></label><p>${tr('公开项目配置会保存在本浏览器。登录验证码由所选云服务发送，短信可能产生服务费用。','Public configuration is stored locally. Your configured service sends login codes; SMS may cost money.')}</p><button id="cloud-config" class="secondary-button">${tr('保存项目配置','Save project configuration')}</button></section><section class="panel"><h2>${tr('登录','Sign in')}</h2><p>${session?tr('已连接账户：','Connected account: ')+esc(session.user?.email||session.user?.phone||session.user?.id):tr('尚未登录','Not signed in')}</p><select id="cloud-kind"><option value="email" ${kind==='email'?'selected':''}>Email</option><option value="phone" ${kind==='phone'?'selected':''}>Phone</option></select><input id="cloud-identity" type="text" value="${esc(identity)}" placeholder="${kind==='email'?'name@example.com':'+8613800000000'}"><button id="cloud-otp" class="secondary-button">${tr('发送验证码','Send code')}</button><label>${tr('验证码','Verification code')}<input id="cloud-code" type="text" inputmode="numeric" autocomplete="one-time-code" value="${esc(otp)}"></label><button id="cloud-verify" class="primary-button">${tr('验证并登录','Verify and sign in')}</button><div class="followups"><button data-oauth="google" class="secondary-button">Google</button><button data-oauth="apple" class="secondary-button">Apple</button><button id="cloud-signout" class="text-button">${tr('退出登录','Sign out')}</button></div><label class="check-row"><input id="cloud-delete-consent" type="checkbox" ${deleteConsent?'checked':''}>${tr('我确认注销将删除云端账号和加密备份，本机记录不受影响','I understand account deletion removes the cloud account and encrypted backup; local records remain')}</label><button id="cloud-delete-account" class="text-button">${tr('注销云端账号','Delete cloud account')}</button></section><section class="panel"><h2>${tr('加密同步','Encrypted sync')}</h2><label>${tr('同步口令（至少 12 字符，每台设备输入相同口令）','Sync passphrase (12+ characters; same on each device)')}<input id="cloud-passphrase" type="password" autocomplete="off"></label><p>${tr('口令仅留在本页内存。云端只保存加密内容；丢失口令无法解密。上传不会自动合并，其他设备更新后须先下载最新版本。','Passphrase stays in page memory. Only ciphertext is stored in the cloud; a lost passphrase cannot decrypt it. Updates are explicit, with revision conflict checks.')}</p><label class="check-row"><input id="cloud-include-key" type="checkbox" ${includeKey?'checked':''}>${tr('将当前模型 Key 一起加密同步','Include the current model key in encrypted sync')}</label><label class="check-row"><input id="cloud-restore-consent" type="checkbox" ${restoreConsent?'checked':''}>${tr('允许下载后替换本机学习数据（先保留本机备份）；替换后刷新生效','Allow downloaded data to replace local learning data (local backup kept); reload afterward')}</label><div class="followups"><button id="cloud-upload" class="secondary-button">${tr('加密上传本机数据','Encrypt and upload')}</button><button id="cloud-unlock-key" class="secondary-button">${tr('仅取回模型 Key','Unlock model key only')}</button><button id="cloud-download" class="secondary-button">${tr('下载并恢复','Download and restore')}</button></div></section><p role="status">${busy?tr('正在处理…','Working…'):esc(message)}</p>`;}
  function bind(){
    document.querySelectorAll('#cloud-url,#cloud-public,#cloud-identity,#cloud-code,#cloud-passphrase,#cloud-kind,#cloud-include-key,#cloud-restore-consent').forEach(input=>{input.oninput=()=>{
      if(input.id==='cloud-url'||input.id==='cloud-public'){session=null;revision=null;}
      if(input.id==='cloud-url')config.url=input.value.trim().replace(/\/$/,'');if(input.id==='cloud-public')config.publicKey=input.value.trim();if(input.id==='cloud-identity')identity=input.value.trim();if(input.id==='cloud-code')otp=input.value.trim();if(input.id==='cloud-passphrase')secret=input.value;if(input.id==='cloud-kind')kind=input.value;if(input.id==='cloud-include-key')includeKey=input.checked;if(input.id==='cloud-restore-consent')restoreConsent=input.checked;
    };});document.querySelector('#cloud-passphrase').value=secret;
    const deleteBox=document.querySelector('#cloud-delete-consent');if(deleteBox)deleteBox.onchange=()=>{deleteConsent=deleteBox.checked;};
    const deleteButton=document.querySelector('#cloud-delete-account');if(deleteButton)deleteButton.onclick=()=>run(async()=>{if(!session?.user?.id||!deleteConsent)throw new Error(tr('请登录并确认注销说明。','Sign in and confirm the deletion notice.'));await api('/rest/v1/rpc/delete_own_account','POST',{});session=null;secret='';revision=null;deleteConsent=false;message=tr('云端账号与备份已注销；本机记录仍保留。','Cloud account and backup deleted; local records remain.');});
    document.querySelector('#cloud-config').onclick=()=>run(async()=>{if(!valid())throw new Error('Invalid project configuration');session=null;revision=null;localStorage.setItem(CLOUD_KEY,JSON.stringify(config));message=tr('公开配置已保存。','Public configuration saved.');});
    document.querySelector('#cloud-otp').onclick=()=>run(async()=>{if(!profile()?.adultVerification?.isAdult)throw new Error('Adults only');await api('/auth/v1/otp','POST',{[kind]:identity,create_user:true,data:{adult_confirmed:true}});message=tr('验证码已请求，请检查邮箱或短信。','Code requested. Check your email or SMS.');});
    document.querySelector('#cloud-verify').onclick=()=>run(async()=>{session=await api('/auth/v1/verify','POST',{[kind]:identity,token:otp,type:kind==='email'?'email':'sms'});otp='';revision=null;message=tr('登录成功，尚未上传或下载。','Signed in. No data uploaded or downloaded yet.');});
    document.querySelector('#cloud-signout').onclick=()=>run(async()=>{try{if(session)await api('/auth/v1/logout','POST');}finally{session=null;secret='';revision=null;message=tr('本页登录已清除。','Page session cleared.');}});
    document.querySelectorAll('[data-oauth]').forEach(button=>button.onclick=()=>run(async()=>{
      if(!valid())throw new Error(tr('请先配置云服务。','Configure cloud first.'));const verifier=encode(crypto.getRandomValues(new Uint8Array(48))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)),challenge=encode(new Uint8Array(digest)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');sessionStorage.setItem('knowledge-review.pkce',JSON.stringify({verifier,url:config.url}));localStorage.setItem(CLOUD_KEY,JSON.stringify(config));location.assign(`${config.url}/auth/v1/authorize?provider=${button.dataset.oauth}&redirect_to=${encodeURIComponent(location.origin+'/')}&code_challenge=${challenge}&code_challenge_method=s256`);
    }));
    document.querySelector('#cloud-upload').onclick=()=>run(async()=>{
      if(!session?.user?.id)throw new Error(tr('请先登录。','Sign in first.'));const envelope=await encryptBackup(packageData(),secret),id=session.user.id;
      if(revision===null){const rows=await api(`/rest/v1/learning_snapshots?user_id=eq.${id}&select=revision`);if(rows.length)throw new Error(tr('云端已有版本，请先下载，避免覆盖其他设备。','A cloud version exists. Download it first.'));await api('/rest/v1/learning_snapshots','POST',{user_id:id,revision:1,envelope});revision=1;}
      else{const rows=await api(`/rest/v1/learning_snapshots?user_id=eq.${id}&revision=eq.${revision}`,'PATCH',{revision:revision+1,envelope},{Prefer:'return=representation'});if(!rows.length)throw new Error(tr('其他设备已更新，请先下载。','Another device updated this data. Download first.'));revision++;}message=tr('加密上传成功。','Encrypted upload complete.');
    });
    document.querySelector('#cloud-unlock-key').onclick=()=>run(async()=>{
      if(!session?.user?.id)throw new Error(tr('请先登录。','Sign in first.'));
      const rows=await api('/rest/v1/learning_snapshots?user_id=eq.'+session.user.id+'&select=revision,envelope');
      if(!rows.length)throw new Error(tr('云端没有记录。','No cloud snapshot.'));
      const data=await decryptBackup(rows[0].envelope,secret);if(!data.model)throw new Error(tr('这份备份未包含模型 Key。','No model key in this backup.'));
      acceptModelKey(data.model);message=tr('已取回到本页内存。请在模型设置中确认服务商和发送说明后保存。','Key unlocked into page memory. Confirm provider and sharing notice in model settings.');
    });
    document.querySelector('#cloud-download').onclick=()=>run(async()=>{
      if(!session?.user?.id||!restoreConsent)throw new Error(tr('请登录并确认替换说明。','Sign in and allow local replacement.'));const rows=await api(`/rest/v1/learning_snapshots?user_id=eq.${session.user.id}&select=revision,envelope`);if(!rows.length)throw new Error(tr('云端没有记录。','No cloud snapshot.'));const data=await decryptBackup(rows[0].envelope,secret);validate(data);
      const values={[PROFILE_KEY]:data.profile,[CHAT_KEY]:data.chats,[KNOWLEDGE_KEY]:data.knowledge,[REVIEW_KEY]:data.reviews},before=Object.fromEntries(Object.keys(values).map(key=>[key,localStorage.getItem(key)]));localStorage.setItem('knowledge-review.before-cloud-restore',JSON.stringify(before));
      try{for(const [key,value]of Object.entries(values)){if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,JSON.stringify(value));}}catch(error){for(const[key,value]of Object.entries(before)){if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}throw error;}
      revision=rows[0].revision;if(data.model)acceptModelKey(data.model);message=tr('已恢复。请刷新页面载入学习记录；模型 Key 已恢复到本页内存，刷新后需从云端重新取回。','Restored. Reload to load learning records. A restored model key is in page memory only; reloading clears it.');
    });
    document.querySelectorAll('button,input,select').forEach(element=>{if(element.closest('main'))element.disabled=busy;});
  }
  async function handleCallback(){const code=new URL(location.href).searchParams.get('code');if(!code)return;try{const pending=JSON.parse(sessionStorage.getItem('knowledge-review.pkce'));if(pending?.url!==config.url)return;session=await api('/auth/v1/token?grant_type=pkce','POST',{auth_code:code,code_verifier:pending.verifier});message=tr('第三方登录成功。','OAuth sign-in complete.');}catch{message=tr('第三方登录未完成，请重试。','OAuth sign-in incomplete.');}finally{sessionStorage.removeItem('knowledge-review.pkce');history.replaceState(null,'','/');}}
  void handleCallback();
  return{view,bind,get busy(){return busy;}};
}
