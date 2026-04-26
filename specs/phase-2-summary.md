# Phase 2 Summary — Auth Flow

Magic-link auth, the registration → approval state machine, the seven public-facing screens (plus profile + chrome), and the middleware that enforces routing per `profiles.status`. End-to-end verified against local Supabase + Mailpit.

## What shipped

### UI primitives (`components/ui/`)

- `button.tsx` — five kinds (primary, secondary, ghost, danger, solid-danger), three sizes, optional leading icon, optional `block`.
- `input.tsx`, `textarea.tsx`, `select.tsx` — focus ring uses `--violet`; readonly inputs render against `--surface-alt`.
- `field.tsx` — label + control + hint/error wrapper.
- `card.tsx` — Tailwind port of the prototype's `.card`, with optional `pad` and `flat`.
- `agora-wordmark.tsx` — mark + serif "Agora" wordmark; size-prop driven.
- `icon.tsx` — 28 inline SVGs ported from `src/ui.jsx`'s `Icon`.
- `avatar.tsx` — deterministic gradient-from-name; not on the brief's strict list but required by `awaiting-approval`, profile, and the top nav. Flagged below.

### Auth helpers + middleware

- `lib/auth.ts` — `getCurrentUser()`, `getCurrentProfile()`, `requireApproved()` for use inside server components.
- `middleware.ts` — refreshes the Supabase session via `@supabase/ssr` on every request, then reads `profiles.status` and applies the routing table. Layouts trust middleware; they don't duplicate the redirect logic. `requireApproved()` in the (authed) layout is a defensive backstop.
- `app/auth/callback/route.ts` — exchanges the PKCE code for a session, then eagerly redirects based on the resolved status.
- `lib/supabase/server.ts`, `client.ts` — wrapper return type cast to `SupabaseClient<Database>` to work around a `@supabase/ssr@0.6.1` ↔ `@supabase/supabase-js@2.49.8` generic-order mismatch that silently degrades the typed Database to `never` for `.from()` calls. Documented inline.

### Server actions

- `lib/actions/auth.ts` — `register({fullName, email, studentId})`, `signIn(email)`, `resendConfirmation()`, `signOut()`. `register` stamps `auth.users.raw_user_meta_data` with `full_name` + `student_id` for the `handle_new_user` trigger.
- `lib/actions/profile.ts` — `updateProfileName(fullName)`. Writes via the user-scoped client; RLS (`profiles_self_update`) gates authorisation, so no service-role.
- Per-page action wrappers (`app/<page>/actions.ts`) bind to `useActionState` for inline error + pending state.

### Pages

- `app/page.tsx` — landing (rewritten from Phase 1 stub).
- `app/register/page.tsx` — register form via `useActionState`.
- `app/signin/page.tsx` — server-rendered shell that switches between the form and the "check your inbox" view via `?sent=1`.
- `app/awaiting-email/page.tsx` — "confirm your email" with resend; gracefully hides resend/sign-out when the user has no session yet (post-register, pre-magic-link).
- `app/awaiting-approval/page.tsx` — pending-review screen with the user's profile + sign-out.
- `app/rejected/page.tsx` — env-driven beadle contacts + sign-out.
- `app/(authed)/layout.tsx` — chrome wrapping dashboard, profile, vote.
- `app/(authed)/dashboard/page.tsx` — Phase 3 stub.
- `app/(authed)/profile/page.tsx` — name editable; email + student ID read-only.
- `app/(authed)/vote/page.tsx` — Phase 4 placeholder so the nav has a target.

### Chrome

- `components/nav/top-nav.tsx` — desktop, `usePathname` for active state.
- `components/nav/bottom-nav.tsx` — mobile tab bar.
- `components/public-card.tsx` — shared shell (wordmark + centred card) reused by the five public-facing auth screens.

### Env

- `.env.example` adds `NEXT_PUBLIC_SITE_URL` (magic-link callback target) and `NEXT_PUBLIC_BEADLE_CONTACT` (newline-separated lines shown on the rejected screen).
- `supabase/config.toml` widens `additional_redirect_urls` to allow both `http://127.0.0.1:3000/**` and `http://localhost:3000/**` so the magic-link callback URL is honoured.

### Migration

- `supabase/migrations/0011_fix_trigger_search_path.sql` — see Deviations.

## Deviations from the brief

1. **New migration despite the brief saying none should be needed.** The Phase 1 trigger functions `handle_new_user` and `handle_email_confirmed` (in `0002_triggers.sql`) are `security definer` but have no `set search_path`. Under Supabase's auth role they can't resolve the unqualified `profiles` table reference and registration dies with "relation profiles does not exist". Phase 1 never exercised the actual signup flow (its acceptance criterion was just `select count(*) from topics`), so the bug stayed latent until Phase 2 turned the magic-link crank. Migration `0011` sets `search_path = public, auth` on both functions. Migration count is now **11** (was 10 after Phase 1.5).

2. **`/awaiting-email` is now a public path.** The brief's routing table groups it under "yes session, pending_email". But after submitting the register form, the user has no session yet (the magic link hasn't been clicked), so the "check your inbox" view needs to render for unauth callers. I added `/awaiting-email` to `PUBLIC_PATHS` and made the page hide resend/sign-out when there's no user. In production with email confirmations on, a `pending_email` user with a session will still land here normally and see the full UI.

3. **Avatar primitive added.** Not on the brief's strict UI primitives list, but required by `awaiting-approval`, the profile page, and the top nav. Trivial, no business logic.

