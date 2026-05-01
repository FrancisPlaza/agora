# Supabase email templates

Two transactional templates for the magic-link auth flow. These files are **not** consumed by the Next.js build — paste them into the Supabase Dashboard.

## Where to paste

In the project's Supabase Dashboard → **Authentication** → **Email Templates**:

| File | Template tab | Subject (set in dashboard, not in body) |
|---|---|---|
| `email-confirm-signup.html` | **Confirm signup** | `Confirm your Agora email` |
| `email-magic-link.html` | **Magic Link** | `Your Agora sign-in link` |

For each: copy the file contents into the body editor, set the subject line above in the subject field on the same screen, save.

## Template variables

Both files use Supabase's Go-template syntax:

- `{{ .ConfirmationURL }}` — the verification link (button `href` and the visible URL fallback).
- `{{ .Data.full_name }}` — the user's full name from `raw_user_meta_data`. Set during registration in `lib/actions/auth.ts` via `signInWithOtp({ options: { data: { full_name } } })`. Falls through to `there` if absent (defensive — magic-link sign-ins for users with empty metadata still render correctly).

## Things to know

- The button uses `#5147E6` (violet-600) instead of the brand `#635BFF` for AA contrast — `#635BFF` on white at 14px fails 4.5:1. The brighter `#635BFF` survives on the inline URL link, where surrounding neutrals raise perceived contrast.
- A `<style>` block in `<head>` carries only `@media` rules (`prefers-color-scheme: dark` + `max-width: 480px`). Gmail strips it cleanly; Apple Mail / iOS Mail honour the dark-mode swap and the mobile breakpoint.
- The wordmark is rendered in a 3-cell layout table — no SVG, no `<img>`, no external assets. Survives client stripping.
- VML `<v:roundrect>` Outlook desktop fallback included so the button renders as a rounded violet pill on Windows Outlook.
- Each file is a complete standalone HTML document — open it in a browser to preview.
