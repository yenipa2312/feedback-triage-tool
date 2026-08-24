// Dashboard endpoint - finds items without a theme yet, asks Claude to:
//  1. classify theme + sentiment (as before)
//  2. extract a short "subject" so items about the same underlying issue
//     can be grouped together, even across different agents' wording
//  3. check the subject against the PM's current backlog and flag a match
// Persists all of it back to storage and returns the full updated list.

const { feedbackStore, backlogStore } = require("./lib/store");

exports.handler = async () => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server is missing ANTHROPIC_API_KEY. Set it in Netlify env vars." }),
    };
  }

  const store = feedbackStore();
  const items = (await store.get("items", { type: "json" })) || [];
  const unanalyzed = items.filter((item) => !item.theme);

  if (unanalyzed.length === 0) {
    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items }),
    };
  }

  const backlog = (await backlogStore().get("items", { type: "json" })) || [];
  const backlogForPrompt = backlog.length
    ? backlog.map((b) => `${b.id}: ${b.title}${b.description ? ` — ${b.description}` : ""}`).join("\n")
    : "(backlog is currently empty)";

  const listForPrompt = unanalyzed
    .map((item) => `${item.id}:\nTrouble spot: ${item.painPoint}\nWould help: ${item.wish}`)
    .join("\n\n");

  const prompt = `You are triaging feedback from call center agents for a product manager.
Each item has two parts: where they run into trouble on calls, and what
would help them most. Classify the item as a whole.

For each item below, output:
- "theme": one of Tooling, Process, Training, Workload, Communication, Compensation, Praise, Other
- "subject": a short, specific label (3-6 words) for the actual underlying
  issue, e.g. "Slow order history lookup". If two or more items clearly
  describe the same underlying issue, use the EXACT SAME subject text for
  all of them, so they can be grouped together automatically.
- "sentiment": one of Positive, Neutral, Negative
- "backlogMatchId": the id of a backlog item below that already covers this
  same underlying issue, or null if none of them genuinely do. Only match
  when it's really the same issue, not just the same general theme.

Existing backlog:
${backlogForPrompt}

Items to classify:
${listForPrompt}

Respond with ONLY valid JSON (no markdown fences, no commentary), matching each item by its exact id:
{"items":[{"id":"...","theme":"...","subject":"...","sentiment":"...","backlogMatchId":"..."}]}`;

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
      if (!result) return item;
      return {
        ...item,
        theme: result.theme,
        subject: result.subject || null,
        sentiment: result.sentiment,
        backlogMatchId: result.backlogMatchId || null,
      };
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