4. **`as never` cast on RPC args is unchanged in `lib/actions/{ballot,tally}.ts`.** That cast is from Phase 1.5 and works around the same `@supabase/ssr` ↔ `@supabase/supabase-js` generic mismatch I patched at the wrapper boundary in this phase. With the wrapper now properly typed, the `as never` casts in Phase 1's actions could probably be dropped — but those files are out of Phase 2 scope, so I left them. Worth a Phase 1.5 addendum.

5. **Email validation is general, not domain-restricted.** The brief said "validate email shape". I do `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`. Domain enforcement is a policy decision the beadle approval step catches. Open to tightening if you want.

6. **Next.js deprecation warning.** Next 16 deprecates the `middleware.ts` file convention in favour of `proxy.ts`. The brief explicitly says `middleware.ts`, so I followed the brief — the warning surfaces in dev but the file still works. Worth a small follow-up to rename + update the function export name.

## Required env vars

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `http://127.0.0.1:54321` for local |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key from `supabase status` |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret key from `supabase status` |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` for local; the magic-link callback target |
| `NEXT_PUBLIC_BEADLE_CONTACT` | Newline-separated lines shown on the rejected screen; leave empty for a generic fallback |

## Manual SQL flips for testing (Phase 6 admin UI not built)

Run inside the local Supabase Postgres (`docker exec supabase_db_agora psql -U postgres`):

```sql
-- Approve a user (no topic assignment yet — Phase 6 will wire that up)
update public.profiles
   set status = 'approved',
       approved_at = now()
 where email = 'voter@sanbeda.edu.ph';

-- Reject a user
update public.profiles
   set status = 'rejected',
       rejected_at = now(),
       rejection_reason = 'mismatched student id'
 where email = 'voter@sanbeda.edu.ph';

-- Reset to pending_approval (e.g. to redo a flow)
update public.profiles
   set status = 'pending_approval',
       approved_at = null,
       approved_by = null,
       rejected_at = null,
       rejected_by = null,
       rejection_reason = null
 where email = 'voter@sanbeda.edu.ph';

-- Reset all the way to pending_email (rare in dev — auto-confirm fires the trigger)
update public.profiles
   set status = 'pending_email'
 where email = 'voter@sanbeda.edu.ph';

-- Promote to beadle (admin)
update public.profiles
   set is_admin = true
 where email = 'voter@sanbeda.edu.ph';

-- Inspect current state
select id, email, full_name, status, is_admin
  from public.profiles
 order by created_at desc;
```

The user must reload (or hit any gated route) for middleware to pick up the new status.

## Acceptance criteria

- [x] `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test` — all pass.
- [x] `supabase db reset` works; one new migration (0011), see deviations.
- [x] Registering populates `auth.users.raw_user_meta_data` with `full_name` and `student_id`; `handle_new_user` creates the profile row.
- [x] Clicking the magic link from Mailpit (`http://127.0.0.1:54324`) signs the user in. They land on `/awaiting-approval` (because Supabase's local dev auto-confirms emails, which fires `handle_email_confirmed` and flips `pending_email` → `pending_approval`).
- [x] Manually flipping `profiles.status = 'approved'` via SQL → next request lands on `/dashboard`.
- [x] Manually flipping to `'rejected'` → next request lands on `/rejected`.
- [x] `/profile` lets the user change `full_name` and persists. Email and student ID are read-only.
- [x] Sign out clears the session and lands on `/`.
- [x] Visiting `/dashboard` while unauthenticated redirects to `/`.
- [x] Visiting `/register` or `/signin` while authenticated redirects to the status-appropriate page (verified via the redirect table; the awaiting-* and / cases too).
- [x] Each Phase 2 screen visually matches the prototype: palette, type, hierarchy.

The one bullet I didn't drive end-to-end in a real browser was `pending_email`, since local-dev auto-confirm short-circuits to `pending_approval`. The path is exercised by the same middleware code, just from a different cell of the routing table.

## What Phase 3 (voter dashboard) needs to know

- **Reading the current user's profile in a server component.** Use `getCurrentProfile()` from `lib/auth.ts`. For approved-only screens, prefer `requireApproved()` — it returns the profile and redirects (via `next/navigation`) on any other status. Both run on every render and read through RLS, so they're cheap and safe.
- **Reading the user's assigned topic.** No helper yet — Phase 3 will need one. Suggested shape:
  ```ts
  // lib/auth.ts (add in Phase 3)
  export async function getMyTopic() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from("topics")
      .select("*")
      .eq("presenter_voter_id", user.id)
      .maybeSingle();
    return data;
  }
  ```
  RLS (`topics_approved_read`) already lets approved voters read every topic, so no service-role needed.
- **The `(authed)` layout is the place to fetch profile + topic once and pass them down.** Currently it fetches the profile and passes `fullName` to `<TopNav>`. Phase 3 can extend this — but be careful, the layout runs for `dashboard`, `vote`, and `profile`; if the assigned-topic fetch becomes expensive, push it down to per-page server components instead.
- **Auth surface contract.** Voters interact with auth through three places only: middleware (routing), `getCurrentProfile()` (read), and the four server actions in `lib/actions/auth.ts` + `lib/actions/profile.ts`. There is no client-side `useAuth()` hook. Phase 3 should keep that boundary.
- **Server actions and `useActionState`.** The pattern Phase 2 settled on: per-page `actions.ts` exposes a `(prev, formData) => Promise<FormState>` server action, the page (or a child client component) binds it via `useActionState`. The `as never` cast on `supabase.rpc()` calls — see Phase 1.5's `ballot.ts` and `tally.ts` — is no longer needed for `.from()` calls thanks to the wrapper-boundary cast in `lib/supabase/server.ts`, but is still needed on `.rpc()` until either `@supabase/ssr` or our wrapper deals with the typing.

## Migration count

11 (was 10 after Phase 1.5; +1 for `0011_fix_trigger_search_path.sql`).
