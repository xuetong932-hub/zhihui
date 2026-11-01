# 云端接通（未配置前仅本地使用）

1. 创建自己的 Supabase 项目，运行本项目 `cloud-schema.sql`，启用 RLS。在运行服务的环境中设置 `SUPABASE_URL`（如 `https://xxxx.supabase.co`）和 `SUPABASE_PUBLISHABLE_KEY`（公开 publishable/anon Key），App 通过 `/api/public-config` 读取。绝不能使用 service_role 或 secret Key。未设置时 App 显示“服务尚未配置”，开发者可在该页临时填写测试项目（只保存在当前浏览器）。
2. 开启邮箱登录；若用验证码，将邮箱模板配置为显示 `{{ .Token }}`。配置自己的邮件发送服务。手机号登录需要开启 Phone 并配置短信服务商。
3. Google、Apple 登录分别需要在 Supabase 配置 OAuth 凭据。Site URL 和允许重定向地址应精确包含实际应用 origin，例如本机 `http://127.0.0.1:4180/`；上线后使用 HTTPS，不使用开放通配符。
4. 登录后在“账号”页设置至少 12 字符的同步口令。口令不上传、不保存；数据用 PBKDF2-SHA256（310000 次）、AES-256-GCM、本次随机 salt 和 IV 加密。所有设备输入相同口令；遗忘无法恢复。模型 Key 仅勾选后加入密文。
5. 初次上传创建 revision 1；已有云记录须先下载。更新采用版本条件，冲突拒绝覆盖，不自动合并。下载替换本机前需要勾选确认，并在本机保存原数据快照。

6. 注册与成年准入：`cloud-schema.sql` 创建 `user_profiles`（用户名、邮箱、手机号、国家或地区）、`account_eligibility`、`admins` 表，以及 `my_account`、`complete_registration`、`admin_list_users`、`is_adult` 函数。快照表只对已通过准入的账号开放。注册时 App 把生日交给 `complete_registration` 计算，只保存结果；未满 18 岁记为拒绝，且不能重新提交。上线前需确认项目日志不会记录 `complete_registration` 的请求参数（生日）。
7. 管理员：只能在 SQL Editor 中指定，App 内没有授权入口。例如：

   ```sql
   insert into public.admins(user_id) select id from auth.users where email = '管理员邮箱';
   ```

   管理员登录后，导航出现“管理”，可查看用户名、国家或地区、部分隐藏的邮箱和手机号、注册与最近登录时间、成年确认状态。撤销权限：`delete from public.admins where user_id = ...;`。

账号注销按钮需登录并勾选注销说明，调用 `delete_own_account()` 删除自身 auth 用户及级联备份，本机学习记录保留。未配置项目时不会执行。

当前限制：需实际云项目才能验证四种登录、RLS、邮件短信送达及跨设备恢复。登录会话保存在本设备并自动刷新，退出登录时清除；尚无自动后台同步、账号绑定合并或中国大陆部署适配。成年准入由服务端判断并记录，但生日仍是用户自行填写，不是身份验证；该部分 SQL 尚未在真实项目上执行验证。发布前必须补齐这些能力，不能把当前版本作为公开多用户成品。

参考：[邮箱验证码](https://supabase.com/docs/guides/auth/auth-email-passwordless)、[短信登录](https://supabase.com/docs/guides/auth/phone-login)、[行级安全](https://supabase.com/docs/guides/database/postgres/row-level-security)。
