// Dashboard endpoint - finds items without a theme yet, asks Claude to
// classify them by theme + sentiment, persists the result, and returns
// the full updated list.

const { getStore } = require("@netlify/blobs");

exports.handler = async () => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server is missing ANTHROPIC_API_KEY. Set it in Netlify env vars." }),
    };
  }

  const store = getStore("feedback");
  const items = (await store.get("items", { type: "json" })) || [];
  const unanalyzed = items.filter((item) => !item.theme);

  if (unanalyzed.length === 0) {
    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items }),
    };
  }

  const listForPrompt = unanalyzed
    .map((item) => `${item.id}:\nTrouble spot: ${item.painPoint}\nWould help: ${item.wish}`)
    .join("\n\n");

  const prompt = `You are triaging feedback from call center agents for a product manager.
Each item has two parts: where they run into trouble on calls, and what
would help them most. Classify the item as a whole.

For each item below, classify:
- "theme": one of Tooling, Process, Training, Workload, Communication, Compensation, Praise, Other
- "sentiment": one of Positive, Neutral, Negative

Respond with ONLY valid JSON (no markdown fences, no commentary), matching each item by its exact id:
{"items":[{"id":"...","theme":"...","sentiment":"..."}]}

Items:
${listForPrompt}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return { statusCode: response.status, body: JSON.stringify({ error: `Anthropic API error: ${errText}` }) };
    }

    const data = await response.json();
    const raw = data.content?.[0]?.text ?? "{}";
    const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```$/, "");
    const parsed = JSON.parse(cleaned);

    const byId = new Map((parsed.items || []).map((i) => [i.id, i]));
    const updated = items.map((item) => {
      const result = byId.get(item.id);
      return result ? { ...item, theme: result.theme, sentiment: result.sentiment } : item;
    });

    await store.setJSON("items", updated);

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: updated }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
