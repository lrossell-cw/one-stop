/**
 * Cutsheet table rows: per-hall filtering and ordering.
 *
 * One row is one *run* -- a single circuit's single hop -- because that is the
 * unit an operator patches, statuses, and looks up. A circuit that crosses
 * three halls contributes three rows, and appears in the cutsheet of every
 * hall it touches.
 */

import { parseLocation, compareRows } from './location.js';

/**
 * The location a row sorts by.
 *
 * An endpoint whose location cell is blank but whose hall is known from the
 * column header (every `120 Z` cell in the sheet) is still a real, patched
 * endpoint. Sorting it as "missing" would drop the whole 120<->160 hop to the
 * bottom of every table, ordered only by its Z-side -- not the
 * alphabetical-then-numeric A-side order the cutsheet is supposed to have.
 * So synthesise a key from the inferred hall instead; it sorts within that
 * hall, after the rows that name a rack.
 */
function sortKeyFor(end) {
  if (!end) return null;
  if (end.location) return end.location;

  const parsed = parseLocation(end.raw ?? '');
  if (parsed) return parsed;
  if (!end.node) return null;

  return {
    raw: end.raw || `${end.node} ${end.cassette ?? ''}${end.port ? ` ${end.port}` : ''}`.trim(),
    node: end.node,
    alpha: end.node,
    rack: null,
    unit: null,
    role: null,
    inferred: true,
  };
}

/**
 * Flatten circuits into cutsheet rows, optionally filtered to one hall.
 *
 * @param {object[]} circuits  circuits with statuses already merged
 * @param {string|null} hall   'DH151' | 'DH173' | 'DH120' | 'DH160' | 'MMR',
 *                             or null for the whole site
 */
export function cutsheetRows(circuits, hall = null) {
  const rows = [];

  for (const circuit of circuits) {
    for (const hop of circuit.hops) {
      // A hall's cutsheet shows the runs that land in it, on either side.
      if (hall && hop.a?.node !== hall && hop.z?.node !== hall) continue;

      rows.push({
        key: `${circuit.id}::${hop.id}`,
        circuitId: circuit.id,
        circuitLabel: circuit.label,
        csvLine: circuit.csvLine,
        hopId: hop.id,
        from: hop.from,
        to: hop.to,
        status: hop.status ?? hop.derivedStatus,
        derivedStatus: hop.derivedStatus,
        overridden: Boolean(hop.overridden),
        overriddenBy: hop.overriddenBy ?? null,
        occupancy: hop.occupancy,
        complete: hop.complete,
        notes: circuit.notes,
        nokiaPort: circuit.nokiaPort,
        aRaw: hop.a?.raw ?? '',
        zRaw: hop.z?.raw ?? '',
        aCassette: hop.a?.cassette ?? null,
        aPort: hop.a?.port ?? null,
        zCassette: hop.z?.cassette ?? null,
        zPort: hop.z?.port ?? null,
        aNode: hop.a?.node ?? null,
        zNode: hop.z?.node ?? null,
        aInferred: Boolean(hop.a?.nodeInferred),
        zInferred: Boolean(hop.z?.nodeInferred),
        // Parsed forms drive the sort; the raw strings drive display.
        aSide: sortKeyFor(hop.a),
        zSide: sortKeyFor(hop.z),
      });
    }
  }

  // Alphabetical first, numeric second, on A-side; Z-side as the tiebreak.
  return rows.sort(compareRows);
}

/** Per-hall row counts, for tab badges. */
export function hallCounts(circuits, halls) {
  return Object.fromEntries(
    halls.map((h) => [h, cutsheetRows(circuits, h).length]),
  );
}
