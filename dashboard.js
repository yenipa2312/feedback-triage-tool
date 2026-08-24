const analyzeBtn = document.getElementById("analyze-btn");
const refreshBtn = document.getElementById("refresh-btn");
const showSyncedCheckbox = document.getElementById("show-synced");
const exportCsvBtn = document.getElementById("export-csv-btn");
const exportMdBtn = document.getElementById("export-md-btn");
const statusEl = document.getElementById("status");
const summaryEl = document.getElementById("summary");
const groupsEl = document.getElementById("theme-groups");

const SENTIMENT_ORDER = { Negative: 0, Neutral: 1, Positive: 2 };

let allItems = [];

analyzeBtn.addEventListener("click", analyzeNew);
refreshBtn.addEventListener("click", loadItems);
showSyncedCheckbox.addEventListener("change", render);
exportCsvBtn.addEventListener("click", () => exportItems("csv"));
exportMdBtn.addEventListener("click", () => exportItems("md"));

loadItems();

async function loadItems() {
  setStatus("Loading...");
  try {
    const res = await fetch("/.netlify/functions/list");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load feedback.");
    allItems = data.items || [];
    setStatus("");
    render();
  } catch (err) {
    setStatus(err.message, "error");
  }
}

async function analyzeNew() {
  analyzeBtn.disabled = true;
  setStatus("Analyzing new feedback with Claude...");
  try {
    const res = await fetch("/.netlify/functions/analyze", { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Analysis failed.");
    allItems = data.items || [];
    setStatus("Done.", "success");
    render();
  } catch (err) {
    setStatus(err.message, "error");
  } finally {
    analyzeBtn.disabled = false;
  }
}

async function toggleSynced(id, synced) {
  try {
    const res = await fetch("/.netlify/functions/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, synced }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Could not update item.");
    }
    const item = allItems.find((i) => i.id === id);
    if (item) item.synced = synced;
    render();
  } catch (err) {
    setStatus(err.message, "error");
  }
}

function render() {
  const showSynced = showSyncedCheckbox.checked;
  const visible = allItems.filter((i) => showSynced || !i.synced);
  const unanalyzedCount = allItems.filter((i) => !i.theme).length;

  summaryEl.textContent = `${allItems.length} total · ${unanalyzedCount} not yet analyzed · showing ${visible.length}`;

  if (!visible.length) {
    groupsEl.innerHTML = `<p class="empty-state">Nothing to show yet.</p>`;
    return;
  }

  const themes = {};
  for (const item of visible) {
    const theme = item.theme || "Not analyzed yet";
    if (!themes[theme]) themes[theme] = [];
    themes[theme].push(item);
  }

  const sortedThemes = Object.entries(themes).sort((a, b) => b[1].length - a[1].length);

  groupsEl.innerHTML = sortedThemes
    .map(([theme, themeItems]) => {
      const sorted = [...themeItems].sort(
        (a, b) => (SENTIMENT_ORDER[a.sentiment] ?? 1) - (SENTIMENT_ORDER[b.sentiment] ?? 1)
      );
      const rows = sorted.map(itemRow).join("");

      return `
        <div class="theme-card stagger-in">
          <h3>${escapeHtml(theme)} <span class="theme-count">${themeItems.length}</span></h3>
          ${rows}
        </div>`;
    })
    .join("");

  groupsEl.querySelectorAll("[data-toggle-id]").forEach((el) => {
    el.addEventListener("change", (e) => {
      toggleSynced(el.dataset.toggleId, e.target.checked);
    });
  });
}

function sentimentBadge(sentiment) {
  if (!sentiment) return "";
  const cls = sentiment.toLowerCase();
  return `<span class="badge ${cls}">${escapeHtml(sentiment)}</span>`;
}

function itemRow(item) {
  const date = new Date(item.submittedAt).toLocaleDateString();
  const who = item.name ? escapeHtml(item.name) : "Anonymous";

  return `
    <div class="feedback-item">
      <div class="feedback-item-head">
        <span class="feedback-who">${who} <span class="feedback-meta">&middot; ${escapeHtml(item.tenure)} &middot; ${date}</span></span>
        <span>${sentimentBadge(item.sentiment)}</span>
      </div>
      <dl class="feedback-body">
        <dt>Trouble spot</dt>
        <dd>${escapeHtml(item.painPoint)}</dd>
        <dt>Would help</dt>
        <dd>${escapeHtml(item.wish)}</dd>
      </dl>
      <label class="sync-toggle">
        <input type="checkbox" data-toggle-id="${item.id}" ${item.synced ? "checked" : ""} />
        Synced to backlog
      </label>
    </div>`;
}

function exportItems(format) {
  const showSynced = showSyncedCheckbox.checked;
  const visible = allItems.filter((i) => showSynced || !i.synced);

  if (!visible.length) {
    setStatus("Nothing to export.", "error");
    return;
  }

  let content, mime, filename;

  if (format === "csv") {
    const rows = [["Name", "Tenure", "Theme", "Sentiment", "Trouble spot", "Would help", "Submitted", "Synced"]];
    for (const item of visible) {
      rows.push([
        item.name || "Anonymous",
        item.tenure,
        item.theme || "",
        item.sentiment || "",
        item.painPoint,
        item.wish,
        item.submittedAt,
        item.synced ? "yes" : "no",
      ]);
    }
    content = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
    mime = "text/csv";
    filename = "feedback-export.csv";
  } else {
    const themes = {};
    for (const item of visible) {
      const theme = item.theme || "Not analyzed yet";
      if (!themes[theme]) themes[theme] = [];
      themes[theme].push(item);
    }
    let md = "";
    for (const [theme, items] of Object.entries(themes)) {
      md += `## ${theme}\n\n`;
      for (const item of items) {
        const who = item.name || "Anonymous";
        md += `- **${who}** (${item.tenure}, ${item.sentiment || "Neutral"}) — trouble: ${item.painPoint} | would help: ${item.wish}\n`;
      }
      md += "\n";
    }
    content = md;
    mime = "text/markdown";
    filename = "feedback-export.md";
  }

  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  const str = String(value ?? "");
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function setStatus(message, kind) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", kind === "error");
  statusEl.classList.toggle("success", kind === "success");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
