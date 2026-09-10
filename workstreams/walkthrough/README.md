# Walkthrough

**Workstream status:** scoping — not yet started. Depends on [[rack-lookup]]'s Jira integration; does not duplicate it.

## What this is

A daily-walkthrough tool for scanning multiple racks in sequence and building up a running record of the walk, rather than looking up one rack at a time. For each scanned location:
- Show the same lookup data rack-lookup already provides (open Jira tickets, serial number, asset tag, current ticket).
- Add the scan to a running list for the walkthrough session.

Two outputs on top of the running list:
- **Copy-to-Slack** — copy the accumulated scan list (including each item's current open ticket) formatted for posting to a Slack workflow.
- **Auto-populate a Jira ticket** — from a given scan's data, pre-fill a new Jira ticket (location, asset tag, serial, etc.) for review before submitting, rather than a technician re-typing that information by hand.

## Relationship to rack-lookup

This workstream is built **on top of** rack-lookup's lookup capability, not a fork or expansion of it:
- rack-lookup stays single-lookup and read-only against Jira.
- walkthrough adds session/list state (today's walkthrough, what's been scanned so far) and two new capabilities rack-lookup doesn't have: an outbound Slack format, and Jira **write** access (ticket creation) — rack-lookup's Jira integration today is read-only.
- Both open items blocking rack-lookup's POC (Asset Management migration risk; where the Jira token lives once shared) apply here too, and don't need to be re-solved separately — see rack-lookup's `STATUS.md`.

## Architecture (anticipated, not yet built)

Likely shares rack-lookup's backend pattern (Node/Express holding the Jira token, proxying requests) rather than a second, separate Jira integration — needs confirming once this workstream actually starts whether it imports/extends rack-lookup's backend or is a genuinely separate service that happens to call the same Jira endpoints. Jira ticket *creation* (write access) is new scope beyond anything rack-lookup does today and will need its own scoped token permissions check.

## Not yet decided
- Exact Slack-post format for the scan list.
- Which Jira ticket type/fields get pre-populated, and which fields still require manual entry before submission.
- Whether a "walkthrough session" is just an in-memory list for that sitting, or a persisted record (useful for confirming a walkthrough was completed, auditing what was checked on a given day).
