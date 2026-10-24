# Family Tree Culture Web (Ургийн бичиг)

Mongolian families build their family tree, archive photos / audio stories / documents, and learn clan history and customs.

## Stack
| Area | Choice |
|---|---|
| Monorepo | Nx 23, **bun** (single root `package.json`), jest + ts-jest, TypeScript 6 strict |
| Web | `apps/family-tree-web` — Next.js 16 App Router, Tailwind v4, shadcn-style UI (`src/components/ui`), next-intl (mn default, en), React Flow + elkjs, TanStack Query, react-hook-form + zod |
| API | `apps/family-tree-service` — Hono on Cloudflare Workers, D1 + Drizzle ORM, R2, Cron Triggers, rate-limit bindings |
| Auth | Clerk (web `@clerk/nextjs`, worker verifies JWT with `@clerk/backend`), webhook user sync |
| Email / push | Resend REST API; Web Push via `@block65/webcrypto-web-push` (WebCrypto, Workers-safe) |
| Shared | `libs/shared/types` (`@super-project/types`: zod schemas + DTO types), `libs/shared/genealogy` (`@super-project/genealogy`: pure logic — dates, family graph, kinship terms, layout graph, anniversaries, clan dataset, names) |
| Hosting | All Cloudflare: web via `@opennextjs/cloudflare`, API as its own Worker |

## Commands
```bash
bun install
bunx nx run family-tree-service:db:reset     # local D1: migrate + seed demo data (idempotent)
bunx nx dev family-tree-service              # API on :8787 (wrangler dev, --test-scheduled)
bunx nx dev family-tree-web                  # web on :3000
bunx nx run-many -t test lint typecheck      # all checks
bunx nx run family-tree-service:db:generate  # after editing src/db/schema.ts → new migration
bunx nx run family-tree-service:db:migrate   # apply locally (-c production for remote)
bunx nx run family-tree-web:preview          # OpenNext build + run in workerd locally (port 8787 — stop the API first, or run `wrangler dev --port 8790` in the app dir)
bunx nx deploy family-tree-service / family-tree-web   # production (ask first!) — order: see "Deploy (workers.dev)"
```
Trigger the reminder job locally: `curl -X POST -H 'Authorization: Bearer dev:user_demo_admin' localhost:8787/v1/dev/run-reminders`
or `curl "localhost:8787/__scheduled?cron=0+*+*+*+*"` (runs only users whose local hour matches).

