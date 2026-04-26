# Supabase Local Development Setup

## Prerequisites

- Docker Desktop installed and running
- Supabase CLI (`brew install supabase/tap/supabase`)
- Node.js 18+

## First-time setup

```bash
# 1. Start local Supabase (pulls Docker images on first run — may take a few minutes)
supabase start

# 2. Copy the Publishable and Secret keys from the output into .env.local:
cp .env.example .env.local
# Edit .env.local with the keys from `supabase status`

# 3. Generate TypeScript types from the local schema
npm run db:types

# 4. Install dependencies and verify
npm install
npm run typecheck
npm run test
```

## Day-to-day commands

| Command | What it does |
|---------|-------------|
| `supabase start` | Start local Supabase (idempotent) |
| `supabase stop` | Stop local Supabase |
| `supabase status` | Show URLs and API keys |
| `npm run db:reset` | Drop and recreate the local database, re-apply all migrations |
| `npm run db:types` | Regenerate `lib/supabase/database.types.ts` from local schema |
| `npm run dev` | Start Next.js dev server |

## Migration files

Migrations live in `supabase/migrations/` (also symlinked as `db/` for convenience). They are applied in lexicographic order by `supabase db reset`.

Migrations are **append-only**. Never edit a committed migration — write a new one.

There is no separate seed step. The seed migration (`0006_seed_topics.sql`) runs as part of every `db:reset`.

## Environment variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API URL (local: `http://127.0.0.1:54321`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable/anon key (respects RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret/service-role key (bypasses RLS — server-side only) |
