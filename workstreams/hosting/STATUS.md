# Workstream: hosting

## Scope
Evaluate and set up a company-approved hosting platform for one-stop-shop workstreams. Leading candidate is Canvas (CoreWeave's internal app-hosting platform) — not yet confirmed. Covers the hosting decision and setup itself; does NOT cover migrating each existing workstream onto it (that happens per-workstream, on each workstream's own timeline) or theming/CI-CD decisions unless inseparable from the hosting choice. Full detail: `README.md` in this folder.

## Current state
Just promoted from backlog to active — verification work has not yet started. Next concrete action: check Canvas against DC-floor requirements via Glean and `go/app-hosting-advisor`, and confirm with the Data Infrastructure platform-owner team.

## Open questions
- Does Canvas actually reach the data hall floor network-wise? (Not yet checked.)
- Any offline/local-network requirement for scanner-gun workflows (rack-lookup, walkthrough) that Canvas may not support?
- Does a DC-floor use case need a formal security exception (`go/security-exception`), or does Canvas already clear that for this kind of internal tool?
- If Canvas doesn't fit, what's the fallback? (Not yet explored — Vercel/Netlify/internal server were earlier placeholders, not evaluated against actual requirements.)

## Last updated
2026-09-10 — see `CHANGELOG.md` in this folder for full step history.
