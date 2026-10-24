# PROGRESS

Checklist for the Family Tree Culture Web build. Tick items as they land so work can resume in a new session.

## Phase 1 — Foundation
- [x] Repo audit, baseline commit
- [x] CLAUDE.md, PROGRESS.md
- [x] Shared libs: `@super-project/types` (zod), `@super-project/genealogy` (pure logic + tests)
- [x] Service → Hono Worker, wrangler config (D1, R2, cron, rate limits)
- [x] Drizzle schema + migrations + seed (demo tree ~40 people)
- [x] Auth: Clerk JWT verify in Worker, dev-auth fallback, svix webhook sync
- [x] Trees CRUD, roles, privacy, invitations (email + link + QR), friend access
- [x] Web: Tailwind v4 + shadcn-style UI, next-intl (mn/en), Clerk, OpenNext, landing page
- [x] Nx targets: dev, build, test, lint, typecheck, db:migrate, deploy

## Phase 2 — Tree builder + media
- [x] React Flow canvas + elkjs layout, add father/mother/partner/child/sibling
- [x] Collapse/expand, focus, search, minimap, fit view, 300+ nodes
- [x] Profile panel + full profile page, custom fields, claim-a-person, audit log
- [x] R2 uploads (presigned single + multipart), thumbnails, albums, tagging
- [x] Browser audio recorder (MediaRecorder) + stories

## Phase 3 — Culture, timeline, reminders
- [x] Culture hub MDX (mn/en): customs, genealogy guide, nine generations
- [x] Clans database + pages, person→clan link
- [x] Kinship "what do I call them?" helper
- [x] Timeline with jubilees
- [x] Cron reminders (Resend + Web Push), notification prefs, dedupe

## Phase 4 — Hardening & ship
- [x] Privacy review, API authz tests
- [x] Error / empty / loading states, a11y pass, 360px check
- [x] Production build of web (OpenNext) + Worker dry-run deploy
- [x] Production config ready (2026-10-24): workers.dev origins, D1 id, R2 buckets + CORS, secrets script, web prod env
- [ ] Deploy — commands in CLAUDE.md "Deploy (workers.dev)"; not run yet (needs owner go-ahead)

## Production state (2026-10-24)
- Cloudflare account subdomain `erkhes-labs.workers.dev`.
  API → https://family-tree-service.erkhes-labs.workers.dev · Web → https://family-tree-web.erkhes-labs.workers.dev
- D1 `family-tree` (1a6d833c-…): migration 0000 applied, 19 tables, 14 clans seeded.
- R2 `family-tree-media` (CORS: web workers.dev origin + http://localhost:3000; GET/PUT/HEAD; headers *; expose ETag),
  R2 `family-tree-web-cache` — both created.
- Secrets: not uploaded yet (Workers don't exist). `scripts/push-prod-secrets.sh check` validates them (all OK).
- Clerk: Development instance (pk_test) is used for now — works on workers.dev. Production instance needs a custom domain.
- Email: `onboarding@resend.dev` sender — Resend only delivers it to the Resend account owner's address until a domain is verified.

## Verified (2026-10-22 / 2026-10-24)
- `nx run-many -t test lint typecheck` green; API dry-run 236 KiB gzip; web OpenNext build 1.72 MB gzip.
- Real Clerk sign-in (dev instance) in headless Chrome; API accepts the browser JWT (azp = web origin).
- Tree + father/mother/partner/child/sibling (API + UI dialog), cycle check, profile/custom fields/events, timeline,
  kinship, culture pages mn/en, invite link + QR + accept, privacy (outsider 403, friend sees year only, no edit).
- Local uploads through the Worker (no R2 keys locally): UI photo upload + thumbnail + download; 2 s audio recorded with
  Chrome's fake mic → upload → story.
- Reminder job (dev-mode instance, mocked email): 3 sent, re-run 0 (dedupe). Webhook: unsigned/bad sig 400, valid 200.
- Production web bundle contains no CLERK_SECRET_KEY and inlines the workers.dev API URL.
- API: auth/roles/privacy/invitations/friends/audit/relatives/uploads (single + multipart)/range downloads via curl (dev auth).
- 400-person tree renders in ~2 s.

## Not yet verified (needs deploy / dashboard)
- Production: health, sign-in, presigned R2 upload, Clerk webhook, Resend delivery, Web Push delivery.
- Session-token claims (email/name/image) are not configured in Clerk yet → users get no email until set.
- Audio recording with a real microphone (manual check in Chrome/Safari).
