# 云端接通（未配置前仅本地使用）

1. 创建自己的 Supabase 项目，运行本项目 `cloud-schema.sql`，启用 RLS。只在 App 填项目 URL 与公开 publishable/anon Key，绝不能使用 service_role 或 secret Key。
2. 开启邮箱登录；若用验证码，将邮箱模板配置为显示 `{{ .Token }}`。配置自己的邮件发送服务。手机号登录需要开启 Phone 并配置短信服务商。
3. Google、Apple 登录分别需要在 Supabase 配置 OAuth 凭据。Site URL 和允许重定向地址应精确包含实际应用 origin，例如本机 `http://127.0.0.1:4180/`；上线后使用 HTTPS，不使用开放通配符。
4. App 内保存公开项目配置，登录后设置至少 12 字符的同步口令。口令不上传、不保存；数据用 PBKDF2-SHA256（310000 次）、AES-256-GCM、本次随机 salt 和 IV 加密。所有设备输入相同口令；遗忘无法恢复。模型 Key 仅勾选后加入密文。
5. 初次上传创建 revision 1；已有云记录须先下载。更新采用版本条件，冲突拒绝覆盖，不自动合并。下载替换本机前需要勾选确认，并在本机保存原数据快照。

6. 成年准入：`cloud-schema.sql` 同时创建 `account_eligibility` 表和 `account_status`、`attest_adult`、`is_adult` 函数，并让快照表只对已通过准入的账号开放。登录后 App 查询准入状态；未确认时要求输入生日，由服务端计算并只保存结果。未满 18 岁记为拒绝且不能重新提交。未运行这部分脚本时，App 会提示“无法确认成年准入状态”，同步不可用。上线前需确认项目日志不会记录 `attest_adult` 的请求参数（生日）。

账号注销按钮需登录并勾选注销说明，调用 `delete_own_account()` 删除自身 auth 用户及级联备份，本机学习记录保留。未配置项目时不会执行。

当前限制：需实际云项目才能验证四种登录、RLS、邮件短信送达及跨设备恢复。账号 Token 仅保留页面内存，刷新后重新登录；尚无自动后台同步、账号绑定合并或中国大陆部署适配。成年准入由服务端判断并记录，但生日仍是用户自行填写，不是身份验证；该部分 SQL 尚未在真实项目上执行验证。发布前必须补齐这些能力，不能把当前版本作为公开多用户成品。

参考：[邮箱验证码](https://supabase.com/docs/guides/auth/auth-email-passwordless)、[短信登录](https://supabase.com/docs/guides/auth/phone-login)、[行级安全](https://supabase.com/docs/guides/database/postgres/row-level-security)。
