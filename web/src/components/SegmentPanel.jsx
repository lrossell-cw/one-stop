import { STATUS_COLORS, STATUS_LABELS, OCCUPANCY_LABELS } from '../site.js';

/**
 * Per-hop detail for the circuit selected on the map.
 *
 * The map answers "is this run up, end to end" with one colour. This panel is
 * where that verdict is broken back down into the three hops, because a hop is
 * the thing that actually gets patched -- so it is also the thing you click to
 * change. Clicking cycles UP -> DOWN -> INVESTIGATE with no animation: the row
 * just switches colour.
 */
export default function SegmentPanel({ run, onCycle, onClear, onClose, busyKey }) {
  if (!run) {
    return (
      <aside className="panel panel--empty">
        <p>Select a run on the map to see its hops.</p>
      </aside>
    );
  }

  const { circuit } = run;

  return (
    <aside className="panel">
      <header className="panel-head">
        <div className="panel-title">
          <h2>{circuit.label}</h2>
          <button type="button" className="link-button" onClick={onClose}>clear</button>
        </div>
        <p className="panel-sub">
          <span
            className="verdict"
            style={{ background: STATUS_COLORS[run.status] }}
          >
            {STATUS_LABELS[run.status]}
          </span>
          {' '}end to end &middot; {run.nodes.join(' → ')}
        </p>
        {run.built < circuit.hops.length && (
          <p className="panel-note">
            {circuit.hops.length - run.built} hop
            {circuit.hops.length - run.built === 1 ? '' : 's'} not built &mdash;
            ports open past {run.nodes[run.nodes.length - 1]}.
          </p>
        )}
      </header>

      <ul className="run-list">
        {circuit.hops.map((hop) => {
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
                <div className="run-label">{hop.from} &harr; {hop.to}</div>
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
              </div>
            </li>
          );
        })}
      </ul>

      {circuit.notes && <p className="run-note panel-notes">{circuit.notes}</p>}
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
