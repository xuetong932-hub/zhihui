# 云端接通（未配置前仅本地使用）

1. 创建自己的 Supabase 项目，运行本项目 `cloud-schema.sql`，启用 RLS。在运行服务的环境中设置 `SUPABASE_URL`（如 `https://xxxx.supabase.co`）和 `SUPABASE_PUBLISHABLE_KEY`（公开 publishable/anon Key），App 通过 `/api/public-config` 读取。绝不能使用 service_role 或 secret Key。未设置时 App 显示“服务尚未配置”，开发者可在该页临时填写测试项目（只保存在当前浏览器）。
2. 开启邮箱登录；若用验证码，将邮箱模板配置为显示 `{{ .Token }}`。配置自己的邮件发送服务。手机号登录需要开启 Phone 并配置短信服务商。
3. Google、Apple 登录分别需要在 Supabase 配置 OAuth 凭据。Site URL 和允许重定向地址应精确包含实际应用 origin，例如本机 `http://127.0.0.1:4180/`；上线后使用 HTTPS，不使用开放通配符。
4. 登录后在“账号”页设置至少 12 字符的同步口令。口令不上传、不保存；数据用 PBKDF2-SHA256（310000 次）、AES-256-GCM、本次随机 salt 和 IV 加密。所有设备输入相同口令；遗忘无法恢复。模型 Key 仅勾选后加入密文。
5. 初次上传创建 revision 1；已有云记录须先下载。更新采用版本条件，冲突拒绝覆盖，不自动合并。下载替换本机前需要勾选确认，并在本机保存原数据快照。

6. 注册与成年准入：`cloud-schema.sql` 创建 `user_profiles`（用户名、邮箱、手机号、国家或地区）、`account_eligibility`、`admins` 表，以及 `my_account`、`complete_registration`、`admin_list_users`、`is_adult` 函数。快照表只对已通过准入的账号开放。注册时 App 把生日交给 `complete_registration` 计算，只保存结果；未满 18 岁记为拒绝，且不能重新提交。上线前需确认项目日志不会记录 `complete_registration` 的请求参数（生日）。
7. 管理员：先在 Supabase 控制台的 Authentication → Users 中“Add user”，填写邮箱和密码，并勾选自动确认邮箱；确保 Email 登录方式允许密码登录。在服务器环境中设置 `ADMIN_USERNAME`（如 `Ava`）和 `ADMIN_LOGIN_EMAIL`（该管理员账号的邮箱）。管理员在 App 登录页点“管理员使用密码登录”，输入用户名和在 Supabase 中设置的密码即可进入（密码不写入代码或配置，请使用强密码），不需要验证码，也不填写注册信息和学习设置（使用默认值，可在“学习设置”修改）。管理员账号视为已满足准入，可以使用同步。请为管理员设置强密码。再在 SQL Editor 中授予管理员身份（App 内没有授权入口），例如：

   ```sql
   insert into public.admins(user_id) select id from auth.users where email = '管理员邮箱';
   ```

   管理员登录后，导航出现“管理”，可查看用户名、国家或地区、部分隐藏的邮箱和手机号、注册与最近登录时间、成年确认状态。撤销权限：`delete from public.admins where user_id = ...;`。

8. 导出到 Google 文档（可选，尚未用真实项目验证）：在 Google Cloud 控制台创建 OAuth 客户端（类型选“Web 应用”），启用 Google Drive API。已获授权的重定向 URI 填 `你的站点地址/oauth-callback.html`（本机如 `http://127.0.0.1:4174/oauth-callback.html`）。然后在服务器环境中设置 `GOOGLE_CLIENT_ID`。App 只请求 `drive.file` 权限（只能访问本应用创建的文件），把 Word 文件上传并转换为 Google 文档。
9. 导出到飞书云文档（未实现，计划）：需要在飞书开放平台创建应用，取得 App ID 和 App Secret（只能放在服务器上），并开通云文档导入权限。实现方式：服务器换取用户访问令牌 → 上传 .docx → 创建导入任务转换为飞书文档 → 返回文档链接。在这之前，用户可以先下载 Word，再在飞书云文档中选择“导入”。

账号注销按钮需登录并勾选注销说明，调用 `delete_own_account()` 删除自身 auth 用户及级联备份，本机学习记录保留。未配置项目时不会执行。

当前限制：需实际云项目才能验证四种登录、RLS、邮件短信送达及跨设备恢复。登录会话保存在本设备并自动刷新，退出登录时清除；尚无自动后台同步、账号绑定合并或中国大陆部署适配。成年准入由服务端判断并记录，但生日仍是用户自行填写，不是身份验证；该部分 SQL 尚未在真实项目上执行验证。发布前必须补齐这些能力，不能把当前版本作为公开多用户成品。

参考：[邮箱验证码](https://supabase.com/docs/guides/auth/auth-email-passwordless)、[短信登录](https://supabase.com/docs/guides/auth/phone-login)、[行级安全](https://supabase.com/docs/guides/database/postgres/row-level-security)。

## 10. 知回免费额度（智谱 GLM-4-Flash）

The free allowance lets users ask questions and get review grading without their own key. The operator does these steps; nothing here is automatic.

1. Register at [智谱开放平台](https://open.bigmodel.cn) and create an API key. Then confirm two things in the console: that `glm-4-flash-250414` is still free, and what its rate limit is.
2. Set the key only in the server environment: `ZHIPU_API_KEY=...`. Never commit it, never put it in the client, and never log it. If it is unset, the free option is hidden.
3. Run the `free_usage` table and `free_quota()` function from `cloud-schema.sql` in the Supabase project.
4. Limits:
   - Signed-in users: 20 questions and 30 review gradings per day, China time. The limits are enforced in SQL; change them there.
   - Local mode (no account): 3 questions and 5 gradings per day, counted per IP in server memory.
   - Every free call: at most 40 per IP in 10 minutes.
5. Not included in the free allowance: semantic relations and mind map expansion (the user's own key is needed).
6. Before a public launch in China, check the requirements for generative AI services: registration and filing, and labelling AI-generated content.
