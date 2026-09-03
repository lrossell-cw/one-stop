/**
 * Geometry and routing tests.
 *
 * site.js is deliberately plain JS with no React import, so the routing rule
 * that matters -- the path follows the data -- is testable without a browser
 * or a bundler.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { routeHop, NODE_ANCHORS, ROOMS, HALLS, SITE_VIEWBOX } from '../src/site.js';
import { wholeLine, circuitNodes } from '../src/segments.js';
import { buildCircuits } from '@one-stop/shared/ingest/csv';
import { applyOverrides } from '@one-stop/shared/model';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('every hall in the model has a room and an anchor', () => {
  for (const hall of ['DH151', 'DH173', 'DH120', 'DH160', 'MMR']) {
    assert.ok(NODE_ANCHORS[hall], `${hall} needs an anchor`);
  }
  for (const hall of HALLS) {
    assert.ok(ROOMS.find((r) => r.id === hall), `${hall} needs a room`);
  }
});

test('every anchor sits inside the floorplan viewBox', () => {
  for (const [node, a] of Object.entries(NODE_ANCHORS)) {
    assert.ok(a.x >= 0 && a.x <= SITE_VIEWBOX.width, `${node} x out of bounds`);
    assert.ok(a.y >= 0 && a.y <= SITE_VIEWBOX.height, `${node} y out of bounds`);
  }
});

test('every anchor sits inside the room it names', () => {
  for (const [node, a] of Object.entries(NODE_ANCHORS)) {
    const room = ROOMS.find((r) => r.id === a.room);
    assert.ok(room, `${node} references unknown room ${a.room}`);
    assert.ok(a.x >= room.x && a.x <= room.x + room.w, `${node} x outside ${room.id}`);
    assert.ok(a.y >= room.y && a.y <= room.y + room.h, `${node} y outside ${room.id}`);
  }
});

test('a route starts at the from-anchor and ends at the to-anchor', () => {
  const d = routeHop('MMR', 'DH151');
  const nums = d.match(/-?\d+(?:\.\d+)?/g).map(Number);

  assert.equal(nums[0], NODE_ANCHORS.MMR.x);
  assert.equal(nums[1], NODE_ANCHORS.MMR.y);
  assert.equal(nums[nums.length - 2], NODE_ANCHORS.DH151.x);
  assert.equal(nums[nums.length - 1], NODE_ANCHORS.DH151.y);
});

test('re-patching an endpoint re-routes the path -- the rail switch', () => {
  // Same circuit, different destination hall. The drawn path must change,
  // because it is computed from the endpoints rather than fixed per hop.
  const toDh120 = routeHop('DH151', 'DH120');
  const toDh160 = routeHop('DH151', 'DH160');

  assert.notEqual(toDh120, toDh160);

  const ends = (d) => d.match(/-?\d+(?:\.\d+)?/g).slice(-2).map(Number);
  assert.deepEqual(ends(toDh120), [NODE_ANCHORS.DH120.x, NODE_ANCHORS.DH120.y]);
  assert.deepEqual(ends(toDh160), [NODE_ANCHORS.DH160.x, NODE_ANCHORS.DH160.y]);
});

test('routing is symmetric in shape but not direction', () => {
  const there = routeHop('MMR', 'DH120');
  const back = routeHop('DH120', 'MMR');
  assert.notEqual(there, back);

  const start = (d) => d.match(/-?\d+(?:\.\d+)?/g).slice(0, 2).map(Number);
  assert.deepEqual(start(there), [NODE_ANCHORS.MMR.x, NODE_ANCHORS.MMR.y]);
  assert.deepEqual(start(back), [NODE_ANCHORS.DH120.x, NODE_ANCHORS.DH120.y]);
});

test('an unknown endpoint yields no path rather than a wrong one', () => {
  assert.equal(routeHop('MMR', 'DH999'), null);
  assert.equal(routeHop(null, 'DH151'), null);
  assert.equal(routeHop('MMR', undefined), null);
});

test('offset fans parallel runs apart', () => {
  assert.notEqual(routeHop('MMR', 'DH120', { offset: 0 }),
                  routeHop('MMR', 'DH120', { offset: 14 }));
});

test('every node the real cutsheet references has an anchor to draw at', async () => {
  const csvText = await readFile(path.join(REPO, 'data', 'raw', 'MMR_Cutsheet.csv'), 'utf8');
  const { circuits } = buildCircuits(csvText, null);

  const referenced = new Set();
  for (const c of circuits) {
    for (const hop of c.hops) {
      if (hop.a?.node) referenced.add(hop.a.node);
      if (hop.z?.node) referenced.add(hop.z.node);
    }
  }

  assert.ok(referenced.size > 0);
  for (const node of referenced) {
    assert.ok(NODE_ANCHORS[node], `cutsheet references ${node} with no map anchor`);
  }
});

test('MMR anchors on MMR1, the heavy-bordered room at bottom-centre', () => {
  assert.equal(NODE_ANCHORS.MMR.room, 'MMR1');
  const mmr1 = ROOMS.find((r) => r.id === 'MMR1');
  assert.ok(mmr1, 'MMR1 must be drawn');
  // Traced from the floorplan raster: x 273-324, y 447-487.
  assert.equal(mmr1.x, 273);
  assert.equal(mmr1.y, 447);
  assert.ok(mmr1.y > 400, 'MMR1 sits in the lower half of the site');
});

// --- Whole-line rendering (visual view) --------------------------------------

const realCircuits = async () => {
  const csvText = await readFile(path.join(REPO, 'data', 'raw', 'MMR_Cutsheet.csv'), 'utf8');
  let colors = null;
  try {
    colors = JSON.parse(await readFile(
      path.join(REPO, 'data', 'generated', 'mmr_cell_colors.json'), 'utf8'));
  } catch { /* optional */ }
  return applyOverrides(buildCircuits(csvText, colors).circuits, {});
};

