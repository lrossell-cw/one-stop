# One-Stop-Shop — PHX01

Internal site app for PHX01 (US-WEST-02, Phoenix): an interactive site map and
an inter-hall fiber run tracker.

## Running it

```bash
npm install          # required — see "Dependencies" below
npm run colors       # recover the occupancy legend from the cutsheet PDF
npm run ingest       # optional: write data/generated/circuits.json + a report
npm run dev          # API on :5174, UI on :5173
npm test             # 59 tests, no registry or browser needed
```

The Vite dev server proxies `/api` to the Express server, so both run
same-origin and there is no CORS to configure.

## How the data flows

```
data/raw/MMR_Cutsheet.csv ──┐
                            ├─► shared/src/ingest ─► circuits with per-hop status
data/raw/MMR_Cutsheet.pdf ──┘         │
   (colors only)                      ▼
                            server (SQLite overrides merged in)
                                      │
                                      ▼
                            web (map + cutsheet views)
```

### The CSV has no colors

This is the single most important thing to know about the source data. The
cutsheet's status legend — **Yellow = Occupied, Green = Open, Red = Faulty** —
exists only as cell background fills in `MMR_Cutsheet.pdf`. The CSV export
drops all of it.

`scripts/extract_pdf_colors.py` recovers those fills by walking the PDF content
stream (no third-party dependencies). Two things make this reliable rather than
a guess:

- The export merges runs of same-colored cells into single rectangles that
  align exactly with the sheet's `<>` separator columns, so each fill already
  covers **one hop group for a run of rows** — per-circuit-per-hop, the same
  granularity the app models.
- Row alignment (PDF row *N* = CSV line *N+1*) is verified at runtime against
  the Circuit column and **fails loudly** rather than silently mismapping. As a
  cross-check, both red cells land precisely on the two `BAD DO NOT USE` rows.

Re-run `npm run colors` whenever the cutsheet is re-exported.

### Status precedence

Each hop's status is derived from the cutsheet, then overridden by hand:

| Cutsheet state | Derived status |
|---|---|
| Hop endpoints not both patched | `NOT_RUN` |
| Red (Faulty) | `DOWN` |
| Yellow (Occupied) | `UP` |
| Green (Open) or no color | `INVESTIGATE` |

Anything not positively confirmed starts as **INVESTIGATE** so it lands on
someone's list, rather than reading as healthy. Clicking a run cycles
`UP → DOWN → INVESTIGATE` and that manual value wins from then on; the derived
default is kept alongside so "reset" always works.

Cycling is resolved **server-side** from stored state, so two people clicking
the same segment at once can't both compute the next value from the same stale
view.

### Shared state, not per-browser

Overrides live in SQLite behind the Express API (`server/src/store.js`). Every
viewer sees the same statuses; nothing touches `localStorage`. Every change is
written to an append-only audit log (`GET /api/history`) — cheap now, and the
obvious thing to want the first time someone asks who set a run to DOWN.

Uses the built-in `node:sqlite`, so there is no native module to compile.

### Routing follows the data

The map's fiber paths are computed from each hop's **actual endpoint nodes**
every render, then grouped by the room pair they connect. Nothing is a
hardcoded line between two fixed icons. Re-patch a circuit to a different
cassette, port, or hall in the cutsheet and the drawn path moves with it — the
rail-switch behaviour. `web/test/site.test.js` asserts this directly, and also
that every node and route the real cutsheet implies can actually be drawn.

## Findings worth knowing

**The sheet leaves implicit endpoints blank.** Every `120 Z` cell in the file is
empty, carrying only a cassette and port — the hall is implied because it
matches the A-side. The ingest recovers the hall from the column header;
without that, the entire 120↔160 hop reads as unbuilt. These are shown as
"(implied)" in the UI.

**Hop completeness is derived from the data, never a hardcoded row list.** So
correcting the CSV corrects the app, with no code change. As of the current
export:

- **8 circuits** are complete end-to-end (the rows that populate `151 Z`:
  XID0416/0417/0418/0419/0424/0425/0426/0427).
- **10 more circuits reach DH160 but have no recorded 151↔120 path** — they
  jump straight from `151 A` to `120 A`. Worth confirming whether that is a
  real gap in the sheet or a genuine bypass.
- **DH173 has no columns in `MMR_Cutsheet.csv`**, so its cutsheet tab is empty
  by design in V1.

**MMR room mapping is unconfirmed.** The cutsheet's endpoints are `MMR164` and
`MMR ISP PP`; the floorplan shows two MMR rooms (MMR2 and MMR3). Which one is
room 164 has not been established, so both are drawn and the logical `MMR` node
anchors on MMR3. Fix in `web/src/site.js` → `NODE_ANCHORS`.

## Layout

```
data/raw/          source PDFs and CSVs (unmodified)
data/generated/    derived artifacts — gitignored, rebuild with npm run colors/ingest
scripts/           PDF extraction (Python, stdlib only)
shared/            domain model, location parsing, ingest — no framework deps
server/            Express API + SQLite store
web/               React + Vite UI
```

`shared/src/model.js` knows nothing about CSV, PDF, SQLite or React. Every
source produces those shapes and every consumer reads them, which is what makes
the source swappable.

## Swapping the data source

`shared/src/ingest/sources.js` defines the interface: a source returns
`{ circuits, warnings, meta }`. `csvSource` is V1. `googleSheetsSource` is a
stub that documents what its replacement must do — notably that the Sheets API
can return cell background colors directly
(`fields=sheets.data.rowData.values.effectiveFormat.backgroundColor`), which
removes the PDF extraction step entirely. Jira and NetBox would be further
siblings.

## Dependencies

`npm install` is required before `npm run dev` — it pulls Express, React and
Vite, and links the `shared` workspace.

`npm test` and `npm run colors` deliberately need neither: the tests use only
`node:test` and `node:sqlite`, and the PDF extractor uses only the Python
standard library. That keeps the data layer verifiable in CI without a
registry.

## Not in V1

- `US-WEST-02A_DH151-DH173-C120_Cutsheet.csv` and
  `US-WEST-02B_C160_Cutsheet.csv` — full DCIM/NetBox cable ledgers (~9,700 and
  ~5,000 rows) covering all intra-hall cabling. Kept in `data/raw/` for
  reference, not ingested.
- Faithful cabinet-grid rendering. Hall overhead views are stylised: cabinets
  that terminate an inter-hall run, laid out on a grid, not the true pod
  geometry from the per-hall PDFs.

## Deploying

SQLite-on-disk is a local-dev and internal-server choice. Vercel and Netlify
have ephemeral filesystems, so a serverless deploy needs a `StatusStore`
sibling backed by a hosted database (Postgres, Turso). The interface is already
in place for it; `SqliteStatusStore` is one implementation of it.
