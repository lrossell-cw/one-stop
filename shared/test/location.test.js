import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseLocation,
  compareLocation,
  sortRows,
  formatLocation,
} from '../src/location.js';

test('parses the dotted R/RU form', () => {
  const loc = parseLocation('DH151.R33.RU4');
  assert.equal(loc.node, 'DH151');
  assert.equal(loc.rack, 33);
  assert.equal(loc.unit, 4);
});

test('parses the spaced CAB/RU form with zero padding', () => {
  const loc = parseLocation('DH151 CAB33 RU05');
  assert.equal(loc.node, 'DH151');
  assert.equal(loc.rack, 33);
  assert.equal(loc.unit, 5);
});

test('the two DH151 spellings normalise to the same rack/unit', () => {
  const dotted = parseLocation('DH151.R33.RU5');
  const spaced = parseLocation('DH151 CAB33 RU05');
  assert.equal(dotted.node, spaced.node);
  assert.equal(dotted.rack, spaced.rack);
  assert.equal(dotted.unit, spaced.unit);
});

test('keeps a trailing role word', () => {
  const loc = parseLocation('DH151 CAB34 RU40 MMR');
  assert.equal(loc.node, 'DH151');
  assert.equal(loc.rack, 34);
  assert.equal(loc.unit, 40);
  assert.equal(loc.role, 'MMR');
});

test('parses bare numeric rack/unit, lowercased', () => {
  const loc = parseLocation('dh120.266.32');
  assert.equal(loc.node, 'DH120');
  assert.equal(loc.rack, 266);
  assert.equal(loc.unit, 32);
});

test('U- and RU- prefixes are both unit prefixes', () => {
  const loc = parseLocation('DH120.R10.U43');
  assert.equal(loc.node, 'DH120');
  assert.equal(loc.rack, 10);
  assert.equal(loc.unit, 43);
});

test('parses MMR room codes', () => {
  const loc = parseLocation('MMR164.R5.RU22');
  assert.equal(loc.node, 'MMR');
  assert.equal(loc.rack, 5);
  assert.equal(loc.unit, 22);
});

test('a named panel with no rack/unit still parses', () => {
  const loc = parseLocation('MMR ISP PP');
  assert.equal(loc.node, 'MMR');
  assert.equal(loc.rack, null);
  assert.equal(loc.unit, null);
  assert.equal(loc.role, 'ISP PP');
  // Grouped under the hall, so every MMR endpoint sorts together...
  assert.equal(loc.alpha, 'MMR');
});

test('...and a rackless panel sorts after racked entries in the same hall', () => {
  const sorted = ['MMR ISP PP', 'MMR164.R5.RU22', 'MMR164.R1.RU2']
    .map(parseLocation)
    .sort(compareLocation)
    .map((l) => l.raw);
  assert.deepEqual(sorted, ['MMR164.R1.RU2', 'MMR164.R5.RU22', 'MMR ISP PP']);
});

test('C160 is an alias for DH160', () => {
  assert.equal(parseLocation('C160.R1.RU2').node, 'DH160');
  assert.equal(parseLocation('dh160.26.38').node, 'DH160');
});

test('empty input yields null, not a junk record', () => {
  assert.equal(parseLocation(''), null);
  assert.equal(parseLocation('   '), null);
  assert.equal(parseLocation(null), null);
});

test('sorts alphabetically first, then numerically', () => {
  const codes = [
    'DH151.R33.RU4',
    'DH120.R10.U43',
    'DH151.R4.RU1',
    'MMR164.R5.RU22',
    'DH151.R33.RU2',
  ];
  const sorted = codes.map(parseLocation).sort(compareLocation).map((l) => l.raw);

  assert.deepEqual(sorted, [
    'DH120.R10.U43',
    // R4 before R33: numeric, not lexicographic ("33" < "4" as strings)
    'DH151.R4.RU1',
    'DH151.R33.RU2',
    'DH151.R33.RU4',
    'MMR164.R5.RU22',
  ]);
});

test('rack sorts numerically, not as text', () => {
  const sorted = ['DH151.R9.RU1', 'DH151.R10.RU1', 'DH151.R100.RU1']
    .map(parseLocation)
    .sort(compareLocation)
    .map((l) => l.rack);
  assert.deepEqual(sorted, [9, 10, 100]);
});

test('missing endpoints sort last', () => {
  const sorted = [parseLocation('DH151.R1.RU1'), null, parseLocation('DH120.R1.RU1')]
    .sort(compareLocation);
  assert.equal(sorted[0].node, 'DH120');
  assert.equal(sorted[1].node, 'DH151');
  assert.equal(sorted[2], null);
});

test('Z-side breaks an A-side tie', () => {
  const rows = [
    { aSide: parseLocation('DH151.R1.RU1'), zSide: parseLocation('DH120.R9.RU1') },
    { aSide: parseLocation('DH151.R1.RU1'), zSide: parseLocation('DH120.R2.RU1') },
    { aSide: parseLocation('DH120.R1.RU1'), zSide: parseLocation('DH160.R1.RU1') },
  ];
  const sorted = sortRows(rows).map((r) => [r.aSide.node, r.zSide.rack]);
  assert.deepEqual(sorted, [
    ['DH120', 1],
    ['DH151', 2],
    ['DH151', 9],
  ]);
});

test('sort is total, so repeated sorts are stable', () => {
  const rows = [
    { aSide: parseLocation('DH151.R1.RU1'), zSide: null },
    { aSide: parseLocation('DH151.R1.RU1'), zSide: null },
    { aSide: parseLocation('DH120.R1.RU1'), zSide: null },
  ];
  assert.deepEqual(
    sortRows(sortRows(rows)).map((r) => r.aSide.raw),
    sortRows(rows).map((r) => r.aSide.raw),
  );
});

test('formats a location for display', () => {
  assert.equal(formatLocation(parseLocation('DH151.R33.RU4')), 'DH151 R33 RU4');
  assert.equal(formatLocation(parseLocation('MMR ISP PP')), 'MMR ISP PP');
  assert.equal(formatLocation(null), '');
});
