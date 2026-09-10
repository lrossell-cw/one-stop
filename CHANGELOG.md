# Changelog (root)

Structural and cross-cutting changes only — new workstreams added, repo restructures, combine events, review outcomes, goal revisions. Feature-level work within a single workstream belongs in that workstream's own `CHANGELOG.md`. Append-only — newest entry on top. Never edit or remove a past entry; if something was wrong, add a new entry that corrects it.

---

## 2026-09-10
- Adopted the project-workflow-template structure repo-wide: `BUILD_OUTLINE.md` → `OUTLINE.md` (template format: Setup/Goal/Workstreams/Ground rules/Review triggers/Review log); added `REVIEWS.md`; converted this file to strict append-only/newest-on-top; added `STATUS.md` per workstream (snapshot, separate from README.md's human-facing how-to-run); retrofit each workstream `CHANGELOG.md` to append-only/dated format; added `main/` per the template's "main, not combined" convention.
- Documented git level (4 — local git + GitHub) and blast radius (hosting third-party) as a deliberate, confirmed choice in `OUTLINE.md`, given fiber-tracker's floorplans/cutsheets and rack-lookup's Jira token.
- Confirmed workstream merge policy: each workstream merges to `main/` independently, whenever genuinely happy with the result — never gated on other workstreams' progress.

## (earlier, pre-dated entries — retrofit from prior "Unreleased" bucket)
- Added **hosting** to the backlog: evaluating Canvas (CoreWeave's internal app-hosting platform) as the deploy target for workstreams, pending Glean/platform-team verification of DC-floor fit.
- Established the workstream backlog: MMR fiber cascade manager, walkthrough tool, escort, consumables, owl tester, key holder manager, SOP collection, to-do list (DCT + DCM variants).
- Split project documentation into `CLAUDE.md` (identity/structure/process), `BUILD_OUTLINE.md` (living plan across workstreams), root `CHANGELOG.md` (this file), and per-workstream `README.md`/`CHANGELOG.md`.
- Restructured repo into a multi-workstream layout: `fiber-tracker` moved to `workstreams/fiber-tracker/`; added empty `workstreams/rack-lookup/`; added `/combine`.
