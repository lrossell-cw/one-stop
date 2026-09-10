# Workstream: walkthrough

## Scope
Daily-walkthrough tool: scan racks in sequence during a walkthrough, see the same per-location data rack-lookup provides (open tickets, serial, asset tag), build a running list across the session, then (a) copy the list formatted for a Slack workflow post including each item's current open ticket, and (b) auto-populate a new Jira ticket from a scan's data for review before submitting. Built on top of rack-lookup's Jira integration — does not duplicate it. Does NOT cover single ad-hoc lookups outside a walkthrough session (that's rack-lookup itself) or non-rack walkthrough items (SOP checks, visual inspections) unless scoped in later.

## Current state
Scoping only — no folder/code exists yet. Full detail in `README.md` in this folder.

## Open questions
- Whether this workstream shares/extends rack-lookup's backend directly, or is a separate service calling the same Jira endpoints — undecided, needs confirming once implementation starts.
- Exact Slack-post format for the accumulated scan list.
- Which Jira ticket fields get auto-populated vs. require manual entry.
- Whether a walkthrough session is ephemeral (in-memory for that sitting) or persisted (for auditing/confirming completion).
- Jira ticket *creation* is new write-access scope beyond rack-lookup's read-only integration — needs its own scoped-token permissions check before implementation.
- Inherits both of rack-lookup's open POC blockers (Asset Management migration risk; hosting/token-location decision) — see `workstreams/rack-lookup/STATUS.md`, not duplicated here.

## Last updated
2026-09-10 — see `CHANGELOG.md` in this folder for full step history.
