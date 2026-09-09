// server.js
// Backend for the rack-lookup tool. Holds Jira credentials privately —
// they never reach the browser/artifact — and does two jobs:
//   1. Resolve the internal customfield_XXXXX IDs behind the human-
//      readable field names ("Asset Rack Location", serial, asset tag),
//      since Jira's search/filter API only accepts IDs, not names.
//   2. Run a JQL search for that location and return the matching
//      tickets, each carrying whatever serial/asset-tag values they
//      have set.
//
// There's no separate "asset database" here — a rack location is just
// a JQL filter value, and every ticket tagged with it (open or closed)
// is the data. That's the whole model.
//
// Run with:  npm install && npm start
// Then point the frontend's fetch calls at http://localhost:3001

require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors()); // dev only — see note at bottom for production
app.use(express.json());

const {
  JIRA_BASE_URL,        // e.g. https://coreweave.atlassian.net
  JIRA_EMAIL,           // the email tied to your Atlassian account
  JIRA_API_TOKEN,       // created at id.atlassian.com/manage-profile/security/api-tokens
  LOCATION_FIELD_NAME = "Asset Rack Location",
  SERIAL_FIELD_NAME = "Serial Number",
  ASSET_TAG_FIELD_NAME = "Asset Tag",
  PORT = 3001,
} = process.env;

if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
  console.error(
    "Missing required env vars. Copy .env.example to .env and fill in JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN."
  );
  process.exit(1);
}

const authHeader =
  "Basic " + Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");

// ---- Scoped API token gateway resolution --------------------------------
// Scoped tokens (the "Create API token with scopes" flow, ATATT-prefixed)
// can't call your site directly at JIRA_BASE_URL — they only work through
// Atlassian's shared gateway at api.atlassian.com, addressed by your
// site's Cloud ID rather than its hostname. Classic tokens skip this
// and call JIRA_BASE_URL directly.
let cachedCloudId = null;

async function getCloudId() {
  if (cachedCloudId) return cachedCloudId;
  const res = await fetch(`${JIRA_BASE_URL}/_edge/tenant_info`);
  if (!res.ok) {
    throw new Error(`Could not resolve Cloud ID (tenant_info returned ${res.status})`);
  }
  const data = await res.json();
  cachedCloudId = data.cloudId;
  return cachedCloudId;
}

async function jiraApiBase() {
  const isScopedToken = JIRA_API_TOKEN.startsWith("ATATT");
  if (!isScopedToken) return JIRA_BASE_URL;
  const cloudId = await getCloudId();
  return `https://api.atlassian.com/ex/jira/${cloudId}`;
}

