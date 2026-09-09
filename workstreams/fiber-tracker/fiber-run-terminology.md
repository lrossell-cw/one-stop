# Fiber Run Terminology Reference

Reference doc for labeling nodes, hops, and strand states in the fiber-tracker workstream. This is the authoritative terminology — use these terms in code, comments, UI copy, and future docs instead of looser language like "loop" or "train track switch."

## Topology

**Cascade (daisy-chain) topology**
A main trunk/feeder cable runs sequentially through multiple data halls, with each hall tapping off a portion of the strand count before passing the remainder downstream to the next hall. The MMR ↔ DH151 ↔ DH120 ↔ DH160 run is a **linear cascade**, not a true ring — it doesn't loop back to its origin. ("Loop" is common colloquial shorthand for this pattern, but isn't the precise term and shouldn't be used in code/schema.)

**Ring topology**
Reserved for a run that physically or logically loops back to its starting point. Worth distinguishing in the data model (`topology: "cascade"` vs `"ring"`) in case future runs are true rings.

## Strand roles at each node

- **Express fibers** (aka *express-through*) — strands that pass straight through a hall's enclosure untouched, continuing to the next hop.
- **Drop fibers** (aka *local fibers*) — strands broken out and terminated at that hall's patch panel for local use.
- **Express port / midspan port / oval port** — the physical enclosure feature enabling a cable to be accessed and a few strands dropped without cutting/splicing the entire cable. The hardware mechanism that makes express/drop splitting possible at a mid-chain hall.

## Node roles

- **Head-end** — the origin of the run (MMR).
- **Tap point / distribution point** — a mid-chain hall where some strands drop and the rest continue as express (DH151, DH120).
- **Terminal node / last hop** — the final hall in the chain, where all *remaining* strands are fully broken out with no further express-through (DH160).

## Note on "routing" behavior
Earlier scope notes described re-routing behavior using a "train track switch" analogy. That language described *behavior* (the rendered path follows real endpoint data, so a re-patch changes what's drawn), not a topology term — it should not be used as if it names a fiber concept. Use **express/drop/cascade/tap/terminal** for topology; describe the redraw-on-repatch behavior in plain terms (see fiber-tracker README's "Routing behavior" section).

## Data model

```json
{
  "runId": "MMR-DH151-DH120-DH160",
  "topology": "cascade",
  "nodes": [
    { "id": "MMR", "role": "headend" },
    { "id": "DH151", "role": "tap" },
    { "id": "DH120", "role": "tap" },
    { "id": "DH160", "role": "terminal" }
  ]
}
```

Per-node express/drop counts (`expressStrands`, `dropStrands`) are **not stored as pre-aggregated fields** — see "Resolved: express/drop derivation" below for why.

## Color legend has a fourth state: NOTE

The PDF-derived color sidecar (`data/generated/mmr_cell_colors.json`) recovers a fourth cell color beyond the documented Yellow/Green/Red: **NOTE** (blue/teal), used for cells carrying a free-text annotation rather than an occupancy call. The ingest pipeline (`shared/src/ingest/csv.js`) treats `NOTE` the same as `UNKNOWN` for status derivation purposes — it does not get its own `deriveStatus` branch — but it is worth knowing this fourth raw color exists in the source data if the derivation logic changes.

## Resolved: express/drop derivation from MMR_Cutsheet.csv

Checked against the actual file (`data/raw/MMR_Cutsheet.csv`, 62 circuit rows): it does **not** carry aggregate express/drop counts per hall. It's a per-circuit occupancy sheet — one row per strand-pair circuit, with A/Z cassette+port populated at each hop the circuit actually reaches, plus a status color (Yellow=Occupied, Green=Open, Red=Faulty) and free-text notes.

Express vs. drop is **derivable per circuit, not read as a count**:
- If a circuit's row has A/Z port data populated at a hop *and* at the next hop, that circuit is **express-through** the middle hall.
- If a circuit's row has A/Z port data populated at a hop but nothing beyond, that circuit **drops** at that hall.

So `expressStrands`/`dropStrands` per node should be **computed at load time** by scanning which circuits continue past a given hall vs. terminate there — not stored as static fields in the node data. Keep the parser responsible for this derivation; don't hand-maintain express/drop counts separately from the circuit rows, or they'll drift out of sync with the source data.
