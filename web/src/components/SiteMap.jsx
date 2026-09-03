import { ROOMS, SITE_VIEWBOX, STATUS_COLORS, STATUS_LABELS } from '../site.js';

/**
 * Whole-site map with the fiber overlay.
 *
 * Segments are drawn from each hop's real `from`/`to` nodes, grouped by the
 * pair of rooms they actually connect. Re-patch a circuit to a different hall
 * and it moves to a different group, so the picture follows the data rather
 * than a fixed set of lines.
 *
 * `segments` is grouped once by App and passed in, so the map and the detail
 * panel are guaranteed to be looking at the same objects and the same keys.
 */
export default function SiteMap({
  segments,
  showFiber,
  onSelectHall,
  onSelectSegment,
  selectedSegment,
}) {
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

      {/*
        Fiber is drawn BELOW the rooms. Its hit targets are deliberately wide,
        and every path begins at an anchor inside a hall's rectangle, so
        painting it on top would let the overlay swallow the clicks that zoom
        into a hall -- the app's primary interaction.
      */}
      {showFiber && (
        <g className="fiber-layer">
          {segments.map((seg) => {
            if (!seg.path) return null;
            const isSelected = selectedSegment === seg.key;
            return (
              <g key={seg.key} className="fiber-segment">
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
              </g>
            );
          })}
        </g>
      )}

      {ROOMS.map((room) => {
        const isHall = room.hall;
        return (
          <g
            key={room.id}
            className={['room', isHall ? 'room--hall' : 'room--aux'].join(' ')}
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

      {/* Badges last, so a count is never hidden under a room. */}
      {showFiber && (
        <g className="badge-layer" pointerEvents="none">
          {segments.map((seg) => (seg.path ? <SegmentBadge key={seg.key} segment={seg} /> : null))}
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
    <g className="segment-badge">
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
