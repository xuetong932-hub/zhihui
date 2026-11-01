import {CHAT_KEY} from './chat-store.js';
import {KNOWLEDGE_KEY} from './knowledge-store.js';
import {REVIEW_KEY} from './review-store.js';
import {PROFILE_KEY,OWNER_KEY,readOwner,sameOwner,bindOwner,maskIdentity,ownership,checkUpload,readBackups,MAX_BACKUPS,replaceLearningData,undoLastRestore,validateSnapshot,snapshotValues,LAST_LOGIN_KEY,LOGIN_METHODS,likelyDuplicate} from './local-space.js';
// Version of the age policy the user accepted; stored server-side with the eligibility decision.
const AGE_POLICY_VERSION='2026-11';
const CLOUD_KEY='knowledge-review.cloud.v1';
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
export function createCloudUI({locale,profile,validateProfile,getModelKey,acceptModelKey,reloadLocal,refresh}){
  const tr=(zh,en)=>locale()==='zh'?zh:en;
  let config={url:'',publicKey:''},session=null,identity='',kind='email',otp='',secret='',includeKey=false,restoreConsent=false,claimConsent=false,deleteConsent=false,message='',busy=false;
  const account=()=>session?.user?.id?{url:config.url,userId:session.user.id,label:maskIdentity(session.user.email||session.user.phone)}:null;
  // Server-side age gate: missing | adult | denied | unavailable (functions not deployed or unreachable).
  // The birth date lives only in this variable until submitted, and is cleared afterwards.
  let eligibility=null,birth='',duplicateOf=null,lastLogin='';
  try{const value=localStorage.getItem(LAST_LOGIN_KEY);if(LOGIN_METHODS.includes(value))lastLogin=value;}catch{}
  if(['email','phone'].includes(lastLogin))kind=lastLogin;
  const methodName=method=>({email:tr('邮箱验证码','email code'),phone:tr('手机号验证码','phone code'),google:'Google',apple:'Apple'})[method]||'';
  function resetAccountState(){eligibility=null;birth='';duplicateOf=null;revision=null;claimConsent=false;}
  async function checkEligibility(){
    try{const status=await api('/rest/v1/rpc/account_status','POST',{});eligibility=['missing','adult','denied'].includes(status)?status:'unavailable';}
    catch{eligibility='unavailable';}
  }
  async function afterSignIn(method){
    resetAccountState();
    try{localStorage.setItem(LAST_LOGIN_KEY,method);lastLogin=method;}catch{/* Only a convenience hint. */}
    const owner=readOwner(localStorage);
    if(likelyDuplicate(owner,account(),session.user?.created_at))duplicateOf=owner.label||tr('另一个账号','another account');
    await checkEligibility();
  }
  function requireAdult(){
    if(eligibility==='adult')return;
    throw new Error(eligibility==='missing'?tr('请先在上方完成成年确认。','Complete the age confirmation above first.'):eligibility==='denied'?tr('此云账号未通过成年确认，不能使用云端同步。','This cloud account did not pass age confirmation and cannot use cloud sync.'):tr('无法确认成年准入状态，暂不能同步。请检查云项目是否已运行 cloud-schema.sql 中的准入函数。','Age eligibility could not be checked, so sync is unavailable. Check that the eligibility functions in cloud-schema.sql are installed.'));
  }
  function ageView(esc){
    if(!session)return '';
    const notice=eligibility==='adult'?`<p class="verified">✓ ${tr('已在服务端完成成年确认','Age confirmed on the server')}</p>`
      :eligibility==='missing'?`<div class="sharing-notice"><p>${tr('云端账号需要在服务端完成一次成年确认，之后才能同步。生日只用于这一次计算，不会保存；结果为未满 18 岁的账号不能使用云端功能，也不能重新提交。生日由你自行填写，不是身份验证。','Cloud accounts need a one-time age confirmation on the server before syncing. Your birth date is used for this calculation only and is not stored. Accounts under 18 cannot use cloud features and cannot resubmit. The date is self-reported, not identity verification.')}</p><label>${tr('出生日期','Date of birth')}<input id="cloud-birthdate" type="date" min="1900-01-01" value="${esc(birth)}"></label><button id="cloud-attest" class="primary-button">${tr('提交成年确认','Submit age confirmation')}</button></div>`
      :eligibility==='denied'?`<p class="error">${tr('此云账号未通过成年确认（仅限年满 18 岁），不能使用云端同步。你可以退出，或在下方注销该云账号。','This cloud account did not pass age confirmation (18+ only) and cannot use cloud sync. You can sign out or delete this cloud account below.')}</p>`
      :eligibility==='unavailable'?`<p class="error">${tr('无法查询成年准入状态：云项目可能尚未运行 cloud-schema.sql 中的准入函数，或网络异常。暂不能同步。','Age eligibility could not be checked: the project may be missing the functions from cloud-schema.sql, or the network failed. Sync is unavailable.')}</p><button id="cloud-recheck" class="secondary-button">${tr('重新检查','Check again')}</button>`:'';
    const duplicate=duplicateOf?`<div class="sharing-notice"><p>${tr(`这台设备上的学习记录属于另一个账号（${esc(duplicateOf)}），而当前账号是刚刚新建的。你可能用了不同的登录方式。`,`This device’s records belong to another account (${esc(duplicateOf)}), and this account was just created. You may have used a different sign-in method.`)}</p><div class="followups"><button id="cloud-dup-switch" class="primary-button">${tr('退出，改用原账号登录','Sign out and use the original account')}</button><button id="cloud-dup-keep" class="text-button">${tr('继续使用新账号','Keep using the new account')}</button></div><p class="field-hint">${tr('把新的登录方式绑定到原账号，需要连接真实云项目后实现。','Linking this sign-in method to the original account requires a configured cloud project and is not available yet.')}</p></div>`:'';
    return notice+duplicate;
  }
  function ownerText(){
    const owner=readOwner(localStorage),state=ownership(localStorage,account());
    if(state==='empty')return tr('本机暂无学习记录。','No learning records on this device yet.');
    if(!owner)return tr('本机学习记录尚未关联云账号。','Local learning records are not linked to a cloud account.');
    const name=owner.label||tr('其他账号','another account');
    return state==='mine'?tr(`本机学习记录属于当前账号（${name}）。`,`Local records belong to this account (${name}).`):tr(`本机学习记录属于账号 ${name}${owner.url!==config.url?'（其他云项目）':''}，不会上传到其他账号。`,`Local records belong to ${name}${owner.url!==config.url?' (another cloud project)':''} and will not be uploaded to another account.`);
  }
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
  async function unlock(envelope){try{return await decryptBackup(envelope,secret);}catch{throw new Error(tr('同步口令错误或云端备份已损坏，未做任何更改。','Wrong sync passphrase or damaged cloud backup. Nothing was changed.'));}}
  async function run(action){if(busy)return;busy=true;message='';refresh();try{await action();}catch(error){message=error.message;}finally{busy=false;refresh();}}
  function packageData(){if(includeKey&&!getModelKey()?.apiKey)throw new Error(tr('请先配置模型 Key，或取消同步 Key。','Configure a model key first, or uncheck key sync.'));return {version:1,createdAt:new Date().toISOString(),profile:JSON.parse(localStorage.getItem(PROFILE_KEY)),chats:JSON.parse(localStorage.getItem(CHAT_KEY)),knowledge:JSON.parse(localStorage.getItem(KNOWLEDGE_KEY)),reviews:JSON.parse(localStorage.getItem(REVIEW_KEY)),...(includeKey?{model:getModelKey()}: {})};}
  // The optional model key is checked separately by acceptModelKey; an invalid key never blocks learning data.
  function snapshotError(error,restoring){
    const part={profile:tr('学习设置','settings'),chats:tr('问答记录','chats'),knowledge:tr('知识库','knowledge library'),reviews:tr('复习记录','review records')}[error.code];
    if(error.code==='too-large')return tr('数据超过本浏览器可保存的大小（约 500 万字符），未做任何更改。','The data exceeds what this browser can store (about 5 million characters). Nothing was changed.');
    if(restoring)return part?tr(`云端备份中的${part}未通过校验，未替换任何本机记录。`,`The cloud backup’s ${part} failed validation. No local records were replaced.`):tr('云端备份内容未通过校验，未替换任何本机记录。','The cloud backup failed validation. No local records were replaced.');
    return part?tr(`本机${part}无法通过校验，已停止上传，未发送数据。`,`Local ${part} failed validation. Upload stopped; nothing was sent.`):tr('本机数据无法通过校验，已停止上传。','Local data failed validation. Upload stopped.');
  }
  function view(){const esc=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);return `<section class="intro"><h1>${tr('账号与加密同步','Account and encrypted sync')}</h1><p>${tr('需要你自己的 Supabase 项目，先按项目内 cloud-setup.md 配置登录与数据库。未配置时不会发送数据。','Requires your Supabase project. Follow cloud-setup.md for auth and database setup. Nothing is sent before configuration.')}</p></section><section class="panel"><label>${tr('项目 URL','Project URL')}<input id="cloud-url" type="url" value="${esc(config.url)}" placeholder="https://your-project.supabase.co"></label><label>${tr('公开 Key（不能填服务端密钥）','Public key (never a server secret)')}<input id="cloud-public" type="text" value="${esc(config.publicKey)}"></label><p>${tr('公开项目配置会保存在本浏览器。登录验证码由所选云服务发送，短信可能产生服务费用。','Public configuration is stored locally. Your configured service sends login codes; SMS may cost money.')}</p><button id="cloud-config" class="secondary-button">${tr('保存项目配置','Save project configuration')}</button></section><section class="panel"><h2>${tr('登录','Sign in')}</h2><p>${session?tr('已连接账户：','Connected account: ')+esc(session.user?.email||session.user?.phone||session.user?.id):tr('尚未登录','Not signed in')}</p>${ageView(esc)}${lastLogin?`<p class="field-hint">${tr('上次在本设备使用：','Last used on this device: ')}${methodName(lastLogin)}</p>`:''}<select id="cloud-kind"><option value="email" ${kind==='email'?'selected':''}>Email</option><option value="phone" ${kind==='phone'?'selected':''}>Phone</option></select><input id="cloud-identity" type="text" value="${esc(identity)}" placeholder="${kind==='email'?'name@example.com':'+8613800000000'}"><button id="cloud-otp" class="secondary-button">${tr('发送验证码','Send code')}</button><label>${tr('验证码','Verification code')}<input id="cloud-code" type="text" inputmode="numeric" autocomplete="one-time-code" value="${esc(otp)}"></label><button id="cloud-verify" class="primary-button">${tr('验证并登录','Verify and sign in')}</button><div class="followups"><button data-oauth="google" class="secondary-button">Google</button><button data-oauth="apple" class="secondary-button">Apple</button><button id="cloud-signout" class="text-button">${tr('退出登录','Sign out')}</button></div><label class="check-row"><input id="cloud-delete-consent" type="checkbox" ${deleteConsent?'checked':''}>${tr('我确认注销将删除云端账号和加密备份，本机记录不受影响','I understand account deletion removes the cloud account and encrypted backup; local records remain')}</label><button id="cloud-delete-account" class="text-button">${tr('注销云端账号','Delete cloud account')}</button></section><section class="panel"><h2>${tr('加密同步','Encrypted sync')}</h2><label>${tr('同步口令（至少 12 字符，每台设备输入相同口令）','Sync passphrase (12+ characters; same on each device)')}<input id="cloud-passphrase" type="password" autocomplete="off"></label><p>${tr('口令仅留在本页内存。云端只保存加密内容；丢失口令无法解密。上传不会自动合并，其他设备更新后须先下载最新版本。','Passphrase stays in page memory. Only ciphertext is stored in the cloud; a lost passphrase cannot decrypt it. Updates are explicit, with revision conflict checks.')}</p><p class="verified" id="cloud-owner">${esc(ownerText())}</p><label class="check-row"><input id="cloud-include-key" type="checkbox" ${includeKey?'checked':''}>${tr('将当前模型 Key 一起加密同步','Include the current model key in encrypted sync')}</label>${session&&ownership(localStorage,account())==='unbound'?`<label class="check-row"><input id="cloud-claim-consent" type="checkbox" ${claimConsent?'checked':''}>${tr('我确认本机现有学习记录属于当前登录账号，可以上传','I confirm the existing local records belong to the signed-in account and may be uploaded')}</label>`:''}<label class="check-row"><input id="cloud-restore-consent" type="checkbox" ${restoreConsent?'checked':''}>${tr(`允许下载后替换本机学习数据；替换前的本机记录保留为本机备份（最近 ${MAX_BACKUPS} 份），可撤销`,`Allow downloaded data to replace local learning data; the replaced records are kept as a local backup (latest ${MAX_BACKUPS}) and can be undone`)}</label><div class="followups"><button id="cloud-upload" class="secondary-button">${tr('加密上传本机数据','Encrypt and upload')}</button><button id="cloud-unlock-key" class="secondary-button">${tr('仅取回模型 Key','Unlock model key only')}</button><button id="cloud-download" class="secondary-button">${tr('下载并恢复','Download and restore')}</button>${readBackups(localStorage).length?`<button id="cloud-undo-restore" class="text-button">${tr('撤销上次恢复（换回本机备份）','Undo last restore (swap in local backup)')}</button>`:''}</div></section><p role="status">${busy?tr('正在处理…','Working…'):esc(message)}</p>`;}
  function bind(){
    document.querySelectorAll('#cloud-url,#cloud-public,#cloud-identity,#cloud-code,#cloud-passphrase,#cloud-kind,#cloud-include-key,#cloud-restore-consent,#cloud-birthdate').forEach(input=>{input.oninput=()=>{
      if(input.id==='cloud-url'||input.id==='cloud-public'){session=null;resetAccountState();}
      if(input.id==='cloud-birthdate')birth=input.value;
      if(input.id==='cloud-url')config.url=input.value.trim().replace(/\/$/,'');if(input.id==='cloud-public')config.publicKey=input.value.trim();if(input.id==='cloud-identity')identity=input.value.trim();if(input.id==='cloud-code')otp=input.value.trim();if(input.id==='cloud-passphrase')secret=input.value;if(input.id==='cloud-kind')kind=input.value;if(input.id==='cloud-include-key')includeKey=input.checked;if(input.id==='cloud-restore-consent')restoreConsent=input.checked;
    };});document.querySelector('#cloud-passphrase').value=secret;
    const deleteBox=document.querySelector('#cloud-delete-consent');if(deleteBox)deleteBox.onchange=()=>{deleteConsent=deleteBox.checked;};
    const claimBox=document.querySelector('#cloud-claim-consent');if(claimBox)claimBox.onchange=()=>{claimConsent=claimBox.checked;};
    const attest=document.querySelector('#cloud-attest');if(attest)attest.onclick=()=>run(async()=>{
      try{
        if(!/^\d{4}-\d{2}-\d{2}$/.test(birth))throw new Error(tr('请输入有效的出生日期。','Enter a valid date of birth.'));
        const result=await api('/rest/v1/rpc/attest_adult','POST',{birthdate:birth,policy_version:AGE_POLICY_VERSION});
        if(result==='adult'){eligibility='adult';message=tr('成年确认已完成，可以同步。','Age confirmed. Sync is available.');}
        else if(result==='denied'){eligibility='denied';message=tr('此应用的云端功能仅供年满 18 岁的用户使用。','Cloud features are only for users aged 18 and over.');}
        else throw new Error(tr('服务端返回了无法识别的结果，请稍后重试。','The server returned an unrecognized result. Try again later.'));
      }finally{birth='';}
    });
    const recheck=document.querySelector('#cloud-recheck');if(recheck)recheck.onclick=()=>run(checkEligibility);
    const dupSwitch=document.querySelector('#cloud-dup-switch');if(dupSwitch)dupSwitch.onclick=()=>run(async()=>{const name=duplicateOf;try{await api('/auth/v1/logout','POST');}finally{session=null;secret='';resetAccountState();message=tr(`已退出。请用账号 ${name} 原来的登录方式登录。`,`Signed out. Sign in with the method you used for ${name}.`);}});
    const dupKeep=document.querySelector('#cloud-dup-keep');if(dupKeep)dupKeep.onclick=()=>{duplicateOf=null;refresh();};
    const deleteButton=document.querySelector('#cloud-delete-account');if(deleteButton)deleteButton.onclick=()=>run(async()=>{if(!session?.user?.id||!deleteConsent)throw new Error(tr('请登录并确认注销说明。','Sign in and confirm the deletion notice.'));await api('/rest/v1/rpc/delete_own_account','POST',{});
      // Local records stay; they are no longer linked to the deleted account.
      if(sameOwner(readOwner(localStorage),account()))localStorage.removeItem(OWNER_KEY);session=null;resetAccountState();secret='';deleteConsent=false;message=tr('云端账号与备份已注销；本机记录仍保留。','Cloud account and backup deleted; local records remain.');});
    document.querySelector('#cloud-config').onclick=()=>run(async()=>{if(!valid())throw new Error(tr('项目 URL 或公开 Key 无效。','Invalid project URL or public key.'));session=null;resetAccountState();localStorage.setItem(CLOUD_KEY,JSON.stringify(config));message=tr('公开配置已保存。','Public configuration saved.');});
    // No age claim is sent with sign-up: client metadata is untrusted. The server gate after sign-in decides.
    document.querySelector('#cloud-otp').onclick=()=>run(async()=>{if(!profile()?.adultVerification?.isAdult)throw new Error(tr('仅限年满 18 岁的用户使用。','Only for users aged 18 and over.'));await api('/auth/v1/otp','POST',{[kind]:identity,create_user:true});message=tr('验证码已请求，请检查邮箱或短信。','Code requested. Check your email or SMS.');});
    document.querySelector('#cloud-verify').onclick=()=>run(async()=>{session=await api('/auth/v1/verify','POST',{[kind]:identity,token:otp,type:kind==='email'?'email':'sms'});otp='';await afterSignIn(kind);message=tr('登录成功，尚未上传或下载。','Signed in. No data uploaded or downloaded yet.');});
    document.querySelector('#cloud-signout').onclick=()=>run(async()=>{try{if(session)await api('/auth/v1/logout','POST');}finally{session=null;secret='';resetAccountState();message=tr('本页登录已清除。','Page session cleared.');}});
    document.querySelectorAll('[data-oauth]').forEach(button=>button.onclick=()=>run(async()=>{
      if(!valid())throw new Error(tr('请先配置云服务。','Configure cloud first.'));const verifier=encode(crypto.getRandomValues(new Uint8Array(48))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)),challenge=encode(new Uint8Array(digest)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');sessionStorage.setItem('knowledge-review.pkce',JSON.stringify({verifier,url:config.url,provider:button.dataset.oauth}));localStorage.setItem(CLOUD_KEY,JSON.stringify(config));location.assign(`${config.url}/auth/v1/authorize?provider=${button.dataset.oauth}&redirect_to=${encodeURIComponent(location.origin+'/')}&code_challenge=${challenge}&code_challenge_method=s256`);
    }));
    document.querySelector('#cloud-upload').onclick=()=>run(async()=>{
      if(!session?.user?.id)throw new Error(tr('请先登录。','Sign in first.'));requireAdult();
      try{checkUpload(localStorage,account(),claimConsent);}catch(error){throw new Error(error.code==='other-account'?tr('本机学习记录属于另一个云账号，不能上传到当前账号。可下载当前账号数据，本机记录会先保存为本机备份。','Local records belong to another cloud account and cannot be uploaded here. Download this account’s data instead; local records are kept as a backup first.'):tr('请先确认本机现有学习记录属于当前账号。','Confirm that the existing local records belong to this account first.'));}
      let snapshot;try{snapshot=packageData();}catch(error){throw error instanceof SyntaxError?new Error(snapshotError({code:'format'},false)):error;}
      try{validateSnapshot(snapshot,validateProfile);}catch(error){throw new Error(snapshotError(error,false));}
      const envelope=await encryptBackup(snapshot,secret),id=session.user.id,owner=account();
      if(revision===null){const rows=await api(`/rest/v1/learning_snapshots?user_id=eq.${id}&select=revision`);if(rows.length)throw new Error(tr('云端已有版本，请先下载，避免覆盖其他设备。','A cloud version exists. Download it first.'));await api('/rest/v1/learning_snapshots','POST',{user_id:id,revision:1,envelope});revision=1;}
      else{const rows=await api(`/rest/v1/learning_snapshots?user_id=eq.${id}&revision=eq.${revision}`,'PATCH',{revision:revision+1,envelope},{Prefer:'return=representation'});if(!rows.length)throw new Error(tr('其他设备已更新，请先下载。','Another device updated this data. Download first.'));revision++;}
      try{bindOwner(localStorage,owner);claimConsent=false;message=tr('加密上传成功，本机记录已关联当前账号。','Encrypted upload complete. Local records are linked to this account.');}catch{message=tr('加密上传成功，但本机无法记录账号关联。','Encrypted upload complete, but the account link could not be saved locally.');}
    });
    document.querySelector('#cloud-unlock-key').onclick=()=>run(async()=>{
      if(!session?.user?.id)throw new Error(tr('请先登录。','Sign in first.'));requireAdult();
      const rows=await api('/rest/v1/learning_snapshots?user_id=eq.'+session.user.id+'&select=revision,envelope');
      if(!rows.length)throw new Error(tr('云端没有记录。','No cloud snapshot.'));
      const data=await unlock(rows[0].envelope);if(!data.model)throw new Error(tr('这份备份未包含模型 Key。','No model key in this backup.'));
      if(!acceptModelKey(data.model))throw new Error(tr('备份中的模型 Key 或服务商配置无效，未取回。','The model key or provider settings in this backup are invalid and were not unlocked.'));message=tr('已取回到本页内存。请在模型设置中确认服务商和发送说明后保存。','Key unlocked into page memory. Confirm provider and sharing notice in model settings.');
    });
    document.querySelector('#cloud-download').onclick=()=>run(async()=>{
      if(!session?.user?.id||!restoreConsent)throw new Error(tr('请登录并确认替换说明。','Sign in and allow local replacement.'));requireAdult();const rows=await api(`/rest/v1/learning_snapshots?user_id=eq.${session.user.id}&select=revision,envelope`);if(!rows.length)throw new Error(tr('云端没有记录。','No cloud snapshot.'));const data=await unlock(rows[0].envelope);
      try{validateSnapshot(data,validateProfile);}catch(error){throw new Error(snapshotError(error,true));}
      try{replaceLearningData(localStorage,snapshotValues(data),account());}
      catch{throw new Error(tr('本机存储空间不足或不可写，未替换任何记录。可先在设备页导出备份。','Local storage is full or unavailable. Nothing was replaced. Export a backup from Device first.'));}
      revision=rows[0].revision;restoreConsent=false;reloadLocal();
      const keyNote=!data.model?'':acceptModelKey(data.model)?tr('模型 Key 已取回到本页内存，请在模型设置中确认发送说明。','The model key is in page memory; confirm the sharing notice in model settings.'):tr('备份中的模型 Key 无效，未取回。','The model key in the backup was invalid and was not unlocked.');
      message=tr('已恢复并载入当前账号的学习记录，替换前的本机记录已保存为本机备份。','Restored and loaded this account’s records. The replaced local records are kept as a backup.')+(keyNote?' '+keyNote:'');
    });
    const undo=document.querySelector('#cloud-undo-restore');if(undo)undo.onclick=()=>run(async()=>{
      if(!restoreConsent)throw new Error(tr('请先勾选允许替换本机学习数据。','Allow replacing local learning data first.'));
      try{undoLastRestore(localStorage);}catch{throw new Error(tr('撤销未完成，本机记录未改变。','Undo incomplete. Local records were not changed.'));}
      revision=null;restoreConsent=false;reloadLocal();message=tr('已换回本机备份；被换下的记录也保留为备份，可再次撤销。','Local backup swapped in. The replaced records are kept as a backup and can be swapped back.');
    });
    document.querySelectorAll('button,input,select').forEach(element=>{if(element.closest('main'))element.disabled=busy;});
  }
  async function handleCallback(){const code=new URL(location.href).searchParams.get('code');if(!code)return;try{const pending=JSON.parse(sessionStorage.getItem('knowledge-review.pkce'));if(pending?.url!==config.url)return;session=await api('/auth/v1/token?grant_type=pkce','POST',{auth_code:code,code_verifier:pending.verifier});await afterSignIn(LOGIN_METHODS.includes(pending.provider)?pending.provider:'google');message=tr('第三方登录成功。','OAuth sign-in complete.');}catch{message=tr('第三方登录未完成，请重试。','OAuth sign-in incomplete.');}finally{sessionStorage.removeItem('knowledge-review.pkce');history.replaceState(null,'','/');queueMicrotask(refresh);}}
  void handleCallback();
  return{view,bind,get busy(){return busy;}};
}
