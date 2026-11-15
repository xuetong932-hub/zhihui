# KnowBack 海报：真实截图 + 提示词

截图在 `screenshots/` 里，都是 App 的真实英文界面（测试环境，内容是 App 自带的入门卡片和真实操作）：

| 编号 | 主题 | 竖版用（手机 1170×2532） | 横版用（电脑 2880×1800） |
|---|---|---|---|
| 01 | 提问、记住 | `01-home-phone.png` | `01-home-desktop.png` |
| 02 | 知识卡片 | `02-knowledge-cards-phone.png` | `02-knowledge-cards-desktop.png` |
| 03 | 复习 | `03-review-phone.png` | `03-review-desktop.png` |
| 04 | 知识图谱 | `04-knowledge-graph-phone.png` | `04-knowledge-graph-desktop.png` |
| 05 | 学习广场 | `05-learning-square-phone.png` | `05-learning-square-desktop.png` |
| 06 | 10 种语言 | `06-languages-phone.png` | `06-languages-desktop.png` |

## 两种用法

**A. 先生成空白屏幕，再贴截图（最稳，推荐）**
用下面的提示词原样生成，屏幕是浅灰占位；再用 `compose.py` 或 Canva / Figma / PS 把截图贴进去。
图片模型重画界面时常把文字写错，这样做能保证海报里的界面 100% 是真实的。

```
python store-assets/compose.py <生成的图> <截图> <输出.png> <屏幕中心x> <屏幕中心y> <状态栏高度>
```
（屏幕中心用屏幕灰色区域内任意一点的像素坐标；状态栏高度约为屏幕高度的 4%，电脑屏幕填 0。）

**B. 把截图当参考图上传（模型支持“参考图 / 图生图”时）**
把对应截图一起上传，并在提示词最后加上：
```
Place the uploaded screenshot exactly on the device screen. Keep it pixel-accurate: do not redraw, translate, crop or change any text, colours or layout in the screenshot.
```
生成后请逐字核对屏幕里的文字；有任何变形就改用方法 A。

## 统一风格（每条提示词都已包含）

品牌墨绿 #30694F、浅绿 #E8F1EC、白底、近黑 #111111；Logo 为墨绿圆角方块中一个白色 ↗ 箭头，旁边写 KnowBack。
干净、留白多、扁平加柔和阴影。不放价格、"Free"、"#1"、评分等（应用商店素材规范不允许）。

## 通用负面提示词

```
garbled text, misspelled words, extra letters, redrawn or fake app interface, people, faces, hands, other brand logos, Apple logo, Google logo, price, "free", "#1", "best", star ratings, badges, cluttered background, neon colours, watermark, signature, low resolution, blurry
```

---

## 01 · Ask it. Remember it.（截图 01-home）

**竖版 9:16**
```
Vertical 9:16 app promotion poster for a learning app called KnowBack. Clean white background with a very pale sage green (#E8F1EC) rounded shape behind the lower half. Top: a small rounded-square app icon in deep green (#30694F) with a white arrow pointing up-right, next to the word "KnowBack" in a bold modern geometric sans-serif. Below it a large bold two-line headline: "Ask it." in near-black (#111111) and "Remember it." in deep green (#30694F). Lower centre: a modern smartphone, front view, thin dark bezel with a small notch, soft drop shadow, with a plain solid light grey screen (placeholder for a real screenshot, draw nothing on it). Beside the phone, not covering the screen, three small floating white rounded chips with soft shadows and tiny deep green icons: a microphone, a camera, a text cursor. Minimal, calm, generous whitespace, flat design with soft shadows, crisp, high resolution. No other text.
```

**横版 16:9**
```
Horizontal 16:9 app promotion poster for a learning app called KnowBack. Clean white background with a very pale sage green (#E8F1EC) soft shape on the right. Left half: a small rounded-square app icon in deep green (#30694F) with a white arrow pointing up-right next to the word "KnowBack" in a bold modern geometric sans-serif, and below it a large bold two-line headline "Ask it." in near-black (#111111) and "Remember it." in deep green (#30694F). Right half: a modern laptop, slightly angled, thin dark bezel, with a plain solid light grey screen (placeholder for a real screenshot, draw nothing on it), and a smartphone standing in front of it with a plain light grey screen too. Small floating white chips with a microphone and a camera icon near the devices. Minimal, generous whitespace, flat design with soft shadows, crisp, high resolution. No other text.
```

## 02 · Every answer becomes a card.（截图 02-knowledge-cards）

**竖版 9:16**
```
Vertical 9:16 app promotion poster for a learning app called KnowBack, same style series. Clean white background with a very pale sage green (#E8F1EC) rounded shape behind the lower half. Top: the KnowBack logo (deep green #30694F rounded square with a white up-right arrow) and the word "KnowBack". Below it a large bold two-line headline: "Every answer" in near-black (#111111) and "becomes a card." in deep green (#30694F). Lower centre: a modern smartphone, front view, thin dark bezel with a small notch, soft shadow, plain solid light grey screen (placeholder, draw nothing on it). Beside the phone, not covering the screen, one white rounded card floating at a slight angle with a soft shadow, showing only abstract content: a bold dark bar, three short grey lines and a small pale green pill. Minimal, generous whitespace, flat design, crisp, high resolution. No other text.
```

**横版 16:9**
```
Horizontal 16:9 app promotion poster for a learning app called KnowBack, same style series. White background, very pale sage green (#E8F1EC) soft shape on the right. Left: KnowBack logo and name, then a large bold two-line headline "Every answer" (near-black #111111) / "becomes a card." (deep green #30694F). Right: a modern laptop with a plain solid light grey screen (placeholder, draw nothing on it); two or three white rounded abstract cards (bold dark bar, grey lines, small pale green pill) float out of the screen towards the viewer with soft shadows. Minimal, flat design with soft shadows, crisp, high resolution. No other text.
```

