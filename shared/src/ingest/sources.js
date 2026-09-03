/**
 * Fiber-run data sources.
 *
 * Everything downstream (API, map, cutsheet tables) depends only on the shape
 * a source returns -- `{ circuits, warnings, meta }` -- never on where it came
 * from. Swapping the CSV for the Google Sheets API, and later Jira/NetBox,
 * means adding a sibling of `csvSource` and changing one line of wiring.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { buildCircuits } from './csv.js';

/**
 * @typedef {object} FiberSource
 * @property {string} name
 * @property {() => Promise<{circuits: object[], warnings: string[], meta: object}>} load
 */

/**
 * V1 source: the CSV export, enriched with occupancy colors recovered from the
 * PDF (the CSV itself has none).
 *
 * @returns {FiberSource}
 */
export function csvSource({ csvPath, colorsPath }) {
  return {
    name: 'csv',
    async load() {
      const csvText = await readFile(csvPath, 'utf8');

      let colors = null;
      const warnings = [];
      if (colorsPath) {
        try {
          colors = JSON.parse(await readFile(colorsPath, 'utf8'));
        } catch (err) {
          if (err.code !== 'ENOENT') throw err;
          warnings.push(
            `color sidecar not found at ${path.basename(colorsPath)} -- ` +
            'run `npm run colors` to generate it from the PDF.');
        }
      }

      const result = buildCircuits(csvText, colors);
      return {
        circuits: result.circuits,
        warnings: [...warnings, ...result.warnings],
        meta: {
          source: 'csv',
          csvPath,
          colorsPath: colors ? colorsPath : null,
          colorLegend: colors?.legend ?? null,
          loadedAt: new Date().toISOString(),
        },
      };
    },
  };
}

/**
 * Placeholder for the next source. Kept here so the interface it must satisfy
 * is written down before anyone starts on it.
 *
 * @returns {FiberSource}
 */
export function googleSheetsSource() {
  return {
    name: 'google-sheets',
    async load() {
      throw new Error(
        'Google Sheets source not implemented. It must return the same ' +
        '{ circuits, warnings, meta } shape as csvSource, with circuits ' +
        'built by buildCircuits() or an equivalent that yields the model in ' +
        'shared/src/model.js. Occupancy should come from the sheet\'s cell ' +
        'background colors via the Sheets API (fields=sheets.data.rowData.' +
        'values.effectiveFormat.backgroundColor), which removes the need for ' +
        'the PDF extraction step entirely.');
    },
  };
}