test('a complete circuit draws one line through all four rooms', async () => {
  const circuits = await realCircuits();
  const full = circuits.find((c) => c.hops.every((h) => h.complete));

  assert.deepEqual(circuitNodes(full), ['MMR', 'DH151', 'DH120', 'DH160']);

  const line = wholeLine(full);
  assert.ok(line.d, 'must produce a path');
  assert.equal(line.built, 3);

  // Starts at the MMR anchor and ends at the DH160 anchor.
  const nums = line.d.match(/-?\d+(?:\.\d+)?/g).map(Number);
  assert.equal(nums[0], NODE_ANCHORS.MMR.x);
  assert.equal(nums[1], NODE_ANCHORS.MMR.y);
  assert.equal(nums[nums.length - 2], NODE_ANCHORS.DH160.x);
  assert.equal(nums[nums.length - 1], NODE_ANCHORS.DH160.y);
});

test('the run stops where the cutsheet stops -- no phantom tail', async () => {
  const circuits = await realCircuits();
  const partial = circuits.find((c) => c.hops[0].complete && !c.hops[1].complete);

  assert.deepEqual(circuitNodes(partial), ['MMR', 'DH151']);
  assert.equal(wholeLine(partial).built, 1);
});

test('an unbuilt tail does not drag a healthy run to NOT_RUN', async () => {
  const circuits = await realCircuits();
  const partial = circuits.find(
    (c) => c.hops[0].status === 'UP' && !c.hops[1].complete);

  assert.ok(partial, 'expected an UP first hop with nothing built past it');
  // Worst-of across ALL hops would be NOT_RUN and read as dead on the map.
  assert.equal(wholeLine(partial).status, 'UP');
});

test('the whole line takes the colour of its worst built hop', async () => {
  const circuits = await realCircuits();
  const full = circuits.find((c) => c.hops.every((h) => h.complete));

  const broken = { ...full, hops: full.hops.map((h, i) => (
    i === 1 ? { ...h, status: 'DOWN' } : { ...h, status: 'UP' })) };
  assert.equal(wholeLine(broken).status, 'DOWN');

  const flagged = { ...full, hops: full.hops.map((h, i) => (
    i === 2 ? { ...h, status: 'INVESTIGATE' } : { ...h, status: 'UP' })) };
  assert.equal(wholeLine(flagged).status, 'INVESTIGATE');
});

test('re-patching into a different hall redraws the line through it', async () => {
  const circuits = await realCircuits();
  const full = circuits.find((c) => c.hops.every((h) => h.complete));
  const before = wholeLine(full);

  // Same circuit, second hop now lands in DH173 instead of DH120.
  const moved = {
    ...full,
    hops: full.hops.map((h, i) => (i === 1
      ? { ...h, z: { ...h.z, node: 'DH173' } }
      : i === 2
        ? { ...h, a: { ...h.a, node: 'DH173' } }
        : h)),
  };

  assert.ok(circuitNodes(moved).includes('DH173'));
  assert.ok(!circuitNodes(moved).includes('DH120'));
  assert.notEqual(wholeLine(moved).d, before.d, 'the drawn path must follow');
});

test('every real circuit produces a drawable whole line', async () => {
  const circuits = await realCircuits();
  let drawn = 0;
  for (const c of circuits) {
    const line = wholeLine(c);
    if (line.built > 0) {
      assert.ok(line.d, `${c.label} is built but has no path`);
      drawn += 1;
    }
    assert.ok(['UP', 'DOWN', 'INVESTIGATE', 'NOT_RUN'].includes(line.status));
  }
  assert.ok(drawn > 0);
});

test('every route the real cutsheet implies can actually be drawn', async () => {
  const csvText = await readFile(path.join(REPO, 'data', 'raw', 'MMR_Cutsheet.csv'), 'utf8');
  const { circuits } = buildCircuits(csvText, null);

  for (const c of circuits) {
    for (const hop of c.hops) {
      const from = hop.a?.node ?? hop.from;
      const to = hop.z?.node ?? hop.to;
      if (!from || !to || from === to) continue;
      assert.ok(routeHop(from, to), `no path for ${from} -> ${to} (${c.label})`);
    }
  }
});
