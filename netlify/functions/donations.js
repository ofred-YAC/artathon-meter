// DonorPerfect — fetch total donated via "artathon" online form
// Based on DPO XML API Documentation v7.1
//
// HOW IT WORKS:
// The DP API accepts a SQL SELECT directly in the &action= parameter.
// Results come back as XML with fields like:
//   <field name="total_donated" id="total_donated" value="1234.56" />
//
// Replace YOUR_API_KEY with your actual DonorPerfect API key.

const DP_API_KEY = "WjdTFvbEA9i4wVP0gvzLifRYKpSHQQW7C49JxwIBCrNEJEiMeyNl%2fMVLd27vq0vCRnnCzzg52CNqjtroGO53DR8JhlRyOjKvrii%2bOvzA8NR4MIqIlzzFV%2fEZ%2f8Ir9iJ2";
const DP_BASE_URL = "https://www.donorperfect.net/prod/xmlrequest.asp";

async function getArtathonTotal() {
  // SQL goes directly in the action parameter (URL-encoded per the docs).
  // dpgift stores online form donations. Most commonly the form name ends up
  // in gift_narrative — but see the notes at the bottom if this returns 0.
  const sql = `SELECT SUM(amount) AS total_donated, COUNT(*) AS gift_count FROM dpgift WHERE LOWER(gift_narrative) LIKE '%artathon%' AND record_type = 'G'`;

  const url = `${DP_BASE_URL}?apikey=${DP_API_KEY}&action=${encodeURIComponent(sql)}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const text = await response.text();
  const xml = new DOMParser().parseFromString(text, "text/xml");

  // Helper: find a <field> by its name attribute and return its value
  const getValue = (name) => {
    const field = [...xml.querySelectorAll("field")].find(
      (f) => f.getAttribute("name") === name
    );
    return field ? field.getAttribute("value") : null;
  };

  // Check for a DP-level error
  const err = getValue("error");
  if (err) throw new Error(`DonorPerfect error: ${err}`);

  const total = parseFloat(getValue("total_donated") || 0);
  const count = parseInt(getValue("gift_count") || 0, 10);

  return {
    total,
    count,
    formatted: total.toLocaleString("en-US", { style: "currency", currency: "USD" }),
  };
}

// --- Usage ---
// Call on page load and point at your HTML elements.

getArtathonTotal()
  .then(({ formatted, count }) => {
    console.log(`Artathon total: ${formatted} from ${count} gifts`);

    // Update your DOM — change these IDs to match your HTML
    const totalEl = document.getElementById("artathon-total");
    const countEl = document.getElementById("artathon-count");
    if (totalEl) totalEl.textContent = formatted;
    if (countEl) countEl.textContent = `${count} donations`;
  })
  .catch((err) => console.error("Failed to fetch artathon total:", err));

// ---------------------------------------------------------------------------
// IF THE QUERY RETURNS $0 / 0 GIFTS:
// The form name might be stored differently in your DP system.
// Swap the `sql` variable above with one of these to investigate:
//
// See the last 10 gift_narrative values to find your form's exact name:
//   const sql = `SELECT TOP 10 gift_id, gift_narrative, amount FROM dpgift ORDER BY gift_id DESC`;
//
// Filter by sub_solicit_code instead:
//   const sql = `SELECT SUM(amount) AS total_donated, COUNT(*) AS gift_count FROM dpgift WHERE LOWER(sub_solicit_code) LIKE '%artathon%' AND record_type = 'G'`;
//
// Filter by campaign code instead:
//   const sql = `SELECT SUM(amount) AS total_donated, COUNT(*) AS gift_count FROM dpgift WHERE LOWER(campaign) LIKE '%artathon%' AND record_type = 'G'`;
// ---------------------------------------------------------------------------
