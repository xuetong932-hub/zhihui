# 安卓 App（TWA 封装）

知回的安卓 App 是用 PWABuilder 生成的 Trusted Web Activity：打开后全屏显示线上网站 https://zhihui.onrender.com ，网站更新后 App 内容自动更新，不需要重新发安装包。

## 文件

| 文件 | 说明 | 是否提交 |
|---|---|---|
| `downloads/zhihui.apk` | 安装包，网站地址 `/zhihui.apk`，手机版"我的"页在安卓浏览器中提供下载 | 提交 |
| `.well-known/assetlinks.json` | 证明 App 与网站属于同一所有者；缺少它，App 顶部会出现地址栏 | 提交 |
| `android-signing/signing.keystore` | 签名密钥，以后每次更新都必须用它签名 | **不提交**（gitignore） |
| `android-signing/signing-key-info.txt` | 密钥密码 | **不提交** |
| `android-signing/zhihui.aab` | 上架 Google Play 用的格式（暂不使用） | 不提交 |

**务必另外备份 `android-signing/` 文件夹**（例如 U 盘）。丢失后无法再发布同一个 App 的更新，用户只能卸载重装。

## 当前包信息

- 包名：`com.zhihui.app`，版本 1.0.0.0（versionCode 1）
- 手机没有 Chrome 时退回 App 内置 WebView
- 启动地址 `/`，安卓手机会被转到手机版 `/m/`

## 什么时候需要重新打包

只改网站内容不需要。只有改 App 名称、图标、包名、启动方式，或 Android 系统要求更新时才需要：

1. 在 pwabuilder.com 输入网址，选 Android → Other Android。
2. 包名保持 `com.zhihui.app`，版本号和 versionCode 加一。
3. 签名选择 **Use mine**，上传 `android-signing/signing.keystore`，填写 `signing-key-info.txt` 里的别名和密码。
4. 用新 APK 替换 `downloads/zhihui.apk`；`assetlinks.json` 指纹不变，不用改。

## 限制

- 不经过应用商店，安装时手机会提示"未知来源应用"。
- App 需要联网；Render 免费版闲置 15 分钟后休眠，首次打开可能等约 1 分钟。
- 上架 Google Play 需要一次性 25 美元开发者账号；国内应用商店通常需要软件著作权和备案。
