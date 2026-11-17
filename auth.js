// Shared account session for the whole app: project configuration, sign-in, registration and admin calls.
// Sign-in is required, so the session is kept on this device (as the Supabase SDK does) and refreshed
// before it expires. Model API keys never go here.
export const SESSION_KEY='knowledge-review.session.v1';
export const DEVICE_CONFIG_KEY='knowledge-review.cloud.v1';
export const AGE_POLICY_VERSION='2026-11';
export const REGIONS=['CN','HK','MO','TW','SG','MY','US','GB','CA','AU','JP','KR','OTHER'];
// Server error messages the client may show (translated); anything else stays generic.
const KNOWN_ERRORS=['username_taken','already_registered','denied','invalid_registration','not_admin','not_eligible','rate_limited','invalid_square','not_found','friend_self'];
// Auth service error codes (error_code) that the sign-in page explains; the provider's own message is never shown.
const AUTH_ERROR_CODES=['sms_send_failed','email_send_failed'];

export const validUsername=value=>typeof value==='string'&&/^[^\s\p{C}@<>"'`/\\]{2,20}$/u.test(value);
export const validEmail=value=>typeof value==='string'&&value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export const validPhone=value=>typeof value==='string'&&/^\+[1-9]\d{6,14}$/.test(value);
export function validBirthdate(value,today=new Date()){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const [y,m,d]=value.split('-').map(Number),date=new Date(y,m-1,d);
  return y>=1900&&date.getFullYear()===y&&date.getMonth()===m-1&&date.getDate()===d&&date<=today;
}
// Returns {field: code}; empty when the form can be submitted. The verification method's field is required.
export function registrationErrors({username,email,phone,region,birthdate,method},today=new Date()){
  const errors={};
  if(!validUsername(username))errors.username='username';
  if(!['email','phone'].includes(method))errors.method='method';
  if(method==='email'||email)if(!validEmail(email))errors.email='email';
  if(method==='phone'||phone)if(!validPhone(phone))errors.phone='phone';
  if(!REGIONS.includes(region))errors.region='region';
  if(!validBirthdate(birthdate,today))errors.birthdate='birthdate';
  return errors;
}
// Device-entered projects must be hosted Supabase with a public key; the local test server may serve a loopback URL.
export function validConfig(config,{fromServer=false}={}){
  if(!config||typeof config.url!=='string'||typeof config.publicKey!=='string')return false;
  const hosted=/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.url),loopback=fromServer&&/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/[a-z-]+$/.test(config.url);
  if(!hosted&&!loopback)return false;
  if(config.publicKey.length<=10||config.publicKey.startsWith('sb_secret_'))return false;
  if(config.publicKey.startsWith('eyJ')){try{const part=config.publicKey.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');if(JSON.parse(atob(part)).role!=='anon')return false;}catch{return false;}}
  return true;
}
const encode=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
function readSession(storage){
  try{const value=JSON.parse(storage.getItem(SESSION_KEY));return value?.access_token&&value.refresh_token&&value.user?.id?value:null;}catch{return null;}
}
function toSession(data){
  const expiresAt=Number.isFinite(data?.expires_at)?data.expires_at*1000:Date.now()+(Number(data?.expires_in)||3600)*1000;
  if(!data?.access_token||!data.refresh_token||!data.user?.id)throw Object.assign(new Error('session'),{code:'session'});
  const user=data.user;
  return {access_token:data.access_token,refresh_token:data.refresh_token,expires_at:expiresAt,user:{id:user.id,email:user.email||'',phone:user.phone||'',created_at:user.created_at||''}};
}

export function createAuth({fetchImpl=(...args)=>fetch(...args),storage=localStorage,session:sessionStore=sessionStorage,location:loc=location,history:hist=history}={}){
  // adminLogin: {username, email} from the server, so the administrator signs in with a username and password.
  // The password itself is set on the account service, never in this code.
  // freeModel: the server offers 知回's free allowance (it holds the model key; signed-in users get the daily quota).
  // oauthProviders: the Google/Apple sign-ins the account service has switched on; buttons for others stay hidden.
  let config=null,source='',adminLogin=null,googleClientId='',freeModel=false,oauthProviders=[],session=readSession(storage);
  const save=value=>{session=value;try{if(value)storage.setItem(SESSION_KEY,JSON.stringify(value));else storage.removeItem(SESSION_KEY);}catch{/* Session then lasts for this page only. */}};
  async function request(path,{method='GET',body,headers={},auth=true}={}){
    if(!config)throw Object.assign(new Error('config'),{code:'config'});
    const response=await fetchImpl(config.url+path,{method,headers:{apikey:config.publicKey,Authorization:`Bearer ${auth&&session?session.access_token:config.publicKey}`,'Content-Type':'application/json',...headers},...(body!==undefined?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});
    const raw=await response.text();let data=null;try{data=raw?JSON.parse(raw):null;}catch{/* Non-JSON bodies are ignored. */}
    if(!response.ok){const known=KNOWN_ERRORS.find(code=>typeof data?.message==='string'&&data.message.includes(code))||AUTH_ERROR_CODES.find(code=>data?.error_code===code);throw Object.assign(new Error('request'),{status:response.status,code:known||`http-${response.status}`});}
    return data;
  }
  async function refresh(){
    if(!session)return false;
    try{save(toSession(await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:session.refresh_token},auth:false})));return true;}
    catch(error){if(error.status>=400&&error.status<500)save(null);return false;}
  }
  // Authenticated call with one refresh-and-retry when the access token has expired.
  async function api(path,method='GET',body,headers){
    if(session&&session.expires_at-60000<Date.now())await refresh();
    try{return await request(path,{method,body,headers});}
    catch(error){if(error.status===401&&session&&await refresh())return request(path,{method,body,headers});throw error;}
  }
  async function loadConfig(){
    try{const response=await fetchImpl('/api/public-config');const value=await response.json();freeModel=value?.freeModel===true;if(validConfig(value,{fromServer:true})){config={url:value.url,publicKey:value.publicKey};source='server';if(typeof value.adminLogin?.username==='string'&&validEmail(value.adminLogin.email))adminLogin={username:value.adminLogin.username,email:value.adminLogin.email};if(typeof value.googleClientId==='string'&&/^[\w.-]+\.apps\.googleusercontent\.com$/.test(value.googleClientId))googleClientId=value.googleClientId;return;}}catch{/* Fall back to a device-entered project. */}
    try{const value=JSON.parse(storage.getItem(DEVICE_CONFIG_KEY));if(validConfig(value)){config={url:value.url,publicKey:value.publicKey};source='device';}}catch{/* Not configured. */}
  }
  async function handleCallback(){
    const url=new URL(loc.href),code=url.searchParams.get('code');if(!code)return;
    try{const pending=JSON.parse(sessionStore.getItem('knowledge-review.pkce'));if(pending?.url===config?.url)save(toSession(await request('/auth/v1/token?grant_type=pkce',{method:'POST',body:{auth_code:code,code_verifier:pending.verifier},auth:false})));}
    catch{/* The sign-in screen shows; the user can retry. */}
    finally{sessionStore.removeItem('knowledge-review.pkce');hist.replaceState(null,'','/');}
  }
  return {
    get config(){return config;},get source(){return source;},get session(){return session;},
    get user(){return session?.user||null;},get googleClientId(){return googleClientId;},get freeModel(){return freeModel;},get oauthProviders(){return oauthProviders;},
    // Access token for the free allowance, refreshed first when it is about to expire; '' when not signed in.
    accessToken:async()=>{if(!session||!config)return '';const exp=Number(session.expires_at)||0,ms=exp<1e12?exp*1000:exp;if(ms&&ms<Date.now()+60000){try{await refresh();}catch{/* Server will ask to sign in again. */}}return session?.access_token||'';},adminEmail:username=>adminLogin&&typeof username==='string'&&username.trim().toLowerCase()===adminLogin.username.toLowerCase()?adminLogin.email:null,
    async init(){await loadConfig();if(!config)return;
      // The public settings say which providers are enabled; if they cannot be read, no provider button is shown.
      try{const external=(await request('/auth/v1/settings',{auth:false}))?.external||{};oauthProviders=['google','apple'].filter(name=>external[name]===true);}catch{oauthProviders=[];}
      await handleCallback();if(session&&session.expires_at-60000<Date.now())await refresh();},
    saveDeviceConfig(value){if(!validConfig(value))return false;storage.setItem(DEVICE_CONFIG_KEY,JSON.stringify({url:value.url,publicKey:value.publicKey}));config={...value};source='device';save(null);return true;},
    api,
    sendCode:({method,identifier,create})=>request('/auth/v1/otp',{method:'POST',body:{[method]:identifier,create_user:Boolean(create)},auth:false}),
    async verify({method,identifier,token}){save(toSession(await request('/auth/v1/verify',{method:'POST',body:{[method]:identifier,token,type:method==='email'?'email':'sms'},auth:false})));return session;},
    // Administrators sign in with the password the operator set; no code or registration form.
    async signInWithPassword({email,password}){save(toSession(await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password},auth:false})));return session;},
    async startOAuth(provider){
      const verifier=encode(crypto.getRandomValues(new Uint8Array(48))),challenge=encode(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
      sessionStore.setItem('knowledge-review.pkce',JSON.stringify({verifier,url:config.url,provider}));
      loc.assign(`${config.url}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(loc.origin+'/')}&code_challenge=${challenge}&code_challenge_method=s256`);
    },
    // {status: missing|adult|denied, registered, username, region, is_admin}
    account:()=>api('/rest/v1/rpc/my_account','POST',{}),
    register:({username,email,phone,region,birthdate})=>api('/rest/v1/rpc/complete_registration','POST',{username,email:email||null,phone:phone||null,region,birthdate,policy_version:AGE_POLICY_VERSION}),
    adminUsers:(search='')=>api('/rest/v1/rpc/admin_list_users','POST',{search,max_rows:500}),
    deleteAccount:()=>api('/rest/v1/rpc/delete_own_account','POST',{}),
    // Learning square (cloud-schema.sql square_*): reading works without signing in; the server checks every write.
    square:{
      feed:(beforeAt=null)=>api('/rest/v1/rpc/square_feed','POST',{before_at:beforeAt,max_rows:20}),
      comments:post=>api('/rest/v1/rpc/square_comments','POST',{post}),
      post:({body,lang,module=null})=>api('/rest/v1/rpc/square_post','POST',{body,lang,module}),
      comment:({post,body,lang})=>api('/rest/v1/rpc/square_comment','POST',{post,body,lang}),
      like:(post,liked)=>api('/rest/v1/rpc/square_like','POST',{post,liked}),
      remove:(kind,target)=>api('/rest/v1/rpc/square_delete','POST',{kind,target}),
      report:(kind,target,reason='')=>api('/rest/v1/rpc/square_report','POST',{kind,target,reason}),
      adminReports:()=>api('/rest/v1/rpc/admin_square_reports','POST',{}),
      moderate:(kind,target,action)=>api('/rest/v1/rpc/admin_square_moderate','POST',{kind,target,action}),
    },
    // Friends (cloud-schema.sql friend_*): codes, requests and friendships; signed-in, registered accounts only.
    friends:{
      overview:()=>api('/rest/v1/rpc/friend_overview','POST',{}),
      lookup:code=>api('/rest/v1/rpc/friend_lookup','POST',{friend_code:code}),
      request:code=>api('/rest/v1/rpc/friend_request','POST',{friend_code:code}),
      respond:(code,accept)=>api('/rest/v1/rpc/friend_respond','POST',{friend_code:code,accept}),
      remove:code=>api('/rest/v1/rpc/friend_remove','POST',{friend_code:code}),
      resetCode:()=>api('/rest/v1/rpc/friend_reset_code','POST',{}),
    },
    async signOut(){try{if(session)await request('/auth/v1/logout',{method:'POST'});}catch{/* Local sign-out still proceeds. */}finally{save(null);}},
  };
}
