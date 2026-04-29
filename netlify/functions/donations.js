const https = require("https");

exports.handler = async function (event, context) {
  const apiKey = process.env.DONORPERFECT_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "API key not configured" }) };
  }

  function dpFetch(sql) {
    const url = `https://www.donorperfect.net/prod/xmlrequest.asp?apikey=${apiKey}&action=dp_sqlselect&version=1&sql=${encodeURIComponent(sql)}`;
    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      }).on("error", reject);
    });
  }

  function parseField(xml, field) {
    const match = xml.match(new RegExp(`<${field}[^>]*>([^<]*)<\/${field}>`, "i"));
    return match ? match[1].trim() : null;
  }

  function parseAllRecords(xml, field) {
    const regex = new RegExp(`<${field}[^>]*>([^<]*)<\/${field}>`, "gi");
    const results = [];
    let match;
    while ((match = regex.exec(xml)) !== null) results.push(match[1].trim());
    return results;
  }

  try {
    // Query 1: total raised + donor count for 2026
    const totalXml = await dpFetch(
      `SELECT SUM(amount) as total, COUNT(*) as count FROM gift WHERE gift_date >= '01/01/2026' AND gift_date <= '12/31/2026' AND record_type = 'G'`
    );

    // Query 2: last 3 donations with donor name and date
    const recentXml = await dpFetch(
      `SELECT TOP 3 g.amount, g.gift_date, dp.first_name, dp.last_name FROM gift g JOIN dp ON g.donor_id = dp.donor_id WHERE g.gift_date >= '01/01/2026' AND g.record_type = 'G' ORDER BY g.gift_date DESC, g.gift_id DESC`
    );

    const total = parseFloat(parseField(totalXml, "total")) || 0;
    const count = parseInt(parseField(totalXml, "count")) || 0;

    const amounts = parseAllRecords(recentXml, "amount");
    const dates = parseAllRecords(recentXml, "gift_date");
    const firstNames = parseAllRecords(recentXml, "first_name");
    const lastNames = parseAllRecords(recentXml, "last_name");

    const recent = amounts.map((amt, i) => ({
      amount: parseFloat(amt) || 0,
      date: dates[i] || "",
      name: `${firstNames[i] || ""} ${lastNames[i] || ""}`.trim() || "Anonymous",
    }));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ total, count, recent }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};javascriptconst https = require("https");

exports.handler = async function (event, context) {
  const apiKey = process.env.DONORPERFECT_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "API key not configured" }) };
  }

  function dpFetch(sql) {
    const url = `https://www.donorperfect.net/prod/xmlrequest.asp?apikey=${apiKey}&action=dp_sqlselect&version=1&sql=${encodeURIComponent(sql)}`;
    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      }).on("error", reject);
    });
  }

  function parseField(xml, field) {
    const match = xml.match(new RegExp(`<${field}[^>]*>([^<]*)<\/${field}>`, "i"));
    return match ? match[1].trim() : null;
  }

  // Splits XML into individual <record>...</record> blocks, then extracts fields from each
  function parseRecords(xml) {
    const records = [];
    const recordRegex = /<record[^>]*>([\s\S]*?)<\/record>/gi;
    let recordMatch;
    while ((recordMatch = recordRegex.exec(xml)) !== null) {
      const block = recordMatch[1];
      const get = (field) => {
        const m = block.match(new RegExp(`<${field}[^>]*>([^<]*)<\/${field}>`, "i"));
        return m ? m[1].trim() : "";
      };
      records.push({
        amount: parseFloat(get("amount")) || 0,
        date: get("gift_date"),
        name: (`${get("first_name")} ${get("last_name")}`).trim() || "Anonymous",
      });
    }
    return records;
  }

  try {
    const totalXml = await dpFetch(
      `SELECT SUM(amount) as total, COUNT(*) as count FROM gift WHERE gift_date >= '01/01/2026' AND gift_date <= '12/31/2026' AND record_type = 'G'`
    );

    const recentXml = await dpFetch(
      `SELECT TOP 3 g.amount, g.gift_date, dp.first_name, dp.last_name FROM gift g JOIN dp ON g.donor_id = dp.donor_id WHERE g.gift_date >= '01/01/2026' AND g.record_type = 'G' ORDER BY g.gift_date DESC, g.gift_id DESC`
    );

    // Log raw XML to Netlify function logs so we can debug if needed
    console.log("TOTAL XML:", totalXml);
    console.log("RECENT XML:", recentXml);

    const total = parseFloat(parseField(totalXml, "total")) || 0;
    const count = parseInt(parseField(totalXml, "count")) || 0;
    const recent = parseRecords(recentXml);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ total, count, recent }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
