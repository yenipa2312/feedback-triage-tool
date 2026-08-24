// Netlify serverless function.
// Receives raw feedback text from the browser, asks Claude to sort it into
// themes + sentiment, and returns structured JSON. The Anthropic API key
// lives only in the Netlify environment variable ANTHROPIC_API_KEY -
// it never touches the browser.

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  let feedback;
  try {
    ({ feedback } = JSON.parse(event.body || "{}"));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid request body" }) };
  }

  if (!feedback || typeof feedback !== "string" || !feedback.trim()) {
    return { statusCode: 400, body: JSON.stringify({ error: "Please provide feedback text." }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server is missing ANTHROPIC_API_KEY. Set it in Netlify env vars." }),
    };
  }

  const prompt = `You are triaging raw product feedback for a product manager.

Split the feedback below into individual items (each distinct thought or line is one item).
For each item, classify:
- "theme": one of Bug, Feature Request, UX Issue, Pricing, Onboarding, Performance, Support, Praise, Other
- "sentiment": one of Positive, Neutral, Negative

Respond with ONLY valid JSON (no markdown fences, no commentary), in exactly this shape:
{"items":[{"text":"original text of the item","theme":"...","sentiment":"..."}]}

Feedback:
"""
${feedback}
"""`;

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

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
