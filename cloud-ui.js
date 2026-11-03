import {CHAT_KEY} from './chat-store.js';
import {KNOWLEDGE_KEY} from './knowledge-store.js';
import {REVIEW_KEY} from './review-store.js';
import {PROFILE_KEY,OWNER_KEY,readOwner,sameOwner,bindOwner,ownership,checkUpload,canUndo,MAX_BACKUPS,replaceLearningData,undoLastRestore,validateSnapshot,snapshotValues} from './local-space.js';
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
// Account page: the signed-in account (from the sign-in gate), encrypted sync, sign-out and deletion.
// Sign-in and the age check happen before the app opens, so every action here has an adult account.
export function createCloudUI({locale,validateProfile,getModelKey,acceptModelKey,reloadLocal,refresh,auth,getAccount,owner,signOut}){
  const tr=(zh,en)=>locale()==='zh'?zh:en;
  let secret='',includeKey=false,restoreConsent=false,claimConsent=false,deleteConsent=false,message='',busy=false,revision=null;
  function ownerText(){
    const current=readOwner(localStorage),state=ownership(localStorage,owner());
    if(state==='empty')return tr('本机暂无学习记录。','No learning records on this device yet.');
    if(!current)return tr('本机学习记录尚未关联云账号。','Local learning records are not linked to a cloud account.');
    const name=current.label||tr('其他账号','another account');
    return state==='mine'?tr(`本机学习记录属于当前账号（${name}）。`,`Local records belong to this account (${name}).`):tr(`本机学习记录属于账号 ${name}，不会上传到其他账号。`,`Local records belong to ${name} and will not be uploaded to another account.`);
  }
  const api=(path,method='GET',body,extra)=>auth.api(path,method,body,extra).catch(error=>{throw new Error(error.status===401?tr('登录已过期，请退出后重新登录。','Your sign-in expired. Sign out and sign in again.'):tr(`云服务请求失败（${error.status||'网络'}），请稍后重试。`,`Cloud request failed (${error.status||'network'}). Try again later.`));});
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
  const regionName=code=>({CN:tr('中国大陆','Chinese mainland'),HK:tr('中国香港','Hong Kong, China'),MO:tr('中国澳门','Macao, China'),TW:tr('中国台湾','Taiwan, China'),SG:tr('新加坡','Singapore'),MY:tr('马来西亚','Malaysia'),US:tr('美国','United States'),GB:tr('英国','United Kingdom'),CA:tr('加拿大','Canada'),AU:tr('澳大利亚','Australia'),JP:tr('日本','Japan'),KR:tr('韩国','South Korea'),OTHER:tr('其他','Other')})[code]||code||'';
  function view(){
    const esc=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
    const acct=getAccount()||{},user=auth.user||{};
    return `<section class="intro"><h1>${tr('账号与加密同步','Account and encrypted sync')}</h1><p>${tr('学习记录保存在本机；需要时可加密上传到你的账号，在其他设备下载恢复。','Learning records stay on this device; you can encrypt and upload them to your account and restore them on other devices.')}</p></section>
      <section class="panel"><h2>${tr('当前账号','Signed-in account')}</h2><p><strong>${esc(acct.username||(acct.is_admin?tr('管理员','Administrator'):''))}</strong>${acct.region?` · ${esc(regionName(acct.region))}`:''}</p><p>${esc(user.email||'')}${user.email&&user.phone?' · ':''}${esc(user.phone||'')}</p><p class="verified">${acct.status==='adult'?`✓ ${tr('已在服务端完成成年确认','Age confirmed on the server')}${acct.is_admin?` · ${tr('管理员','Administrator')}`:''}`:acct.is_admin?tr('管理员账号（由运营者创建，无需注册信息）','Administrator account (created by the operator; no registration details)'):''}</p>
        <div class="followups"><button id="cloud-signout" class="secondary-button">${tr('退出登录','Sign out')}</button></div>
        <label class="check-row"><input id="cloud-delete-consent" type="checkbox" ${deleteConsent?'checked':''}>${tr('我确认注销将删除云端账号、注册信息和加密备份，本机记录不受影响','I understand deletion removes the cloud account, registration details and encrypted backup; local records remain')}</label><button id="cloud-delete-account" class="text-button">${tr('注销云端账号','Delete cloud account')}</button></section>
      ${!globalThis.crypto?.subtle?`<section class="panel"><h2>${tr('加密同步','Encrypted sync')}</h2><p>${tr('加密同步需要 HTTPS 网址。现在是局域网地址（http），浏览器不提供加密功能，所以这里暂不可用。请在电脑上打开 http://localhost:4174 同步，学习记录不会受影响。','Encrypted sync needs an HTTPS address. On this home-network (http) address the browser offers no encryption, so sync is unavailable here. Sync on the computer at http://localhost:4174; your records are not affected.')}</p></section>`:`<section class="panel"><h2>${tr('加密同步','Encrypted sync')}</h2><label>${tr('同步口令（至少 12 字符，每台设备输入相同口令）','Sync passphrase (12+ characters; same on each device)')}<input id="cloud-passphrase" type="password" autocomplete="off"></label><p>${tr('口令仅留在本页内存。云端只保存加密内容；丢失口令无法解密。上传不会自动合并，其他设备更新后须先下载最新版本。','Passphrase stays in page memory. Only ciphertext is stored in the cloud; a lost passphrase cannot decrypt it. Updates are explicit, with revision conflict checks.')}</p><p class="verified" id="cloud-owner">${esc(ownerText())}</p><label class="check-row"><input id="cloud-include-key" type="checkbox" ${includeKey?'checked':''}>${tr('将当前模型 Key 一起加密同步','Include the current model key in encrypted sync')}</label>${ownership(localStorage,owner())==='unbound'?`<label class="check-row"><input id="cloud-claim-consent" type="checkbox" ${claimConsent?'checked':''}>${tr('我确认本机现有学习记录属于当前登录账号，可以上传','I confirm the existing local records belong to the signed-in account and may be uploaded')}</label>`:''}<label class="check-row"><input id="cloud-restore-consent" type="checkbox" ${restoreConsent?'checked':''}>${tr(`允许下载后替换本机学习数据；替换前的本机记录保留为本机备份（最近 ${MAX_BACKUPS} 份），可撤销`,`Allow downloaded data to replace local learning data; the replaced records are kept as a local backup (latest ${MAX_BACKUPS}) and can be undone`)}</label><div class="followups"><button id="cloud-upload" class="secondary-button">${tr('加密上传本机数据','Encrypt and upload')}</button><button id="cloud-unlock-key" class="secondary-button">${tr('仅取回模型 Key','Unlock model key only')}</button><button id="cloud-download" class="secondary-button">${tr('下载并恢复','Download and restore')}</button>${canUndo(localStorage,owner())?`<button id="cloud-undo-restore" class="text-button">${tr('撤销上次恢复（换回本机备份）','Undo last restore (swap in local backup)')}</button>`:''}</div></section>`}<p role="status">${busy?tr('正在处理…','Working…'):esc(message)}</p>`;
  }
  function bind(){
    const deleteBox=document.querySelector('#cloud-delete-consent');if(deleteBox)deleteBox.onchange=()=>{deleteConsent=deleteBox.checked;};
    const claimBox=document.querySelector('#cloud-claim-consent');if(claimBox)claimBox.onchange=()=>{claimConsent=claimBox.checked;};
    document.querySelector('#cloud-signout').onclick=()=>run(async()=>{secret='';await signOut();});
    document.querySelector('#cloud-delete-account').onclick=()=>run(async()=>{
      if(!deleteConsent)throw new Error(tr('请先确认注销说明。','Confirm the deletion notice first.'));
      await api('/rest/v1/rpc/delete_own_account','POST',{});
      // Local records stay; they are no longer linked to the deleted account.
      if(sameOwner(readOwner(localStorage),owner()))localStorage.removeItem(OWNER_KEY);secret='';await signOut();
    });
    // Without HTTPS the sync controls are not shown (see view).
    if(!document.querySelector('#cloud-upload')){document.querySelectorAll('button,input,select').forEach(element=>{if(element.closest('main'))element.disabled=busy;});return;}
    document.querySelectorAll('#cloud-passphrase,#cloud-include-key,#cloud-restore-consent').forEach(input=>{input.oninput=()=>{
      if(input.id==='cloud-passphrase')secret=input.value;if(input.id==='cloud-include-key')includeKey=input.checked;if(input.id==='cloud-restore-consent')restoreConsent=input.checked;
    };});document.querySelector('#cloud-passphrase').value=secret;
    document.querySelector('#cloud-upload').onclick=()=>run(async()=>{
      try{checkUpload(localStorage,owner(),claimConsent);}catch(error){throw new Error(error.code==='other-account'?tr('本机学习记录属于另一个云账号，不能上传到当前账号。可下载当前账号数据，本机记录会先保存为本机备份。','Local records belong to another cloud account and cannot be uploaded here. Download this account’s data instead; local records are kept as a backup first.'):tr('请先确认本机现有学习记录属于当前账号。','Confirm that the existing local records belong to this account first.'));}
      let snapshot;try{snapshot=packageData();}catch(error){throw error instanceof SyntaxError?new Error(snapshotError({code:'format'},false)):error;}
      try{validateSnapshot(snapshot,validateProfile);}catch(error){throw new Error(snapshotError(error,false));}
      const envelope=await encryptBackup(snapshot,secret),id=auth.user.id,account=owner();
      if(revision===null){const rows=await api(`/rest/v1/learning_snapshots?user_id=eq.${id}&select=revision`);if(rows.length)throw new Error(tr('云端已有版本，请先下载，避免覆盖其他设备。','A cloud version exists. Download it first.'));await api('/rest/v1/learning_snapshots','POST',{user_id:id,revision:1,envelope});revision=1;}
      else{const rows=await api(`/rest/v1/learning_snapshots?user_id=eq.${id}&revision=eq.${revision}`,'PATCH',{revision:revision+1,envelope},{Prefer:'return=representation'});if(!rows.length)throw new Error(tr('其他设备已更新，请先下载。','Another device updated this data. Download first.'));revision++;}
      try{bindOwner(localStorage,account);claimConsent=false;message=tr('加密上传成功，本机记录已关联当前账号。','Encrypted upload complete. Local records are linked to this account.');}catch{message=tr('加密上传成功，但本机无法记录账号关联。','Encrypted upload complete, but the account link could not be saved locally.');}
    });
    document.querySelector('#cloud-unlock-key').onclick=()=>run(async()=>{
      const rows=await api(`/rest/v1/learning_snapshots?user_id=eq.${auth.user.id}&select=revision,envelope`);
      if(!rows.length)throw new Error(tr('云端没有记录。','No cloud snapshot.'));
      const data=await unlock(rows[0].envelope);if(!data.model)throw new Error(tr('这份备份未包含模型 Key。','No model key in this backup.'));
      if(!acceptModelKey(data.model))throw new Error(tr('备份中的模型 Key 或服务商配置无效，未取回。','The model key or provider settings in this backup are invalid and were not unlocked.'));message=tr('已取回到本页内存。请在模型设置中确认服务商和发送说明后保存。','Key unlocked into page memory. Confirm provider and sharing notice in model settings.');
    });
    document.querySelector('#cloud-download').onclick=()=>run(async()=>{
      if(!restoreConsent)throw new Error(tr('请先确认替换说明。','Allow local replacement first.'));
      const rows=await api(`/rest/v1/learning_snapshots?user_id=eq.${auth.user.id}&select=revision,envelope`);if(!rows.length)throw new Error(tr('云端没有记录。','No cloud snapshot.'));const data=await unlock(rows[0].envelope);
      try{validateSnapshot(data,validateProfile);}catch(error){throw new Error(snapshotError(error,true));}
      try{replaceLearningData(localStorage,snapshotValues(data),owner());}
      catch{throw new Error(tr('本机存储空间不足或不可写，未替换任何记录。可先在设备页导出备份。','Local storage is full or unavailable. Nothing was replaced. Export a backup from Device first.'));}
      revision=rows[0].revision;restoreConsent=false;reloadLocal();
      const keyNote=!data.model?'':acceptModelKey(data.model)?tr('模型 Key 已取回到本页内存，请在模型设置中确认发送说明。','The model key is in page memory; confirm the sharing notice in model settings.'):tr('备份中的模型 Key 无效，未取回。','The model key in the backup was invalid and was not unlocked.');
      message=tr('已恢复并载入当前账号的学习记录，替换前的本机记录已保存为本机备份。','Restored and loaded this account’s records. The replaced local records are kept as a backup.')+(keyNote?' '+keyNote:'');
    });
    const undo=document.querySelector('#cloud-undo-restore');if(undo)undo.onclick=()=>run(async()=>{
      if(!restoreConsent)throw new Error(tr('请先勾选允许替换本机学习数据。','Allow replacing local learning data first.'));
      try{undoLastRestore(localStorage,new Date(),owner());}catch{throw new Error(tr('撤销未完成，本机记录未改变。','Undo incomplete. Local records were not changed.'));}
      revision=null;restoreConsent=false;reloadLocal();message=tr('已换回本机备份；被换下的记录也保留为备份，可再次撤销。','Local backup swapped in. The replaced records are kept as a backup and can be swapped back.');
    });
    document.querySelectorAll('button,input,select').forEach(element=>{if(element.closest('main'))element.disabled=busy;});
  }
  return{view,bind,get busy(){return busy;}};
}
