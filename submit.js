// NUP Recruiting Intake — submission endpoint
// Deploy as a serverless function (e.g. Vercel: place at /api/submit.js).
// The Airtable token lives ONLY here, in an environment variable. It is never
// sent to the browser, so view-source on the form exposes nothing.
//
// Required environment variables:
//   AIRTABLE_TOKEN     - a Personal Access Token with data.records:write on the base
//   AIRTABLE_BASE_ID   - appkQ2J5YOCN2SkVy
//   AIRTABLE_TABLE_ID  - tbl1xnLXQPyea373T   (the "Players" table)

const AIRTABLE_API = "https://api.airtable.com/v0";

// Only these fields may be written. Anything else in the payload is ignored.
const ALLOWED_FIELDS = new Set([
  "Player Name", "Class Year", "Primary Position", "Secondary Position",
  "Eligibility Center Status", "Transcript On File", "Height", "Weight (lbs)",
  "Measured Date", "40 Time", "40 Verification", "Shuttle", "Shuttle Verification",
  "Vertical", "Vertical Verification", "Key Lift", "Lift Verification",
  "Competition Level", "Team Role", "Honors", "Film Link", "Offers",
  "Coach Contact & Camps", "GPA", "SAT", "ACT", "Intended Major",
  "Out-of-Pocket Budget", "Need-Based Aid", "Money Priority", "Money vs Level Tradeoff",
  "Max Distance", "Home City", "Home State", "Family At Games", "School Size",
  "Setting", "Environment Notes",
  "College Position", "Scholarship vs Walk-On", "Desired Role", "Scheme Preference",
  "Why Play", "Dealbreakers", "Dream School 1", "Dream School 2", "Dream School 3",
  "Consent: Parent/Guardian Authority", "Consent: Account Access",
  "Consent: Player Reviews Sends", "Consent: List Sign-Off", "Consent: Scope Understood",
  "Consent: Info Accurate", "Consent: Data Use & Withdrawal", "Consent: No Guarantee / Not Agent",
  "Parent/Guardian Name", "Consent Date",
  "Parent Email", "Parent Phone", "NUP Notes"
]);

function isEmpty(v) {
  return v === undefined || v === null || v === "" ||
    (Array.isArray(v) && v.length === 0);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableId = process.env.AIRTABLE_TABLE_ID;
  if (!token || !baseId || !tableId) {
    return res.status(500).json({ error: "Server not configured" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  // Honeypot. Real people never fill a hidden field; bots do.
  // Pretend success and write nothing.
  if (body.company) {
    return res.status(200).json({ ok: true });
  }

  const incoming = body.fields || {};
  const fields = {};
  for (const [k, v] of Object.entries(incoming)) {
    if (ALLOWED_FIELDS.has(k) && !isEmpty(v)) fields[k] = v;
  }

  if (!fields["Player Name"]) {
    return res.status(400).json({ error: "Player Name is required" });
  }

  // Set server-side so they can't be spoofed from the browser.
  fields["Status"] = "New";
  fields["Submission Date"] = new Date().toISOString().slice(0, 10);

  try {
    const r = await fetch(`${AIRTABLE_API}/${baseId}/${tableId}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ records: [{ fields }], typecast: true })
    });

    if (!r.ok) {
      // Log status only — never log the family's data.
      console.error("Airtable responded", r.status);
      return res.status(502).json({ error: "Could not save. Please try again." });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("Submission failed to reach Airtable");
    return res.status(502).json({ error: "Could not save. Please try again." });
  }
}
