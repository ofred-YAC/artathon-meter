// netlify/functions/donations.js

const DP_API_KEY = process.env.DP_API_KEY;
const DP_BASE_URL = "https://www.donorperfect.net/prod/xmlrequest.asp";

export const handler = async () => {
  // DP online forms store their form ID in the dp_form field on dpgift.
  // "ARTathon donation form" has id=3, so we filter by dp_form=3.
  const sql = `SELECT SUM(amount) AS total_donated, COUNT(*) AS gift_count FROM dpgift WHERE dp_form = 3 AND record_type = 'G'`;

  const url = `${DP_BASE_URL}?apikey=${DP_API_KEY}&action=${encodeURIComponent(sql)}`;

  try {
    const response = await fetch(url);
    const text = await response.text();

    // DP returns single-quoted XML attributes: name='foo' value='bar'
    const getValue = (name) => {
      const match = text.match(new RegExp(`name='${name}'[^/]*value='([^']*)'`));
      return match ? match[1] : null;
    };

    const total = parseFloat(getValue("total_donated") || 0);
    const count = parseInt(getValue("gift_count") || 0, 10);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ total, count }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
