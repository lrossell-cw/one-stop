#!/usr/bin/env node
/**
 * Build data/generated/circuits.json from the raw cutsheet.
 *
 * Usage: npm run ingest
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { csvSource } from './sources.js';
import { HOP_IDS, nodesTouched } from '../model.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT_DIR = path.join(REPO, 'data', 'generated');
const OUT = path.join(OUT_DIR, 'circuits.json');

const source = csvSource({
  csvPath: path.join(REPO, 'data', 'raw', 'MMR_Cutsheet.csv'),
  colorsPath: path.join(OUT_DIR, 'mmr_cell_colors.json'),
});

const { circuits, warnings, meta } = await source.load();

await mkdir(OUT_DIR, { recursive: true });
await writeFile(OUT, JSON.stringify({ meta, circuits }, null, 2));

// --- Report -----------------------------------------------------------------
const byStatus = {};
const byHop = Object.fromEntries(HOP_IDS.map((id) => [id, {}]));

for (const c of circuits) {
  for (const hop of c.hops) {
    byStatus[hop.derivedStatus] = (byStatus[hop.derivedStatus] ?? 0) + 1;
    byHop[hop.id][hop.derivedStatus] = (byHop[hop.id][hop.derivedStatus] ?? 0) + 1;
  }
}

const complete = circuits.filter((c) => c.hops.every((h) => h.complete));

console.log(`circuits: ${circuits.length}`);
console.log(`end-to-end complete (all 3 hops): ${complete.length}`);
console.log('\nderived status, all hops:');
for (const [k, v] of Object.entries(byStatus).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(12)} ${v}`);
}
console.log('\nper hop:');
for (const id of HOP_IDS) {
  const parts = Object.entries(byHop[id])
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}=${v}`)
    .join('  ');
  console.log(`  ${id.padEnd(9)} ${parts}`);
}

const touched = {};
for (const c of circuits) {
  for (const n of nodesTouched(c)) touched[n] = (touched[n] ?? 0) + 1;
}
console.log('\ncircuits touching each node:');
for (const [k, v] of Object.entries(touched).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(7)} ${v}`);
}

if (warnings.length) {
  console.log('\nwarnings:');
  for (const w of warnings) console.log(`  - ${w}`);
}

console.log(`\nwrote ${path.relative(REPO, OUT)}`);
