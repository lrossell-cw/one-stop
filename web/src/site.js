/**
 * PHX01 site geometry.
 *
 * Coordinates are in the floorplan's own pixel space (657 x 624, the raster in
 * data/raw/PHX01_Floorplan.pdf), traced from the room outlines on that
 * drawing. The rooms are therefore in their true relative positions even
 * though the interiors are stylised -- V1 does not attempt the cabinet grids.
 */

export const SITE_VIEWBOX = { width: 657, height: 624 };

/**
 * Rooms the map draws. `hall: true` means it is a data hall you can zoom into.
 *
 * MMR: the cutsheet's endpoints are MMR164 / "MMR ISP PP", and the floorplan
 * shows two MMR rooms (MMR2 and MMR3). Which one room 164 is has not been
 * confirmed, so both are drawn and the logical MMR node anchors on MMR3, the
 * nearer of the two to DH151. Correcting this is a one-line change here.
 */
export const ROOMS = [
  { id: 'DH173', label: 'DH173', hall: true, x: 48, y: 128, w: 112, h: 179 },
  { id: 'DH151', label: 'DH151', hall: true, x: 48, y: 325, w: 112, h: 165 },
  { id: 'DH120', label: 'DH120', hall: true, x: 500, y: 18, w: 117, h: 189 },
  { id: 'DH160', label: 'DH160', hall: true, x: 502, y: 315, w: 115, h: 125 },

  { id: 'MMR3', label: 'MMR3', hall: false, x: 118, y: 92, w: 47, h: 23 },
  { id: 'MMR2', label: 'MMR2', hall: false, x: 270, y: 93, w: 45, h: 22 },
];

/** Where a fiber path attaches for each logical node in the model. */
export const NODE_ANCHORS = {
  MMR: { x: 141, y: 103, room: 'MMR3' },
  DH151: { x: 104, y: 407, room: 'DH151' },
  DH173: { x: 104, y: 217, room: 'DH173' },
  DH120: { x: 558, y: 112, room: 'DH120' },
  DH160: { x: 559, y: 377, room: 'DH160' },
};

export const HALLS = ROOMS.filter((r) => r.hall).map((r) => r.id);

/** Cutsheet tabs: the four halls plus the MMR itself. */
export const CUTSHEET_TABS = ['MMR', ...HALLS];

export const STATUS_COLORS = {
  UP: '#1a9850',
  DOWN: '#d73027',
  INVESTIGATE: '#e8a33d',
  NOT_RUN: '#9aa5b1',
};

export const STATUS_LABELS = {
  UP: 'Up',
  DOWN: 'Down',
  INVESTIGATE: 'Investigate',
  NOT_RUN: 'Not run',
};

export const OCCUPANCY_LABELS = {
  OCCUPIED: 'Occupied (yellow)',
  OPEN: 'Open (green)',
  FAULTY: 'Faulty (red)',
  UNKNOWN: 'No color in cutsheet',
};

/**
 * Route a hop between two anchors.
 *
 * This is the "train track switch" behaviour: the path is computed from the
 * hop's ACTUAL endpoint nodes every render. Re-patch a circuit to a different
 * hall in the cutsheet and the drawn line follows it, because nothing here is
 * a hardcoded line between two fixed icons -- `from`/`to` come from the data.
 *
 * Returns an SVG path string, or null when either endpoint is unknown.
 */
export function routeHop(fromNode, toNode, { offset = 0 } = {}) {
  const a = NODE_ANCHORS[fromNode];
  const b = NODE_ANCHORS[toNode];
  if (!a || !b) return null;

  // Orthogonal-ish routing with a rounded elbow, so parallel runs between the
  // same pair of rooms fan out instead of overprinting.
  const midX = (a.x + b.x) / 2 + offset;
  const dx = Math.abs(b.x - a.x);

  if (dx < 40) {
    // Same column: bow outwards so the run is visible alongside the rooms.
    const bowX = a.x + 70 + offset;
    return `M ${a.x} ${a.y} C ${bowX} ${a.y}, ${bowX} ${b.y}, ${b.x} ${b.y}`;
  }

  return [
    `M ${a.x} ${a.y}`,
    `L ${midX - 18} ${a.y}`,
    `Q ${midX} ${a.y} ${midX} ${a.y + Math.sign(b.y - a.y) * 18}`,
    `L ${midX} ${b.y - Math.sign(b.y - a.y) * 18}`,
    `Q ${midX} ${b.y} ${midX + 18} ${b.y}`,
    `L ${b.x} ${b.y}`,
  ].join(' ');
}
