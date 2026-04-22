const https = require("https");

exports.handler = async function (event, context) {
  const apiKey = process.env.DONORPERFECT_API_KEY;

  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "API key not configured" }),
    };
  }

  // SQL to sum all gifts for calendar year 2026
  const sql = encodeURIComponent(
    `SELECT SUM(amount) as total, COUNT(*) as count FROM gift WHERE gift_date >= '01/01/2026' AND gift_date <= '12/31/2026' AND record_type = 'G'`
  );

  const url = `https://www.donorperfect.net/prod/xmlrequest.asp?apikey=${apiKey}&action=dp_sqlselect&version=1&sql=${sql}`;

  return new Promise((resolve) => {
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            // Parse XML response to extract total
            const totalMatch = data.match(/<total[^>]*>([^<]*)<\/total>/i);
            const countMatch = data.match(/<count[^>]*>([^<]*)<\/count>/i);

            const total = totalMatch ? parseFloat(totalMatch[1]) || 0 : 0;
            const count = countMatch ? parseInt(countMatch[1]) || 0 : 0;

            resolve({
              statusCode: 200,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
              },
              body: JSON.stringify({ total, count }),
            });
          } catch (err) {
            resolve({
              statusCode: 500,
              body: JSON.stringify({ error: "Failed to parse response", raw: data }),
            });
          }
        });
      })
      .on("error", (err) => {
        resolve({
          statusCode: 500,
          body: JSON.stringify({ error: err.message }),
        });
      });
  });
};
