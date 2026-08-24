const input = document.getElementById("feedback-input");
const analyzeBtn = document.getElementById("analyze-btn");
const sampleBtn = document.getElementById("sample-btn");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const summaryEl = document.getElementById("summary");
const groupsEl = document.getElementById("theme-groups");

const SAMPLE_FEEDBACK = `The mobile app crashes every time I try to upload a photo
Love the new dashboard, so much faster than before
Wish there was a dark mode option
Pricing feels high compared to competitors with similar features
Support responded within an hour, really impressed
Onboarding was confusing, took me a while to find the settings page
The export to CSV button doesn't work on Safari
Would pay more for a team collaboration feature
Search results are often irrelevant to what I typed
Great job on the redesign, everything feels cleaner`;

const SENTIMENT_ORDER = { Negative: 0, Neutral: 1, Positive: 2 };

sampleBtn.addEventListener("click", () => {
  input.value = SAMPLE_FEEDBACK;
});

analyzeBtn.addEventListener("click", analyzeFeedback);

async function analyzeFeedback() {
  const feedback = input.value.trim();

  if (!feedback) {
    setStatus("Please paste some feedback first.", true);
    return;
  }

  setStatus("Analyzing with Claude...");
  analyzeBtn.disabled = true;
  resultsEl.hidden = true;

  try {
    const res = await fetch("/.netlify/functions/triage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedback }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `Request failed with status ${res.status}`);
    }

    renderResults(data.items || []);
    setStatus(`Analyzed ${data.items?.length || 0} items.`);
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    analyzeBtn.disabled = false;
  }
}

function renderResults(items) {
  if (!items.length) {
    resultsEl.hidden = true;
    return;
  }

  const themes = {};
  for (const item of items) {
    const theme = item.theme || "Other";
    if (!themes[theme]) themes[theme] = [];
    themes[theme].push(item);
  }

  const sortedThemes = Object.entries(themes).sort((a, b) => b[1].length - a[1].length);

  summaryEl.textContent = `${items.length} items across ${sortedThemes.length} themes`;

  groupsEl.innerHTML = sortedThemes
    .map(([theme, themeItems]) => {
      const sorted = [...themeItems].sort(
        (a, b) => (SENTIMENT_ORDER[a.sentiment] ?? 1) - (SENTIMENT_ORDER[b.sentiment] ?? 1)
      );
      const rows = sorted
        .map(
          (item) => `
        <div class="feedback-item">
          <span class="sentiment-dot sentiment-${(item.sentiment || "neutral").toLowerCase()}"></span>
          <span class="feedback-text">${escapeHtml(item.text)}</span>
          <span class="sentiment-label">${escapeHtml(item.sentiment || "Neutral")}</span>
        </div>`
        )
        .join("");

      return `
        <div class="theme-card">
          <h3>${escapeHtml(theme)} <span class="theme-count">${themeItems.length}</span></h3>
          ${rows}
        </div>`;
    })
    .join("");

  resultsEl.hidden = false;
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