async function jiraFetch(path, options = {}) {
  const apiBase = await jiraApiBase();
  const res = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      Authorization: authHeader,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jira API ${res.status} on ${path}: ${text}`);
  }
  return res.json();
}

// ---- Field ID resolution -------------------------------------------------
// Jira's search API needs customfield_XXXXX ids, not display names, and
// those ids are specific to your instance. Rather than hardcode them
// (fragile — they can differ across instances/migrations), we look them
// up once by name via GET /rest/api/3/field and cache the result.
let cachedFieldMap = null;

async function getFieldMap() {
  if (cachedFieldMap) return cachedFieldMap;

  const fields = await jiraFetch("/rest/api/3/field");
  const byName = new Map();
  for (const field of fields) {
    if (!byName.has(field.name)) byName.set(field.name, []);
    byName.get(field.name).push(field.id);
  }

  function resolve(nameOrId) {
    // Accept a raw field id/reference too, so pasting whatever Jira's UI
    // showed you (cf[10207], customfield_10207, or a bare 10207) works
    // without needing the exact display name at all.
    const cfMatch = nameOrId.match(/^(?:cf\[|customfield_)?(\d+)\]?$/);
    if (cfMatch) {
      return `customfield_${cfMatch[1]}`;
    }

    const matches = byName.get(nameOrId);
    if (!matches || matches.length === 0) {
      throw new Error(
        `No Jira field named "${nameOrId}" was found. Check the name matches exactly ` +
          `(case-sensitive), or set the corresponding *_FIELD_NAME env var to a raw ` +
          `field id instead (e.g. "customfield_10207" or "10207").`
      );
    }
    if (matches.length > 1) {
      console.warn(
        `Warning: multiple Jira fields are named "${nameOrId}" (${matches.join(", ")}). ` +
          `Using the first match (${matches[0]}). If this is wrong, set the field ID ` +
          `directly instead of relying on name lookup.`
      );
    }
    return matches[0];
  }

  cachedFieldMap = {
    location: resolve(LOCATION_FIELD_NAME),
    serial: resolve(SERIAL_FIELD_NAME),
    assetTag: resolve(ASSET_TAG_FIELD_NAME),
  };

  console.log("Resolved Jira field IDs:", cachedFieldMap);
  return cachedFieldMap;
}

// GET /api/rack/:locationId
// locationId is the full "Asset Rack Location" value, e.g.
// "US-PHX01.DH120.R198.RU26" — matched exactly against that field.
app.get("/api/rack/:locationId", async (req, res) => {
  const locationId = req.params.locationId;

  try {
    const fieldMap = await getFieldMap();
    const { tickets, currentTicketKey, diagnostics } = await fetchTicketsForLocation(locationId, fieldMap);

    if (tickets.length === 0) {
      return res.status(404).json({ error: "not_found", locationId, diagnostics });
    }

    res.json({ locationId, tickets, currentTicketKey });
  } catch (err) {
    console.error("Jira lookup failed:", err.message);
    res.status(502).json({ error: "jira_unreachable", message: err.message });
  }
});

async function fetchTicketsForLocation(locationId, fieldMap) {
  // "Asset Rack Location" is a Labels-type custom field (confirmed via
  // Jira's own UI, which generates queries like
  // "Asset Rack Location[Labels]" = US-PHX01.DH120.R198.RU26 ).
  // Labels fields aren't full-text indexed, so "~" (contains) returns
  // zero results — "=" is the correct operator here and does a true
  // exact match on the whole label value, no post-filtering needed.
  const jql = `"${LOCATION_FIELD_NAME}[Labels]" = "${locationId}" ORDER BY updated DESC`;

  console.log("[diagnostic] JQL sent to Jira:", jql);

  const data = await jiraFetch("/rest/api/3/search/jql", {
    method: "POST",
    body: JSON.stringify({
      jql,
      maxResults: 50,
      fields: ["summary", "status", "priority", "created", fieldMap.location, fieldMap.serial, fieldMap.assetTag],
    }),
  });

  const rawIssues = data.issues || [];
  console.log(`[diagnostic] Jira returned ${rawIssues.length} issue(s).`);

  const filtered = rawIssues;

  // Serial number / asset tag are also Labels-type fields (same as
  // location), so Jira returns them as arrays even though each ticket
  // realistically only carries one value — join them into a plain
  // string for display rather than leaking the array shape to the UI.
  function flattenLabelField(value) {
    if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : null;
    return value || null;
  }

  const mapped = filtered.map((issue) => ({
    key: issue.key,
    summary: issue.fields.summary,
    status: issue.fields.status?.name || "Unknown",
    priority: issue.fields.priority?.name || null,
    created: issue.fields.created,
    serial: flattenLabelField(issue.fields[fieldMap.serial]),
    assetTag: flattenLabelField(issue.fields[fieldMap.assetTag]),
    // Ticket links are for humans to click, so these always point at
    // your normal site URL, never the API gateway URL.
    url: `${JIRA_BASE_URL}/browse/${issue.key}`,
  }));

  // "Current" ticket for the copy-to-clipboard feature: the newest
  // CREATED ticket whose key is on the SDA or DO project, ignoring
  // other trackers (e.g. HO) that may also be tagged with this
  // location. Sorted here so the frontend doesn't need to know this
  // business rule at all.
  const CURRENT_TICKET_PREFIXES = ["SDA", "DO"];
  const currentTicket = mapped
    .filter((t) => CURRENT_TICKET_PREFIXES.some((p) => t.key.startsWith(`${p}-`)))
    .sort((a, b) => new Date(b.created) - new Date(a.created))[0] || null;

  return {
    tickets: mapped,
    currentTicketKey: currentTicket ? currentTicket.key : null,
    // Diagnostics for the not_found response — tells you WHICH step
    // came up empty: Jira's own search, or the exact-match JS filter.
    diagnostics: {
      jql,
      rawIssueCount: rawIssues.length,
      rawLocationValues: rawIssues.map((i) => i.fields[fieldMap.location]),
    },
  };
}

app.listen(PORT, async () => {
  console.log(`Rack lookup backend running on http://localhost:${PORT}`);
  try {
    await getFieldMap(); // resolve + log field IDs at startup, fail fast if a name is wrong
  } catch (err) {
    console.error("Startup field resolution failed:", err.message);
  }
});

// ---- Next steps for a real deployment -----------------------------------
// 1. Field names: LOCATION_FIELD_NAME / SERIAL_FIELD_NAME /
//    ASSET_TAG_FIELD_NAME default to "Asset Rack Location", "Serial
//    Number", "Asset Tag" — override in .env if your instance uses
//    different exact names. Names are case-sensitive.
// 2. CORS: app.use(cors()) currently allows any origin, fine for local
//    dev. Lock it down to your actual frontend's origin before this is
//    reachable outside your laptop.
// 3. Secrets: JIRA_API_TOKEN must never be committed. Keep it in .env
//    (already gitignored) or your real secrets manager in prod.
// 4. Caching: Jira rate-limits aggressively. If this gets real traffic,
//    add a short (30-60s) in-memory or Redis cache per locationId —
//    the field map is already cached indefinitely since it rarely changes.
