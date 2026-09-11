# Project: one-stop-shop

## Setup
Git level: 4 (local git + GitHub)
Blast radius: hosting third-party (GitHub) — deliberate choice, confirmed. Revisit per-workstream if a future workstream's source files are more sensitive than what's here today (current data — floorplans, cutsheets, a scoped Jira token behind a backend proxy — was reviewed and judged acceptable for GitHub).
Autonomy level: 2 (target policy — changes applied directly, committed somewhere easy to review after the fact and trivially reversible, no per-change approval required). **Not yet mechanically true**: this Claude Project has no direct filesystem/git access, so every change is still drafted content Leo applies manually (effectively level 0 in practice). Level 2 becomes real once work moves to Claude Code against the actual cloned repo — that move is planned, not yet done. Until then, treat this as the intended target, not the current behavior.

## Goal
A single umbrella project ("one-stop-shop") housing independent internal tools for the PHX01 site floor, each built as its own workstream, occasionally combined once real overlaps emerge. These are floor tools — real usability on mobile devices (not just desktop/laptop) is part of the goal, not an afterthought; see the Mobile integration backlog item for current status.

## Workstreams
- [in progress] fiber-tracker — interactive site map + inter-hall fiber run tracker (MMR ↔ DH151 ↔ DH120 ↔ DH160). See `workstreams/fiber-tracker/STATUS.md`.
- [validated POC, not deployed] rack-lookup — QR/barcode scan of a rack's Jira "Asset Rack Location" to look up matching tickets, serial, and asset tag. Read-only, single-lookup. See `workstreams/rack-lookup/STATUS.md`.
- [scoping] walkthrough — daily-walkthrough batch scanning built on rack-lookup's lookup capability: running scan list, copy-to-Slack, auto-populate Jira ticket. See `workstreams/walkthrough/STATUS.md`.
- [scoping] hosting — evaluate and set up a company-approved hosting platform (leading candidate: Canvas), blocking real deployment for every other workstream. See `workstreams/hosting/STATUS.md`.
- [ ] main — each workstream merges independently, on its own timeline, once genuinely happy with the result (not gated on other workstreams being done — see Ground rules)

## Backlog (named, not yet scoped or started — no folder/STATUS.md/CHANGELOG.md exists yet)
- MMR fiber cascade manager — may extend or relate to fiber-tracker's MMR hop logic; needs scoping to determine if it's a feature there or a standalone workstream.
- Escort — likely relates to existing Escort ticket request-type work in Jira/JSM; needs scoping to determine overlap.
- Consumables
- Owl tester
- Key holder manager
- SOP collection
- To-do list — one workstream, distinguished by request direction (DCT→DCM for DCM-only tasks like site/DCAT access or facilities portal requests, vs. DCT→DCT/DCM→DCT). Needs scoping to confirm whether direction implies different permissions/visibility.
- Mobile integration — get workstreams (rack-lookup and walkthrough especially, given camera-scan requires HTTPS and silently fails over plain LAN HTTP per rack-lookup's README) properly testable/usable on a phone, not just LAN-IP workarounds during dev. **Follows hosting** (now an active workstream, see `workstreams/hosting/`) — real HTTPS mobile access depends on where this actually deploys, so this shouldn't be scoped in detail until hosting resolves. Prioritized as the immediate next workstream after hosting, ahead of other backlog items, because Leo wants to test functionality on-device sooner rather than later. Discuss further once this workstream starts.
- Theming — shared visual theming system for all workstreams, so the "one-stop-shop" reads as one thing rather than 8 independently-styled tools. Not a single fixed brand: theming is **user preference**. Ships with some presets available from the start (likely including CoreWeave brand — Prometo Bold/Hackman fonts, primary blue #0541E9, per prior brand work), but users can also generate their own themes. Enforced as **a shared package/library** (e.g. `/shared/theme` or a `/packages` workspace) that every workstream imports from, rather than a written style guide each workstream implements independently — the point is one source of truth for tokens/colors/fonts and the switching mechanism, not just visual guidance. Not started — needs scoping once 2+ workstreams have real UI to theme.

## Combine backlog
No planned combines. They surface naturally once workstreams exist and an overlap becomes concrete (shared data, shared users, one workstream feeding another) — not architected in advance. When a candidate surfaces: note it here, discuss before committing, only build once the workstreams involved are each genuinely stable.

*(no candidates yet)*

## Ground rules (carried into every session)
- Never fabricate content not present in a source file — flag gaps instead of filling them.
- One change per step; show it before attempting the next change.
- Every accepted step = one commit, with a message describing the decision.
- A workstream is "done" only when its STATUS.md says so explicitly.
- A workstream merges to `main/` independently of the others, whenever its owner is genuinely happy with the result — never gated on other workstreams' progress.
- A review checkpoint happens before any merge into main, and whenever a review trigger below is met. Reviews are not skipped even if every individual step so far was accepted.
- This is a Claude Project without direct filesystem/git access: Claude produces file contents in chat; Leo copies them into the real repo and runs git himself. Any instruction to "update," "commit," or "restructure" means: draft the exact file contents and/or exact git commands for Leo to run — never assume the change has already landed in the real repo.
- **Doc changes always show a diff before being treated as final.** When updating any root or workstream doc (OUTLINE.md, STATUS.md, CHANGELOG.md, README.md, etc.), Claude shows the specific old-text/new-text change(s) — not just the finished file — so Leo can visually review exactly what changed before pasting anything into the real repo. Full corrected file contents and git commands follow the diff, once Leo has had the chance to review it, in the same response unless Leo flags something to change first. This doesn't require a separate approval round-trip for every edit — the diff itself is the review surface Leo checks before applying.
- Prefer swappable data layers (clean interface between "where data comes from" and "how it's rendered/used") since sources of truth are expected to evolve.
- A workstream gets its docs (STATUS.md, CHANGELOG.md, README.md, folder) only once work on it actually begins — don't pre-scaffold docs for backlog ideas.
- Workstreams building real UI should consume theming from the shared theming package (see Backlog) once it exists, rather than hardcoding their own colors/fonts — check whether it's started before styling a new workstream from scratch.

## Review triggers (any one of these starts a review — see OUTLINE.md's parent doc / process reference)
- A workstream's STATUS.md is marked done.
- Before any merge into main.
- The user explicitly asks for one.
- A proposed next step would contradict an earlier accepted decision or a ground rule — flag it and hold for review instead of proceeding.

## Review log
- See REVIEWS.md for the full history. Most recent outcome: none yet — first review pending first trigger.
