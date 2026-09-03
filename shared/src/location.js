/**
 * Parsing and sorting for PHX01 location codes.
 *
 * The real cutsheet is not consistent. All of these appear, and all of them
 * have to normalise to the same shape:
 *
 *   DH151.R33.RU4          dotted, R-prefixed rack, RU-prefixed unit
 *   DH151 CAB33 RU05       space separated, CAB-prefixed rack, zero padded
 *   DH151 CAB34 RU40 MMR   ... with a trailing role word
 *   dh120.266.32           lowercase, bare numeric rack and unit
 *   DH120.R10.U43          U- rather than RU- prefixed unit
 *   MMR164.R5.RU22         MMR room rather than a data hall
 *   MMR ISP PP             a named panel with no rack/unit at all
 *   dh160.26.38            lowercase bare numerics
 *
 * Sort order (per CLAUDE.md): alphabetical first, numeric second, applied to
 * the A-side, then the same rule on the Z-side as a tiebreak.
 */

/** Canonical node names, keyed by the many ways the sheet spells them. */
const NODE_ALIASES = [
  [/^dh\s*151/i, 'DH151'],
  [/^dh\s*173/i, 'DH173'],
  [/^dh\s*120/i, 'DH120'],
  [/^c\s*120/i, 'DH120'],
  [/^dh\s*160/i, 'DH160'],
  [/^c\s*160/i, 'DH160'],
  [/^mmr/i, 'MMR'],
];

/**
 * Parse a raw location code into { node, rack, unit, role, raw }.
 *
 * Returns null for empty/whitespace input so callers can distinguish "no
 * endpoint recorded" from "endpoint recorded but unparseable".
 */
export function parseLocation(raw) {
  if (raw == null) return null;
  const text = String(raw).trim().replace(/\s+/g, ' ');
  if (!text) return null;

  const node = NODE_ALIASES.find(([re]) => re.test(text))?.[1] ?? null;

  // Split on dots and spaces alike, so `DH151.R33.RU4` and `DH151 CAB33 RU05`
  // decompose the same way.
  const parts = text.split(/[.\s]+/).filter(Boolean);

  let rack = null;
  let unit = null;
  const roleWords = [];

  // parts[0] is the room/hall token; everything after is rack, unit, role.
  for (const part of parts.slice(1)) {
    const rackMatch = /^(?:R|CAB|RACK)?(\d+)$/i.exec(part);
    const unitMatch = /^(?:RU|U)(\d+)$/i.exec(part);

    if (unitMatch) {
      // An explicit RU/U prefix is unambiguous -- always the unit.
      unit = Number(unitMatch[1]);
    } else if (rackMatch) {
      // Bare or R/CAB-prefixed numbers fill rack first, then unit, which is
      // what `dh120.266.32` (rack 266, unit 32) needs.
      if (rack === null) rack = Number(rackMatch[1]);
      else if (unit === null) unit = Number(rackMatch[1]);
    } else {
      roleWords.push(part);
    }
  }

  return {
    raw: text,
    node,
    rack,
    unit,
    role: roleWords.length ? roleWords.join(' ') : null,
    // The alphabetical key is the node when we recognise one, else the leading
    // non-numeric text. `MMR ISP PP` sorts under "MMR ISP PP", not "MMR".
    alpha: node ?? text.replace(/\d+/g, '').trim().toUpperCase(),
  };
}

/**
 * Compare two parsed locations: alphabetical part first, numeric parts second.
 *
 * Nulls (no endpoint recorded) sort last, so incomplete rows collect at the
 * bottom of a cutsheet rather than salting the top of it.
 */
export function compareLocation(a, b) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;

  const alpha = a.alpha.localeCompare(b.alpha, 'en', { sensitivity: 'base' });
  if (alpha !== 0) return alpha;

  const rack = compareNumeric(a.rack, b.rack);
  if (rack !== 0) return rack;

  const unit = compareNumeric(a.unit, b.unit);
  if (unit !== 0) return unit;

  // Last resort so the sort is total and therefore stable across reloads.
  return a.raw.localeCompare(b.raw, 'en', {
    sensitivity: 'base',
    numeric: true,
  });
}

function compareNumeric(a, b) {
  const aMissing = a === null || a === undefined || Number.isNaN(a);
  const bMissing = b === null || b === undefined || Number.isNaN(b);
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;
  return a - b;
}

/**
 * Sort cutsheet rows by A-side, then Z-side as a tiebreak.
 *
 * Rows are `{ aSide, zSide }` of parsed locations (or null).
 */
export function compareRows(rowA, rowB) {
  const a = compareLocation(rowA.aSide, rowB.aSide);
  if (a !== 0) return a;
  return compareLocation(rowA.zSide, rowB.zSide);
}

export function sortRows(rows) {
  return [...rows].sort(compareRows);
}

/** Human-readable form: `DH151 R33 RU4`. */
export function formatLocation(loc) {
  if (!loc) return '';
  const bits = [loc.node ?? loc.alpha];
  if (loc.rack !== null) bits.push(`R${loc.rack}`);
  if (loc.unit !== null) bits.push(`RU${loc.unit}`);
  if (loc.role) bits.push(loc.role);
  return bits.join(' ');
}
