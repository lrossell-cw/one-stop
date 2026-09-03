import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCircuits } from '../src/ingest/csv.js';
import { cutsheetRows } from '../src/cutsheet.js';
import { applyOverrides } from '../src/model.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const csvText = await readFile(path.join(REPO, 'data', 'raw', 'MMR_Cutsheet.csv'), 'utf8');

let colors = null;
try {
  colors = JSON.parse(
    await readFile(path.join(REPO, 'data', 'generated', 'mmr_cell_colors.json'), 'utf8'));
} catch { /* optional */ }

const { circuits } = buildCircuits(csvText, colors);
const withStatus = applyOverrides(circuits, {});

test('whole-site view has one row per circuit-hop', () => {
  const rows = cutsheetRows(withStatus, null);
  assert.equal(rows.length, circuits.length * 3);
});

test('a hall tab only contains runs that touch that hall', () => {
  for (const hall of ['MMR', 'DH151', 'DH120', 'DH160']) {
    const rows = cutsheetRows(withStatus, hall);
    assert.ok(rows.length > 0, `${hall} should have rows`);
    for (const row of rows) {
      assert.ok(
        row.aNode === hall || row.zNode === hall,
        `${hall} row ${row.key} touches neither side`,
      );
    }
  }
});

test('DH173 is empty: the MMR cutsheet has no DH173 columns', () => {
  assert.equal(cutsheetRows(withStatus, 'DH173').length, 0);
});

test('a run appears in the cutsheet of both halls it connects', () => {
  const mmr = new Set(cutsheetRows(withStatus, 'MMR').map((r) => r.key));
  const dh151 = new Set(cutsheetRows(withStatus, 'DH151').map((r) => r.key));

  const shared = [...mmr].filter((k) => dh151.has(k));
  assert.ok(shared.length > 0, 'MMR<->DH151 runs should show in both tabs');
});

test('rows sort alphabetically then numerically on the A-side', () => {
  const rows = cutsheetRows(withStatus, null);
  const keys = rows
    .filter((r) => r.aSide)
    .map((r) => [r.aSide.alpha, r.aSide.rack ?? Infinity, r.aSide.unit ?? Infinity]);

  for (let i = 1; i < keys.length; i += 1) {
    const [pa, pr, pu] = keys[i - 1];
    const [ca, cr, cu] = keys[i];
    const alpha = pa.localeCompare(ca, 'en', { sensitivity: 'base' });
    assert.ok(alpha <= 0, `alpha out of order at ${i}: ${pa} then ${ca}`);
    if (alpha === 0) {
      assert.ok(pr <= cr, `rack out of order at ${i}: ${pr} then ${cr}`);
      if (pr === cr) assert.ok(pu <= cu, `unit out of order at ${i}: ${pu} then ${cu}`);
    }
  }
});

test('Z-side breaks ties within an identical A-side', () => {
  const rows = cutsheetRows(withStatus, null);

  for (let i = 1; i < rows.length; i += 1) {
    const prev = rows[i - 1];
    const cur = rows[i];
    if (!prev.aSide || !cur.aSide) continue;
    if (prev.aSide.raw !== cur.aSide.raw) continue;
    if (!prev.zSide || !cur.zSide) continue;

    const alpha = prev.zSide.alpha.localeCompare(cur.zSide.alpha, 'en',
                                                 { sensitivity: 'base' });
    assert.ok(alpha <= 0, `Z-side alpha out of order at row ${i}`);
    if (alpha === 0 && prev.zSide.rack !== null && cur.zSide.rack !== null) {
      assert.ok(prev.zSide.rack <= cur.zSide.rack, `Z-side rack out of order at ${i}`);
    }
  }
});

test('sorting is deterministic across repeated builds', () => {
  const a = cutsheetRows(withStatus, null).map((r) => r.key);
  const b = cutsheetRows(applyOverrides(buildCircuits(csvText, colors).circuits, {}), null)
    .map((r) => r.key);
  assert.deepEqual(a, b);
});

test('rows carry the status the UI needs to color them', () => {
  const rows = cutsheetRows(withStatus, 'DH120');
  for (const row of rows) {
    assert.ok(['UP', 'DOWN', 'INVESTIGATE', 'NOT_RUN'].includes(row.status));
    assert.equal(typeof row.overridden, 'boolean');
  }
});

test('an override shows through to the cutsheet row', () => {
  const target = withStatus[0];
  const overridden = applyOverrides(circuits, {
    [`${target.id}::MMR-151`]: { status: 'DOWN', updatedAt: 't', updatedBy: 'leo' },
  });

  const row = cutsheetRows(overridden, null)
    .find((r) => r.circuitId === target.id && r.hopId === 'MMR-151');

  assert.equal(row.status, 'DOWN');
  assert.equal(row.overridden, true);
  assert.equal(row.overriddenBy, 'leo');
});
