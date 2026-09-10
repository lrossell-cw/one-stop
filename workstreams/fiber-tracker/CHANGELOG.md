# Changelog: fiber-tracker

Feature-level changes for this workstream only. Structural/repo-wide changes belong in the root `CHANGELOG.md`. Newest entries on top — never edit or remove a past entry; if something was wrong, add a new entry that corrects it.

---

## 2026-09-10
- Accepted: standardized terminology on cascade/express/drop/tap/terminal (see `fiber-run-terminology.md`), replacing "loop" and "train track switch" language.
- Accepted: confirmed express/drop strand counts are not pre-aggregated in `MMR_Cutsheet.csv` — must be computed at load time per circuit (does a circuit's row have port data continuing past a hall, or does it stop there), not hand-maintained as static fields.
- Next: nail down the exact alphabetical-vs-numeric sort key split for cutsheet tables against the real CSV structure before finalizing that implementation.

## (earlier, pre-dated entries — retrofit from prior "Unreleased" bucket)
- Accepted: initial scope defined — interactive site map, fiber run overlay with UP/DOWN/INVESTIGATE toggle, visual/cutsheet view split, routing-follows-data behavior, per-hall cutsheet with alphabetical-then-numeric sort.
- Accepted: V1 data source locked to `MMR_Cutsheet.csv` only; large DCIM cable-ledger CSVs explicitly deferred to a possible future phase.
