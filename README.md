# Ургийн бичиг · Family Tree Culture Web

Mongolian families build their family tree together, keep photos, voices and documents for generations, and learn clan
history and customs. Nx monorepo: Next.js web (`apps/family-tree-web`), Hono API on Cloudflare Workers
(`apps/family-tree-service`), shared libs (`libs/shared/types`, `libs/shared/genealogy`).

## Run locally (no keys needed)
```bash
bun install
bunx nx run family-tree-service:db:reset   # local D1 + demo data
bunx nx dev family-tree-service            # API  → http://localhost:8787
bunx nx dev family-tree-web                # Web  → http://localhost:3000  (sign in with a demo user)
bunx nx run-many -t test lint typecheck
```
See `CLAUDE.md` for architecture, decisions and the production checklist, and `PROGRESS.md` for status.
