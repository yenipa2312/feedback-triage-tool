# Feedback Triage Tool

Two pages:

- **`index.html`** — "Your voice is very important for us." The public link
  you share with agents: optional name, how long they've worked there, where
  calls give them trouble, and what would help most. No login.
- **`dashboard.html`** — your view. Click **Analyze New Feedback** and Claude
  sorts everything into themes, then clusters items describing the same
  underlying issue under a shared "subject" (e.g. two agents both flagging
  slow order lookups become one group, not two). Each subject is checked
  against **your backlog** (a small list you maintain right on the
  dashboard) — a match shows a green badge, no match shows "Add to backlog"
  for one-click adding. Filter by agent experience level, check "synced"
  once items are handled, export the rest as CSV or Markdown.

## Design

Built with the `impeccable-design` / `frontend-craft` / `design-tokens` /
`accessibility-audit` / `emil-design-eng` / `design-taste-frontend` skills:
a locked slate + burnt-orange OKLCH palette (not the generic "AI dark +
blue/purple" default), both light and dark mode via `prefers-color-scheme`,
sentiment shown as text+color badges (never color alone), visible `<label>`
on every field, and restrained motion tuned for an internal work tool
(nothing above a ~200ms press/focus transition).

## How it works

- Storage: [Netlify Blobs](https://docs.netlify.com/blobs/overview/), a
  built-in key-value store — no external database or account needed. All
  submissions live in one JSON list.
- `netlify/functions/submit.js` — agents' form posts here
- `netlify/functions/list.js` — dashboard reads all stored feedback items
- `netlify/functions/analyze.js` — calls Claude on items with no theme yet;
  extracts theme, a short "subject" for clustering, sentiment, and checks
  each subject against the current backlog for a match
- `netlify/functions/update-status.js` — flips the "synced to backlog" flag
  on one item
- `netlify/functions/backlog-list.js` / `backlog-add.js` — your backlog,
  stored separately from feedback, used both for display and as reference
  material `analyze.js` matches against

**Note:** backlog matching only runs at analysis time, on items that don't
have a theme yet. If you add a backlog item that would match older, already-
analyzed feedback, that older feedback won't retroactively pick up the
match — it's a one-pass check, not a live search.
- The Anthropic API key is read from the `ANTHROPIC_API_KEY` environment
  variable, only server-side — it never reaches the browser.

**Known limitation:** storage uses a single JSON blob updated on every
submit, so two agents submitting in the exact same instant could
theoretically overwrite each other. Fine for occasional internal feedback;
not built for high concurrent traffic.

## Local setup

1. Install [Node.js](https://nodejs.org) (LTS) if you haven't already.
2. Install dependencies and the Netlify CLI:
   ```
   npm install
   npm install -g netlify-cli
   ```
3. Copy `.env.example` to `.env` and paste in your own Anthropic API key
   (get one at https://console.anthropic.com/). `.env` is gitignored.
4. Run the dev server:
   ```
   netlify dev
   ```
5. Open the printed URL (usually `http://localhost:8888`) for the
   submission form, and `http://localhost:8888/dashboard.html` for your
   dashboard. Netlify CLI emulates Blobs locally too, so everything works
   the same as production.

## Deploying to Netlify

1. Push to GitHub, then in Netlify: **Add new site → Import an existing
   project → GitHub** → pick this repo. Settings auto-detect from
   `netlify.toml`.
2. **Site settings → Environment variables** → add `ANTHROPIC_API_KEY`.
3. **Site configuration → Visitor access** → make sure production isn't
   password/team-gated, or agents won't be able to open the form at all.
4. If functions error with `MissingBlobsEnvironmentError` (some sites don't
   get Netlify's automatic Blobs config injected): create a Personal
   access token (your Netlify avatar → **User settings → Applications →
   Personal access tokens → New access token**), find your **Site ID**
   (**Site configuration → General → Site details**), and add two more
   environment variables: `NETLIFY_BLOBS_SITE_ID` and `NETLIFY_BLOBS_TOKEN`.
   `netlify/functions/lib/store.js` uses these automatically if present.
5. Redeploy so functions pick up the new env vars.
6. Share the site's root URL (`.../`) with agents for submitting feedback,
   and keep `.../dashboard.html` for yourself.

## Notes

- Uses `claude-haiku-4-5-20251001` for fast, cheap categorization — change
  the model name in `netlify/functions/analyze.js` if you want a different
  Claude model.
