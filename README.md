# Feedback Triage Tool

Two pages:

- **`index.html`** — "Your voice is very important for us." The public link
  you share with agents: an optional 1-5 mood check-in, optional name, how
  long they've worked there, where calls give them trouble, and what would
  help most. No login. After sending, a small milestone badge celebrates
  how many times *that browser* has submitted (1st, 3rd, 5th, 10th...) —
  tracked only in `localStorage`, never sent anywhere or tied to a name, so
  it motivates without undermining anonymity.
- **`dashboard.html`** — your view. Click **Analyze New Feedback** and Claude
  sorts everything into themes, then clusters items describing the same
  underlying issue under a shared "subject" (e.g. two agents both flagging
  slow order lookups become one group, not two). Each subject is checked
  against **your backlog** (a small list you maintain right on the
  dashboard) — a match shows a green badge, no match shows "Add to backlog"
  for one-click adding. Each item is also tagged with a **customer-journey
  stage** (Greeting & Verification, Issue Diagnosis, Resolution, Escalation
  & Transfer, Wrap-up & Documentation) — a separate lens from theme, for
  reading *where in the call* friction concentrates rather than what kind
  of issue it is. Filter by agent experience level or journey stage, check
  "synced" once items are handled, export the rest as CSV or Markdown. A
  sentiment-pulse bar and stat tiles give you the at-a-glance overview;
  Praise items get a distinct "recognition" card treatment; anything
  submitted in the last 48 hours gets a "New" badge.

## Design

Uses the real Ameriabank brand palette and fonts, sourced from
`skills/ameriabank-deck/references/design-system.md` (colours sampled from
the logo file, not guessed) — brand green `#68BD45`, deep green `#3D8B26`
for text, near-black `#111111`, pale-green card fill `#EEF6E9`, Cambria for
headings + Calibri for body (both ship with Office, no font download
needed). One documented brand rule drives the buttons: green fills take
near-black text, never white. Light mode is the default (matches the
brand's own materials); dark mode is the brand's own "dark slide" mode
(`#111111` background, brand green needs no substitute there), both via
`prefers-color-scheme`. The logo gets a white backing chip automatically
in dark mode, since the wordmark's black half would otherwise disappear.

Interaction/motion polish still follows the `impeccable-design` /
`frontend-craft` / `design-tokens` / `accessibility-audit` /
`emil-design-eng` / `design-taste-frontend` skills: sentiment shown as
text+color badges (never color alone), visible `<label>` on every field,
and restrained motion tuned for an internal work tool.

## How it works

- Storage: [Netlify Blobs](https://docs.netlify.com/blobs/overview/), a
  built-in key-value store — no external database or account needed. All
  submissions live in one JSON list.
- `netlify/functions/submit.js` — agents' form posts here
- `netlify/functions/list.js` — dashboard reads all stored feedback items
- `netlify/functions/analyze.js` — calls Claude on items with no theme yet;
  extracts theme, a short "subject" for clustering, sentiment, a
  customer-journey stage, and checks each subject against the current
  backlog for a match
- `netlify/functions/update-status.js` — flips the "synced to backlog" flag
  on one item
- `netlify/functions/backlog-list.js` / `backlog-add.js` — your backlog,
  stored separately from feedback, used both for display and as reference
  material `analyze.js` matches against
- The Anthropic API key is read from the `ANTHROPIC_API_KEY` environment
  variable, only server-side — it never reaches the browser.

**Note:** backlog matching only runs at analysis time, on items that don't
have a theme yet. If you add a backlog item that would match older, already-
analyzed feedback, that older feedback won't retroactively pick up the
match — it's a one-pass check, not a live search.

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
