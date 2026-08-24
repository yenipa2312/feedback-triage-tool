# Feedback Triage Tool

Paste raw customer feedback, click **Analyze**, and Claude sorts it into themes
(Bug, Feature Request, Pricing, Praise, ...) with sentiment, grouped into cards.

## How it works

- `index.html` / `style.css` / `app.js` — static frontend, no build step
- `netlify/functions/triage.js` — a serverless function that calls the Claude API
  server-side, so the API key never reaches the browser
- The API key is read from the `ANTHROPIC_API_KEY` environment variable

## Local setup

1. Install [Node.js](https://nodejs.org) (LTS version) if you haven't already.
2. Install the Netlify CLI globally:
   ```
   npm install -g netlify-cli
   ```
3. Copy `.env.example` to `.env` and paste in your own Anthropic API key
   (get one at https://console.anthropic.com/). `.env` is gitignored, so it
   never gets committed.
4. Run the dev server:
   ```
   netlify dev
   ```
5. Open the URL it prints (usually `http://localhost:8888`) and try it out.

## Deploying to Netlify

1. Push this folder to a GitHub repository.
2. In the Netlify dashboard: **Add new site → Import an existing project → GitHub**,
   and pick this repo.
3. Build settings: publish directory `.`, functions directory `netlify/functions`
   (already configured in `netlify.toml`, so the defaults should just work).
4. Before the first deploy (or right after), go to
   **Site settings → Environment variables** and add:
   - Key: `ANTHROPIC_API_KEY`
   - Value: your Anthropic API key
5. Deploy. Netlify gives you a live URL you can share with your team.

## Notes

- Uses `claude-haiku-4-5-20251001` for fast, cheap categorization. You can
  swap the model name in `netlify/functions/triage.js` for a different Claude
  model.
- No npm dependencies are required — the function uses the built-in `fetch`
  available in Netlify's Node runtime.
