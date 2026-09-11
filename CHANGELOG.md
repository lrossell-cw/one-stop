# Changelog (root)

Structural and cross-cutting changes only — new workstreams added, repo restructures, combine events, review outcomes, goal revisions. Feature-level work within a single workstream belongs in that workstream's own `CHANGELOG.md`. Append-only — newest entry on top. Never edit or remove a past entry; if something was wrong, add a new entry that corrects it.

---

## 2026-09-10 (4)
- Promoted **hosting** from backlog to active workstream — created `workstreams/hosting/` with README.md, STATUS.md, CHANGELOG.md. This is the immediate next workstream to work on, with Mobile integration queued directly behind it once hosting resolves.

## 2026-09-10 (3)
- Updated root `OUTLINE.md`'s Goal statement to explicitly name mobile usability as part of the project's goal, not an afterthought — these are floor tools, not desktop tools.
- Added **Mobile integration** to the backlog, sequenced after Hosting (real HTTPS mobile access depends on where workstreams actually deploy). Current plan is Canvas in the CoreWeave workspace, matching Hosting's own status — not yet confirmed, prioritized early because Leo wants on-device testing sooner rather than later.

## 2026-09-10 (2)
- Corrected rack-lookup's STATUS.md: it was inaccurately marked "scoping only, no code scaffolded" — real code already existed as a validated POC (per its own `README.md`, tested end-to-end against real CoreWeave Jira data). Corrected to reflect actual state.
- Added **walkthrough** as a new active workstream (moved out of the unscoped backlog): daily-walkthrough batch scanning, copy-to-Slack, auto-populate Jira ticket — built on top of rack-lookup's lookup capability rather than expanding rack-lookup itself. rack-lookup remains single-lookup/read-only.

## 2026-09-10
- Adopted the project-workflow-template structure repo-wide: `BUILD_OUTLINE.md` → `OUTLINE.md` (template format: Setup/Goal/Workstreams/Ground rules/Review triggers/Review log); added `REVIEWS.md`; converted this file to strict append-only/newest-on-top; added `STATUS.md` per workstream (snapshot, separate from README.md's human-facing how-to-run); retrofit each workstream `CHANGELOG.md` to append-only/dated format; added `main/` per the template's "main, not combined" convention.
- Documented git level (4 — local git + GitHub) and blast radius (hosting third-party) as a deliberate, confirmed choice in `OUTLINE.md`, given fiber-tracker's floorplans/cutsheets and rack-lookup's Jira token.
- Confirmed workstream merge policy: each workstream merges to `main/` independently, whenever genuinely happy with the result — never gated on other workstreams' progress.

## (earlier, pre-dated entries — retrofit from prior "Unreleased" bucket)
- Added **hosting** to the backlog: evaluating Canvas (CoreWeave's internal app-hosting platform) as the deploy target for workstreams, pending Glean/platform-team verification of DC-floor fit.
- Established the workstream backlog: MMR fiber cascade manager, walkthrough tool, escort, consumables, owl tester, key holder manager, SOP collection, to-do list (DCT + DCM variants).
- Split project documentation into `CLAUDE.md` (identity/structure/process), `BUILD_OUTLINE.md` (living plan across workstreams), root `CHANGELOG.md` (this file), and per-workstream `README.md`/`CHANGELOG.md`.
- Restructured repo into a multi-workstream layout: `fiber-tracker` moved to `workstreams/fiber-tracker/`; added empty `workstreams/rack-lookup/`; added `/combine`.
