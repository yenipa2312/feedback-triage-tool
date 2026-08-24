const analyzeBtn = document.getElementById("analyze-btn");
const refreshBtn = document.getElementById("refresh-btn");
const showSyncedCheckbox = document.getElementById("show-synced");
const experienceFilter = document.getElementById("experience-filter");
const exportCsvBtn = document.getElementById("export-csv-btn");
const exportMdBtn = document.getElementById("export-md-btn");
const statusEl = document.getElementById("status");
const summaryEl = document.getElementById("summary");
const groupsEl = document.getElementById("theme-groups");
const backlogListEl = document.getElementById("backlog-list");
const backlogCountEl = document.getElementById("backlog-count");
const backlogForm = document.getElementById("backlog-form");
const backlogTitleInput = document.getElementById("backlog-title");
const backlogDescriptionInput = document.getElementById("backlog-description");

const SENTIMENT_ORDER = { Negative: 0, Neutral: 1, Positive: 2 };

let allItems = [];
let backlogItems = [];

analyzeBtn.addEventListener("click", analyzeNew);
refreshBtn.addEventListener("click", () => { loadItems(); loadBacklog(); });
showSyncedCheckbox.addEventListener("change", render);
experienceFilter.addEventListener("change", render);
exportCsvBtn.addEventListener("click", () => exportItems("csv"));
exportMdBtn.addEventListener("click", () => exportItems("md"));
backlogForm.addEventListener("submit", addBacklogItem);

loadItems();
loadBacklog();

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

async function loadBacklog() {
  try {
    const res = await fetch("/.netlify/functions/backlog-list");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load backlog.");
    backlogItems = data.items || [];
    renderBacklog();
  } catch (err) {
    setStatus(err.message, "error");
  }
}

async function addBacklogItem(e) {
  e.preventDefault();
  const title = backlogTitleInput.value.trim();
  const description = backlogDescriptionInput.value.trim();
  if (!title) return;

  try {
    const res = await fetch("/.netlify/functions/backlog-add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not add backlog item.");
    backlogItems = data.items || [];
    backlogForm.reset();
    renderBacklog();
  } catch (err) {
    setStatus(err.message, "error");
  }
}

async function addSubjectToBacklog(subject, groupItems) {
  const theme = groupItems[0]?.theme || "Other";
  const description = `Reported by ${groupItems.length} agent(s), theme: ${theme}. Example: "${groupItems[0].painPoint}"`;

  try {
    const res = await fetch("/.netlify/functions/backlog-add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: subject, description }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not add backlog item.");
    backlogItems = data.items || [];

    const newId = data.newItem?.id;
    if (newId) {
      for (const item of allItems) {
        if (item.subject === subject) item.backlogMatchId = newId;
      }
    }
    renderBacklog();
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

function renderBacklog() {
  backlogCountEl.textContent = backlogItems.length;
  if (!backlogItems.length) {
    backlogListEl.innerHTML = `<p class="empty-state">Nothing in your backlog yet — add items below, or use "Add to backlog" on an unmatched issue.</p>`;
    return;
  }
  backlogListEl.innerHTML = backlogItems
    .map(
      (b) => `
      <div class="backlog-item">
        <strong>${escapeHtml(b.title)}</strong>
        ${b.description ? `<span class="feedback-meta">${escapeHtml(b.description)}</span>` : ""}
      </div>`
    )
    .join("");
}

function render() {
  const showSynced = showSyncedCheckbox.checked;
  const experience = experienceFilter.value;
  const visible = allItems.filter(
    (i) => (showSynced || !i.synced) && (!experience || i.tenure === experience)
  );
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
      return `
        <div class="theme-card stagger-in">
          <h3>${escapeHtml(theme)} <span class="theme-count">${themeItems.length}</span></h3>
          ${subjectGroups(theme, themeItems)}
          ${suggestionsBlock(theme)}
        </div>`;
    })
    .join("");

  groupsEl.querySelectorAll("[data-toggle-id]").forEach((el) => {
    el.addEventListener("change", (e) => {
      toggleSynced(el.dataset.toggleId, e.target.checked);
    });
  });

  groupsEl.querySelectorAll("[data-add-subject]").forEach((el) => {
    el.addEventListener("click", () => {
      const subject = el.dataset.addSubject;
      const groupItems = visible.filter((i) => (i.subject || null) === subject);
      addSubjectToBacklog(subject, groupItems);
    });
  });
}

function subjectGroups(theme, themeItems) {
  const groups = {};
  for (const item of themeItems) {
    const key = item.subject || (item.theme ? item.painPoint : "Not analyzed yet");
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }

  const sortedGroups = Object.entries(groups).sort((a, b) => b[1].length - a[1].length);

  return sortedGroups
    .map(([subject, groupItems]) => {
      const sorted = [...groupItems].sort(
        (a, b) => (SENTIMENT_ORDER[a.sentiment] ?? 1) - (SENTIMENT_ORDER[b.sentiment] ?? 1)
      );
      const rows = sorted.map(itemRow).join("");
      const isAnalyzed = Boolean(groupItems[0].theme);

      return `
        <div class="subject-group">
          <div class="subject-head">
            <span class="subject-title">${escapeHtml(subject)} <span class="theme-count">${groupItems.length}</span></span>
            ${isAnalyzed ? backlogMatchBadge(subject, groupItems) : ""}
          </div>
          ${rows}
        </div>`;
    })
    .join("");
}

function backlogMatchBadge(subject, groupItems) {
  const matchId = groupItems[0].backlogMatchId;
  const match = matchId ? backlogItems.find((b) => b.id === matchId) : null;

  if (match) {
    return `<span class="badge positive">In backlog: ${escapeHtml(match.title)}</span>`;
  }

  return `
    <span class="badge outline">Not in your backlog</span>
    <button type="button" class="secondary add-to-backlog-btn" data-add-subject="${escapeHtml(subject)}">Add to backlog</button>`;
}

function suggestionsBlock(theme) {
  const entry = typeof OPEN_SOURCE_PLAYBOOK !== "undefined" ? OPEN_SOURCE_PLAYBOOK[theme] : null;
  if (!entry) return "";

  const tips = entry.tips.map((tip) => `<li>${escapeHtml(tip)}</li>`).join("");
  const sources = entry.sources
    .map((s) => `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(s.title)}</a>`)
    .join(" &middot; ");

  return `
    <div class="suggestions">
      <p class="suggestions-label">Suggestions from research</p>
      <ul class="suggestions-list">${tips}</ul>
      <p class="suggestions-sources">${sources}</p>
    </div>`;
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
  const experience = experienceFilter.value;
  const visible = allItems.filter(
    (i) => (showSynced || !i.synced) && (!experience || i.tenure === experience)
  );

  if (!visible.length) {
    setStatus("Nothing to export.", "error");
    return;
  }

  let content, mime, filename;

  if (format === "csv") {
    const rows = [["Name", "Tenure", "Theme", "Subject", "Sentiment", "Trouble spot", "Would help", "Submitted", "Synced"]];
    for (const item of visible) {
      rows.push([
        item.name || "Anonymous",
        item.tenure,
        item.theme || "",
        item.subject || "",
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
        md += `- **${who}** (${item.tenure}, ${item.sentiment || "Neutral"}${item.subject ? `, ${item.subject}` : ""}) — trouble: ${item.painPoint} | would help: ${item.wish}\n`;
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
