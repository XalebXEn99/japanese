# 化 · ka · change

A functional, responsive Japanese study app for personal, noncommercial use. GitHub Pages hosts the frontend at **https://japanese.thestone.co.za**. Accounts use Neon Managed Auth, and authenticated progress sync uses Neon's managed Data API in the existing London project. No additional application host is required.

## What works

- Hiragana and katakana charts, voiced sounds, combinations, and focused practice.
- N5–N1 vocabulary libraries with categories, kana readings, romaji, English meanings, search, and flashcards.
- Kanji readings, meanings, animated stroke order, and mouse/touch handwriting feedback.
- 100 expanded grammar lessons with 300 examples, 500 practice questions, and the supplied Tae Kim reference PDF.
- Multiple-choice reading/meaning quizzes, typed answers, and listening quizzes with corrections and mistake review.
- Sequential units with an **80%** pass requirement; level assessments unlock the following level. Free practice is never locked.
- Spaced-repetition scheduling, due reviews, reading-support preferences, local persistence, and validated progress export/import.
- Email/password signup, login, logout, session restoration, password-reset UI, and authenticated cross-device progress sync.
- Daily level-aware sentence/listening challenges, optional Japanese microphone input, streaks, and review graphs.
- Light, dark, and seasonal appearance with a three-position icon toggle in the header and Settings. Seasonal mode follows Japan's calendar and your device's local time: night 00:00–06:00, day 06:00–18:00, evening 18:00–24:00.
- 24 individually generated landscapes: two scenes per season, each with day, evening, and night art. Original PNGs are preserved at 1536×1024 or approximately 1672×940; none are cropped from image sheets or upscaled. Scenes crossfade every minute, with pause/next controls and reduced-motion support.
- Opt-in rain, stream, white noise, and pentatonic chimes generated locally with Web Audio; adjustable volume, play/pause, and sound changes during playback. The popup closes on outside click or Escape without stopping the audio. No autoplay.
- Signed-in accounts show a name initial in the header, with an accessible full-name label.
- Centered account dialogs and a docked footer for sources/licenses and icon-only scenery controls.

### Content coverage

| Level | Vocabulary | Kanji | Grammar lessons |
|---|---:|---:|---:|
| N5 | 674 | 84 | 20 |
| N4 | 630 | 169 | 20 |
| N3 | 1,659 | 387 | 20 |
| N2 | 1,778 | 398 | 20 |
| N1 | 3,070 | 1,345 | 20 |

Also included: 310 kana entries and 2,548 stroke diagrams.

**These are unofficial study-level assignments, not a complete or official JLPT syllabus.** The 100 grammar lessons are a starting curriculum, not exhaustive N1 preparation. Tae Kim's full supplied guide is accessible separately. Level assessments are app checkpoints, not official exams.

Handwriting feedback measures similarity to ordered reference strokes. It is not unrestricted handwritten-character recognition. Speech uses the browser Web Speech API and requires an installed Japanese voice; there is no paid speech service or exposed API key. Devices without a Japanese voice show an explicit error. There are no bundled native-speaker word recordings.

## Run locally

Use Node.js 22 and npm. The current `.env.local` is configured for the linked Neon **main** branch. It is ignored by Git.

```powershell
npm ci
npm run db:setup
npm run dev
```

Open **http://127.0.0.1:5173**. Only Vite is needed: the browser connects directly to Neon Auth and the Data API. Guest learning works without cloud configuration.

For a fresh environment, provision Auth and the Data API as below, then pull the same branch's `postgres`, `auth`, and `data-api` environment into `.env.local`. Setup uses `DATABASE_URL_UNPOOLED` for its transactional schema migration and writes both public frontend aliases. Set `NEON_ENV_FILE` to use another ignored environment file without changing the linked branch.

Never put `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, passwords, or admin credentials in a `VITE_*` variable. The browser only needs the public Auth and Data API HTTPS URLs.

## Validate

```powershell
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

On Windows, an installed Edge browser can be used instead of downloading Chromium:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npm run test:e2e
```

Tests cover answer normalization, scheduling, conflict merges, handwriting metrics, curriculum integrity, legacy API authentication/ownership/concurrency, seasonal asset dimensions, daily challenges, and real-browser learning/appearance flows.

An optional live account test creates a uniquely named temporary user, verifies session restoration and cross-browser sync, then deletes that user and its progress. It requires the authenticated Neon CLI and `.env.local`; Playwright starts Vite automatically:

```powershell
$env:RUN_LIVE_AUTH = '1'
npm run test:e2e -- live-auth --workers=1
```

To verify the deployed site instead:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
$env:PLAYWRIGHT_BASE_URL = 'https://japanese.thestone.co.za'
$env:RUN_LIVE_AUTH = '1'
npm run test:e2e -- live-auth --workers=1
```

