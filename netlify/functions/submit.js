// Public endpoint - agents POST their feedback here. Stored in Netlify Blobs
// as a single JSON array under the "feedback" store. No auth: the link is
// meant to be open, per the team's low-stakes internal use case.

const { feedbackStore } = require("./lib/store");

const TENURE_VALUES = new Set([
  "Less than 6 months",
  "6 months to 1 year",
  "1 to 3 years",
  "3 to 5 years",
  "5+ years",
]);

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  let name, tenure, painPoint, wish, mood;
  try {
    ({ name, tenure, painPoint, wish, mood } = JSON.parse(event.body || "{}"));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid request body" }) };
  }

  const moodValue = Number.isInteger(mood) && mood >= 1 && mood <= 5 ? mood : null;

  if (!TENURE_VALUES.has(tenure)) {
    return { statusCode: 400, body: JSON.stringify({ error: "Please select how long you've been working here." }) };
  }
  if (!painPoint || typeof painPoint !== "string" || !painPoint.trim()) {
    return { statusCode: 400, body: JSON.stringify({ error: "Please answer where the trouble is." }) };
  }
  if (!wish || typeof wish !== "string" || !wish.trim()) {
    return { statusCode: 400, body: JSON.stringify({ error: "Please answer what would help most." }) };
  }

  const store = feedbackStore();
  const items = (await store.get("items", { type: "json" })) || [];

  items.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: typeof name === "string" && name.trim() ? name.trim() : null,
    tenure,
    painPoint: painPoint.trim(),
    wish: wish.trim(),
    mood: moodValue,
    submittedAt: new Date().toISOString(),
    theme: null,
    sentiment: null,
    synced: false,
  });

  await store.setJSON("items", items);

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