## 03 · Review right before you forget.（截图 03-review）

**竖版 9:16**
```
Vertical 9:16 app promotion poster for a learning app called KnowBack, same style series. White background with a very pale sage green (#E8F1EC) rounded shape behind the lower half. Top: KnowBack logo (deep green #30694F rounded square, white up-right arrow) and the word "KnowBack". Headline in two lines: "Review right" in near-black (#111111) and "before you forget." in deep green (#30694F). Lower centre: a modern smartphone, front view, notch, soft shadow, plain solid light grey screen (placeholder, draw nothing on it). Behind the phone a soft simple chart: one grey curve dropping steeply, and one deep green curve that dips gently and is lifted back up at a few points marked with small green dots. No axis labels. Minimal, flat, crisp, high resolution. No other text.
```

**横版 16:9**
```
Horizontal 16:9 app promotion poster for a learning app called KnowBack, same style series. White background. Left: KnowBack logo and name, headline "Review right" (near-black #111111) / "before you forget." (deep green #30694F). Across the lower half, a wide soft chart: a grey curve dropping steeply and a deep green curve that is lifted back up at several points marked with small green dots, light green fill under it. Right: a modern laptop with a plain solid light grey screen (placeholder, draw nothing on it) standing above the chart. No axis labels. Minimal, flat design with soft shadows, crisp, high resolution. No other text.
```

## 04 · See how your ideas connect.（截图 04-knowledge-graph）

**竖版 9:16**
```
Vertical 9:16 app promotion poster for a learning app called KnowBack, same style series. White background with a very pale sage green (#E8F1EC) rounded shape behind the lower half. Top: KnowBack logo and the word "KnowBack". Headline in two lines: "See how your" in near-black (#111111) and "ideas connect." in deep green (#30694F). Lower centre: a modern smartphone, front view, notch, soft shadow, plain solid light grey screen (placeholder, draw nothing on it). Around and behind the phone, not covering the screen, an elegant network of round nodes linked by thin lines in four soft colours (deep green, blue, orange, red), each cluster around one larger node. Minimal, flat, crisp, high resolution. No other text.
```

**横版 16:9**
```
Horizontal 16:9 app promotion poster for a learning app called KnowBack, same style series. White background. Left: KnowBack logo and name, headline "See how your" (near-black #111111) / "ideas connect." (deep green #30694F). Right: a modern laptop with a plain solid light grey screen (placeholder, draw nothing on it); behind and around it an elegant network of round nodes and thin links in four soft colours (deep green, blue, orange, red), four clusters each around a larger node, extending into the background. Minimal, flat design with soft shadows, crisp, high resolution. No other text.
```

## 05 · Learn together, in your language.（截图 05-learning-square）

**竖版 9:16**
```
Vertical 9:16 app promotion poster for a learning app called KnowBack, same style series. White background with a very pale sage green (#E8F1EC) rounded shape behind the lower half. Top: KnowBack logo and the word "KnowBack". Headline in two lines: "Learn together," in near-black (#111111) and "in your language." in deep green (#30694F). Lower centre: a modern smartphone, front view, notch, soft shadow, plain solid light grey screen (placeholder, draw nothing on it). Beside the phone, not covering the screen, two small white rounded chat-bubble cards with soft shadows, each with a plain coloured circle avatar (no faces), grey text lines and a small heart icon; one bubble shows a small deep green translate symbol (two arrows). Minimal, flat, crisp, high resolution. No other text, no flags.
```

**横版 16:9**
```
Horizontal 16:9 app promotion poster for a learning app called KnowBack, same style series. White background. Left: KnowBack logo and name, headline "Learn together," (near-black #111111) / "in your language." (deep green #30694F). Right: a modern laptop with a plain solid light grey screen (placeholder, draw nothing on it), with three white rounded chat-bubble cards floating around it: plain coloured circle avatars (no faces), grey text lines, small heart and comment icons, and one small deep green translate symbol. Minimal, flat design with soft shadows, crisp, high resolution. No other text, no flags.
```

## 06 · 10 languages. Private by default.（截图 06-languages）

**竖版 9:16**
```
Vertical 9:16 app promotion poster for a learning app called KnowBack, same style series. White background with a very pale sage green (#E8F1EC) rounded shape behind the lower half. Top: KnowBack logo and the word "KnowBack". Headline in two lines: "10 languages." in near-black (#111111) and "Private by default." in deep green (#30694F). Lower centre: a modern smartphone, front view, notch, soft shadow, plain solid light grey screen (placeholder, draw nothing on it). Beside the phone, not covering the screen: on one side a soft deep green rounded shield with a small white padlock, on the other a simple globe icon with a thin green outline. Minimal, flat, crisp, high resolution. No other text, no flags.
```

**横版 16:9**
```
Horizontal 16:9 app promotion poster for a learning app called KnowBack, same style series. White background. Left: KnowBack logo and name, headline "10 languages." (near-black #111111) / "Private by default." (deep green #30694F). Right: a modern laptop with a plain solid light grey screen (placeholder, draw nothing on it), a deep green rounded shield with a white padlock on one side and a thin-outlined green globe on the other, both floating with soft shadows. Minimal, flat design with soft shadows, crisp, high resolution. No other text, no flags.
```

## 尺寸参考

- 竖版：9:16，例如 1080×1920 或 1440×2560。应用商店截图（Google Play 1080×1920；App Store 6.7 英寸 1290×2796）。
- 横版：16:9，例如 1920×1080；Google Play 宣传横幅是 1024×500（约 2:1），用横版图裁切即可。
