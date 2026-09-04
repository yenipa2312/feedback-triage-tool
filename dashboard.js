const analyzeBtn = document.getElementById("analyze-btn");
const refreshBtn = document.getElementById("refresh-btn");
const showSyncedCheckbox = document.getElementById("show-synced");
const experienceFilter = document.getElementById("experience-filter");
const journeyFilter = document.getElementById("journey-filter");
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
const backlogTypeInput = document.getElementById("backlog-type");
const exportBacklogBtn = document.getElementById("export-backlog-btn");
const statsRowEl = document.getElementById("stats-row");
const pulseBarEl = document.getElementById("pulse-bar");

const SENTIMENT_ORDER = { Negative: 0, Neutral: 1, Positive: 2 };
const MOOD_EMOJI = { 1: "😞", 2: "🙁", 3: "😐", 4: "🙂", 5: "😄" };
const NEW_WINDOW_MS = 48 * 60 * 60 * 1000;

let allItems = [];
let backlogItems = [];

analyzeBtn.addEventListener("click", analyzeNew);
refreshBtn.addEventListener("click", () => { loadItems(); loadBacklog(); });
showSyncedCheckbox.addEventListener("change", render);
experienceFilter.addEventListener("change", render);
journeyFilter.addEventListener("change", render);
exportCsvBtn.addEventListener("click", () => exportItems("csv"));
exportMdBtn.addEventListener("click", () => exportItems("md"));
backlogForm.addEventListener("submit", addBacklogItem);
exportBacklogBtn.addEventListener("click", exportBacklog);

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
  const type = backlogTypeInput.value;
  if (!title) return;

  try {
    const res = await fetch("/.netlify/functions/backlog-add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, type }),
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

async function addSubjectToBacklog(subject, groupItems, type) {
  const theme = groupItems[0]?.theme || "Other";
  const description = `Reported by ${groupItems.length} agent(s), theme: ${theme}. Example: "${groupItems[0].painPoint}"`;

  try {
    const res = await fetch("/.netlify/functions/backlog-add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: subject, description, type }),
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
        <strong><span class="badge outline">${escapeHtml(b.type || "Task")}</span> ${escapeHtml(b.title)}</strong>
        ${b.description ? `<span class="feedback-meta">${escapeHtml(b.description)}</span>` : ""}
      </div>`
    )
    .join("");
}

function getVisibleItems() {
  const showSynced = showSyncedCheckbox.checked;
  const experience = experienceFilter.value;
  const journeyStage = journeyFilter.value;
  return allItems.filter(
    (i) =>
      (showSynced || !i.synced) &&
      (!experience || i.tenure === experience) &&
      (!journeyStage || i.journeyStage === journeyStage)
  );
}

function render() {
  const visible = getVisibleItems();
  const unanalyzedCount = allItems.filter((i) => !i.theme).length;

  summaryEl.textContent = `${allItems.length} total · ${unanalyzedCount} not yet analyzed · showing ${visible.length}`;

  renderStats(visible);
  renderPulseBar(visible);

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
      const recognitionClass = theme === "Praise" ? " recognition" : "";
      const icon = theme === "Praise" ? "🎉 " : "";
      return `
        <div class="theme-card stagger-in${recognitionClass}">
          <h3>${icon}${escapeHtml(theme)} <span class="theme-count">${themeItems.length}</span></h3>
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
      const typeSelect = el.parentElement.querySelector("[data-subject-type]");
      addSubjectToBacklog(subject, groupItems, typeSelect ? typeSelect.value : "Task");
    });
  });
}

function renderPulseBar(visible) {
  const analyzed = visible.filter((i) => i.sentiment);
  if (!analyzed.length) {
    pulseBarEl.innerHTML = "";
    return;
  }

  const counts = { Positive: 0, Neutral: 0, Negative: 0 };
  for (const item of analyzed) {
    if (counts[item.sentiment] !== undefined) counts[item.sentiment] += 1;
  }
  const total = analyzed.length;
  const pct = (n) => Math.round((n / total) * 100);

  pulseBarEl.innerHTML = `
    <div class="pulse-track">
      <span class="pulse-segment positive" style="flex: ${counts.Positive}"></span>
      <span class="pulse-segment neutral" style="flex: ${counts.Neutral}"></span>
      <span class="pulse-segment negative" style="flex: ${counts.Negative}"></span>
    </div>
    <div class="pulse-legend">
      <span><span class="pulse-dot positive"></span>${pct(counts.Positive)}% positive</span>
      <span><span class="pulse-dot neutral"></span>${pct(counts.Neutral)}% neutral</span>
      <span><span class="pulse-dot negative"></span>${pct(counts.Negative)}% negative</span>
      <span>(${total} analyzed)</span>
    </div>`;
}

