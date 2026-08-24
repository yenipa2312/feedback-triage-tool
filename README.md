# Feedback Triage Tool

Two pages:

- **`index.html`** — "Your voice is very important for us." The public link
  you share with agents: optional name, how long they've worked there, where
  calls give them trouble, and what would help most. No login.
- **`dashboard.html`** — your view. Click **Analyze New Feedback** to have
  Claude sort everything into themes (Tooling, Process, Training, Workload,
  Communication, Compensation, Praise, Other) with sentiment. Check "synced"
  on items once you've added them to your backlog, and export the rest as
  CSV or Markdown to paste in.

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
- `netlify/functions/list.js` — dashboard reads all stored items
- `netlify/functions/analyze.js` — calls Claude on items with no theme yet,
  saves the result back to storage
- `netlify/functions/update-status.js` — flips the "synced to backlog" flag
  on one item
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
3. Redeploy so the function picks up the key.
4. Share the site's root URL (`.../`) with agents for submitting feedback,
   and keep `.../dashboard.html` for yourself.

## Notes

- Uses `claude-haiku-4-5-20251001` for fast, cheap categorization — change
  the model name in `netlify/functions/analyze.js` if you want a different
  Claude model.
