# Home scene backgrounds

The phone home page can show a different scene behind the greeting (sheet: picture button on the home scene). Only the home scene changes; the pet room keeps its own picture. Catalog: `scenes.js`. Files in `scenes/`: 900×1600 WebP (centre crop) and 180×320 `-thumb` WebP. Not precached by the service worker. Original files are in the untracked `store-assets/scenes-src/`.

## Generated for 知回 in LibTV (Seedream 5.5, 9:16), project "KnowBack 界面插画"

Made for this app; no third-party rights. Prompts kept the top half calm and slightly muted so the white text stays readable, with no people's faces, text or logos.

| id | Name | LibTV node |
|---|---|---|
| desk (day) | 书桌 | i-KzweionCSL (existing `illustrations/home-desk.webp`) |
| desk-night | 书桌 · 夜 | i-3di2b1yU8b (from the desk) |
| fresh-day / fresh-night | 窗边阳台 | i-JIxfJsITJZ / i-FIyyB8MAY0 |
| pixel-day / pixel-night | 像素小书房 | i-1UnuCf5uzO / i-Eg5InWbjiC |
| game-day / game-night | 森林小屋 | i-yHhW1GGUqt / i-dlvKo91ONj |
| sky-day / sky-night | 云朵晴空（2026-11-15，以森林小屋为画风参考；夜晚版由白天版改成） | i-fQcIE1TGJ9 / i-AWVUveNcy6 |
| street-day | 街角咖啡 | i-QaWxMq4dYo (photo style, no people) |
| portrait-day | 窗边阅读 | i-CKUJRGiRh6 (photo style, seen from behind, no face) |

## Photos from Unsplash

Free to use, including commercially, under the [Unsplash License](https://unsplash.com/license). Attribution is not required; sources are kept here. Restored from the earlier background feature (commit 3faeb1b~1).

| id | Name | Source |
|---|---|---|
| lake | 湖光山色 | https://unsplash.com/photos/mypcmUsi_5c |
| forest | 林间光束 | https://unsplash.com/photos/sp-p7uuT0tw |
| sea | 黄昏海面 | https://unsplash.com/photos/-IMlv9Jlb24 |
| neon-street | 霓虹雨巷 (night of 街角咖啡) | https://unsplash.com/photos/4pTY4ty7jXM |
| neon-city | 未来城市 | https://unsplash.com/photos/dA0-qxdbyyY |
| silhouette | 紫色天空 (night of 窗边阅读) | https://unsplash.com/photos/nXo2ZsKHTHg |

## Supplied by the product owner

| id | Name | Source |
|---|---|---|
| anime-day / anime-night | 晴空与夜色 | AI-generated images provided by the product owner, 2026-11-02 |

## Not used, on purpose

Stock photos where a person's face can be recognised: free licences such as Unsplash and Pexels do not come with model releases, so commercial use is risky. Portraits here are generated from behind or are silhouettes.
