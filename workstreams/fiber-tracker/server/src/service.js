/**
 * Fiber tracker business logic.
 *
 * Deliberately free of Express (and of any HTTP concept beyond returning a
 * status code), so the precedence rules that matter -- derived defaults vs
 * operator overrides, and what a click does -- are testable without a server,
 * a socket, or an npm install.
 *
 * `app.js` is a thin routing shim over this.
 */

import {
  applyOverrides,
  HOP_IDS,
  STATUS_CYCLE,
  nextStatus,
} from '@one-stop/shared/model';

export class FiberService {
  /**
   * @param {object} opts
   * @param {import('./store.js').SqliteStatusStore} opts.store
   * @param {{name: string, load: () => Promise<object>}} opts.source
   */
  constructor({ store, source }) {
    this.store = store;
    this.source = source;
    this.snapshot = null;
  }

  /**
   * The cutsheet snapshot, cached. Overrides are NOT cached -- they are read
   * from the store on every request, so a status one person sets is visible to
   * everyone else on their next load.
   */
  async load(force = false) {
    if (!this.snapshot || force) this.snapshot = await this.source.load();
    return this.snapshot;
  }

  async circuits() {
    const data = await this.load();
    return {
      meta: data.meta,
      warnings: data.warnings,
      hops: HOP_IDS,
      statusCycle: STATUS_CYCLE,
      circuits: applyOverrides(data.circuits, this.store.all()),
    };
  }

  async reload() {
    const data = await this.load(true);
    return { ok: true, circuits: data.circuits.length, warnings: data.warnings };
  }

  async findHop(circuitId, hopId) {
    const data = await this.load();
    const circuit = data.circuits.find((c) => c.id === circuitId);
    if (!circuit) {
      return { error: { code: 404, message: `unknown circuit ${circuitId}` } };
    }
    const hop = circuit.hops.find((h) => h.id === hopId);
    if (!hop) {
      return { error: { code: 404, message: `unknown hop ${hopId}` } };
    }
    return { circuit, hop };
  }

  /**
   * Set or cycle a hop's status.
   *
   * `cycle: true` advances one step from the CURRENT stored value, resolved
   * server-side. Two people clicking the same segment at once therefore can't
   * both compute the next value from the same stale state.
   */
  async setStatus(circuitId, hopId, { status, cycle, by = null } = {}) {
    const found = await this.findHop(circuitId, hopId);
    if (found.error) return found;

    let next = status;
    if (cycle) {
      const current = this.store.get(circuitId, hopId)?.status ?? found.hop.derivedStatus;
      next = nextStatus(current);
    } else if (!STATUS_CYCLE.includes(status)) {
      return {
        error: {
          code: 400,
          message: `status must be one of ${STATUS_CYCLE.join(', ')}`,
        },
      };
    }

    const saved = this.store.set(circuitId, hopId, next, by);
    return {
      result: {
        circuitId,
        hopId,
        ...saved,
        derivedStatus: found.hop.derivedStatus,
        overridden: true,
      },
    };
  }

  /** Drop an override so the hop falls back to its derived default. */
  async clearStatus(circuitId, hopId) {
    const found = await this.findHop(circuitId, hopId);
    if (found.error) return found;

    this.store.clear(circuitId, hopId);
    return {
      result: {
        circuitId,
        hopId,
        status: found.hop.derivedStatus,
        derivedStatus: found.hop.derivedStatus,
        overridden: false,
      },
    };
  }

  history(limit = 100) {
    return { entries: this.store.history(limit) };
  }
}
