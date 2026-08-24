// Dashboard endpoint - returns the PM's current backlog items, used both
// for display and as reference material for analyze.js's matching step.

const { backlogStore } = require("./lib/store");

exports.handler = async () => {
  const store = backlogStore();
  const items = (await store.get("items", { type: "json" })) || [];

  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ items }),
  };
};
