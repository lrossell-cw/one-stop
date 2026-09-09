# Rack Lookup

**Workstream status:** proof of concept, validated end-to-end against real
CoreWeave Jira data (PHX01). Not yet deployed anywhere beyond a local
laptop. Two open items block moving past POC — see **Before this goes
further** below.

## What this is

A scanner-gun-driven lookup tool for the data hall floor. A technician
scans (or types) a rack's `Asset Rack Location` value — e.g.
`US-PHX01.DH120.R198.RU26` — and the tool shows every Jira ticket tagged
with that location: serial number, asset tag, ticket status, and a
one-click copy of `{rack}.{position} - {current ticket key}` (with the
key as a live hyperlink when pasted into Slack/Docs/email).

There is deliberately **no separate asset database**. `Asset Rack
Location` is a Labels-type custom field in Jira
(`cf[10207]`, cloudId `0b202827-7a05-4ef3-94f5-056caea69699`), and every
ticket tagged with a location IS the record for that location — an
incident ticket, a deployment ticket, a handoff ticket, etc. This
avoids a second system of record that could drift out of sync with
Jira.

## How it fits into the bigger proposal

Sits alongside the other DC Ops Jira/CMDB workstreams (ticket
standardization, custom field cleanup, SDA→DO migration) — see the main
proposal repo. This workstream specifically answers: *given a physical
rack, what's its current ticket status, without anyone maintaining a
separate spreadsheet or CMDB entry for it.*

## Architecture

```
┌─────────────┐      ┌──────────────┐      ┌───────────────┐
│  frontend/   │─────▶│  backend/    │─────▶│  Jira Cloud    │
│  React/Vite  │ HTTP │  Node/Express │ HTTPS│  REST API      │
│  (scan log + │      │  holds the    │      │  (scoped token)│
│  detail pane)│      │  Jira token   │      │                │
└─────────────┘      └──────────────┘      └───────────────┘
```

The backend exists **only** to keep the Jira API token off the browser.
Jira's API can't be called directly from client-side JS both because of
CORS and because a token embedded in browser code is visible to anyone
who opens dev tools. See `backend/server.js` for the full request flow,
including:

- Scoped-token gateway routing (tokens starting `ATATT` route through
  `api.atlassian.com/ex/jira/{cloudId}/...`, resolved once via the
  site's public `_edge/tenant_info` endpoint and cached)
- Dynamic field-ID resolution by name (falls back to accepting a raw
  `cf[NNNN]` / `customfield_NNNN` / bare-number reference directly if a
  display-name lookup isn't reliable)
- Labels-field-correct JQL (`"Asset Rack Location[Labels]" = "..."`) —
  this field type does NOT support `~` contains-search reliably, only
  exact `=`
- "Current ticket" resolution (newest **created** SDA/DO-prefixed
  ticket, server-side, so the frontend doesn't duplicate that rule)

## Local setup

Two services, two terminals:

```bash
# Terminal 1 — backend
cd backend
cp .env.example .env
# fill in JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN (see .env.example
# for how LOCATION_FIELD_NAME / SERIAL_FIELD_NAME / ASSET_TAG_FIELD_NAME work)
npm install
npm start
# → http://localhost:3001

# Terminal 2 — frontend
cd frontend
cp .env.example .env
npm install
npm run dev
# → http://localhost:5173
```

### Testing from a phone on the same wifi

```bash
# find your machine's LAN IP
ipconfig getifaddr en0        # macOS
# then in frontend/.env:
VITE_API_BASE_URL=http://<your-lan-ip>:3001
npm run dev            # already runs with --host, binds to 0.0.0.0
```
Open `http://<your-lan-ip>:5173` on the phone. Note: the camera-scan
fallback (`BarcodeDetector`) requires HTTPS or `localhost` and will be
silently unavailable over a plain `http://` LAN address — the primary
scanner-gun-into-focused-field flow is unaffected by this.

### Docker (local, both services together)

```bash
docker compose up --build
```

## Before this goes further

Two things are unresolved from the POC phase and worth settling before
treating this as more than a demo:

1. **Confirm "Asset Rack Location" isn't a Jira Asset Management
   (Insight) object property.** It's currently confirmed to be a
   classic Labels-type custom field (`cf[10207]`) via testing against
   real Jira, which is what this code is built for. If your org later
   migrates to Asset Management for this field, the query mechanism
   changes entirely (AQL against a separate Assets API, not JQL) —
   this would need a rewrite of `fetchTicketsForLocation()` in
   `backend/server.js`, not just a config change.

2. **Where does this run, and where does the Jira token live, once it's
   not on someone's laptop?** A read-scoped personal API token proxied
   through a shared internal service is a different risk profile than
   the same token in a local `.env` file. Worth a short conversation
   with whoever owns Jira/security before deploying this anywhere
   shared, plus confirming with platform/infra what's actually
   available for hosting small internal tools (a namespace on
   CoreWeave Cloud, or another established pattern).

## Known limitations (by design, for POC scope)

- Mock fallback data in `frontend/src/App.jsx` (`MOCK_LOOKUPS`) only
  covers one location — it exists so the UI still demos with zero
  backend running, not as real sample data.
- No caching — every scan hits Jira live. Fine for demo/low volume;
  worth adding a short-lived per-location cache if this sees real
  floor traffic (Jira rate-limits aggressively).
- CORS on the backend is wide open (`cors()` with no origin
  restriction) — fine for local dev, must be locked to the real
  frontend's origin before any shared deployment.
