import {REGIONS,registrationErrors,validEmail,validPhone,validConfig} from './auth.js';
import {ownership,readOwner,sameOwner,PROFILE_KEY,bindOwner,setAsideLocalData,likelyDuplicate,summarizeSnapshot,readLocalSnapshot,MAX_BACKUPS,LAST_LOGIN_KEY} from './local-space.js';
import {escapeHtml as esc} from './chat-store.js';
// Sign-in gate shown before the app. Stages: loading, unconfigured, signin, signup, code, register, denied, error, local.
// Sign-up asks for username, email, phone, country or region and birthday; the birthday is sent once for the
// server's adult check and then cleared from memory.
export const LOCAL_MODE_KEY='knowledge-review.local-mode.v1';
export function createAuthGate({auth,locale,refresh,onReady}){
  const tr=(zh,en)=>locale()==='zh'?zh:en;
  let stage='loading',busy=false,message='',errors={},codeFor='signin',otp='',acct=null,deleteConsent=false;
  let devConfig={url:'',publicKey:''};
  // Admin password stays in memory only until the sign-in attempt finishes.
  const adminForm={username:'',password:''};
  // Set when sign-in finds no account for the email or phone; the page then offers registration.
  let unregistered=false;
  const form={method:'email',identifier:'',username:'',email:'',phone:'',region:'',birthdate:''};
  // Only the method name is remembered on this device, to preselect it next time.
  try{const last=localStorage.getItem(LAST_LOGIN_KEY);if(['email','phone'].includes(last))form.method=last;}catch{/* Default to email. */}
  const regionName=code=>({CN:tr('中国大陆','Chinese mainland'),HK:tr('中国香港','Hong Kong, China'),MO:tr('中国澳门','Macao, China'),TW:tr('中国台湾','Taiwan, China'),SG:tr('新加坡','Singapore'),MY:tr('马来西亚','Malaysia'),US:tr('美国','United States'),GB:tr('英国','United Kingdom'),CA:tr('加拿大','Canada'),AU:tr('澳大利亚','Australia'),JP:tr('日本','Japan'),KR:tr('韩国','South Korea'),OTHER:tr('其他','Other')})[code];
  const account=()=>auth.user&&auth.config?{url:auth.config.url,userId:auth.user.id,label:acct?.username||(acct?.is_admin?tr('管理员','Administrator'):'')}:null;
  const fieldError=key=>({username:tr('用户名为 2–20 个字符，不能包含空格或 @ < > " \' / \\ 等符号。','Username: 2–20 characters, no spaces or @ < > " \' / \\.'),email:tr('请输入有效的邮箱。','Enter a valid email.'),phone:tr('请输入带国家区号的手机号，例如 +8613800000000。','Enter a phone number with country code, e.g. +8613800000000.'),region:tr('请选择国家或地区。','Choose a country or region.'),birthdate:tr('请输入有效的生日。','Enter a valid birthday.'),identifier:tr('请输入有效的邮箱或手机号。','Enter a valid email or phone number.')})[errors[key]?key:'']||'';
  const errorText=error=>({username_taken:tr('该用户名已被使用，请换一个。','This username is taken. Choose another.'),already_registered:tr('此账号已完成注册。','This account is already registered.'),invalid_registration:tr('注册信息未通过服务端校验，请检查后重试。','The server rejected the registration details. Check and try again.'),config:tr('服务尚未配置。','The service is not configured.'),sms_send_failed:tr('短信发送失败：该号码可能不在测试名单内，或短信服务暂时不可用。可以改用邮箱登录。','The text message could not be sent: this number may not be on the test list, or the SMS service is unavailable. You can sign in with email instead.'),email_send_failed:tr('验证码邮件发送失败，请稍后重试，或改用手机号登录。','The code email could not be sent. Try again later, or sign in with your phone number.')})[error?.code]||(error?.status===429?tr('操作过于频繁，请稍后再试。','Too many attempts. Try again later.'):tr('请求未完成，请检查网络后重试。','Request incomplete. Check your network and try again.'));
  async function run(action){if(busy)return;busy=true;message='';refresh();try{await action();}catch(error){message=errorText(error);}finally{busy=false;refresh();}}
  function go(next){stage=next;errors={};message='';refresh();}

  async function check(){
    try{acct=await auth.account();}
    catch(error){if(!auth.session){go('signin');return;}stage='error';message=errorText(error);return;}
    if(acct?.status==='denied'){stage='denied';return;}
    // Administrators are created by the operator and skip the registration form.
    if(!acct?.is_admin&&(!acct?.registered||acct.status!=='adult')){prefill();stage='register';return;}
    const state=ownership(localStorage,account()),previous=readOwner(localStorage);
    if(state==='unbound'||state==='other'){stage='local';return;}
    // No records, but the learning settings belong to another account: start this account from its own setup.
    if(state==='empty'&&previous&&!sameOwner(previous,account())){try{localStorage.removeItem(PROFILE_KEY);}catch{/* Settings only. */}}
    // Records created from now on belong to this account (also refreshes the stored username label).
    try{bindOwner(localStorage,account());}catch{/* Storage full: ownership is checked again next time. */}
    stage='ready';onReady(acct,account());
  }
  function prefill(){const user=auth.user;if(user?.email&&!form.email)form.email=user.email;if(user?.phone&&!form.phone)form.phone=user.phone.startsWith('+')?user.phone:`+${user.phone}`;form.method=user?.phone&&!user?.email?'phone':'email';}
  async function register(){
    const found=registrationErrors(form);
    if(Object.keys(found).length){errors=found;return;}
    try{
      const result=await auth.register(form);
      if(result==='denied'){stage='denied';return;}
      await check();
    }catch(error){
      if(error.code==='username_taken'){stage='register';errors={username:'username'};message=errorText(error);return;}
      if(error.code==='denied'){stage='denied';return;}
      throw error;
    }finally{form.birthdate='';}
  }
  // Local mode: use the app without an account; everything stays in this browser. The choice is remembered on this
  // device until the user picks "登录 / 注册". A signed-in session always wins, and signing in ends local mode.
  function enterLocal(){try{localStorage.setItem(LOCAL_MODE_KEY,'1');}catch{/* This page only. */}stage='ready';onReady({local:true},null);}
  async function start(){
    await auth.init();
    let local=false;try{local=localStorage.getItem(LOCAL_MODE_KEY)==='1';}catch{/* Not remembered. */}
    if(!auth.session&&local){enterLocal();refresh();return;}
    if(!auth.config){stage='unconfigured';refresh();return;}if(!auth.session){stage='signin';refresh();return;}
    try{localStorage.removeItem(LOCAL_MODE_KEY);}catch{/* Ignored. */}
    await run(check);
  }

  function header(title,hint){return `<section class="intro"><span class="eyebrow">${tr('知回','Knowledge Review')}</span><h1>${title}</h1><p>${hint}</p></section>`;}
  const status=()=>`<p class="error" role="alert">${esc(message)}</p>${busy?`<p class="verified" role="status">${tr('正在处理…','Working…')}</p>`:''}`;
  const regionSelect=()=>`<label class="field-label" for="auth-region">${tr('国家或地区','Country or region')} *</label><select id="auth-region"><option value="">${tr('请选择','Choose')}</option>${REGIONS.map(code=>`<option value="${code}" ${form.region===code?'selected':''}>${regionName(code)}</option>`).join('')}</select><p class="error">${fieldError('region')}</p>`;
  // Shown only when the local test server provides a test administrator; real projects never do.
 const privacy=()=>`<div class="sharing-notice"><p>${tr('注册即表示你了解：管理员可以查看你的用户名、国家或地区、部分隐藏的邮箱和手机号、注册时间与最近登录时间。生日只用于服务端判断是否年满 18 岁，不会保存；未满 18 岁无法完成注册，同一账号不能重新提交生日。生日由你自行填写，不是身份验证。','By registering you understand that administrators can see your username, country or region, partially hidden email and phone, and registration and last sign-in times. Your birthday is used only for the server’s 18+ check and is not stored; under-18 accounts cannot finish registering, and the same account cannot resubmit a birthday. The birthday is self-reported, not identity verification.')}</p></div>`;
  function fields({lockedMethod}={}){
    const user=auth.user;
    return `<label class="field-label" for="auth-username">${tr('用户名','Username')} *</label><input id="auth-username" type="text" maxlength="20" autocomplete="username" value="${esc(form.username)}"><p class="error">${fieldError('username')}</p>
      <label class="field-label" for="auth-email">${tr('邮箱','Email')}${(lockedMethod||form.method)==='email'?' *':''}</label><input id="auth-email" type="text" inputmode="email" autocomplete="email" maxlength="254" value="${esc(form.email)}" ${lockedMethod&&user?.email?'readonly':''}><p class="error">${fieldError('email')}</p>
      <label class="field-label" for="auth-phone">${tr('手机号','Phone')}${(lockedMethod||form.method)==='phone'?' *':''}</label><input id="auth-phone" type="text" inputmode="tel" autocomplete="tel" maxlength="16" placeholder="+8613800000000" value="${esc(form.phone)}" ${lockedMethod&&user?.phone?'readonly':''}><p class="error">${fieldError('phone')}</p>
      ${regionSelect()}
      <label class="field-label" for="auth-birthdate">${tr('生日','Birthday')} *</label><input id="auth-birthdate" type="date" min="1900-01-01" value="${esc(form.birthdate)}"><p class="error">${fieldError('birthdate')}</p>`;
  }
  function localView(){
    const owner=readOwner(localStorage),other=ownership(localStorage,account())==='other';
    let counts='';try{const s=summarizeSnapshot(readLocalSnapshot(localStorage));counts=tr(`（对话 ${s.threads} 个、知识卡片 ${s.cards} 张、复习记录 ${s.reviews} 条）`,` (${s.threads} conversations, ${s.cards} cards, ${s.reviews} review records)`);}catch{/* Counts are optional. */}
    const duplicate=other&&likelyDuplicate(owner,account(),auth.user?.created_at)?`<p>${tr('你的账号是刚刚创建的，可能用了与之前不同的登录方式。','Your account was just created; you may have used a different sign-in method than before.')}</p>`:'';
    return header(tr('这台设备上的学习记录','Learning records on this device'),other?tr(`这些记录${counts}属于账号「${esc(owner.label||'另一个账号')}」。为保护对方隐私，需先把它们移入本机备份，然后继续使用你的账号。只有原账号登录后才能换回这些记录。`,`These records${counts} belong to the account “${esc(owner.label||'another account')}”. To protect that person’s privacy they must be moved into a local backup before you continue. Only the original account can swap them back.`):tr(`这些记录${counts}还没有关联任何账号。它们是你的吗？`,`These records${counts} are not linked to any account. Are they yours?`))
      +`<section class="panel">${duplicate}<p>${tr(`本机最多保留 ${MAX_BACKUPS} 份备份，更早的会被移除。如果这些记录还没上传到云端，请先退出，用原账号登录并同步。`,`This device keeps at most ${MAX_BACKUPS} backups; older ones are removed. If these records were never uploaded, sign out and sync them from the original account first.`)}</p>
      <div class="followups">${other?'':`<button class="primary-button" id="local-claim">${tr('是我的，关联到当前账号','Yes, link them to my account')}</button>`}<button class="${other?'primary':'secondary'}-button" id="local-aside">${other?tr('移入本机备份并继续','Move to local backup and continue'):tr('不是我的，移入本机备份','Not mine, move to local backup')}</button><button class="text-button" id="auth-signout">${tr('退出登录','Sign out')}</button></div>${status()}</section>`;
  }
  function view(){
    if(stage==='loading')return header(tr('正在连接…','Connecting…'),tr('正在检查登录状态。','Checking your sign-in.'));
    if(stage==='unconfigured')return header(tr('服务尚未配置','Service not configured'),tr('使用本应用需要登录，但服务器还没有配置账号服务（Supabase）。运营者需在服务器设置 SUPABASE_URL 和 SUPABASE_PUBLISHABLE_KEY，或由开发者在下方填写测试项目。','Sign-in is required, but the server has no account service (Supabase) configured. The operator must set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY on the server, or a developer can enter a test project below.'))
      +`<section class="panel local-entry"><h2>${tr('不登录，先在本机使用','Use on this device without signing in')}</h2><p>${tr('提问、知识卡片和复习都可以用，记录只保存在这个浏览器。以后登录时，可以把这些记录并入账号。','Asking, knowledge cards and review all work; records stay in this browser. When you sign in later, you can add them to your account.')}</p><button class="primary-button" data-local-mode>${tr('使用本地模式','Use local mode')} →</button></section>
      <section class="panel"><details><summary>${tr('开发者：填写云项目','Developer: enter a cloud project')}</summary><label class="field-label" for="dev-url">${tr('项目 URL','Project URL')}</label><input id="dev-url" type="text" placeholder="https://your-project.supabase.co" value="${esc(devConfig.url)}"><label class="field-label" for="dev-key">${tr('公开 Key（不能填服务端密钥）','Public key (never a server secret)')}</label><input id="dev-key" type="text" value="${esc(devConfig.publicKey)}"><div class="followups"><button class="secondary-button" id="dev-save">${tr('保存并继续','Save and continue')}</button></div></details>${status()}</section>`;
    if(stage==='signin')return header(tr('登录','Sign in'),tr('使用注册时的邮箱或手机号接收验证码。','Use the email or phone you registered with to receive a code.'))
      +`<section class="panel auth-panel"><div class="module-tabs"><button class="module-tab ${form.method==='email'?'active':''}" data-auth-method="email">${tr('邮箱','Email')}</button><button class="module-tab ${form.method==='phone'?'active':''}" data-auth-method="phone">${tr('手机号','Phone')}</button></div><label class="field-label" for="auth-identifier">${form.method==='email'?tr('邮箱','Email'):tr('手机号（含国家区号）','Phone (with country code)')}</label><input id="auth-identifier" type="text" inputmode="${form.method==='email'?'email':'tel'}" value="${esc(form.identifier)}" placeholder="${form.method==='email'?'name@example.com':'+8613800000000'}"><p class="error">${fieldError('identifier')}</p>
        <div class="actions"><button class="text-button" id="go-signup">${tr('没有账号？注册','No account? Register')}</button><button class="primary-button" id="signin-send">${tr('发送验证码','Send code')}</button></div>
        <div class="local-option"><button class="secondary-button" data-local-mode>${tr('不登录，先在本机使用','Use on this device without signing in')}</button><span class="field-hint">${tr('记录只保存在这个浏览器，以后登录时可并入账号。','Records stay in this browser; you can add them to an account later.')}</span></div>
        <div class="followups"><button class="text-button" id="go-admin">${tr('管理员使用密码登录','Administrator password sign-in')}</button></div>
        ${auth.oauthProviders?.length?`<div class="followups">${auth.oauthProviders.includes('google')?`<button class="secondary-button" data-oauth="google">${tr('使用 Google 登录','Continue with Google')}</button>`:''}${auth.oauthProviders.includes('apple')?`<button class="secondary-button" data-oauth="apple">${tr('使用 Apple 登录','Continue with Apple')}</button>`:''}</div>`:''}${status()}${unregistered?`<div class="sharing-notice"><p>${tr('这个邮箱或手机号还没有注册。','This email or phone number is not registered yet.')}</p><button class="primary-button" id="go-signup-now">${tr('去注册','Go to registration')}</button></div>`:''}</section>`;
    if(stage==='signup')return header(tr('注册','Register'),tr('填写基本信息，选择用邮箱还是手机号接收验证码。带 * 为必填。','Enter your details and choose whether to receive the code by email or phone. * is required.'))
      +`<section class="panel auth-panel"><label class="field-label" for="auth-method">${tr('验证方式','Verify with')}</label><select id="auth-method"><option value="email" ${form.method==='email'?'selected':''}>${tr('邮箱验证码','Email code')}</option><option value="phone" ${form.method==='phone'?'selected':''}>${tr('手机短信验证码','SMS code')}</option></select>${fields()}${privacy()}
        <div class="actions"><button class="text-button" id="go-signin">${tr('已有账号？登录','Have an account? Sign in')}</button><button class="primary-button" id="signup-send">${tr('发送验证码','Send code')}</button></div>${status()}</section>`;
    if(stage==='admin')return header(tr('管理员登录','Administrator sign-in'),tr('输入管理员用户名和密码，无需验证码或注册信息。','Enter the administrator username and password. No code or registration details needed.'))
      +`<section class="panel auth-panel"><label class="field-label" for="admin-username">${tr('用户名','Username')}</label><input id="admin-username" type="text" autocomplete="username" maxlength="40" value="${esc(adminForm.username)}"><label class="field-label" for="admin-password">${tr('密码','Password')}</label><input id="admin-password" type="password" autocomplete="current-password"><div class="actions"><button class="text-button" id="go-signin">${tr('返回验证码登录','Back to code sign-in')}</button><button class="primary-button" id="admin-signin">${tr('登录','Sign in')}</button></div>${status()}</section>`;
    if(stage==='code')return header(tr('输入验证码','Enter the code'),tr(`验证码已发送到 ${esc(codeFor==='signup'?(form.method==='email'?form.email:form.phone):form.identifier)}。`,`A code was sent to ${esc(codeFor==='signup'?(form.method==='email'?form.email:form.phone):form.identifier)}.`))
      +`<section class="panel auth-panel"><label class="field-label" for="auth-code">${tr('验证码','Code')}</label><input id="auth-code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="10" value="${esc(otp)}"><div class="actions"><button class="text-button" id="code-back">${tr('返回修改','Go back')}</button><button class="primary-button" id="code-verify">${codeFor==='signup'?tr('验证并完成注册','Verify and register'):tr('验证并登录','Verify and sign in')}</button></div>${status()}</section>`;
    if(stage==='register')return header(tr('完善注册信息','Finish registering'),tr('这个账号还没有完成注册。补充以下信息后即可使用。','This account has not finished registering. Add the details below to continue.'))
      +`<section class="panel auth-panel">${fields({lockedMethod:auth.user?.phone&&!auth.user?.email?'phone':'email'})}${privacy()}<div class="actions"><button class="text-button" id="auth-signout">${tr('退出登录','Sign out')}</button><button class="primary-button" id="register-submit">${tr('完成注册','Finish registering')}</button></div>${status()}</section>`;
    if(stage==='denied')return header(tr('无法完成注册','Registration not available'),tr('本应用仅供年满 18 岁的用户使用。此账号未通过成年确认，不能使用；同一账号不能重新提交生日。','This app is only for users aged 18 and over. This account did not pass the age check and cannot be used; the same account cannot resubmit a birthday.'))
      +`<section class="panel"><label class="check-row"><input id="denied-delete-consent" type="checkbox" ${deleteConsent?'checked':''}>${tr('我确认注销此云账号','I confirm deleting this cloud account')}</label><div class="followups"><button class="secondary-button" id="denied-delete">${tr('注销此账号','Delete this account')}</button><button class="text-button" id="auth-signout">${tr('退出登录','Sign out')}</button></div>${status()}</section>`;
    if(stage==='error')return header(tr('暂时无法连接','Cannot connect right now'),tr('无法读取账号状态。','Your account status could not be loaded.'))+`<section class="panel"><div class="followups"><button class="primary-button" id="auth-retry">${tr('重试','Retry')}</button><button class="text-button" id="auth-signout">${tr('退出登录','Sign out')}</button></div>${status()}</section>`;
    if(stage==='local')return localView();
    return '';
  }
  function bind(){
    const value=id=>document.querySelector(id)?.value.trim()??'';
    const mirror={'#auth-identifier':'identifier','#auth-username':'username','#auth-email':'email','#auth-phone':'phone','#auth-birthdate':'birthdate'};
    for(const [selector,key] of Object.entries(mirror)){const input=document.querySelector(selector);if(input)input.oninput=()=>{form[key]=input.value.trim();};}
    const region=document.querySelector('#auth-region');if(region)region.onchange=()=>{form.region=region.value;};
    const method=document.querySelector('#auth-method');if(method)method.onchange=()=>{form.method=method.value;errors={};refresh();};
    const code=document.querySelector('#auth-code');if(code)code.oninput=()=>{otp=code.value.trim();};
    const devUrl=document.querySelector('#dev-url'),devKey=document.querySelector('#dev-key');if(devUrl)devUrl.oninput=()=>{devConfig.url=devUrl.value.trim().replace(/\/$/,'');};if(devKey)devKey.oninput=()=>{devConfig.publicKey=devKey.value.trim();};
    const on=(selector,handler)=>{const element=document.querySelector(selector);if(element)element.onclick=handler;};
    document.querySelectorAll('[data-auth-method]').forEach(button=>button.onclick=()=>{form.method=button.dataset.authMethod;form.identifier='';errors={};refresh();});
    on('#go-signup-now',()=>document.querySelector('#go-signup')?.click());
    on('#go-signup',()=>{unregistered=false;const id=form.identifier;if(validEmail(id)){form.email=id;form.method='email';}else if(validPhone(id)){form.phone=id;form.method='phone';}go('signup');});
    on('#go-signin',()=>{form.birthdate='';adminForm.password='';go('signin');});
    on('#go-admin',()=>{unregistered=false;go('admin');});
    document.querySelectorAll('[data-local-mode]').forEach(button=>{button.onclick=()=>{if(!busy)enterLocal();};});
    const adminUsername=document.querySelector('#admin-username');if(adminUsername)adminUsername.oninput=()=>{adminForm.username=adminUsername.value.trim();};
    const adminPassword=document.querySelector('#admin-password');if(adminPassword){adminPassword.value=adminForm.password;adminPassword.oninput=()=>{adminForm.password=adminPassword.value;};}
    const adminSignIn=async credentials=>{
      try{await auth.signInWithPassword(credentials);}
      catch(error){if(error.status>=400&&error.status<500&&error.status!==429){message=tr('用户名或密码不正确。','Incorrect username or password.');return;}throw error;}
      finally{adminForm.password='';}
      // Password accounts that are not administrators still go through registration and the age check.
      await check();
    };
    // The username maps to the operator-configured administrator account; unknown names get the same message as a wrong password.
    on('#admin-signin',()=>run(async()=>{const email=auth.adminEmail(adminForm.username);if(!email||!adminForm.password){adminForm.password='';message=tr('用户名或密码不正确。','Incorrect username or password.');return;}await adminSignIn({email,password:adminForm.password});}));
    on('#dev-save',()=>run(async()=>{if(!validConfig(devConfig))throw Object.assign(new Error('config'),{code:'config'});auth.saveDeviceConfig(devConfig);stage='signin';}));
    on('#signin-send',()=>run(async()=>{unregistered=false;const id=form.identifier;if(form.method==='email'?!validEmail(id):!validPhone(id)){errors={identifier:'identifier'};return;}
      try{await auth.sendCode({method:form.method,identifier:id,create:false});}catch(error){if(error.status>=400&&error.status<500&&error.status!==429&&!['sms_send_failed','email_send_failed'].includes(error.code)){unregistered=true;return;}throw error;}
      codeFor='signin';otp='';stage='code';}));
    on('#signup-send',()=>run(async()=>{errors=registrationErrors(form);if(Object.keys(errors).length)return;await auth.sendCode({method:form.method,identifier:form.method==='email'?form.email:form.phone,create:true});codeFor='signup';otp='';stage='code';}));
    on('#code-back',()=>{otp='';go(codeFor);});
    on('#code-verify',()=>run(async()=>{
      if(!/^\d{4,10}$/.test(otp)){message=tr('请输入收到的验证码。','Enter the code you received.');return;}
      const identifier=codeFor==='signup'?(form.method==='email'?form.email:form.phone):form.identifier;
      try{await auth.verify({method:form.method,identifier,token:otp});}catch(error){if(error.status>=400&&error.status<500&&error.status!==429){message=tr('验证码错误或已过期，请重试。','The code is wrong or expired. Try again.');return;}throw error;}
      otp='';try{localStorage.setItem(LAST_LOGIN_KEY,form.method);}catch{/* Convenience only. */}
      if(codeFor==='signup'){const current=await auth.account();if(!current?.registered){await register();return;}message=tr('此账号已注册，已为你登录。','This account was already registered; you are signed in.');}
      form.birthdate='';await check();
    }));
    on('#register-submit',()=>run(register));
    on('#auth-retry',()=>run(check));
    on('#auth-signout',()=>run(async()=>{await auth.signOut();acct=null;form.birthdate='';stage='signin';}));
    document.querySelectorAll('[data-oauth]').forEach(button=>button.onclick=()=>run(()=>auth.startOAuth(button.dataset.oauth)));
    on('#local-claim',()=>run(async()=>{bindOwner(localStorage,account());await check();}));
    on('#local-aside',()=>run(async()=>{try{setAsideLocalData(localStorage,account());}catch{message=tr('本机存储空间不足，未做任何更改。','Local storage is full. Nothing was changed.');return;}await check();}));
    const consent=document.querySelector('#denied-delete-consent');if(consent)consent.onchange=()=>{deleteConsent=consent.checked;};
    on('#denied-delete',()=>run(async()=>{if(!deleteConsent){message=tr('请先勾选确认。','Confirm first.');return;}await auth.deleteAccount();await auth.signOut();deleteConsent=false;stage='signin';message=tr('账号已注销。','The account was deleted.');}));
    document.querySelectorAll('main button,main input,main select').forEach(element=>{if(busy)element.disabled=true;});
  }
  return {view,bind,start,get ready(){return stage==='ready';},get busy(){return busy;}};
}
