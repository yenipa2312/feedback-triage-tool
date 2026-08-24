// Dashboard endpoint - flips the "synced to backlog" flag on one item.

const { feedbackStore } = require("./lib/store");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  let id, synced;
  try {
    ({ id, synced } = JSON.parse(event.body || "{}"));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid request body" }) };
  }

  if (!id) {
    return { statusCode: 400, body: JSON.stringify({ error: "id is required" }) };
  }

  const store = feedbackStore();
  const items = (await store.get("items", { type: "json" })) || [];
  const updated = items.map((item) => (item.id === id ? { ...item, synced: !!synced } : item));

  await store.setJSON("items", updated);

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
