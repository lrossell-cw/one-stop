# Workstream: rack-lookup

## Scope
Single-location lookup tool: scan or type a rack's `Asset Rack Location` value to see every Jira ticket tagged with that location, plus serial number and asset tag, plus a one-click copy of `{rack}.{position} - {current ticket key}`. Read-only against Jira. Does NOT cover a separate asset database — Jira's Labels-type custom fields are the only data source; a location value is just a JQL filter, and matching tickets are the data. Does NOT cover batch/sequential scanning, Slack posting, or Jira ticket creation — that functionality is the **walkthrough** workstream, built on top of this one's lookup capability (see `workstreams/walkthrough/`).

## Current state
**Proof of concept, validated end-to-end against real CoreWeave Jira data (PHX01).** Not deployed anywhere beyond a local laptop. Frontend (React/Vite) + backend (Node/Express) both exist and run locally (`docker compose up --build`, or two terminals — see `README.md`). Backend confirmed working against real Jira: scoped-token gateway routing, dynamic field-ID resolution, Labels-field-correct JQL (exact `=` match only, `~` contains-search unreliable on this field type), and server-side "current ticket" resolution (newest-created SDA/DO-prefixed ticket).

Known POC-scope limitations (by design, not bugs): mock fallback data covers only one location (for UI demo without a running backend); no caching (every scan hits Jira live — Jira rate-limits aggressively, would need a short-lived per-location cache under real floor traffic); CORS wide open on the backend (must be locked to the real frontend's origin before shared deployment).

## Open questions
Two items block moving past POC, per `README.md`:
1. **Confirm "Asset Rack Location" isn't a Jira Asset Management (Insight) object property.** Currently confirmed as a classic Labels-type custom field (`cf[10207]`) via testing against real Jira. If the org migrates this field to Asset Management later, the query mechanism changes entirely (AQL against the Assets API, not JQL) — would need a rewrite of `fetchTicketsForLocation()`, not just a config change.
2. **Where does this run, and where does the Jira token live, once it's not on someone's laptop?** A read-scoped personal token in a local `.env` is a different risk profile than the same token proxied through a shared internal service. Needs a conversation with whoever owns Jira/security before any shared deployment — likely resolved alongside the Hosting workstream (see root `OUTLINE.md`).

## Last updated
2026-09-10 — see `CHANGELOG.md` in this folder for full step history.
