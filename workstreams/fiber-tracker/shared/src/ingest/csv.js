/**
 * Parse MMR_Cutsheet.csv (+ the PDF-derived color sidecar) into circuits.
 *
 * The sheet is laid out as a chain of hop column-groups separated by `<>`
 * marker columns:
 *
 *   Circuit | MMR A | <> | MMR Z | Cassette | Port | <> | 151 A | Cassette | Port | <> | ...
 *
 * Rather than hardcode column indices -- which would break the moment someone
 * inserts a column -- the header is parsed structurally: `<>` columns delimit
 * groups, and within a group the endpoint column is the one that is not
 * Cassette/Port.
 */

import { HOP_CHAIN, deriveStatus } from '../model.js';
import { parseLocation } from '../location.js';

/** Minimal RFC4180 CSV reader (handles quoted fields containing commas). */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') {
      field += ch;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const CLEAN = (s) => (s ?? '').replace(/\s+/g, ' ').trim();

/**
 * Work out, from the header row, which column holds what.
 *
 * Returns the ordered list of endpoint groups; each is
 * `{ label, endpointCol, cassetteCol, portCol }`.
 */
export function parseHeader(header) {
  const cells = header.map(CLEAN);
  const groups = [];
  let current = null;

  cells.forEach((cell, index) => {
    if (cell === '<>') {
      if (current) groups.push(current);
      current = null;
      return;
    }
    const lower = cell.toLowerCase();
    if (!cell) return;

    if (lower === 'cassette') {
      if (current) current.cassetteCol = index;
      return;
    }
    if (lower === 'port') {
      if (current) current.portCol = index;
      return;
    }
    if (lower === 'circuit' || lower === 'location' ||
        lower === 'nokia port' || lower === 'notes') {
      return; // metadata columns, handled separately
    }

    // Anything else starting a group is an endpoint label ("MMR A", "151 Z").
    if (!current) {
      current = { label: cell, endpointCol: index,
                  cassetteCol: null, portCol: null };
    }
  });
  if (current) groups.push(current);

  return groups;
}

function metaColumns(header) {
  const cells = header.map((c) => CLEAN(c).toLowerCase());
  return {
    circuit: cells.indexOf('circuit'),
    location: cells.indexOf('location'),
    nokiaPort: cells.indexOf('nokia port'),
    notes: cells.indexOf('notes'),
  };
}

/**
 * Match the sheet's endpoint labels ("MMR A", "151 Z", "120 A") onto the hop
 * chain. Each hop consumes the A-side that opens it and the A-side of the next
 * group as its Z-side, because the sheet records a chain, not isolated pairs.
 */
function endpointFor(groups, label) {
  return groups.find((g) => CLEAN(g.label).toLowerCase() === label.toLowerCase());
}

/** The (A-side, Z-side) sheet labels that describe each hop. */
const HOP_COLUMNS = {
  'MMR-151': { a: 'MMR Z', z: '151 A' },
  '151-120': { a: '151 Z', z: '120 A' },
  '120-160': { a: '120 Z', z: '160 A' },
};

/**
 * Which hall a column belongs to, from its header label ("120 Z" -> DH120).
 *
 * The sheet leaves the location cell blank whenever a hop's Z-side sits in the
 * same hall as its A-side and only the cassette/port differ -- every `120 Z`
 * cell in the file is empty, with just `A, 15/16` beside it. Without this the
 * entire 120<->160 hop reads as unbuilt.
 */
function nodeFromLabel(label) {
  const m = /^(?:DH|C)?\s*(151|173|120|160)\b/i.exec(CLEAN(label));
  if (m) return `DH${m[1]}`;
  if (/^mmr/i.test(CLEAN(label))) return 'MMR';
  return null;
}