The live test uses the site's deployed Auth/Data API URLs. Private local database configuration and Neon CLI access are still needed to clean up its isolated test account and progress. When testing another branch, set both `NEON_ENV_FILE` and `LIVE_AUTH_BRANCH` to that branch's configuration.

## Deploy

### 1. Neon Auth and managed Data API

Use the existing project and branch. Auth is declared in `neon.ts`. Provision the Data API with automatic grants disabled; never expose all public tables:

```powershell
neon data-api create --branch main --database neondb --auth-provider neon_auth --add-default-grants=false --db-max-rows 1 --db-schemas public --server-cors-allowed-origins 'http://127.0.0.1:5173,http://localhost:5173,https://japanese.thestone.co.za'
neon env pull --branch main --file .env.local -s postgres -s auth -s data-api
npm run db:setup
neon data-api refresh-schema --branch main --database neondb
```

Run `create` only if `neon data-api get --branch main` reports that the service does not exist. `server/schema.sql` and `server/data-api.sql` are applied in one transaction. Existing rows and account IDs are preserved.

The database derives ownership from the verified JWT, enforces per-user row-level security, and grants only the columns needed for reading and saving progress. Browser clients cannot select an owner, change owners, delete rows, or access another account. Revision checks prevent stale writes overwriting newer progress. Anonymous table access is not granted.

The older Node API files are retained for compatibility but are not used by the frontend and do not need deployment.

### 2. Frontend on GitHub Pages

Use **this directory as the root of a dedicated GitHub repository**. The Pages workflow must be at that repository's `.github/workflows/pages.yml`; nesting this whole project below a parent repository will not activate it. Do not accidentally publish unrelated files from a parent/home directory.

1. In GitHub repository **Settings → Pages**, choose **GitHub Actions**.
2. Set repository **Actions variables**:
   - `VITE_NEON_AUTH_URL`: the public production Neon Auth URL.
   - `VITE_NEON_DATA_API_URL`: the public production Data API URL, including `/neondb/rest/v1`.
3. Set the Pages custom domain to `japanese.thestone.co.za`.
4. Add a DNS **CNAME** for `japanese` pointing to `<repository-owner>.github.io`, not a repository URL.
5. After DNS verification, enable **Enforce HTTPS**.
6. Push to `main` or run the Pages workflow manually.

The bundled `public/CNAME` preserves your custom domain. Hash-based routes work on static hosting without server rewrites. The build defaults to `/` for the custom domain. Without a custom domain, build with `VITE_BASE_PATH=/your-repository/`.

The production frontend origin is already registered as trusted in main's Neon Auth configuration. Add preview origins explicitly before using them. Neon production email delivery may require custom SMTP; test password-reset delivery after configuring it.

**Deployment and DNS are not performed by the local build.** Verify hosted signup/login, sync, password-reset email, and Japanese audio on your actual phone after deployment.

## Progress behavior

Guest data and each account's cached data are stored separately. Import guest progress explicitly in Settings after signing in. Export a backup before clearing browser data.

Sync conflicts merge the latest card reviews, preserve best unit scores, and combine study dates. Answer counters retain the larger device total instead of summing possibly duplicated snapshots. This avoids duplicate counting but can undercount simultaneous independent sessions. Local reset does not delete cloud history.

Daily challenges count the first submission per local calendar day. Topics are revealed after answering, not used as hints. Microphone input is optional, requires browser support and permission, and may use your browser vendor's speech service. The transcript can be edited before submission.

## Content and licenses

See [LICENSE-CONTENT.md](LICENSE-CONTENT.md) and the in-app Sources page. Content retains its source-specific licenses:

- OpenJLPT/EDRDG dictionary content: attribution and share-alike requirements.
- KanjiVG: CC BY-SA 3.0.
- Tae Kim's supplied guide: CC BY-NC-SA 3.0 US.

Keep the noncommercial guide and derived content out of monetized distributions unless separately permitted. The app is not affiliated with Obenkyo, LingoDeer, Tae Kim, or the JLPT.

Generated content is checked in, so ordinary builds do not download external corpora. To rebuild it from its pinned sources:

```powershell
npm run content:build
npm test
```

Thematic categories use conservative exact English-gloss matches (food, family, travel, time, home, work, nature, health), with part-of-speech categories for remaining words. To reclassify the bundled data without network downloads, run `npm run content:build -- --categories-only`.
