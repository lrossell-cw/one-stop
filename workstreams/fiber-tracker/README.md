# fiber-tracker

Part of the [one-stop-shop](../../CLAUDE.md) project. See root `BUILD_OUTLINE.md` for this workstream's status.

## What this is
1. An interactive site map — click a data hall to zoom into a simplified overhead view of that hall.
2. A fiber-run tracker — visualize and update the status of inter-hall fiber circuits.

## Stack
- Frontend: React + Vite (`web/`)
- Backend: Node/Express (`server/`)
- Deploy target (later): Vercel/Netlify or an internal server. Not deployed yet — local dev only for now.

## Scope

### Site map
- Source: `data/raw/PHX01_Floorplan.pdf` — whole-site layout showing DH173, DH151, DH120, DH160, MMR2/MMR3, storage, offices.
- Clicking a data hall zooms/expands into that hall's overhead view.
- Overhead views are **simplified/stylized for V1** — not pixel-accurate to the cabinet/pod grids in the source PDFs (`data/raw/DH120_Overhead_pdf.pdf`, `.../DH151_Overhead_pdf.pdf`, `.../DH173_Overhead_pdf.pdf`, `.../C160_Overhead.pdf`). Faithful cabinet-grid rendering is a future phase.

### Fiber run overlay
- Source: `data/raw/MMR_Cutsheet.csv` only. This is the only data source for fiber runs in V1.
- **Topology: linear cascade** (not a ring/loop) — `MMR (head-end) ↔ DH151 (tap) ↔ DH120 (tap) ↔ DH160 (terminal)`. See `fiber-run-terminology.md` for full terminology (express/drop strands, tap points, etc.) — use those terms in code/UI, not "loop."
- Toggle to show/hide the fiber overlay on the site map.
- Each hop segment is clickable. Clicking cycles status: **UP → DOWN → INVESTIGATE → UP**.
  - No animation on status change — the segment just switches state/color instantly.
- Default status is derived from the MMR cutsheet's occupancy color legend (**Yellow = Occupied, Green = Open, Red = Faulty**), but a manual UP/DOWN/INVESTIGATE click **overrides** the derived default. Manual state takes precedence once set.
- Fiber run state is **shared, persistent, server-side** — not per-browser localStorage. Every viewer of the app sees the same state. Needs a real backend store (start simple — SQLite or a JSON-backed store behind the Express API — but it must survive restarts and be shared across clients).
- Express/drop strand counts per hall are **computed at load time** from which circuits continue past a hall vs. terminate there — not stored as static counts. See `fiber-run-terminology.md`'s "Resolved: express/drop derivation" section.

### Routing behavior (redraw on re-patch)
- If a circuit's endpoint changes (re-patched to a different port/cassette/hall), the drawn path on the map must re-route to visually follow the *actual* current connection.
- Practically: the line/path between halls must be derived from real endpoint data in the circuit model, not hardcoded as a fixed line between two fixed hall icons. If hop data changes, the rendered path changes with it.

### Visual view vs. Cutsheet view
- Toggle between:
  - **Visual view**: the map/overhead graphics.
  - **Cutsheet view**: tabular circuit data.
- **Cutsheet view is separated per data hall** — DH151, DH173, DH120, DH160, and MMR each get their own cutsheet table, showing only the circuits/runs that touch that hall.
- When no hall is selected, show the whole-site cutsheet (all circuits, unfiltered).
- **Sort order for every cutsheet table**: alphabetical first, numeric second — applied to A-side, then Z-side as a secondary/tiebreak sort. i.e., sort rows by A-side location code alphabetically, then by its numeric suffix, then apply the same alphabetical-then-numeric rule on the Z-side as a tiebreak.
  - The exact parsing of "alphabetical part" vs "numeric part" out of location codes (e.g. `DH151.R33.RU4`, `MMR164.R5.RU22`) needs to be nailed down against the real CSV structure — confirm the intended key format before finalizing the sort implementation.

## Explicitly out of scope for V1
- `data/raw/US-WEST-02A_DH151-DH173-C120_Cutsheet.csv` and `data/raw/US-WEST-02B_C160_Cutsheet.csv` — these are full DCIM/NetBox-style cable ledgers (~9,700 and ~5,000 rows) covering *all* intra-hall cabling (firewall/OOB, backbone, FBS, mgmt-core, net-agg/comp-agg, fabric tiers, etc.), not just inter-hall fiber runs. Keep them in `data/raw/` for reference but **do not ingest them in V1**. Likely a future phase once the MMR-only fiber tracker pattern is proven.

## Data layer design
- V1 source (`shared/src/ingest/sources.js`'s `csvSource`) parses `MMR_Cutsheet.csv` live at load time, enriched with occupancy colors recovered from the PDF (`data/generated/mmr_cell_colors.json`); the server caches the resulting snapshot in memory and reloads it via `/api/reload`.
- `npm run ingest` separately writes `data/generated/circuits.json` as a static debug/report artifact (circuit counts, per-hop status breakdown) — it is not read by the running app, just a convenience for inspecting what the parser produced.
- Structure the data layer so the source is swappable — the eventual goal is live Google Sheets API access via a service account, and further out, pulling from Jira and NetBox as sources of truth. Don't hardcode CSV-specific assumptions into the UI layer; keep a clean interface between "where fiber run data comes from" and "how it's rendered." `googleSheetsSource()` is stubbed in `sources.js` with the interface the next source must satisfy.

## Possible relation to backlog items
- **MMR fiber cascade manager** (see root `BUILD_OUTLINE.md` backlog) may extend or relate to this workstream's MMR hop logic — needs scoping when that workstream starts to determine if it's a feature here or a separate tool.
