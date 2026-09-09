/**
 * Core domain model for PHX01 fiber runs.
 *
 * Deliberately knows nothing about CSVs, PDFs, SQLite or React. Every data
 * source (CSV today, Google Sheets / Jira / NetBox later) produces these
 * shapes, and every consumer reads them.
 */

/** The halls and rooms the site map knows about. */
export const NODES = ['MMR', 'DH151', 'DH173', 'DH120', 'DH160'];

/**
 * The inter-hall topology, as an ordered chain. The map derives geometry from
 * this plus each circuit's real endpoints -- it is NOT a list of fixed lines
 * between fixed icons.
 */
export const HOP_CHAIN = [
  { id: 'MMR-151', from: 'MMR', to: 'DH151' },
  { id: '151-120', from: 'DH151', to: 'DH120' },
  { id: '120-160', from: 'DH120', to: 'DH160' },
];

export const HOP_IDS = HOP_CHAIN.map((h) => h.id);

/** Manual statuses, in the order a click cycles through them. */
export const STATUS_CYCLE = ['UP', 'DOWN', 'INVESTIGATE'];

/**
 * Every status a hop can hold.
 *
 * UP / DOWN / INVESTIGATE are operator-set and always win over the derived
 * default. NOT_RUN is structural: the cutsheet has no endpoint data for that
 * hop at all, so there is nothing to be up or down about.
 */
export const STATUSES = [...STATUS_CYCLE, 'NOT_RUN'];

/**
 * Occupancy as recovered from the cutsheet's color legend.
 * Yellow = Occupied, Green = Open, Red = Faulty.
 */
export const OCCUPANCY = ['OCCUPIED', 'OPEN', 'FAULTY', 'UNKNOWN'];

/**
 * Map a hop's occupancy color to the status it starts life in.
 *
 * Per the operating decision: anything we cannot positively confirm starts as
 * INVESTIGATE so it lands on someone's list to verify, rather than silently
 * reading as healthy. A faulty (red) cell starts DOWN. Only a hop that is
 * both fully patched and marked occupied (yellow) starts UP.
 */
export function deriveStatus({ occupancy, complete }) {
  if (!complete) return 'NOT_RUN';
  switch (occupancy) {
    case 'FAULTY':
      return 'DOWN';
    case 'OCCUPIED':
      return 'UP';
    // Green (Open) means the ports are free, not that a run is healthy, so it
    // still wants eyes on it before anyone trusts it.
    case 'OPEN':
    case 'UNKNOWN':
    default:
      return 'INVESTIGATE';
  }
}

/** Advance a status one step around the click cycle. */
export function nextStatus(current) {
  const i = STATUS_CYCLE.indexOf(current);
  // NOT_RUN and anything unrecognised enter the cycle at its start.
  if (i === -1) return STATUS_CYCLE[0];
  return STATUS_CYCLE[(i + 1) % STATUS_CYCLE.length];
}

/**
 * Merge operator overrides onto derived defaults.
 *
 * `overrides` is keyed `${circuitId}::${hopId}`. A manual status always wins
 * once set; clearing it falls back to the derived default.
 */
export function applyOverrides(circuits, overrides = {}) {
  return circuits.map((circuit) => ({
    ...circuit,
    hops: circuit.hops.map((hop) => {
      const key = overrideKey(circuit.id, hop.id);
      const override = overrides[key];
      return {
        ...hop,
        derivedStatus: hop.derivedStatus,
        status: override?.status ?? hop.derivedStatus,
        overridden: Boolean(override),
        overriddenAt: override?.updatedAt ?? null,
        overriddenBy: override?.updatedBy ?? null,
      };
    }),
  }));
}

export function overrideKey(circuitId, hopId) {
  return `${circuitId}::${hopId}`;
}

/** Which nodes a circuit actually touches, derived from its endpoint data. */
export function nodesTouched(circuit) {
  const seen = new Set();
  for (const hop of circuit.hops) {
    if (hop.status === 'NOT_RUN' && !hop.a && !hop.z) continue;
    if (hop.a?.node) seen.add(hop.a.node);
    if (hop.z?.node) seen.add(hop.z.node);
  }
  return [...seen];
}

/**
 * Roll several hop statuses up into one summary status, worst first.
 *
 * Used to color an aggregate map segment that stands for many circuits: one
 * DOWN circuit should be visible even if fifty others are UP.
 */
const SEVERITY = { DOWN: 3, INVESTIGATE: 2, UP: 1, NOT_RUN: 0 };

export function rollUp(statuses) {
  let worst = 'NOT_RUN';
  for (const s of statuses) {
    if ((SEVERITY[s] ?? 0) > (SEVERITY[worst] ?? 0)) worst = s;
  }
  return worst;
}
