/**
 * Group hops into drawable map segments.
 *
 * Lives in one place because the map and the detail panel must agree on the
 * segment `key` exactly -- if they ever drift, clicking a segment opens an
 * empty panel.
 *
 * Grouping is by the pair of rooms a hop ACTUALLY connects, read from its
 * endpoint data rather than its nominal position in the chain. That is what
 * makes the drawing follow a re-patch.
 */

import { rollUp } from '@one-stop/shared/model';
import { routeHop } from './site.js';

/** The two rooms a hop connects, or null if either end is unknown. */
export function hopEndpoints(hop) {
  const from = hop.a?.node ?? hop.from;
  const to = hop.z?.node ?? hop.to;
  if (!from || !to || from === to) return null;
  return { from, to };
}

/**
 * @param {object[]} circuits
 * @returns {Map<string, object>} keyed `${from}->${to}`
 */
export function groupSegments(circuits) {
  const groups = new Map();

  for (const circuit of circuits) {
    for (const hop of circuit.hops) {
      const ends = hopEndpoints(hop);
      if (!ends) continue;

      const key = `${ends.from}->${ends.to}`;
      if (!groups.has(key)) {
        groups.set(key, { key, from: ends.from, to: ends.to, hops: [] });
      }
      groups.get(key).hops.push({ circuit, hop });
    }
  }

  for (const g of groups.values()) {
    g.path = routeHop(g.from, g.to);
    g.status = rollUp(g.hops.map(({ hop }) => hop.status));
    g.total = g.hops.length;
    g.down = g.hops.filter(({ hop }) => hop.status === 'DOWN').length;
    g.investigate = g.hops.filter(({ hop }) => hop.status === 'INVESTIGATE').length;
  }

  return groups;
}
