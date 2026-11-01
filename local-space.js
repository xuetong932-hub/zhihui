import {CHAT_KEY,loadChats} from './chat-store.js';
import {KNOWLEDGE_KEY,loadKnowledge} from './knowledge-store.js';
import {REVIEW_KEY,loadReviews} from './review-store.js';
// Local learning data belongs to at most one cloud account. Uploads and restores check this
// binding so one person's records are never sent to another account or silently overwritten.
export const PROFILE_KEY='knowledge-review.profile.v1';
export const OWNER_KEY='knowledge-review.local-owner.v1';
export const BACKUP_KEY='knowledge-review.before-cloud-restore';
export const LEARNING_KEYS=[PROFILE_KEY,CHAT_KEY,KNOWLEDGE_KEY,REVIEW_KEY];
export const MAX_BACKUPS=3;
// Browsers typically allow about 5 million characters per origin; larger snapshots cannot be stored anyway.
export const MAX_SNAPSHOT_CHARS=5000000;
const fail=code=>Object.assign(new Error(code),{code});
// One schema check for every whole-snapshot entry point (cloud upload/restore, future file import).
// Each store uses the same loader that reads it at startup, so accepted data always opens.
export function validateSnapshot(data,validateProfile){
  if(data?.version!==1||!['profile','chats','knowledge','reviews'].every(key=>Object.hasOwn(data,key)))throw fail('format');
  if(JSON.stringify(data).length>MAX_SNAPSHOT_CHARS)throw fail('too-large');
  if(!validateProfile(data.profile))throw fail('profile');
  if(data.chats!==null&&loadChats({getItem:()=>JSON.stringify(data.chats)}).issue)throw fail('chats');
  try{if(data.knowledge!==null)loadKnowledge(JSON.stringify(data.knowledge));}catch{throw fail('knowledge');}
  try{if(data.reviews!==null)loadReviews(JSON.stringify(data.reviews));}catch{throw fail('reviews');}
  return data;
}
export function readOwner(storage){
  try{const value=JSON.parse(storage.getItem(OWNER_KEY));return value?.version===1&&typeof value.url==='string'&&typeof value.userId==='string'&&value.userId?value:null;}catch{return null;}
}
export const sameOwner=(owner,account)=>Boolean(owner&&account&&owner.url===account.url&&owner.userId===account.userId);
export function bindOwner(storage,account){storage.setItem(OWNER_KEY,JSON.stringify({version:1,url:account.url,userId:account.userId,label:account.label||'',boundAt:new Date().toISOString()}));}
export function maskIdentity(value){
  const text=String(value||'');
  if(text.includes('@')){const [name,domain]=text.split('@');return `${name.slice(0,2)}***@${domain}`;}
  return text.length>7?`${text.slice(0,3)}***${text.slice(-4)}`:text?'***':'';
}
export function hasLearningData(storage){
  const read=key=>{const raw=storage.getItem(key);if(!raw)return null;try{return JSON.parse(raw);}catch{return undefined;}};
  const chats=read(CHAT_KEY),knowledge=read(KNOWLEDGE_KEY),reviews=read(REVIEW_KEY);
  // Unreadable records still belong to someone, so they count as data.
  if([chats,knowledge,reviews].includes(undefined))return true;
  const threads=Object.values(chats?.modules&&typeof chats.modules==='object'?chats.modules:{}).flat();
  return threads.some(thread=>thread?.messages?.length)||Boolean(knowledge?.cards?.length)||Boolean(reviews?.events?.length);
}
// empty: nothing to protect; mine: bound to this account; unbound: data never linked; other: another account's data.
export function ownership(storage,account){
  if(!hasLearningData(storage))return 'empty';
  const owner=readOwner(storage);
  return owner?(sameOwner(owner,account)?'mine':'other'):'unbound';
}
// Only the method name is remembered on this device (never the account), to suggest the usual sign-in.
export const LAST_LOGIN_KEY='knowledge-review.last-login.v1';
export const LOGIN_METHODS=['email','phone','google','apple'];
// A freshly created account on a device whose records belong to another account suggests a second sign-in method.
export const NEW_ACCOUNT_MS=10*60000;
export function likelyDuplicate(owner,account,createdAt,now=Date.now()){
  const created=Date.parse(createdAt);
  return Boolean(owner&&account&&!sameOwner(owner,account)&&owner.url===account.url&&Number.isFinite(created)&&now-created>=0&&now-created<NEW_ACCOUNT_MS);
}
export function checkUpload(storage,account,claimed){
  const state=ownership(storage,account);
  if(state==='other')throw fail('other-account');
  if(state==='unbound'&&!claimed)throw fail('claim-required');
  return state;
}
const capture=storage=>Object.fromEntries(LEARNING_KEYS.map(key=>[key,storage.getItem(key)]));
function write(storage,values){for(const key of LEARNING_KEYS){const value=values[key];if(value===null||value===undefined)storage.removeItem(key);else storage.setItem(key,value);}}
export function readBackups(storage){
  let value;try{value=JSON.parse(storage.getItem(BACKUP_KEY));}catch{return [];}
  const validValues=values=>values&&typeof values==='object'&&LEARNING_KEYS.every(key=>values[key]===undefined||values[key]===null||typeof values[key]==='string');
  if(value?.version===2&&Array.isArray(value.entries))return value.entries.filter(entry=>validValues(entry?.values));
  // Version 1 kept a single key → raw-string map without metadata.
  if(validValues(value)&&LEARNING_KEYS.some(key=>typeof value[key]==='string'))return [{savedAt:null,owner:null,values:value}];
  return [];
}
// Writes the backup first; if that fails nothing changes. A failed data write rolls back every key.
function swap(storage,nextValues,nextOwner,entries){
  const before=capture(storage),ownerRaw=storage.getItem(OWNER_KEY),backupRaw=storage.getItem(BACKUP_KEY);
  storage.setItem(BACKUP_KEY,JSON.stringify({version:2,entries}));
  try{write(storage,nextValues);if(nextOwner)storage.setItem(OWNER_KEY,JSON.stringify(nextOwner));else storage.removeItem(OWNER_KEY);}
  catch(error){
    write(storage,before);if(ownerRaw===null)storage.removeItem(OWNER_KEY);else storage.setItem(OWNER_KEY,ownerRaw);
    if(backupRaw===null)storage.removeItem(BACKUP_KEY);else storage.setItem(BACKUP_KEY,backupRaw);throw error;
  }
}
// A null account (file import) leaves the replaced data unlinked, so uploading it later needs a claim.
export function replaceLearningData(storage,data,account,now=new Date()){
  const values=Object.fromEntries(LEARNING_KEYS.map(key=>[key,data[key]===null||data[key]===undefined?null:JSON.stringify(data[key])]));
  const entries=readBackups(storage);
  if(hasLearningData(storage))entries.unshift({savedAt:now.toISOString(),owner:readOwner(storage),values:capture(storage)});
  swap(storage,values,account?{version:1,url:account.url,userId:account.userId,label:account.label||'',boundAt:now.toISOString()}:null,entries.slice(0,MAX_BACKUPS));
}
// Reads the Device page export: {version:1, exportedAt, data:{<storage key>: value}}.
export const MAX_IMPORT_BYTES=20000000;
export function parseExport(text){
  if(typeof text!=='string'||text.length>MAX_IMPORT_BYTES)throw fail('too-large');
  let file;try{file=JSON.parse(text);}catch{throw fail('format');}
  if(file?.version!==1||!file.data||typeof file.data!=='object'||!LEARNING_KEYS.every(key=>Object.hasOwn(file.data,key)))throw fail('format');
  const value=key=>file.data[key]??null;
  return {version:1,exportedAt:Number.isFinite(Date.parse(file.exportedAt))?file.exportedAt:null,profile:value(PROFILE_KEY),chats:value(CHAT_KEY),knowledge:value(KNOWLEDGE_KEY),reviews:value(REVIEW_KEY)};
}
// Current local stores as a snapshot; unreadable JSON throws rather than being treated as empty.
export function readLocalSnapshot(storage){
  const read=key=>{const raw=storage.getItem(key);if(!raw)return null;try{return JSON.parse(raw);}catch{throw fail('local');}};
  return {version:1,profile:read(PROFILE_KEY),chats:read(CHAT_KEY),knowledge:read(KNOWLEDGE_KEY),reviews:read(REVIEW_KEY)};
}
export function snapshotValues(snapshot){return {[PROFILE_KEY]:snapshot.profile,[CHAT_KEY]:snapshot.chats,[KNOWLEDGE_KEY]:snapshot.knowledge,[REVIEW_KEY]:snapshot.reviews};}
export function summarizeSnapshot(snapshot){
  const threads=Object.values(snapshot.chats?.modules||{}).flat();
  return {threads:threads.length,messages:threads.reduce((sum,thread)=>sum+thread.messages.filter(message=>message.status==='done').length,0),
    cards:(snapshot.knowledge?.cards||[]).filter(card=>['active','paused'].includes(card.status)).length,reviews:snapshot.reviews?.events?.length||0};
}
// Undo swaps the newest backup with current data, so undoing again returns to the restored copy.
export function undoLastRestore(storage,now=new Date()){
  const [latest,...rest]=readBackups(storage);if(!latest)throw fail('no-backup');
  swap(storage,latest.values,latest.owner,[{savedAt:now.toISOString(),owner:readOwner(storage),values:capture(storage)},...rest]);
  return latest;
}