## Local auth without Clerk keys (dev mode)
- Worker var `AUTH_MODE=dev` (default env only; production env is `clerk`) accepts `Authorization: Bearer dev:<userId>`.
- The web app runs in dev-auth mode whenever `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is empty: `/sign-in` shows a demo-user picker
  (`user_demo_admin` / `_editor` / `_viewer` / `_outsider` from the seed) and stores the choice in a cookie.
- Never set `AUTH_MODE=dev` in production.

## Layout
```
apps/family-tree-service/
  wrangler.jsonc            D1 (DB), R2 (MEDIA), rate limits, hourly cron; env.production
  src/index.ts              Hono app, error mapping, scheduled() handler
  src/db/schema.ts          Drizzle schema (source of truth) → migrations/ via drizzle-kit
  src/routes/*.ts           trees, invitations, persons, relationships, events, media, blob, clans, me, webhooks
  src/lib/access.ts         computeAccess(): the ONLY place deciding view/edit/manage
  src/lib/privacy.ts        redaction of living persons for non-members, contact visibility
  src/lib/storage.ts        R2 presigned S3 URLs (if R2_* keys) or HMAC-signed Worker URLs (local)
  src/cron/reminders.ts     hourly reminders (email + push), dedup via reminders_sent
  scripts/seed.ts           demo data + clans → .seed/*.sql
apps/family-tree-web/
  src/app/[locale]/...      pages (see "Routes" below)
  src/i18n/                 next-intl routing/request/navigation
  messages/{mn,en}.json     ALL UI strings
  content/{customs,guide}/  MDX culture content (mn + en)
  src/components/tree/      React Flow canvas, nodes, layout (elkjs), add-relative dialog, person panel
  src/components/{media,person,culture,dashboard,auth,forms,ui}/
  src/lib/                  api client, auth (Clerk | dev), react-query hooks, upload pipeline, push
  public/sw.js              Web Push service worker
libs/shared/types, libs/shared/genealogy
```

## Data model (D1, `src/db/schema.ts`)
- `users` (id = Clerk user id), `trees` (privacy family|friends|public, owner, rootPersonId, clanId),
  `tree_members` (PK tree+user, role admin|editor|viewer, personId = "this is me"), `invitations` (token, kind email|link,
  role, personId, expiresAt, maxUses/useCount, revokedAt), `friend_access` (pending|approved|rejected).
- `persons`: names (given, patronymic, clan name + `clan_id`, maiden, previous[], nicknames[], Mongol script), gender,
  ethnicity, **partial dates** as `birth_year/_month/_day/_qualifier` (qualifier exact|about|before|after|estimated),
  places as JSON `{text,country,aimag,sum,bag}`, death/burial/cause/memorial, residence, education[], workplaces[],
  military, awards[], achievements, hobbies, favorites, biography, quote, message to descendants, contacts (+visibility),
  profile photo, `user_id` (claimed account; NULL = unregistered person).
- `person_custom_fields` (key/value per person), `parent_child` (type biological|adoptive|step|foster|unknown, unique pair),
  `partnerships` (any number per person; status married|divorced|widowed|partner|unknown; start/end partial dates; sort_order).
- `events` (typed life facts, partial date, place), `albums`, `media` (kind photo|video|audio|document, r2_key, thumb_key,
  status pending|ready, multipart upload_id), `media_persons` (tags), `stories` (audio media and/or text, per person).
- `audit_log` (entity, action, field diff JSON), `notification_prefs`, `push_subscriptions`, `reminders_sent` (unique per
  user+kind+ref+occurrence+daysBefore+channel), `clans` (seeded from `libs/shared/genealogy/src/lib/clans.ts`).
- Half/step siblings are **derived** from parent links (`FamilyIndex.siblings`), never stored.

## Conventions & decisions
- All authorization happens in the API (`requireTree(db, treeId, userId, 'view'|'edit'|'manage')`). The UI only hides buttons.
- Non-members (public/friends viewers) never get exact birth dates, birthplace, residence, contacts or custom fields of
  living persons. Contacts default to `private` (admins + the person themselves).
- A person's linked account may edit their own profile even as a viewer.
- D1 limit: max 100 bound parameters per statement → multi-row inserts are one statement per row inside `db.batch`.
- Every mutation writes `audit_log` in the same `db.batch` when possible.
- Invitations: link invites (QR) may be multi-use; email invites are single-use. Tokens are 192-bit random.
- Uploads: browser → R2 directly via presigned PUT (multipart above 90 MB, 20 MB parts). Without R2 S3 keys the same flow uses
  signed Worker URLs into the R2 binding, so local dev needs no keys. Thumbnails are made in the browser (canvas → webp).
- Reminders cron runs hourly; a user is processed when it's `REMINDER_LOCAL_HOUR` (8) in their timezone (default Asia/Ulaanbaatar).
- Culture content lives in the repo as MDX (`apps/family-tree-web/content`) and is statically rendered; clan pages render
  from the shared clan dataset.
- Kinship terms follow common modern Mongolian usage; regional variants exist (documented in the guide content).
- Web uses `src/middleware.ts` (Edge runtime) instead of Next 16 `proxy.ts`: OpenNext warns that Node.js middleware is
  experimental on Cloudflare. Next prints a deprecation notice for `middleware`; revisit when OpenNext supports proxy.ts.
- i18n request config reads the locale via `next/root-params`, which keeps the culture hub statically prerendered.
- OpenNext incremental cache = R2 (`NEXT_INC_CACHE_R2_BUCKET` → bucket `family-tree-web-cache`).
- The tree canvas is loaded client-only (`next/dynamic`, ssr:false) to keep React Flow + elk out of the server bundle
  (web Worker ≈1.65 MB gzip, API Worker ≈0.24 MB gzip). elk runs in a Web Worker (`public/elk-worker.min.js`, copied at build).
- Messages are typed against `messages/en.json` (`global.d.ts`), so a missing key fails `typecheck`; keep mn/en keys identical.
- Tree layout: persons + small "union" nodes per couple, elk `layered` + NETWORK_SIMPLEX (keeps couples on one row).
  400 people ≈ 2 s to first render; very wide trees rely on collapse/focus modes.
- Removed unused root deps `graphql`, `graphql-yoga` (the service is now Hono). Next upgraded 16.1 → 16.4.2 because
  `@opennextjs/cloudflare@1.20` requires next ≥ 16.4.1.
- Git: this project lives inside a larger `~/Documents` repo; commits only stage `My projects/super-project/**`
  (lowercase on disk — the old `Super-project` index entries were renamed).

## Secrets / keys
Never commit or print secret values. Gitignored secret files:
- `apps/family-tree-service/.dev.vars` — local Worker secrets (Clerk, Resend, VAPID, BLOB_SIGNING_SECRET; `AUTH_MODE`).
  **No `R2_*` keys locally**: uploads then go through signed Worker URLs into the local R2 simulation. (With R2 keys,
  `wrangler dev` would presign to the real bucket while the `MEDIA` binding stays local → `complete` can't see the file.)
- `apps/family-tree-service/.prod-secrets` — production-only values (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`).
- `apps/family-tree-web/.env.local` (local dev) and `.env.production.local` (production build: workers.dev URLs + Clerk keys).
- `scripts/push-prod-secrets.sh api|web|all|check` (gitignored) — reads the files above and pipes JSON to
  `wrangler secret bulk`. Refuses if the Worker isn't deployed yet (bulk would create an empty draft Worker).
  API secrets: CLERK_SECRET_KEY, CLERK_JWT_KEY, RESEND_API_KEY, VAPID_PUBLIC_KEY/PRIVATE_KEY/SUBJECT, BLOB_SIGNING_SECRET, R2_*.
  Web secret: CLERK_SECRET_KEY. CLERK_WEBHOOK_SECRET is set separately after the Clerk webhook exists.
- Templates: `.dev.vars.example`, `apps/family-tree-web/.env.example` (placeholders only — never real keys).

## Web production build (important)
- Nx loads the app's `.env.local` into every task's environment and Next never overrides set variables, so a plain
  `nx` OpenNext build would inline the *local* `NEXT_PUBLIC_*` values. `apps/family-tree-web/scripts/cf.mjs` drops those
  keys first (→ `.env.production.local` wins), runs `opennextjs-cloudflare build`, then `scripts/scrub-open-next-env.mjs`.
- OpenNext compiles all `.env*` files into `.open-next/cloudflare/next-env.mjs` (bundled into the Worker); the scrub keeps
  only `NEXT_PUBLIC_*`, so CLERK_SECRET_KEY reaches the Worker only as a secret. Targets `cf-build`, `deploy` and the
  `deploy`/`upload` package scripts all go through `cf.mjs`. (`preview` is local-only and uses `.env.local`.)

## Production (workers.dev, no custom domain yet)
- Account subdomain `erkhes-labs` → API `https://family-tree-service.erkhes-labs.workers.dev`,
  web `https://family-tree-web.erkhes-labs.workers.dev` (`workers_dev: true` in both wrangler files).
- API `env.production`: AUTH_MODE=clerk (never dev), WEB_ORIGIN/API_ORIGIN = the URLs above,
  EMAIL_FROM = `onboarding@resend.dev` (Resend test sender: delivers only to the Resend account owner until a domain is verified).
- D1 `family-tree` id 1a6d833c-4906-4858-8a42-b2aa480c1888 (migrated, clans seeded). R2 `family-tree-media` (CORS: web
  origin + http://localhost:3000, GET/PUT/HEAD, headers *, expose ETag) and `family-tree-web-cache` exist.
- Clerk: Development instance for now (works on workers.dev). Dashboard to-dos: session-token claims
  `{"email":"{{user.primary_email_address}}","name":"{{user.full_name}}","image":"{{user.image_url}}"}`; after deploy a webhook
  to `https://family-tree-service.erkhes-labs.workers.dev/v1/webhooks/clerk` (user.created/updated/deleted), then
  `cd apps/family-tree-service && bunx wrangler secret put CLERK_WEBHOOK_SECRET --env production`.

### Deploy (workers.dev) — in this order
```bash
scripts/push-prod-secrets.sh check            # validate values (prints names only)
bunx nx deploy family-tree-service            # 1. API (typecheck + test first)
scripts/push-prod-secrets.sh api              # 2. API secrets
bunx nx deploy family-tree-web                # 3. web (cf.mjs: build → scrub → deploy, populates R2 cache)
scripts/push-prod-secrets.sh web              # 4. web CLERK_SECRET_KEY (web sign-in pages need it)
curl https://family-tree-service.erkhes-labs.workers.dev/v1/health
```
Custom domain later: add `routes` (custom_domain) to both wrangler files, update WEB_ORIGIN/API_ORIGIN, the R2 CORS
origins, `.env.production.local`, a Clerk Production instance (pk_live) and a verified Resend domain.
