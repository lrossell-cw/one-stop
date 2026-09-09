# Changelog — fiber-tracker

Feature-level changes for this workstream only. Structural/repo-wide changes belong in the root `CHANGELOG.md`.

## Unreleased

- Initial scope defined: interactive site map, fiber run overlay with UP/DOWN/INVESTIGATE toggle, visual/cutsheet view split, routing-follows-data behavior, per-hall cutsheet with alphabetical-then-numeric sort.
- V1 data source locked to `MMR_Cutsheet.csv` only; large DCIM cable-ledger CSVs explicitly deferred.
- Added `fiber-run-terminology.md`: standardized on cascade/express/drop/tap/terminal terminology, replacing loose "loop" and "train track switch" language. Confirmed against the real CSV (62 circuit rows) that express/drop counts are not pre-aggregated in the source data — must be derived per circuit at load time.
- Built out the V1 implementation across all three packages:
  - `shared/`: structural CSV parser (`ingest/csv.js`) that reads the cutsheet's `<>`-delimited hop column-groups rather than hardcoded indices; location parser (`location.js`) normalizing the sheet's inconsistent rack/unit spellings and providing the alphabetical-then-numeric sort key; core domain model (`model.js`) with status derivation, the operator-override merge, and worst-hop rollup; cutsheet row flattening/filtering (`cutsheet.js`).
  - `server/`: thin Express layer (`app.js`) over a testable `FiberService` (`service.js`); shared, persistent status store backed by SQLite (`store.js`) with WAL mode and an append-only audit log (`hop_status_log`), plus an in-memory store for tests. Endpoints: `/api/health`, `/api/circuits`, `/api/reload`, `/api/circuits/:circuitId/hops/:hopId/status` (POST/DELETE), `/api/history`.
  - `web/`: React app (`App.jsx`) wiring visual/cutsheet view toggle, fiber overlay toggle, hall zoom, and a segment detail panel; `SiteMap.jsx` draws one continuous line per circuit from real endpoint data (not fixed lines between icons); `HallView.jsx` renders a simplified per-hall cabinet grid; `CutsheetView.jsx` implements the per-hall tabs with the alphabetical-then-numeric sort and inline status cycling; site geometry traced from the real floorplan raster (`site.js`).
  - Test coverage: 67 passing tests across all three packages (CSV/location parsing, status derivation and override precedence, service-layer behavior, routing/redraw-on-repatch geometry).
- Found and documented that the color sidecar carries a fourth raw color, `NOTE` (blue/teal annotation cells), beyond the three in the original legend — currently folded into `UNKNOWN` for status purposes. See `fiber-run-terminology.md`.
- Confirmed DH173 is drawn on the map and appears as a cutsheet tab (it's a real hall) but never carries fiber data — the cutsheet has no DH173 hop columns. Handled as an explicit, self-explanatory empty state in `CutsheetView.jsx` rather than hidden or treated as a bug.
