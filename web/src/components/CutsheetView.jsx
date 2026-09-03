import { useMemo } from 'react';
import { cutsheetRows } from '@one-stop/shared/cutsheet';
import { CUTSHEET_TABS, STATUS_COLORS, STATUS_LABELS } from '../site.js';

/**
 * Tabular circuit data, one tab per hall plus the whole site.
 *
 * Rows are runs (one circuit's one hop), sorted alphabetical-then-numeric on
 * the A-side with the Z-side as tiebreak. A hall's tab shows only the runs
 * that land in that hall, on either side.
 */
export default function CutsheetView({ circuits, hall, onSelectHall, onCycle, busyKey }) {
  const rows = useMemo(() => cutsheetRows(circuits, hall), [circuits, hall]);

  const counts = useMemo(() => {
    const out = { ALL: cutsheetRows(circuits, null).length };
    for (const tab of CUTSHEET_TABS) out[tab] = cutsheetRows(circuits, tab).length;
    return out;
  }, [circuits]);

  return (
    <div className="cutsheet">
      <nav className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={hall === null}
          className={`tab ${hall === null ? 'is-active' : ''}`}
          onClick={() => onSelectHall(null)}
        >
          Whole site <span className="tab-count">{counts.ALL}</span>
        </button>
        {CUTSHEET_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={hall === tab}
            className={`tab ${hall === tab ? 'is-active' : ''}`}
            onClick={() => onSelectHall(tab)}
          >
            {tab} <span className="tab-count">{counts[tab]}</span>
          </button>
        ))}
      </nav>

      <p className="cutsheet-note">
        {hall
          ? `Runs touching ${hall}, on either side.`
          : 'All runs across the site.'}
        {' '}Sorted by A-side (letters, then numbers), then Z-side.
        {' '}Click a status to cycle it.
      </p>

      <div className="table-wrap">
        <table className="cutsheet-table">
          <thead>
            <tr>
              <th scope="col">Status</th>
              <th scope="col">Circuit</th>
              <th scope="col">Hop</th>
              <th scope="col">A-side</th>
              <th scope="col">Cass/Port</th>
              <th scope="col">Z-side</th>
              <th scope="col">Cass/Port</th>
              <th scope="col">Cutsheet</th>
              <th scope="col">Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className={row.complete ? '' : 'row--not-run'}>
                <td>
                  <button
                    type="button"
                    className="status-pill"
                    style={{ background: STATUS_COLORS[row.status] }}
                    disabled={busyKey === row.key}
                    onClick={() => onCycle(row.circuitId, row.hopId)}
                    title={row.overridden
                      ? `Set by hand. Cutsheet default: ${STATUS_LABELS[row.derivedStatus]}`
                      : 'Derived from the cutsheet'}
                  >
                    {STATUS_LABELS[row.status]}
                    {row.overridden && <span className="pill-dot" aria-label="set by hand" />}
                  </button>
                </td>
                <td className="cell-circuit">
                  {row.circuitLabel}
                  <span className="cell-sub">line {row.csvLine}</span>
                </td>
                <td className="cell-hop">{row.from} &harr; {row.to}</td>
                <td className={row.aInferred ? 'cell-inferred' : ''}>
                  {row.aRaw || (row.aNode ? `${row.aNode} (implied)` : '—')}
                </td>
                <td className="cell-port">
                  {[row.aCassette, row.aPort].filter(Boolean).join(' ') || '—'}
                </td>
                <td className={row.zInferred ? 'cell-inferred' : ''}>
                  {row.zRaw || (row.zNode ? `${row.zNode} (implied)` : '—')}
                </td>
                <td className="cell-port">
                  {[row.zCassette, row.zPort].filter(Boolean).join(' ') || '—'}
                </td>
                <td className="cell-occ">{occupancyShort(row.occupancy)}</td>
                <td className="cell-notes">{row.notes ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {rows.length === 0 && (
          <p className="empty">
            No inter-hall fiber runs touch {hall} in the MMR cutsheet.
            {hall === 'DH173' && (
              <> DH173 has no columns in <code>MMR_Cutsheet.csv</code>, so it is
              expected to be empty until its runs are added.</>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

function occupancyShort(occ) {
  switch (occ) {
    case 'OCCUPIED': return 'Occupied';
    case 'OPEN': return 'Open';
    case 'FAULTY': return 'Faulty';
    default: return '—';
  }
}
