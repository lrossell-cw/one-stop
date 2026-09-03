import { useMemo } from 'react';
import { rollUp } from '@one-stop/shared/model';
import {
  ROOMS,
  SITE_VIEWBOX,
  STATUS_COLORS,
  STATUS_LABELS,
  routeHop,
} from '../site.js';

/**
 * Whole-site map with the fiber overlay.
 *
 * Segments are drawn from each hop's real `from`/`to` nodes, grouped by the
 * pair of rooms they actually connect. Re-patch a circuit to a different hall
 * and it moves to a different group, so the picture follows the data rather
 * than a fixed set of lines.
 */
export default function SiteMap({
  circuits,
  showFiber,
  selectedHall,
  onSelectHall,
  onSelectSegment,
  selectedSegment,
}) {
  // Group hops by the room pair they connect, derived from live endpoint data.
  const segments = useMemo(() => {
    const groups = new Map();

    for (const circuit of circuits) {
      for (const hop of circuit.hops) {
        const from = hop.a?.node ?? hop.from;
        const to = hop.z?.node ?? hop.to;
        if (!from || !to || from === to) continue;

        const key = `${from}->${to}`;
        if (!groups.has(key)) groups.set(key, { key, from, to, hops: [] });
        groups.get(key).hops.push({ circuit, hop });
      }
    }

    return [...groups.values()].map((g, i) => ({
      ...g,
      // Fan parallel runs apart so a re-route is visible rather than hidden
      // underneath the run it replaced.
      path: routeHop(g.from, g.to, { offset: (i % 3) * 14 - 14 }),
      status: rollUp(g.hops.map(({ hop }) => hop.status)),
      total: g.hops.length,
      down: g.hops.filter(({ hop }) => hop.status === 'DOWN').length,
      investigate: g.hops.filter(({ hop }) => hop.status === 'INVESTIGATE').length,
    }));
  }, [circuits]);

  return (
    <svg
      className="site-map"
      viewBox={`0 0 ${SITE_VIEWBOX.width} ${SITE_VIEWBOX.height}`}
      role="img"
      aria-label="PHX01 site map"
    >
      <rect
        x="0" y="0"
        width={SITE_VIEWBOX.width} height={SITE_VIEWBOX.height}
        className="map-bg"
      />

      {ROOMS.map((room) => {
        const isHall = room.hall;
        const selected = selectedHall === room.id;
        return (
          <g
            key={room.id}
            className={[
              'room',
              isHall ? 'room--hall' : 'room--aux',
              selected ? 'is-selected' : '',
            ].join(' ')}
            onClick={isHall ? () => onSelectHall(room.id) : undefined}
            role={isHall ? 'button' : undefined}
            tabIndex={isHall ? 0 : undefined}
            aria-label={isHall ? `Open ${room.label} overhead view` : undefined}
            onKeyDown={isHall ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectHall(room.id);
              }
            } : undefined}
          >
            <rect x={room.x} y={room.y} width={room.w} height={room.h} rx="3" />
            <text
              x={room.x + room.w / 2}
              y={room.y + room.h / 2}
              textAnchor="middle"
              dominantBaseline="central"
              className={isHall ? 'room-label' : 'room-label room-label--small'}
            >
              {room.label}
            </text>
          </g>
        );
      })}

      {showFiber && (
        <g className="fiber-layer">
          {segments.map((seg) => {
            if (!seg.path) return null;
            const isSelected = selectedSegment === seg.key;
            return (
              <g key={seg.key} className="fiber-segment">
                {/* Wide invisible stroke so the line is easy to hit. */}
                <path
                  d={seg.path}
                  className="fiber-hitbox"
                  onClick={() => onSelectSegment(seg)}
                />
                <path
                  d={seg.path}
                  className={`fiber-path ${isSelected ? 'is-selected' : ''}`}
                  stroke={STATUS_COLORS[seg.status]}
                  strokeDasharray={seg.status === 'NOT_RUN' ? '6 5' : undefined}
                  pointerEvents="none"
                />
                <SegmentBadge segment={seg} />
              </g>
            );
          })}
        </g>
      )}
    </svg>
  );
}

/** Count bubble at the midpoint of a segment. */
function SegmentBadge({ segment }) {
  const anchor = midpointOf(segment.path);
  if (!anchor) return null;

  const label = segment.down > 0
    ? `${segment.down}/${segment.total}`
    : String(segment.total);

  return (
    <g pointerEvents="none" className="segment-badge">
      <rect
        x={anchor.x - 15} y={anchor.y - 9}
        width="30" height="18" rx="9"
        fill={STATUS_COLORS[segment.status]}
      />
      <text x={anchor.x} y={anchor.y} textAnchor="middle" dominantBaseline="central">
        {label}
      </text>
      <title>
        {`${segment.from} to ${segment.to}: ${segment.total} run(s), `
         + `${STATUS_LABELS[segment.status]}`}
      </title>
    </g>
  );
}

/**
 * Rough midpoint of a path, taken from its coordinate pairs. Good enough for
 * badge placement and avoids needing a live DOM node to measure.
 */
function midpointOf(d) {
  if (!d) return null;
  const nums = d.match(/-?\d+(?:\.\d+)?/g);
  if (!nums || nums.length < 4) return null;

  const pts = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    pts.push({ x: Number(nums[i]), y: Number(nums[i + 1]) });
  }
  return pts[Math.floor(pts.length / 2)];
}
