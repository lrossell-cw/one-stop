# Workstream: rack-lookup

## Scope
Scan a QR/barcode of a rack's "Asset Rack Location" value (via handheld scanner gun or camera) to look up matching Jira tickets, serial number, and asset tag for that location. Does NOT cover a separate asset database — Jira's Labels-type custom fields are the only data source; a location value is just a JQL filter, and matching tickets are the data.

## Current state
Scoping only — folder created, no code scaffolded yet. Known constraints: format `US-PHX01.DH120.R198.RU26` (site.datahall.rack.rackunit) for the Asset Rack Location field; "current" ticket for a location = newest-created ticket on the SDA or DO project (other prefixes ignored); backend must hold the Jira API token privately and proxy requests, frontend never touches it directly.

## Open questions
- Not yet confirmed whether direct deployment access to CoreWeave's own infrastructure (e.g. a Kubernetes namespace) exists, or whether deployment needs to go through platform/infra — may be resolved once the Hosting workstream (Canvas evaluation) lands.
- Full implementation scope (stack details beyond React/Express, UI flow, error handling for unmatched locations) not yet drafted.

## Last updated
2026-09-10 — see `CHANGELOG.md` in this folder for full step history.
