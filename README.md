# KnowBack (知回)

**What you ask comes back.** KnowBack turns the questions you ask AI into knowledge cards and brings them back for review right before you would forget them, with a squirrel named Backy to keep you going.

- **Live demo:** https://zhihui.onrender.com (phone layout; works on desktop too)
- **Video:** https://youtu.be/bDHABwyX9Cw
- 中文说明: [README.zh-CN.md](README.zh-CN.md)

## Features

- **Ask anything** by typing, voice or photo. The AI explains it clearly.
- **Automatic knowledge cards.** After each answer, the key idea, an everyday example and your original question become a card, filed under a subject (Coding, Health, Finance…). No note-taking.
- **Spaced review.** A daily stack of cards, coloured by subject. Review each one as a flashcard, a multiple-choice question, or an "explain it in your own words" prompt that the AI grades.
- **See what you know.** Memory status (strong / steady / fading), a knowledge graph of related ideas, and a mind map for every card.
- **Backy the squirrel.** At most two gentle push reminders a day (09:00 when cards are due; 20:00 only if you have not reviewed yet). Pine cones, a growing beanstalk, outfits and a learning calendar.
- **Friends, a learning square and 10 interface languages** (简体中文, 繁體中文, English, 日本語, 한국어, Bahasa Melayu, Español, Français, Português, Deutsch).

## How it works

Reviews are scheduled with an independent implementation of **FSRS-5** ([`fsrs.js`](fsrs.js)). Recall probability after $t$ days for a memory of stability $S$ follows the power forgetting curve

$$R(t, S) = \left(1 + \tfrac{19}{81}\cdot\tfrac{t}{S}\right)^{-0.5}$$

and the next review is set where $R$ falls to the desired retention (90% by default, adjustable in the review plan). Stability and difficulty are rebuilt from each card's review history, so nothing extra is stored.

**Privacy first.** Learning data stays in the browser by default. Cloud sync is end-to-end encrypted with the user's own passphrase. For push reminders, the device plans its own reminder times and sends the server only times and card counts, never card content.

## Tech stack

| Part | Built with |
|---|---|
| App | Plain JavaScript ES modules, HTML, CSS. A PWA with a service worker. No framework, no build step |
| Server | Node.js 22+ ([`server.mjs`](server.mjs)), no runtime dependencies. Model calls are proxied, and keys stay on the server |
| Accounts & data | Supabase (PostgreSQL, row-level security, security-definer functions, `pg_cron`) |
| AI | Zhipu AI GLM-4-Flash as the built-in free model; users can connect their own provider |
| Push | Web Push (VAPID + aes128gcm) implemented with Node's `crypto` ([`webpush.mjs`](webpush.mjs)) |
| Hosting | Render (auto-deploys from this repository) |

## Run it locally

Requires Node.js 22 or later. There are no packages to install.

```sh
npm run check   # syntax check
npm test        # ~186 tests (Node's built-in runner, includes local HTTP tests)
npm start       # http://127.0.0.1:4174
```

The app needs an account service to sign in. To try it without one, run the isolated test server, which includes a fake account service (any email; the code is `123456`) and fixed test answers instead of a real model:

```sh
node tests/browser-fixture.mjs   # http://127.0.0.1:4175, phone layout at /m/
```

For a real setup, put the settings in environment variables or in a git-ignored `server.local.json`: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (the public key only), and optionally `ZHIPU_API_KEY` (free model) and `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` / `PUSH_SECRET` (push reminders). Run [`cloud-schema.sql`](cloud-schema.sql) in Supabase first. More detail: [cloud-setup.md](cloud-setup.md) and [docs/DEPLOY_RENDER.md](docs/DEPLOY_RENDER.md).

## Project map

| Path | What it is |
|---|---|
| `app.js`, `chat-ui.js`, `review-ui.js`, `knowledge-ui.js` | App shell, ask flow, review session, knowledge library |
| `review-store.js`, `fsrs.js`, `reminders.js` | Review queue, FSRS scheduling, reminder planning |
| `server.mjs`, `model-service.mjs`, `knowledge-service.mjs`, `push-service.mjs` | Server, model proxy, card extraction, push sending |
| `cloud-schema.sql` | Supabase tables and functions (re-runnable) |
| `i18n/` | Catalogs for the 8 languages beyond Chinese and English |
| `illustrations/`, `scenes/` | Art used by the app |
| `tests/` | Automated tests and the isolated QA server |
| `docs/` | Requirements, architecture and deployment notes (mostly in Chinese) |

## AI use and credits

- **Claude Code** (Anthropic): AI coding assistant used throughout development. The author designed the product, features and interface, reviewed every change and tested on a phone; Claude wrote most of the code and tests under that direction.
- **Zhipu AI GLM-4-Flash**: the in-app free model for answers, card extraction, quiz questions and grading.
- **LibTV** (image models such as Doubao Seedream): the Backy mascot, outfits, badges and most scene illustrations. Some home-scene photos are from Unsplash under the Unsplash License; sources are listed in [docs/BACKGROUNDS.md](docs/BACKGROUNDS.md).
- **FSRS** scheduling formulas and default parameters come from the open-source [open-spaced-repetition](https://github.com/open-spaced-repetition) project (MIT). This repository contains an independent implementation.
- **[jsQR](https://github.com/cozmo/jsQR)** (Apache-2.0) for scanning friend QR codes; see [`vendor/`](vendor/).
- **Smiley Sans** font (SIL Open Font License); see [`fonts/SmileySans-OFL.txt`](fonts/SmileySans-OFL.txt).

© 2026 KnowBack. All rights reserved unless stated otherwise above.
