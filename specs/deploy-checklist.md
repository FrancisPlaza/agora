# Agora — Vercel deploy checklist

First production deploy of the Agora app. Use this as a working checklist; tick items as you go. Things flagged with **⚠** are the ones most likely to bite if missed.

---

## 1. Pre-deploy in the repo

- [ ] Working tree clean. `git status` shows no uncommitted changes.
- [ ] On `main` (or whichever branch Vercel is configured to deploy from).
- [ ] `npm run lint` passes.
- [ ] `npm run typecheck` passes.
- [ ] `npm run build` passes locally with production env vars (`.env.production.local` if you keep one).
- [ ] `npm run test` passes — especially the IRV tests (`lib/irv.test.ts`).
- [ ] Latest migration count in `supabase/migrations/` matches what's in production-bound code (currently 24).
- [ ] No `console.log` strays in committed code that you don't want in production (quick `git grep "console.log" -- "*.tsx" "*.ts"`).
- [ ] `next.config.ts` has the `bodySizeLimit: "12mb"` Server Actions setting and the commit-SHA wiring.

---

## 2. Vercel project

- [ ] Vercel project created and linked to the GitHub repo.
- [ ] Build command: default (`next build`). Install command: default. Output directory: `.next`. Root directory: project root.
- [ ] Production branch set to `main`.
- [ ] Node.js version matches local dev (check `package.json` `engines` if set, otherwise Vercel default).
- [ ] Region set to one near Manila (e.g. `sin1` Singapore). After the first deploy, click a Function Invocation log in Vercel → Logs and confirm `Routed to <region>` matches. Hobby tier defaults to `iad1` until explicitly set; a transpacific roundtrip from `iad1` to a Singapore Supabase project adds ~500ms per DB call and destroys page-render perf.

---

## 3. Environment variables (Vercel dashboard → Settings → Environment Variables)

For all environments (Production, Preview, Development) unless flagged:

- [ ] `NEXT_PUBLIC_SUPABASE_URL` — your prod Supabase project URL.
- [ ] `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — publishable key (formerly the anon key). Safe to expose in client code.
- [ ] `SUPABASE_SECRET_KEY` — secret key (formerly the service role key). **Production only. Do NOT expose to Preview or Development without a separate Supabase project — this key bypasses RLS.**
- [ ] `RESEND_API_KEY` — Resend API key for the approval email. **Server-only.** Set in Production (and Preview if you want approval emails to fire there too).
- [ ] `EMAIL_FROM` — sending address, e.g. `Agora <agora@e.plaza.ph>`. Must match a verified Resend domain. Server-only.
- [ ] Any other env vars listed in `specs/` (check `specs/schema.md` and any phase summaries for env requirements).
- [ ] `VERCEL_GIT_COMMIT_SHA` — auto-injected by Vercel; just confirm it appears in the build env, no manual setup needed.

⚠ **Use a separate Supabase project for production**, not your dev project. Class data lives in prod; experiments and tests stay in dev. Don't share the database.

---

## 4. Supabase production project

If you haven't already created the prod project:

- [ ] New Supabase project created (e.g. `agora-prod`), region near Manila if possible.
- [ ] Project URL and publishable key copied to Vercel env vars (step 3).
- [ ] Secret key copied to Vercel env (Production scope only).

### Apply migrations

- [ ] `supabase link --project-ref <prod-ref>` (one-off).
- [ ] `supabase db push` to apply all 24 migrations against prod.
- [ ] Verify in the Supabase dashboard → Database → Tables that all expected tables exist (`profiles`, `topics`, `ballots`, `rankings`, `notes`, `tally_results`, `audit_log`, etc.).
- [ ] Verify RLS is enabled on every table (Database → Policies → look for the green RLS toggle).
- [ ] **Topics are seeded for free.** Migration `0006_seed_topics.sql` inserts all 32 topics from the JDN101 syllabus (idempotent — `on conflict (id) do nothing`). After `db push`, run `select count(*) from topics;` in the SQL editor and confirm it returns 32. If it returns 0, the migration didn't apply; check the push log for errors.

### Storage

- [ ] Storage bucket `presentations` exists.
- [ ] Bucket policies match what's documented in `specs/schema.md`: insert restricted to matching presenter, select for approved voters, no updates.
- [ ] Bucket file size limit set to 10 MB if available at the bucket level (the app enforces this too).

### Auth configuration (Supabase dashboard → Authentication → URL Configuration)

⚠ **Critical for magic links to actually work in production.**

- [ ] **Site URL** set to your production domain (e.g. `https://agora.francis.example`). Magic-link emails use this as the link target.
- [ ] **Redirect URLs** allowlist includes:
  - `https://<your-prod-domain>/**`
  - The Vercel preview pattern if you want previews to work: `https://*.vercel.app/**` (only if you actually need this; otherwise skip).
