// netlify/functions/donations.js

const DP_API_KEY = process.env.DP_API_KEY;
const DP_BASE_URL = "https://www.donorperfect.net/prod/xmlrequest.asp";

const fetchDP = async (sql) => {
  const url = `${DP_BASE_URL}?apikey=${DP_API_KEY}&action=${encodeURIComponent(sql)}`;
  const res = await fetch(url);
  return res.text();
};

// DP returns single-quoted XML: name='foo' value='bar'
const parseRecords = (text) => {
  const records = [];
  const recordMatches = text.matchAll(/<record>(.*?)<\/record>/gs);
  for (const rec of recordMatches) {
    const fields = {};
    const fieldMatches = rec[1].matchAll(/name='([^']+)'[^/]*value='([^']*)'/g);
    for (const f of fieldMatches) {
      fields[f[1]] = f[2];
    }
    records.push(fields);
  }
  return records;
};

export const handler = async () => {
  try {
    // Query 1: total donated
    const totalXml = await fetchDP(
      `SELECT SUM(amount) AS total_donated, COUNT(*) AS gift_count FROM dpgift WHERE record_type = 'G'`
    );
    const totalRecord = parseRecords(totalXml)[0] || {};
    const total = parseFloat(totalRecord.total_donated || 0);
    const count = parseInt(totalRecord.gift_count || 0, 10);

    // Query 2: last 3 gifts with donor name and date
    const recentXml = await fetchDP(
      `SELECT TOP 3 g.gift_id, g.amount, g.gift_date, d.first_name, d.last_name, d.org_rec FROM dpgift g JOIN dp d ON g.donor_id = d.donor_id WHERE g.record_type = 'G' ORDER BY g.gift_date DESC, g.gift_id DESC`
    );
    const recentRecords = parseRecords(recentXml);

    const today = new Date();
    const recent = recentRecords.map((r) => {
      const giftDate = new Date(r.gift_date);
      const daysAgo = Math.floor((today - giftDate) / (1000 * 60 * 60 * 24));

      
      const name = r.org_rec === "Y"
        ? r.last_name
        : `${r.first_name}`.trim();

      return {
        name: name || "Anonymous",
        amount: parseFloat(r.amount || 0),
        daysAgo,
      };
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ total, count, recent }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
