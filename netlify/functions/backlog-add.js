// Dashboard endpoint - adds one item to the PM's backlog (title, optional
// description, and an issue type). Used both for manual entries and the
// "Add to backlog" one-click action on an unmatched issue subject.
// The "type" field exists so this list is already shaped like Jira import
// data (Issue Type / Summary / Description) for whenever real Jira
// integration gets wired up - no Jira API today, just the right shape.

const { backlogStore } = require("./lib/store");

const ISSUE_TYPES = new Set(["Task", "Story"]);

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  let title, description, type;
  try {
    ({ title, description, type } = JSON.parse(event.body || "{}"));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid request body" }) };
  }

  if (!title || typeof title !== "string" || !title.trim()) {
    return { statusCode: 400, body: JSON.stringify({ error: "A title is required." }) };
  }

  const store = backlogStore();
  const items = (await store.get("items", { type: "json" })) || [];

  const newItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: title.trim(),
    description: typeof description === "string" ? description.trim() : "",
    type: ISSUE_TYPES.has(type) ? type : "Task",
    createdAt: new Date().toISOString(),
  };
  items.push(newItem);

  await store.setJSON("items", items);

  return { statusCode: 200, body: JSON.stringify({ items, newItem }) };
};
