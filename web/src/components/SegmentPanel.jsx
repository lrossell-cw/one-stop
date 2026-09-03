import { STATUS_COLORS, STATUS_LABELS, OCCUPANCY_LABELS } from '../site.js';

/**
 * The per-circuit-hop detail panel for a selected map segment.
 *
 * The map segment is an aggregate of many runs, so status is set here, on the
 * individual run -- which is the thing that actually gets patched. Clicking a
 * row cycles UP -> DOWN -> INVESTIGATE with no animation: the row just
 * switches color.
 */
export default function SegmentPanel({ segment, onCycle, onClear, busyKey }) {
  if (!segment) {
    return (
      <aside className="panel panel--empty">
        <p>Select a fiber segment on the map to see the runs it carries.</p>
      </aside>
    );
  }

  const rows = [...segment.hops].sort((a, b) =>
    a.circuit.label.localeCompare(b.circuit.label, 'en', { numeric: true }));

  return (
    <aside className="panel">
      <header className="panel-head">
        <h2>{segment.from} &harr; {segment.to}</h2>
        <p className="panel-sub">
          {segment.total} run{segment.total === 1 ? '' : 's'}
          {segment.down > 0 && <> &middot; <b className="text-down">{segment.down} down</b></>}
          {segment.investigate > 0 && (
            <> &middot; <b className="text-investigate">{segment.investigate} to verify</b></>
          )}
        </p>
      </header>

      <ul className="run-list">
        {rows.map(({ circuit, hop }) => {
          const key = `${circuit.id}::${hop.id}`;
          return (
            <li key={key} className="run">
              <button
                type="button"
                className="run-status"
                style={{ background: STATUS_COLORS[hop.status] }}
                disabled={busyKey === key}
                onClick={() => onCycle(circuit.id, hop.id)}
                title={`Click to cycle. Cutsheet default: ${STATUS_LABELS[hop.derivedStatus]}`}
              >
                {STATUS_LABELS[hop.status]}
              </button>

              <div className="run-body">
                <div className="run-label">
                  {circuit.label}
                  {circuit.isCondemned && <span className="tag tag--bad">do not use</span>}
                  {circuit.isSpare && <span className="tag">spare</span>}
                </div>
                <div className="run-path">
                  <Endpoint end={hop.a} fallbackNode={hop.from} />
                  <span className="run-arrow">&rarr;</span>
                  <Endpoint end={hop.z} fallbackNode={hop.to} />
                </div>
                <div className="run-meta">
                  {OCCUPANCY_LABELS[hop.occupancy] ?? hop.occupancy}
                  {!hop.complete && <> &middot; ports open, run not built</>}
                  {hop.overridden && (
                    <>
                      {' '}&middot; set by hand
                      {hop.overriddenBy ? ` (${hop.overriddenBy})` : ''}
                      {' '}
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => onClear(circuit.id, hop.id)}
                      >
                        reset to {STATUS_LABELS[hop.derivedStatus]}
                      </button>
                    </>
                  )}
                </div>
                {circuit.notes && <div className="run-note">{circuit.notes}</div>}
              </div>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

function Endpoint({ end, fallbackNode }) {
  if (!end) return <span className="endpoint endpoint--none">not recorded</span>;

  const where = end.raw
    || (end.node ? `${end.node} (implied)` : fallbackNode);

  return (
    <span className={`endpoint ${end.nodeInferred ? 'endpoint--inferred' : ''}`}>
      {where}
      {(end.cassette || end.port) && (
        <span className="endpoint-port">
          {end.cassette ? ` ${end.cassette}` : ''}
          {end.port ? `:${end.port}` : ''}
        </span>
      )}
    </span>
  );
}
