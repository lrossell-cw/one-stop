import { useMemo } from 'react';
import { rollUp } from '@one-stop/shared/model';
import { STATUS_COLORS, STATUS_LABELS } from '../site.js';

/**
 * Simplified overhead view for one data hall.
 *
 * Stylised on purpose for V1: rows of cabinets laid out on a grid, with the
 * cabinets that actually terminate a fiber run highlighted and labelled. It is
 * NOT the true cabinet/pod grid from the per-hall PDFs -- faithful rendering of
 * those is a later phase, and pretending otherwise would be worse than an
 * obvious abstraction.
 */
const GRID = { cols: 8, cell: 74, gap: 14, pad: 40 };

export default function HallView({ hall, circuits, onBack, onSelectRun }) {
  // Cabinets that terminate a run in this hall, keyed by rack number.
  const racks = useMemo(() => {
    const map = new Map();

    for (const circuit of circuits) {
      for (const hop of circuit.hops) {
        for (const [side, end] of [['a', hop.a], ['z', hop.z]]) {
          if (!end || end.node !== hall) continue;

          const rack = end.rack ?? null;
          const key = rack === null ? `${end.role ?? 'panel'}` : `R${rack}`;
          if (!map.has(key)) {
            map.set(key, { key, rack, label: key, runs: [], named: rack === null });
          }
          map.get(key).runs.push({ circuit, hop, side, end });
        }
      }
    }

    return [...map.values()].sort((a, b) => {
      if (a.named !== b.named) return a.named ? 1 : -1;
      return (a.rack ?? 0) - (b.rack ?? 0);
    });
  }, [circuits, hall]);

  // Rows grow with the data instead of being capped, so a hall never silently
  // hides cabinets the caption has already counted. Interior gaps only: with a
  // gap per column the right margin ends up wider than the left.
  const cols = Math.min(GRID.cols, Math.max(racks.length, 1));
  const rows = Math.max(1, Math.ceil(racks.length / GRID.cols));
  const width = GRID.pad * 2 + cols * GRID.cell + (cols - 1) * GRID.gap;
  const height = GRID.pad * 2 + rows * GRID.cell + (rows - 1) * GRID.gap;

  return (
    <div className="hall-view">
      <header className="hall-head">
        <button type="button" className="back-button" onClick={onBack}>
          &larr; Site map
        </button>
        <h2>{hall} &mdash; overhead</h2>
        <span className="hall-note">
          Simplified layout. {racks.length} cabinet{racks.length === 1 ? '' : 's'} terminate
          {racks.length === 1 ? 's' : ''} inter-hall fiber here.
        </span>
      </header>

      <svg
        className="hall-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${hall} simplified overhead view`}
      >
        <rect x="0" y="0" width={width} height={height} className="map-bg" />

        {racks.map((rack, i) => {
          const col = i % GRID.cols;
          const row = Math.floor(i / GRID.cols);
          const x = GRID.pad + col * (GRID.cell + GRID.gap);
          const y = GRID.pad + row * (GRID.cell + GRID.gap);

          const worst = rollUp(rack.runs.map(({ hop }) => hop.status));

          return (
            <g key={rack.key} className="cabinet">
              <rect
                x={x} y={y} width={GRID.cell} height={GRID.cell} rx="4"
                fill={STATUS_COLORS[worst]}
                fillOpacity="0.18"
                stroke={STATUS_COLORS[worst]}
              />
              <text x={x + GRID.cell / 2} y={y + 24} textAnchor="middle" className="cab-label">
                {rack.label}
              </text>
              <text x={x + GRID.cell / 2} y={y + 46} textAnchor="middle" className="cab-count">
                {rack.runs.length}
              </text>
              <text x={x + GRID.cell / 2} y={y + 62} textAnchor="middle" className="cab-sub">
                {rack.runs.length === 1 ? 'run' : 'runs'}
              </text>
              <title>{`${rack.label}: ${rack.runs.length} run(s), ${STATUS_LABELS[worst]}`}</title>
            </g>
          );
        })}
      </svg>

      <div className="hall-runs">
        <h3>Runs terminating in {hall}</h3>
        <ul className="run-list">
          {racks.flatMap((rack) => rack.runs.map(({ circuit, hop, side, end }) => {
            const key = `${circuit.id}::${hop.id}::${side}`;
            return (
              <li key={key} className="run">
                <button
                  type="button"
                  className="run-status"
                  style={{ background: STATUS_COLORS[hop.status] }}
                  onClick={() => onSelectRun(circuit.id, hop.id)}
                >
                  {STATUS_LABELS[hop.status]}
                </button>
                <div className="run-body">
                  <div className="run-label">{circuit.label}</div>
                  <div className="run-meta">
                    {hop.from} &harr; {hop.to} &middot; {rack.label}
                    {end.cassette ? ` cassette ${end.cassette}` : ''}
                    {end.port ? ` port ${end.port}` : ''}
                  </div>
                </div>
              </li>
            );
          }))}
        </ul>
      </div>
    </div>
  );
}

