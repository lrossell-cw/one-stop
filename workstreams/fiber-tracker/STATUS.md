# Workstream: fiber-tracker

## Scope
Interactive PHX01 site map + inter-hall fiber run tracker. Covers: site map with click-to-zoom into per-hall overheads; fiber run overlay for the linear cascade MMR (head-end) ↔ DH151 (tap) ↔ DH120 (tap) ↔ DH160 (terminal), with clickable UP/DOWN/INVESTIGATE status per hop; visual view vs. per-hall cutsheet view. Does NOT cover: the two large DCIM/NetBox full cable-ledger CSVs (explicitly deferred), pixel-accurate cabinet-grid rendering (V1 is simplified/stylized), or any workstream other than fiber runs/site map. Full detail: `README.md` in this folder.

## Current state
Scope fully defined and documented (README.md, fiber-run-terminology.md). Data source locked to `data/raw/MMR_Cutsheet.csv` only. Terminology standardized on cascade/express/drop/tap/terminal, replacing earlier loose "loop"/"train track switch" language. Confirmed against the real CSV (62 circuit rows) that express/drop strand counts are not pre-aggregated in the source — must be derived per circuit at load time by the parser, not hand-maintained. Implementation (actual code in `server/`, `web/`, `shared/`) has been scaffolded in a prior session; specifics of what's built vs. still open haven't been re-verified against the live repo as of this doc's creation.

## Open questions
- Exact alphabetical-vs-numeric split for cutsheet sort keys (e.g. `DH151.R33.RU4`) not yet nailed down against the real CSV structure — needs confirmation before finalizing the sort implementation.
- Whether "MMR fiber cascade manager" (backlog item) is a feature of this workstream or a separate one — needs scoping when that item starts.
- Hosting target undecided (see root OUTLINE.md's Hosting backlog item — Canvas is the leading candidate, pending verification).

## Last updated
2026-09-10 — see `CHANGELOG.md` in this folder for full step history.
