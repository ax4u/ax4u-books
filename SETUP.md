# AX4U Books — Setup

An AI picture-book service: enter a topic → pay once (Polar) → OpenAI or Gemini
generates the story text and illustrations → download the finished book as a PDF.
Auth and data live in Supabase.

> **Runs with zero config.** Any service without keys falls back to a mock, so
> you can demo the entire flow (login → topic → "payment" → generation → PDF)
> immediately. Fill in keys below to make each part real.

## Quick start (mock mode)

```bash
npm install
cp .env.example .env.local   # optional — defaults already work
npm run dev
```

Open http://localhost:3000:

1. **시작하기** → log in with any email (mock auth, no password).
2. **새 그림책 만들기** → enter a topic and options.
3. Click create → mock checkout instantly "pays".
4. Watch pages generate (mock text + procedural illustrations), then **PDF 다운로드**.

---

## Going live

### 1. Supabase (auth + database)

1. Create a project at https://supabase.com.
2. In **SQL Editor**, run [`supabase/schema.sql`](supabase/schema.sql)
   (creates the `books` table, RLS policies, and a private `book-assets` bucket).
3. **Project Settings → API**, copy into `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only — required so the Polar webhook can
     write books while bypassing RLS)
4. **Authentication → Providers → Email**: enable email. For the smoothest flow,
   turn **off** "Confirm email" (otherwise sign-up requires clicking a link
   handled by `/auth/callback`).

Auth uses `@supabase/ssr`; session refresh happens in `src/proxy.ts` (Next.js 16
renamed `middleware` → `proxy`).

### 2. Polar (one-time payment per book)

1. Create an organization at https://polar.sh (use **Sandbox** first).
2. Create a **Product** (one-time price) and copy its ID → `POLAR_PRODUCT_ID`.
3. Create an **Organization Access Token** → `POLAR_ACCESS_TOKEN`.
4. Set `POLAR_SERVER=sandbox` (switch to `production` when ready).
5. For local webhook testing, use the Polar CLI:
   ```bash
   npm run polar:install   # installs the official `polar` binary
   npm run polar:login     # choose Sandbox first
   npm run dev
   npm run polar:listen
   ```
   `polar:listen` forwards events to
   `http://localhost:3000/api/webhooks/polar` by default. If your app runs
   somewhere else, set `POLAR_FORWARD_URL` first:
   ```bash
   POLAR_FORWARD_URL=http://localhost:3001/api/webhooks/polar npm run polar:listen
   ```
   When `polar:listen` connects, it prints a `Secret`. Copy that value into
   `.env.local` as `POLAR_WEBHOOK_SECRET`, then restart `npm run dev`. If you
   use both a dashboard webhook and CLI listen, comma-separate both secrets:
   `POLAR_WEBHOOK_SECRET=dashboard_secret,cli_listen_secret`.
6. For production or preview deployments, create a **Webhook** in the Polar
   dashboard:
   - URL: `https://YOUR_DOMAIN/api/webhooks/polar`
   - Secret → `POLAR_WEBHOOK_SECRET`
   - Events: `order.paid`, `checkout.updated`, and `order.created`

Flow: creating a book opens a Polar checkout with the `bookId` in metadata. On
`order.paid` (or a successful `checkout.updated`) the webhook marks the book
paid and starts generation via `after()`. The book page also has a manual
**생성 시작/다시 시도** button as a fallback if the webhook is delayed.

The npm scripts above mirror the Polar CLI documented at
https://github.com/polarsource/cli. The official install script installs a
global `polar` binary and resets the local Polar token cache, so rerun
`npm run polar:login` if needed after installing/updating.

### 3. AI provider (text + images)

Set `AI_PROVIDER` to `openai` or `gemini`. The app uses that provider when its
key is present, otherwise falls back to the other, then to mock.

**OpenAI** — https://platform.openai.com
```
OPENAI_API_KEY=sk-...
OPENAI_TEXT_MODEL=gpt-5.1
OPENAI_IMAGE_MODEL=gpt-image-2
```

**Gemini** — https://aistudio.google.com/apikey
```
GEMINI_API_KEY=...
GEMINI_TEXT_MODEL=gemini-2.5-flash
GEMINI_IMAGE_MODEL=gemini-3-pro-image-preview   # Nano Banana 2
```

Model names are env-configurable so you can adjust as the providers update them.

### 4. Korean/Japanese PDF text

pdf-lib's built-in fonts are Latin-only. Drop a Unicode `.ttf`/`.otf` (e.g.
Noto Sans KR) into `public/fonts/` — it's embedded automatically. See
[`public/fonts/README.md`](public/fonts/README.md).

---

## Architecture

| Concern        | Location                                  |
| -------------- | ----------------------------------------- |
| Env + mock flags | `src/lib/env.ts`                        |
| Auth (real + mock) | `src/lib/auth.ts`, `src/proxy.ts`     |
| Data store     | `src/lib/books/` (Supabase + in-memory)   |
| AI providers   | `src/lib/ai/` (openai / gemini / mock)    |
| Generation     | `src/lib/ai/storybook.ts`                 |
| Payments       | `src/lib/polar/`, `app/api/webhooks/polar`|
| PDF            | `src/lib/pdf/generate.ts`, `app/api/books/[id]/pdf` |
| Pages          | `app/` (landing, login, dashboard, create, books/[id]) |

## Notes & next steps

- Illustrations are stored as base64 data URLs inside the book record. For
  production, upload them to the `book-assets` Supabase Storage bucket and store
  URLs instead (keeps DB rows small).
- Long generation runs inside `after()`. On serverless, raise `maxDuration` or
  move generation to a queue/background worker for many pages.
