import { ROOMS, SITE_VIEWBOX, STATUS_COLORS, STATUS_LABELS } from '../site.js';

/**
 * Whole-site map with the fiber overlay.
 *
 * The visual view draws each circuit as ONE continuous line from the MMR to
 * wherever it terminates, coloured by its worst hop -- the same reading as the
 * colour on the sheet. Which hop is at fault is the cutsheet's job; here the
 * question is "is this run up, end to end".
 *
 * The geometry still comes from real endpoints at every step, so re-patching a
 * circuit into a different hall redraws its line through the new room.
 *
 * `runs` is computed once by App and passed in, so the map and the detail panel
 * are always looking at the same objects.
 */
export default function SiteMap({
  runs,
  showFiber,
  onSelectHall,
  onSelectRun,
  focusId,
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
          {runs.map((run) => {
            if (!run.d) return null;
            const dim = focusId && focusId !== run.id;
            return (
              <g key={run.id} className="fiber-run">
                <path
                  d={run.d}
                  className="fiber-hitbox"
                  onClick={() => onSelectRun(run.id)}
                />
                <path
                  d={run.d}
                  className={[
                    'fiber-path',
                    focusId === run.id ? 'is-selected' : '',
                    dim ? 'is-dim' : '',
                  ].join(' ')}
                  stroke={STATUS_COLORS[run.status]}
                  pointerEvents="none"
                >
                  <title>
                    {`${run.label}: ${STATUS_LABELS[run.status]} — `
                     + `${run.nodes.join(' → ')}`}
                  </title>
                </path>
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

    </svg>
  );
}
