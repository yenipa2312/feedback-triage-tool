// Public endpoint - agents POST their feedback here. Stored in Netlify Blobs
// as a single JSON array under the "feedback" store. No auth: the link is
// meant to be open, per the team's low-stakes internal use case.

const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  let text;
  try {
    ({ text } = JSON.parse(event.body || "{}"));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid request body" }) };
  }

  if (!text || typeof text !== "string" || !text.trim()) {
    return { statusCode: 400, body: JSON.stringify({ error: "Feedback text is required." }) };
  }

  const store = getStore("feedback");
  const items = (await store.get("items", { type: "json" })) || [];

  items.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text: text.trim(),
    submittedAt: new Date().toISOString(),
    theme: null,
    sentiment: null,
    synced: false,
  });

  await store.setJSON("items", items);

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
