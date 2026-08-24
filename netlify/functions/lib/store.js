// Netlify normally auto-configures Blobs for deployed functions, but some
// sites don't get that context injected. Falling back to explicit
// siteID/token (from env vars) if they're set, per Netlify's own guidance
// for MissingBlobsEnvironmentError.

const { getStore } = require("@netlify/blobs");

function feedbackStore() {
  const siteID = process.env.NETLIFY_BLOBS_SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN;

  if (siteID && token) {
    return getStore({ name: "feedback", siteID, token });
  }

  return getStore("feedback");
}

module.exports = { feedbackStore };