function readEndpoint(row, group) {
  if (!group) return null;
  const raw = CLEAN(row[group.endpointCol]);
  const cassette = group.cassetteCol === null ? '' : CLEAN(row[group.cassetteCol]);
  const port = group.portCol === null ? '' : CLEAN(row[group.portCol]);

  if (!raw && !cassette && !port) return null;

  const loc = parseLocation(raw);
  const columnNode = nodeFromLabel(group.label);

  return {
    raw,
    // Node comes from the endpoint data when it is recorded, and falls back to
    // the column's hall when the sheet left it implicit. This is what lets the
    // map re-route on a re-patch: move a circuit to a different hall and the
    // node changes with it, rather than being pinned to a fixed icon.
    node: loc?.node ?? columnNode,
    nodeInferred: !loc?.node && Boolean(columnNode),
    rack: loc?.rack ?? null,
    unit: loc?.unit ?? null,
    role: loc?.role ?? null,
    cassette: cassette || null,
    port: port || null,
    // An endpoint counts as patched if we know where it lands: either an
    // explicit location, or a cassette/port pair in a column whose hall is
    // known from the header.
    patched: Boolean(raw) || Boolean(cassette && port && columnNode),
    location: loc,
  };
}

/**
 * Build circuits from the CSV rows plus the PDF color sidecar.
 *
 * @param {string} csvText  raw MMR_Cutsheet.csv
 * @param {object} colors   parsed data/generated/mmr_cell_colors.json (optional)
 */
export function buildCircuits(csvText, colors = null) {
  const rows = parseCsv(csvText);
  if (!rows.length) return { circuits: [], warnings: ['cutsheet is empty'] };

  const header = rows[0];
  const groups = parseHeader(header);
  const meta = metaColumns(header);
  const colorCells = colors?.cells ?? {};
  const warnings = [];

  const circuits = [];
  const seenIds = new Map();

  rows.slice(1).forEach((row, i) => {
    const csvLine = i + 2; // 1-based, and row 1 is the header
    if (!row.some((cell) => CLEAN(cell))) return; // spacer row

    const label = CLEAN(row[meta.circuit]);
    const rowColors = colorCells[String(csvLine)] ?? {};

    const hops = HOP_CHAIN.map((hop) => {
      const cols = HOP_COLUMNS[hop.id];
      const a = readEndpoint(row, endpointFor(groups, cols.a));
      const z = readEndpoint(row, endpointFor(groups, cols.z));

      // A hop is "complete" only when BOTH of its endpoints are patched.
      // Where downstream columns are blank the patch panel ports are still
      // open -- the run simply has not been built yet, so it is not a fault.
      // Completeness is derived per hop from the data itself rather than from
      // any hardcoded list of rows, so correcting the CSV corrects the app.
      const complete = Boolean(a?.patched && z?.patched);
      const occupancy = rowColors[hop.id] ?? 'UNKNOWN';
      const usable = occupancy === 'NOTE' ? 'UNKNOWN' : occupancy;

      return {
        id: hop.id,
        from: hop.from,
        to: hop.to,
        a,
        z,
        complete,
        occupancy: usable,
        derivedStatus: deriveStatus({ occupancy: usable, complete }),
      };
    });

    // Stable, human-meaningful id. Rows share labels ("OPEN" x14, blanks), so
    // fall back to the CSV line, which is also what the color map is keyed on.
    const slug = label ? label.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') : '';
    let id = slug ? `${slug}@${csvLine}` : `row-${csvLine}`;
    if (seenIds.has(id)) warnings.push(`duplicate circuit id ${id}`);
    seenIds.set(id, true);

    circuits.push({
      id,
      csvLine,
      label: label || '(unlabelled)',
      unlabelled: !label,
      // "BAD DO NOT USE" and "OPEN" are states-of-the-row, not circuit names.
      isSpare: /^open$/i.test(label),
      isCondemned: /bad\s*do\s*not\s*use/i.test(label),
      location: CLEAN(row[meta.location]) || null,
      nokiaPort: CLEAN(row[meta.nokiaPort]) || null,
      notes: CLEAN(row[meta.notes]) || null,
      hops,
    });
  });

  if (!colors) {
    warnings.push(
      'no color sidecar supplied -- every hop falls back to INVESTIGATE. ' +
      'Run `npm run colors` to regenerate it from the PDF.');
  }

  return { circuits, warnings };
}
