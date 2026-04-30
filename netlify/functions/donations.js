const https = require("https");

exports.handler = async function () {
  const apiKey = process.env.DONORPERFECT_API_KEY;

  function dpFetch(sql) {
    const url = `https://www.donorperfect.net/prod/xmlrequest.asp?apikey=${apiKey}&action=${encodeURIComponent(sql)}`;
    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve(data));
      }).on("error", reject);
    });
  }

  function parseRecords(xml) {
    const records = [];
    const recordRegex = /<record[^>]*>([\s\S]*?)<\/record>/gi;

    let match;
    while ((match = recordRegex.exec(xml))) {
      const block = match[1];
      const get = (field) => {
        const m = block.match(
          new RegExp(`name=['"]${field}['"][^>]*value=['"]([^'"]*)`, "i")
        );
        return m ? m[1] : "";
      };

      records.push({
        amount: parseFloat(get("amount")) || 0,
        date: get("gift_date"),
        donor_id: get("donor_id"),
      });
    }
    return records;
  }

  function parseDonors(xml) {
    const map = {};
    const recordRegex = /<record[^>]*>([\s\S]*?)<\/record>/gi;

    let match;
    while ((match = recordRegex.exec(xml))) {
      const block = match[1];
      const get = (field) => {
        const m = block.match(
          new RegExp(`name=['"]${field}['"][^>]*value=['"]([^'"]*)`, "i")
        );
        return m ? m[1] : "";
      };

      const id = get("donor_id");
      map[id] = `${get("first_name")} ${get("last_name")}`.trim();
    }
    return map;
  }

  try {
    // 1. Get gifts (simple query ONLY)
    const giftsXml = await dpFetch(
      `SELECT amount, gift_date, donor_id FROM gift WHERE gift_date >= '2026-01-01' AND record_type = 'G'`
    );

    const gifts = parseRecords(giftsXml);

    // 2. Compute total
    const total = gifts.reduce((sum, g) => sum + g.amount, 0);

    // 3. Sort + take latest 3
    const recentGifts = gifts
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 3);

    // 4. Get donor names (separate query)
    const donorsXml = await dpFetch(
      `SELECT donor_id, first_name, last_name FROM dp`
    );

    const donorMap = parseDonors(donorsXml);

    // 5. Attach names
    const recent = recentGifts.map((g) => ({
      amount: g.amount,
      date: g.date,
      name: donorMap[g.donor_id] || "Anonymous",
    }));

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ total, recent }),
    };
  } catch (err) {
    return { statusCode: 500, body: err.message };
  }
};
