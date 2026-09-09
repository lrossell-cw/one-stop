/**
 * Turning circuits into drawable geometry for the visual view.
 *
 * The map draws one continuous line per circuit, coloured by its worst hop --
 * the same reading as the colour on the sheet. Per-hop detail is the cutsheet's
 * job, so nothing here splits a run into separately coloured pieces.
 *
 * Every point on a line comes from the circuit's ACTUAL endpoint data rather
 * than its nominal position in the chain. That is what makes the drawing follow
 * a re-patch: move a circuit to a different hall and its line moves with it.
 */

import { rollUp } from '@one-stop/shared/model';
import { NODE_ANCHORS } from './site.js';

/** The two rooms a hop connects, or null if either end is unknown. */
export function hopEndpoints(hop) {
  const from = hop.a?.node ?? hop.from;
  const to = hop.z?.node ?? hop.to;
  if (!from || !to || from === to) return null;
  return { from, to };
}

/**
 * The ordered list of rooms a circuit actually passes through, read from its
 * endpoint data. Consecutive duplicates are collapsed, so a circuit that stops
 * at DH151 yields ['MMR', 'DH151'] rather than a padded chain.
 */
export function circuitNodes(circuit) {
  const nodes = [];
  const push = (n) => {
    if (n && nodes[nodes.length - 1] !== n) nodes.push(n);
  };

  for (const hop of circuit.hops) {
    // An unbuilt hop ends the run: there is no path beyond it to draw.
    if (!hop.complete) break;
    const ends = hopEndpoints(hop);
    if (!ends) break;
    push(ends.from);
    push(ends.to);
  }
  return nodes;
}

/**
 * The whole run as a single path, MMR through to wherever it terminates.
 *
 * This is the visual view's rendering: one continuous line per circuit,
 * coloured by its worst hop -- the same reading as the colour on the sheet.
 * The geometry still comes from real endpoints at every step, so a re-patch
 * that moves a circuit to a different hall redraws the line through the new
 * room rather than the old one.
 *
 * @returns {{d: string|null, status: string, nodes: string[], built: number}}
 */
export function wholeLine(circuit, { offset = 0 } = {}) {
  const nodes = circuitNodes(circuit);
  const built = circuit.hops.filter((h) => h.complete);

  if (nodes.length < 2) {
    return { d: null, status: rollUp(circuit.hops.map((h) => h.status)), nodes, built: 0 };
  }

  const pts = nodes.map((n) => NODE_ANCHORS[n]).filter(Boolean);
  if (pts.length < 2) {
    return { d: null, status: rollUp(built.map((h) => h.status)), nodes, built: built.length };
  }

  return {
    d: roundedPolyline(pts, offset),
    // Only hops that exist can be up or down; an unbuilt tail must not drag
    // the whole run to NOT_RUN and make a healthy circuit look dead.
    status: rollUp(built.map((h) => h.status)),
    nodes,
    built: built.length,
  };
}

/**
 * A polyline through the anchor points with rounded corners, nudged by
 * `offset` so parallel circuits fan out instead of stacking exactly.
 */
function roundedPolyline(pts, offset) {
  const p = pts.map((pt, i) => ({
    x: pt.x + (i === 0 || i === pts.length - 1 ? 0 : offset),
    y: pt.y + offset * 0.6,
  }));

  if (p.length === 2) {
    return `M ${p[0].x} ${p[0].y} L ${p[1].x} ${p[1].y}`;
  }

  const R = 16;
  let d = `M ${p[0].x} ${p[0].y}`;
  for (let i = 1; i < p.length - 1; i += 1) {
    const prev = p[i - 1];
    const cur = p[i];
    const next = p[i + 1];
    d += ` L ${lerp(cur, prev, R)} Q ${cur.x} ${cur.y} ${lerp(cur, next, R)}`;
  }
  const last = p[p.length - 1];
  return `${d} L ${last.x} ${last.y}`;
}

/** A point `dist` along the line from `a` toward `b`, as "x y". */
function lerp(a, b, dist) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const t = Math.min(dist / len, 0.5);
  return `${round(a.x + dx * t)} ${round(a.y + dy * t)}`;
}

const round = (n) => Math.round(n * 10) / 10;
