# 免费公开测试部署（Render）

用于小范围内测：朋友在任何地方用一个 HTTPS 网址打开知回。服务器在海外，国内访问可能较慢。

## 免费版限制

- 15 分钟没人访问会休眠，下一次打开需要等约 1 分钟。
- 每次重启或休眠后，未登录用户的免费额度计数（按 IP，存在内存中）会清零；登录用户的额度存在 Supabase，不受影响。
- 每月免费运行时长有限，个人内测通常够用。以 Render 官网说明为准。

## 运营者步骤

1. 把代码推送到自己的 GitHub **私有**仓库。`server.local.json`、`*.local.json` 和 `密码.txt` 已被 gitignore，不会上传。
2. 在 Render 用 GitHub 登录，选择 **New → Blueprint**，选这个仓库。Render 读取 `render.yaml`，创建名为 `zhihui` 的免费 Web 服务。
3. 按提示填写环境变量（只填在 Render 控制台，不写进代码）：
   - `ZHIPU_API_KEY`：智谱 Key（免费额度用）。
   - `SUPABASE_URL`、`SUPABASE_PUBLISHABLE_KEY`：Supabase 项目地址和公开 Key。绝不填 secret 或 service_role Key。
   - `ADMIN_USERNAME`、`ADMIN_LOGIN_EMAIL`：管理员用户名和邮箱。
4. 部署完成后得到网址，例如 `https://zhihui.onrender.com`。服务会自动读取 Render 提供的 `RENDER_EXTERNAL_URL`，只接受这个网址的访问；使用自定义域名时设置 `PUBLIC_ORIGIN=https://你的域名`。
5. 在 Supabase → Authentication → URL Configuration 把 **Site URL** 改成这个网址，并加入 Redirect URLs。
6. 用手机打开网址，测试邮箱验证码登录、提问、复习和加密同步（HTTPS 下可用）。

## 公开模式的行为

- 只接受公开网址（以及本机）的 Host 和 Origin，并发送 HSTS。
- 访客 IP 取自代理的 `X-Forwarded-For` 第一项。访客可以伪造这一项，所以未登录额度和频率限制只是基本防护；需要更严格时，要求登录后才能使用免费额度。
- 面向公众推广前，见 `cloud-setup.md` 第 10 节的合规提示。
