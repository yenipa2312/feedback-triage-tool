// Dashboard endpoint - adds one item to the PM's backlog (title + optional
// description). Used both for manual entries and the "Add to backlog"
// one-click action on an unmatched issue subject.

const { backlogStore } = require("./lib/store");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  let title, description;
  try {
    ({ title, description } = JSON.parse(event.body || "{}"));
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
    createdAt: new Date().toISOString(),
  };
  items.push(newItem);

  await store.setJSON("items", items);

  return { statusCode: 200, body: JSON.stringify({ items, newItem }) };
};