- [ ] **Email confirmations** enabled.
- [ ] **Magic link** sign-in enabled.

### Email templates (the work that just landed)

- [ ] Open `supabase/email-templates/email-confirm-signup.html` and paste the body into Supabase dashboard → Authentication → Email Templates → **Confirm signup**.
- [ ] Set the subject for that template to: `Confirm your Agora email`.
- [ ] Open `supabase/email-templates/email-magic-link.html` and paste the body into Supabase dashboard → Authentication → Email Templates → **Magic Link**.
- [ ] Set the subject for that template to: `Your Agora sign-in link`.
- [ ] Send a test email to yourself from the Supabase dashboard ("Send test email") to verify rendering before any real student receives one.
- [ ] Confirm the greeting renders your `full_name` from registration metadata (or "there" if the field isn't populated). If it always shows "there", check that the registration server action sets `data: { full_name }` in the `signUp` options.

### SMTP (only if you've outgrown Supabase's free email)

- [ ] Custom SMTP configured under Authentication → SMTP Settings (SendGrid, Resend, Postmark — your call). Free Supabase email has rate limits that may bite when 32 students all register in the same hour. Worth setting up before class kickoff.

### Email service (Resend) — for the approval email

The approval email (sent when a beadle approves a registration) goes through Resend, not Supabase Auth. The Supabase email templates above stay; Resend handles only the post-approval notification.

- [ ] Sending domain `e.plaza.ph` (or whichever domain matches `EMAIL_FROM`) added in the Resend dashboard → Domains.
- [ ] DNS records (SPF, DKIM, DMARC) added at the DNS provider for the sending domain. Wait for Resend to mark the domain as Verified.
- [ ] Production API key generated in the Resend dashboard → API Keys; pasted into Vercel env vars (Production scope) as `RESEND_API_KEY`.
- [ ] `EMAIL_FROM` set in Vercel env vars (Production scope) to the verified address, e.g. `Agora <agora@e.plaza.ph>`.
- [ ] Send a test email from the Resend dashboard to your own address to confirm deliverability before approving any real student.

---

## 5. Domain

- [ ] Custom domain added in Vercel → Settings → Domains (or skip if you're shipping on the auto-generated `*.vercel.app`).
- [ ] DNS records propagated (Vercel will tell you when).
- [ ] HTTPS cert issued (Vercel does this automatically — should take a minute or two).
- [ ] Update Supabase **Site URL** if the domain changed after the auth-config step above.

---

## 6. First deploy

- [ ] `git push origin main` triggers the build.
- [ ] Build succeeds in Vercel. Check the deployment log for any warnings.
- [ ] Open the deployed URL.

---

## 7. Smoke tests in production (run yourself before any student gets the URL)

⚠ **Don't skip this. The first time real RLS policies hit real auth flows is the riskiest moment.**

- [ ] As Francis, click **Sign in** on the homepage, enter your email, click the magic link. Land on the dashboard with admin nav visible. (Don't register — your account is seeded.)
- [ ] **Register** a new test account using a throwaway email (the smoke test for the public registration flow). Magic-link confirmation email arrives.
- [ ] Click the confirm link. Lands on the awaiting-approval screen.
- [ ] **Sign in again** using the magic-link route from the homepage. Magic-link sign-in email arrives.
- [ ] As Francis (the seeded beadle), approve the throwaway account as a voter and assign it a topic. Confirm the approval email arrives within ~1 minute, names the assigned topic, and the magic link signs the throwaway account into the dashboard.
- [ ] Land on the dashboard. All 32 topic cards render. The unassigned ones show the surface-alt no-art treatment with centered dark text.
- [ ] **Upload artwork.** Try a 5 MB JPG — should succeed. Try a 10.5 MB JPG — should reject client-side. Try HEIC — should reject. Try GIF — should accept.
- [ ] **Topic detail page.** Hero renders. "Add to my ranking" button shows inline below the hero. Click it. Topic appears in your draft ballot.
- [ ] **Ranking page.** Drag to reorder works. Auto-save works (refresh and the order persists).
- [ ] **Submit ballot.** Locked state renders.
- [ ] **As beadle**, open polls. Run tally. Top 5 results render.
- [ ] **Re-run tally** — should overwrite cleanly, no dupes.
- [ ] **Reopen polls** — tally should clear (no stale results showing).
- [ ] Visit `/topic/[id]` for a topic that has artwork — click the artwork → lightbox opens. Esc closes it.
- [ ] Footer commit SHA renders the latest deploy's SHA.

---

## 8. Things that will probably bite

⚠ **Vercel request body limit.** Vercel's serverless function request limit is **4.5 MB** on Hobby and Pro tiers, regardless of what `next.config.ts` says. The `bodySizeLimit: "12mb"` setting in Next.js controls framework-level rejection but doesn't override the platform limit. Files between 4.5 MB and 10 MB will succeed locally and fail in production with a generic Vercel 413 error. Two options: drop `MAX_BYTES` to 4 MB and update the validation copy, or move uploads to direct-to-Supabase-storage signed URLs (skips the Server Action entirely). For a 32-student class shipping today, the path of least resistance is dropping the limit to 4 MB and telling students to compress. Flag if you want to ship the larger limit and we'll do the signed-URL refactor as a follow-up.

⚠ **Supabase email rate limits.** Free tier caps at ~3-4 transactional emails per hour per user, ~30/hour project-wide. If 32 students all register in the same hour for the first lecture, you'll hit the cap. Either configure custom SMTP (step 4) or pre-stagger registrations.

⚠ **Cold starts.** Server Actions on Vercel free tier can have ~1-2s cold starts. The first interaction of a session feels slower than the prototype. Not a blocker, just expected.

⚠ **Greeting variable.** If the email greeting always reads "Hi there," instead of the student's name, the registration action isn't writing `full_name` to user metadata. Quick fix in `lib/actions/auth.ts`: add `data: { full_name: parsed.full_name }` to the `supabase.auth.signUp` options.

⚠ **Admins are seeded by script, not by registering.** After `supabase db push` lands migrations (step 4), run:

  ```
  npm run seed:prod-admins
  ```

  with the prod env vars (`NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SECRET_KEY`) set in your shell. Confirm at the prompt. The script seeds Francis, Jay, and Marlon as approved admins. After it runs, tell them to click **Sign in** (not Register) on first visit. Topics for Francis and Jay get assigned later in the dashboard; Marlon stays without a topic (non-voting admin).

---

## 9. Rollback

If something explodes after launch:

- [ ] **Vercel:** dashboard → Deployments → previous good deployment → "Promote to Production". Instant.
- [ ] **Supabase migrations:** migrations are append-only, so rollback means writing a new migration that reverts the changes. Don't try to delete or edit a committed migration. For schema-level mistakes, prepare the revert migration locally before promoting it to prod.
- [ ] **Storage:** Supabase doesn't have a one-click rollback for bucket contents. If artwork uploads break, the files are still there — just the metadata pointer in `topics.art_filename` would be stale. Recoverable.

Keep the previous good deployment URL (Vercel gives every deploy a unique URL) handy for the first 24 hours so you can test fixes against a known-good baseline.

---

## 10. Class kickoff prep (after deploy, before first lecture)

- [ ] Run `npm run seed:prod-admins` against prod (see step 8 ⚠ above). Confirm all three admin rows exist in `profiles` with `is_admin = true` and `status = 'approved'`.
- [ ] Sign in as Francis to confirm the magic-link flow lands on the dashboard with admin powers.
- [ ] Confirm `select count(*) from topics;` returns 32 in prod. (The seed migration handles this — see step 4.)
- [ ] Spot-check a few rows for typos and ordering — the migration source is `supabase/migrations/0006_seed_topics.sql`. If you want to fix a philosopher name or theme post-deploy, write a new migration; don't edit `0006`.
- [ ] Test the magic-link flow on a phone (most students will register from mobile).
- [ ] Send the class a one-paragraph email with the URL, what to do (register → wait for beadle approval → upload art when their turn comes), and your beadle contact for issues.
- [ ] Brief your co-beadle (if there is one) on the approval queue and the unlock-ballot flow.
