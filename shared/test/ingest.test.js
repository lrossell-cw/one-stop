import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv, parseHeader, buildCircuits } from '../src/ingest/csv.js';
import { deriveStatus, nextStatus, applyOverrides, rollUp } from '../src/model.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CSV = path.join(REPO, 'data', 'raw', 'MMR_Cutsheet.csv');
const COLORS = path.join(REPO, 'data', 'generated', 'mmr_cell_colors.json');

const csvText = await readFile(CSV, 'utf8');
let colors = null;
try {
  colors = JSON.parse(await readFile(COLORS, 'utf8'));
} catch { /* generated file is optional; tests below skip if absent */ }

test('CSV reader keeps quoted commas in one field', () => {
  const rows = parseCsv('a,b\n"one, two",three\n');
  assert.deepEqual(rows[1], ['one, two', 'three']);
});

test('header parses into hop column groups structurally', () => {
  const groups = parseHeader(parseCsv(csvText)[0]);
  const labels = groups.map((g) => g.label);
  assert.deepEqual(labels, [
    'MMR A', 'MMR Z', '151 A', '151 Z', '120 A', '120 Z', '160 A',
  ]);
  // Each endpoint group past the first carries its own cassette + port.
  const mmrZ = groups.find((g) => g.label === 'MMR Z');
  assert.ok(mmrZ.cassetteCol !== null && mmrZ.portCol !== null);
});

test('every non-blank CSV row becomes a circuit with three hops', () => {
  const { circuits } = buildCircuits(csvText, colors);
  assert.equal(circuits.length, 51);
  for (const c of circuits) {
    assert.equal(c.hops.length, 3);
    assert.deepEqual(c.hops.map((h) => h.id), ['MMR-151', '151-120', '120-160']);
  }
});

test('circuit ids are unique even though labels repeat', () => {
  const { circuits } = buildCircuits(csvText, colors);
  const ids = new Set(circuits.map((c) => c.id));
  assert.equal(ids.size, circuits.length);
  // "OPEN" appears 14 times in the Circuit column.
  assert.ok(circuits.filter((c) => c.isSpare).length > 1);
});

test('an implicit Z-side (blank location, cassette+port set) still counts as patched', () => {
  const { circuits } = buildCircuits(csvText, colors);
  const xid0417 = circuits.find((c) => c.label.startsWith('XID0417'));
  const hop = xid0417.hops.find((h) => h.id === '120-160');

  // The `120 Z` column is blank in every row of this sheet.
  assert.equal(hop.a.raw, '');
  assert.equal(hop.a.cassette, 'A');
  assert.equal(hop.a.node, 'DH120', 'hall inferred from the column header');
  assert.equal(hop.a.nodeInferred, true);
  assert.equal(hop.complete, true);
});

test('blank downstream hops are NOT_RUN, not faults', () => {
  const { circuits } = buildCircuits(csvText, colors);
  const xid0363 = circuits.find((c) => c.label.startsWith('XID0363'));

  assert.equal(xid0363.hops[0].complete, true);
  assert.equal(xid0363.hops[1].complete, false);
  assert.equal(xid0363.hops[1].derivedStatus, 'NOT_RUN');
  assert.equal(xid0363.hops[2].derivedStatus, 'NOT_RUN');
});

test('completeness comes from the data, not a hardcoded row list', () => {
  const { circuits } = buildCircuits(csvText, colors);
  const complete = circuits.filter((c) => c.hops.every((h) => h.complete));
  // The eight rows that populate the `151 Z` column.
  assert.equal(complete.length, 8);
  assert.ok(complete.every((c) => /^(XID041[6-9]|XID042[4-7])/.test(c.label)));
});

test('both FAULTY cells land on the two BAD DO NOT USE rows', {
  skip: colors ? false : 'run `npm run colors` first',
}, () => {
  const { circuits } = buildCircuits(csvText, colors);
  const down = circuits.filter((c) => c.hops.some((h) => h.derivedStatus === 'DOWN'));
  assert.equal(down.length, 2);
  assert.ok(down.every((c) => c.isCondemned));
});

test('deriveStatus: incomplete beats occupancy', () => {
  assert.equal(deriveStatus({ occupancy: 'OCCUPIED', complete: false }), 'NOT_RUN');
  assert.equal(deriveStatus({ occupancy: 'OCCUPIED', complete: true }), 'UP');
  assert.equal(deriveStatus({ occupancy: 'FAULTY', complete: true }), 'DOWN');
  // Green means the ports are free, not that the run is proven healthy.
  assert.equal(deriveStatus({ occupancy: 'OPEN', complete: true }), 'INVESTIGATE');
  assert.equal(deriveStatus({ occupancy: 'UNKNOWN', complete: true }), 'INVESTIGATE');
});

test('click cycles UP -> DOWN -> INVESTIGATE -> UP', () => {
  assert.equal(nextStatus('UP'), 'DOWN');
  assert.equal(nextStatus('DOWN'), 'INVESTIGATE');
  assert.equal(nextStatus('INVESTIGATE'), 'UP');
  // A never-run hop enters the cycle at the start.
  assert.equal(nextStatus('NOT_RUN'), 'UP');
});

test('a manual override wins over the derived default', () => {
  const circuits = [{
    id: 'c1',
    hops: [{ id: 'MMR-151', derivedStatus: 'UP' }, { id: '151-120', derivedStatus: 'UP' }],
  }];
  const merged = applyOverrides(circuits, {
    'c1::MMR-151': { status: 'DOWN', updatedAt: 't', updatedBy: 'leo' },
  });

  assert.equal(merged[0].hops[0].status, 'DOWN');
  assert.equal(merged[0].hops[0].overridden, true);
  assert.equal(merged[0].hops[0].derivedStatus, 'UP', 'derived value is retained');
  assert.equal(merged[0].hops[1].status, 'UP');
  assert.equal(merged[0].hops[1].overridden, false);
});

test('rollUp surfaces the worst status in a bundle', () => {
  assert.equal(rollUp(['UP', 'UP', 'DOWN']), 'DOWN');
  assert.equal(rollUp(['UP', 'INVESTIGATE']), 'INVESTIGATE');
  assert.equal(rollUp(['NOT_RUN', 'UP']), 'UP');
  assert.equal(rollUp([]), 'NOT_RUN');
});
