# Changelog (root)

Structural and cross-cutting changes only — new workstreams added, repo restructures, combine events, shared tooling changes. Feature-level work within a single workstream belongs in that workstream's own `CHANGELOG.md`.

## Unreleased

- Restructured repo into a multi-workstream layout: `fiber-tracker` moved to `workstreams/fiber-tracker/`; added empty `workstreams/rack-lookup/`; added `/combine`.
- Split project documentation into `CLAUDE.md` (identity/structure/process), `BUILD_OUTLINE.md` (living plan across workstreams), root `CHANGELOG.md` (this file), and per-workstream `README.md`/`CHANGELOG.md`.
- Established the workstream backlog: MMR fiber cascade manager, walkthrough tool, escort, consumables, owl tester, key holder manager, SOP collection, to-do list (DCT + DCM variants).
- Added **hosting** to the backlog: evaluating Canvas (CoreWeave's internal app-hosting platform) as the deploy target for workstreams, pending Glean/platform-team verification of DC-floor fit.
