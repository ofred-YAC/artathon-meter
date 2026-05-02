// netlify/functions/donations.js

const DP_API_KEY = process.env.DP_API_KEY;
const DP_BASE_URL = "https://www.donorperfect.net/prod/xmlrequest.asp";

export const handler = async () => {
  // Check the API key is actually set
  if (!DP_API_KEY) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "DP_API_KEY is not set in environment variables" }),
    };
  }

  // Try a super simple query first — just grab 1 gift to confirm the API works at all
  const sql = `SELECT TOP 1 gift_id, amount, gift_narrative, sub_solicit_code, campaign FROM dpgift ORDER BY gift_id DESC`;

  const url = `${DP_BASE_URL}?apikey=${DP_API_KEY}&action=${encodeURIComponent(sql)}`;

  try {
    const response = await fetch(url);
    const text = await response.text();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        http_status: response.status,
        raw: text,
        url_used: url.replace(DP_API_KEY, "REDACTED"),
      }),
    };
  } catch (err) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fetch_error: err.message }),
    };
  }
};