function renderStats(visible) {
  if (!visible.length) {
    statsRowEl.innerHTML = "";
    return;
  }

  const negative = visible.filter((i) => i.sentiment === "Negative").length;

  const themeCounts = {};
  for (const item of visible) {
    if (!item.theme) continue;
    themeCounts[item.theme] = (themeCounts[item.theme] || 0) + 1;
  }
  const topThemeEntry = Object.entries(themeCounts).sort((a, b) => b[1] - a[1])[0];
  const topTheme = topThemeEntry ? `${topThemeEntry[0]} (${topThemeEntry[1]})` : "—";

  const journeyCounts = {};
  for (const item of visible) {
    if (!item.journeyStage || item.journeyStage === "Other") continue;
    journeyCounts[item.journeyStage] = (journeyCounts[item.journeyStage] || 0) + 1;
  }
  const topJourneyEntry = Object.entries(journeyCounts).sort((a, b) => b[1] - a[1])[0];
  const topJourneyStage = topJourneyEntry ? `${topJourneyEntry[0]} (${topJourneyEntry[1]})` : "—";

  const analyzed = visible.filter((i) => i.theme && i.theme !== "Praise");
  const subjectsSeen = new Set();
  let unmatchedSubjects = 0;
  for (const item of analyzed) {
    const key = item.subject || item.painPoint;
    if (subjectsSeen.has(key)) continue;
    subjectsSeen.add(key);
    if (!item.backlogMatchId) unmatchedSubjects += 1;
  }

  const tiles = [
    { value: visible.length, label: "Feedback shown", accent: false },
    { value: negative, label: "Negative sentiment", accent: negative > 0 },
    { value: topTheme, label: "Top theme", accent: false },
    { value: topJourneyStage, label: "Top journey stage", accent: false },
    { value: unmatchedSubjects, label: "Issues not in backlog", accent: unmatchedSubjects > 0 },
  ];

  statsRowEl.innerHTML = tiles
    .map(
      (t) => `
      <div class="stat-tile">
        <div class="stat-value${t.accent ? " accent" : ""}">${escapeHtml(String(t.value))}</div>
        <div class="stat-label">${escapeHtml(t.label)}</div>
      </div>`
    )
    .join("");
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
    const typeLabel = match.type ? `${match.type}: ` : "";
    return `<span class="badge positive">In backlog: ${typeLabel}${escapeHtml(match.title)}</span>`;
  }

  return `
    <span class="badge outline">Not in your backlog</span>
    <select class="subject-type-select" data-subject-type aria-label="Issue type for ${escapeHtml(subject)}">
      <option value="Task">Task</option>
      <option value="Story">Story</option>
    </select>
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
  const isNew = Date.now() - new Date(item.submittedAt).getTime() < NEW_WINDOW_MS;
  const moodEmoji = MOOD_EMOJI[item.mood] || "";

  return `
    <div class="feedback-item">
      <div class="feedback-item-head">
        <span class="feedback-who">${moodEmoji ? `<span class="mood-emoji" title="Mood: ${item.mood}/5">${moodEmoji}</span> ` : ""}${who} <span class="feedback-meta">&middot; ${escapeHtml(item.tenure)} &middot; ${date}</span></span>
        <span>${isNew ? '<span class="badge new">New</span> ' : ""}${item.journeyStage ? `<span class="badge outline">${escapeHtml(item.journeyStage)}</span> ` : ""}${sentimentBadge(item.sentiment)}</span>
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
  const visible = getVisibleItems();

  if (!visible.length) {
    setStatus("Nothing to export.", "error");
    return;
  }

  let content, mime, filename;

  if (format === "csv") {
    const rows = [["Name", "Tenure", "Mood", "Theme", "Subject", "Journey stage", "Sentiment", "Trouble spot", "Would help", "Submitted", "Synced"]];
    for (const item of visible) {
      rows.push([
        item.name || "Anonymous",
        item.tenure,
        item.mood || "",
        item.theme || "",
        item.subject || "",
        item.journeyStage || "",
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

function exportBacklog() {
  if (!backlogItems.length) {
    setStatus("Your backlog is empty — nothing to export.", "error");
    return;
  }

  // Standard Jira CSV-import column names, so this file can be dropped
  // straight into a bulk import once real Jira integration exists.
  const rows = [["Issue Type", "Summary", "Description"]];
  for (const b of backlogItems) {
    rows.push([b.type || "Task", b.title, b.description || ""]);
  }
  const content = rows.map((r) => r.map(csvEscape).join(",")).join("\n");

  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "backlog-jira-import.csv";
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
