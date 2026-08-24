// Dashboard endpoint - returns every stored feedback item as-is (analyzed or not).

const { getStore } = require("@netlify/blobs");

exports.handler = async () => {
  const store = getStore("feedback");
  const items = (await store.get("items", { type: "json" })) || [];

  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ items }),
  };
};
