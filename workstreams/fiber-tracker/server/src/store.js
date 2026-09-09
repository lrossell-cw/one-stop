/**
 * Shared, persistent store for operator-set fiber run statuses.
 *
 * State is server-side and shared: every viewer of the app sees the same
 * thing. Nothing here touches localStorage.
 *
 * `StatusStore` is the interface; `SqliteStatusStore` is the V1 implementation.
 * Deploying to Vercel/Netlify means writing a sibling backed by a hosted
 * database (Postgres, Turso) -- serverless filesystems are ephemeral, so
 * SQLite-on-disk is a local-dev and internal-server choice only.
 */

import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { overrideKey } from '@one-stop/shared/model';

/**
 * @typedef {object} StatusStore
 * @property {() => Record<string, {status: string, updatedAt: string, updatedBy: string|null}>} all
 * @property {(circuitId: string, hopId: string, status: string, by?: string) => object} set
 * @property {(circuitId: string, hopId: string) => void} clear
 * @property {(limit?: number) => object[]} history
 * @property {() => void} close
 */

export class SqliteStatusStore {
  /** @param {string} file path to the SQLite database */
  constructor(file) {
    mkdirSync(path.dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);

    // WAL so a reader never blocks the writer; several people will have the
    // app open at once.
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec('PRAGMA foreign_keys = ON');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS hop_status (
        key         TEXT PRIMARY KEY,
        circuit_id  TEXT NOT NULL,
        hop_id      TEXT NOT NULL,
        status      TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        updated_by  TEXT
      )
    `);

    // Append-only audit of every change. Cheap now, and the obvious thing to
    // want the first time someone asks "who set this to DOWN and when?".
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS hop_status_log (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        circuit_id  TEXT NOT NULL,
        hop_id      TEXT NOT NULL,
        status      TEXT,
        previous    TEXT,
        changed_at  TEXT NOT NULL,
        changed_by  TEXT
      )
    `);
    this.db.exec(
      'CREATE INDEX IF NOT EXISTS idx_log_changed_at ON hop_status_log(changed_at DESC)');
  }

  all() {
    const rows = this.db
      .prepare('SELECT circuit_id, hop_id, status, updated_at, updated_by FROM hop_status')
      .all();

    const out = {};
    for (const r of rows) {
      out[overrideKey(r.circuit_id, r.hop_id)] = {
        status: r.status,
        updatedAt: r.updated_at,
        updatedBy: r.updated_by,
      };
    }
    return out;
  }

  get(circuitId, hopId) {
    const row = this.db
      .prepare('SELECT status, updated_at, updated_by FROM hop_status WHERE key = ?')
      .get(overrideKey(circuitId, hopId));
    if (!row) return null;
    return { status: row.status, updatedAt: row.updated_at, updatedBy: row.updated_by };
  }

  set(circuitId, hopId, status, by = null) {
    const key = overrideKey(circuitId, hopId);
    const now = new Date().toISOString();
    const previous = this.get(circuitId, hopId)?.status ?? null;

    this.db.prepare(`
      INSERT INTO hop_status (key, circuit_id, hop_id, status, updated_at, updated_by)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        status = excluded.status,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by
    `).run(key, circuitId, hopId, status, now, by);

    this.db.prepare(`
      INSERT INTO hop_status_log (circuit_id, hop_id, status, previous, changed_at, changed_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(circuitId, hopId, status, previous, now, by);

    return { status, updatedAt: now, updatedBy: by };
  }

  /** Drop an override so the hop falls back to its derived default. */
  clear(circuitId, hopId) {
    const previous = this.get(circuitId, hopId)?.status ?? null;
    this.db.prepare('DELETE FROM hop_status WHERE key = ?')
      .run(overrideKey(circuitId, hopId));
    this.db.prepare(`
      INSERT INTO hop_status_log (circuit_id, hop_id, status, previous, changed_at, changed_by)
      VALUES (?, ?, NULL, ?, ?, NULL)
    `).run(circuitId, hopId, previous, new Date().toISOString());
  }

  history(limit = 100) {
    return this.db.prepare(`
      SELECT circuit_id AS circuitId, hop_id AS hopId, status, previous,
             changed_at AS changedAt, changed_by AS changedBy
      FROM hop_status_log
      ORDER BY id DESC
      LIMIT ?
    `).all(limit);
  }

  close() {
    this.db.close();
  }
}

/** In-memory store, for tests. Same interface, no persistence. */
export class MemoryStatusStore {
  constructor() {
    this.map = new Map();
    this.log = [];
  }

  all() {
    return Object.fromEntries(this.map);
  }

  get(circuitId, hopId) {
    return this.map.get(overrideKey(circuitId, hopId)) ?? null;
  }

  set(circuitId, hopId, status, by = null) {
    const previous = this.get(circuitId, hopId)?.status ?? null;
    const entry = { status, updatedAt: new Date().toISOString(), updatedBy: by };
    this.map.set(overrideKey(circuitId, hopId), entry);
    this.log.unshift({ circuitId, hopId, status, previous,
                       changedAt: entry.updatedAt, changedBy: by });
    return entry;
  }

  clear(circuitId, hopId) {
    this.map.delete(overrideKey(circuitId, hopId));
  }

  history(limit = 100) {
    return this.log.slice(0, limit);
  }

  close() {}
}
