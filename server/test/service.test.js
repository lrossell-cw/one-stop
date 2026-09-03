/**
 * Backend tests. Zero third-party dependencies: node:sqlite and node:test only,
 * so these run before `npm install` and in CI without a registry.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SqliteStatusStore, MemoryStatusStore } from '../src/store.js';
import { FiberService } from '../src/service.js';
import { csvSource } from '@one-stop/shared/ingest/sources';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const realSource = () => csvSource({
  csvPath: path.join(REPO, 'data', 'raw', 'MMR_Cutsheet.csv'),
  colorsPath: path.join(REPO, 'data', 'generated', 'mmr_cell_colors.json'),
});

async function tmpDb(t) {
  const dir = await mkdtemp(path.join(tmpdir(), 'one-stop-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return path.join(dir, 'test.db');
}

// --- Persistence -------------------------------------------------------------

test('an override survives closing and reopening the database', async (t) => {
  const file = await tmpDb(t);

  const first = new SqliteStatusStore(file);
  first.set('XID0417-448933804@11', 'MMR-151', 'DOWN', 'leo');
  first.close();

  // A fresh process would do exactly this.
  const second = new SqliteStatusStore(file);
  const saved = second.get('XID0417-448933804@11', 'MMR-151');
  assert.equal(saved.status, 'DOWN');
  assert.equal(saved.updatedBy, 'leo');
  second.close();
});

test('two concurrent connections see each other\'s writes', async (t) => {
  const file = await tmpDb(t);
  const alice = new SqliteStatusStore(file);
  const bob = new SqliteStatusStore(file);

  alice.set('c1', 'MMR-151', 'INVESTIGATE', 'alice');

  // Bob did not write it and never reloaded, but the state is shared.
  assert.equal(bob.get('c1', 'MMR-151').status, 'INVESTIGATE');

  bob.set('c1', 'MMR-151', 'UP', 'bob');
  assert.equal(alice.get('c1', 'MMR-151').status, 'UP');

  alice.close();
  bob.close();
});

test('clearing an override removes it entirely', async (t) => {
  const file = await tmpDb(t);
  const store = new SqliteStatusStore(file);

  store.set('c1', 'MMR-151', 'DOWN');
  assert.ok(store.get('c1', 'MMR-151'));

  store.clear('c1', 'MMR-151');
  assert.equal(store.get('c1', 'MMR-151'), null);
  store.close();
});

test('every change is recorded in the audit log', async (t) => {
  const file = await tmpDb(t);
  const store = new SqliteStatusStore(file);

  store.set('c1', 'MMR-151', 'DOWN', 'leo');
  store.set('c1', 'MMR-151', 'INVESTIGATE', 'sam');

  const log = store.history();
  assert.equal(log.length, 2);
  assert.equal(log[0].status, 'INVESTIGATE');
  assert.equal(log[0].previous, 'DOWN', 'records what it replaced');
  assert.equal(log[0].changedBy, 'sam');
  store.close();
});

// --- Override precedence -----------------------------------------------------

test('a manual status overrides the derived default, and clearing restores it', async () => {
  const store = new MemoryStatusStore();
  const service = new FiberService({ store, source: realSource() });

  const before = await service.circuits();
  const target = before.circuits.find((c) => c.hops[0].derivedStatus === 'UP');
  assert.ok(target, 'expected at least one hop deriving as UP');

  const derived = target.hops[0].derivedStatus;
  await service.setStatus(target.id, 'MMR-151', { status: 'DOWN', by: 'leo' });

  const after = await service.circuits();
  const hop = after.circuits.find((c) => c.id === target.id).hops[0];
  assert.equal(hop.status, 'DOWN');
  assert.equal(hop.overridden, true);
  assert.equal(hop.derivedStatus, derived, 'derived value is preserved alongside');
  assert.equal(hop.overriddenBy, 'leo');

  await service.clearStatus(target.id, 'MMR-151');
  const restored = await service.circuits();
  const back = restored.circuits.find((c) => c.id === target.id).hops[0];
  assert.equal(back.status, derived);
  assert.equal(back.overridden, false);
});

test('cycling walks UP -> DOWN -> INVESTIGATE -> UP from stored state', async () => {
  const store = new MemoryStatusStore();
  const service = new FiberService({ store, source: realSource() });

  const { circuits } = await service.circuits();
  const target = circuits.find((c) => c.hops[0].derivedStatus === 'UP');

  const seen = [];
  for (let i = 0; i < 4; i += 1) {
    const out = await service.setStatus(target.id, 'MMR-151', { cycle: true });
    seen.push(out.result.status);
  }
  assert.deepEqual(seen, ['DOWN', 'INVESTIGATE', 'UP', 'DOWN']);
});

test('cycling a NOT_RUN hop enters the cycle rather than staying unbuilt', async () => {
  const store = new MemoryStatusStore();
  const service = new FiberService({ store, source: realSource() });

  const { circuits } = await service.circuits();
  const target = circuits.find((c) => c.hops[2].status === 'NOT_RUN');
  assert.ok(target, 'expected at least one NOT_RUN hop');

  const out = await service.setStatus(target.id, '120-160', { cycle: true });
  assert.equal(out.result.status, 'UP');
  assert.equal(out.result.derivedStatus, 'NOT_RUN');
});

test('rejects an unknown circuit, hop, or status', async () => {
  const store = new MemoryStatusStore();
  const service = new FiberService({ store, source: realSource() });
  const { circuits } = await service.circuits();
  const id = circuits[0].id;

  assert.equal((await service.setStatus('nope', 'MMR-151', { status: 'UP' })).error.code, 404);
  assert.equal((await service.setStatus(id, 'nope', { status: 'UP' })).error.code, 404);
  assert.equal((await service.setStatus(id, 'MMR-151', { status: 'BANANA' })).error.code, 400);
  // NOT_RUN is derived-only; an operator cannot set it by hand.
  assert.equal((await service.setStatus(id, 'MMR-151', { status: 'NOT_RUN' })).error.code, 400);
});

test('overrides apply per hop, not per circuit', async () => {
  const store = new MemoryStatusStore();
  const service = new FiberService({ store, source: realSource() });

  const { circuits } = await service.circuits();
  const target = circuits.find((c) => c.hops.every((h) => h.complete));
  assert.ok(target, 'expected an end-to-end complete circuit');

  await service.setStatus(target.id, '151-120', { status: 'DOWN' });

  const after = await service.circuits();
  const hops = after.circuits.find((c) => c.id === target.id).hops;
  assert.equal(hops.find((h) => h.id === '151-120').status, 'DOWN');
  assert.equal(hops.find((h) => h.id === 'MMR-151').overridden, false,
               'the neighbouring hop is untouched');
  assert.equal(hops.find((h) => h.id === '120-160').overridden, false);
});

// --- Source swappability -----------------------------------------------------

test('the service works against any source returning the model shape', async () => {
  const fake = {
    name: 'fake',
    async load() {
      return {
        circuits: [{
          id: 'fake-1',
          label: 'FAKE',
          hops: [{ id: 'MMR-151', from: 'MMR', to: 'DH151', complete: true,
                   occupancy: 'OCCUPIED', derivedStatus: 'UP', a: null, z: null }],
        }],
        warnings: [],
        meta: { source: 'fake' },
      };
    },
  };

  const service = new FiberService({ store: new MemoryStatusStore(), source: fake });
  const { circuits, meta } = await service.circuits();
  assert.equal(meta.source, 'fake');
  assert.equal(circuits[0].hops[0].status, 'UP');

  await service.setStatus('fake-1', 'MMR-151', { status: 'DOWN' });
  const after = await service.circuits();
  assert.equal(after.circuits[0].hops[0].status, 'DOWN');
});

test('reload picks up an edited cutsheet without a restart', async () => {
  let text = await readFile(path.join(REPO, 'data', 'raw', 'MMR_Cutsheet.csv'), 'utf8');
  const { buildCircuits } = await import('@one-stop/shared/ingest/csv');

  const mutable = {
    name: 'mutable',
    async load() {
      const { circuits, warnings } = buildCircuits(text, null);
      return { circuits, warnings, meta: { source: 'mutable' } };
    },
  };

  const service = new FiberService({ store: new MemoryStatusStore(), source: mutable });
  const before = (await service.circuits()).circuits.length;

  text = text.split('\n').slice(0, -2).join('\n'); // drop trailing rows
  assert.equal((await service.circuits()).circuits.length, before,
               'cached until explicitly reloaded');

  await service.reload();
  assert.ok((await service.circuits()).circuits.length < before);
});
