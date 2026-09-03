import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import SiteMap from './components/SiteMap.jsx';
import SegmentPanel from './components/SegmentPanel.jsx';
import HallView from './components/HallView.jsx';
import CutsheetView from './components/CutsheetView.jsx';
import { groupSegments } from './segments.js';
import { HALLS, STATUS_COLORS, STATUS_LABELS } from './site.js';

/** Last path segment, for displaying a source path without the machine's tree. */
function basename(p) {
  return p ? p.split('/').pop() : null;
}

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [view, setView] = useState('visual');      // 'visual' | 'cutsheet'
  const [showFiber, setShowFiber] = useState(true);
  // Kept separate on purpose: the cutsheet has an MMR tab, but MMR is not a
  // data hall and has no overhead view. Sharing one piece of state here put
  // the visual view into a HallView for a room that does not exist.
  const [zoomedHall, setZoomedHall] = useState(null);
  const [cutsheetTab, setCutsheetTab] = useState(null);
  const [segmentKey, setSegmentKey] = useState(null);
  const [busyKey, setBusyKey] = useState(null);

  const refresh = useCallback(async () => {
    try {
      setData(await api.circuits());
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const circuits = data?.circuits ?? [];

  /**
   * Status is shared state, so every mutation refetches rather than patching
   * a local copy -- what another viewer just changed arrives with it.
   */
  const cycle = useCallback(async (circuitId, hopId) => {
    const key = `${circuitId}::${hopId}`;
    setBusyKey(key);
    try {
      await api.cycleHop(circuitId, hopId);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyKey(null);
    }
  }, [refresh]);

  const clear = useCallback(async (circuitId, hopId) => {
    setBusyKey(`${circuitId}::${hopId}`);
    try {
      await api.clearHop(circuitId, hopId);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyKey(null);
    }
  }, [refresh]);

  // Rebuilt from fresh data each render, so the panel tracks the latest state
  // rather than holding a stale snapshot of the segment it was opened with.
  // Shares groupSegments with the map so the two can never disagree on a key.
  const segments = useMemo(() => groupSegments(circuits), [circuits]);
  const segmentList = useMemo(() => [...segments.values()], [segments]);

  const selectedSegment = segmentKey ? segments.get(segmentKey) ?? null : null;

  const totals = useMemo(() => {
    const out = { UP: 0, DOWN: 0, INVESTIGATE: 0, NOT_RUN: 0 };
    for (const c of circuits) for (const h of c.hops) out[h.status] = (out[h.status] ?? 0) + 1;
    return out;
  }, [circuits]);

  if (error && !data) {
    return (
      <div className="app app--error">
        <h1>One-Stop-Shop &mdash; PHX01</h1>
        <p className="error">Could not reach the API: {error}</p>
        <p>Start it with <code>npm run dev:server</code>.</p>
      </div>
    );
  }

  if (!data) return <div className="app"><p>Loading cutsheet&hellip;</p></div>;

  return (
    <div className="app">
      <header className="app-head">
        <div>
          <h1>One-Stop-Shop &mdash; PHX01</h1>
          <p className="app-sub">US-WEST-02 &middot; Phoenix &middot; inter-hall fiber</p>
        </div>

        <div className="toolbar">
          <div className="segmented" role="group" aria-label="View">
            <button
              type="button"
              className={view === 'visual' ? 'is-active' : ''}
              onClick={() => setView('visual')}
            >
              Visual
            </button>
            <button
              type="button"
              className={view === 'cutsheet' ? 'is-active' : ''}
              onClick={() => setView('cutsheet')}
            >
              Cutsheet
            </button>
          </div>

          {view === 'visual' && !zoomedHall && (
            <label className="switch">
              <input
                type="checkbox"
                checked={showFiber}
                onChange={(e) => setShowFiber(e.target.checked)}
              />
              Fiber overlay
            </label>
          )}
        </div>
      </header>

      <div className="legend">
        {Object.entries(STATUS_LABELS).map(([status, label]) => (
          <span key={status} className="legend-item">
            <i style={{ background: STATUS_COLORS[status] }} />
            {label} <b>{totals[status] ?? 0}</b>
          </span>
        ))}
      </div>

      {error && <p className="error error--inline">{error}</p>}

      {data.warnings?.length > 0 && (
        <ul className="warnings">
          {data.warnings.map((w, i) => <li key={`${i}-${w}`}>{w}</li>)}
        </ul>
      )}

      <main className={view === 'visual' && !zoomedHall ? 'layout layout--split' : 'layout'}>
        {view === 'cutsheet' && (
          <CutsheetView
            circuits={circuits}
            hall={cutsheetTab}
            onSelectHall={setCutsheetTab}
            onCycle={cycle}
            busyKey={busyKey}
          />
        )}

        {view === 'visual' && zoomedHall && (
          <HallView
            hall={zoomedHall}
            circuits={circuits}
            onBack={() => setZoomedHall(null)}
            onSelectRun={cycle}
          />
        )}

        {view === 'visual' && !zoomedHall && (
          <>
            <SiteMap
              segments={segmentList}
              showFiber={showFiber}
              onSelectHall={(id) => HALLS.includes(id) && setZoomedHall(id)}
              onSelectSegment={(seg) => setSegmentKey(seg.key)}
              selectedSegment={segmentKey}
            />
            <SegmentPanel
              segment={selectedSegment}
              onCycle={cycle}
              onClear={clear}
              busyKey={busyKey}
            />
          </>
        )}
      </main>

      <footer className="app-foot">
        Source: <code>{basename(data.meta?.csvPath) ?? data.meta?.source}</code>
        {data.meta?.colorsPath && <> + PDF color legend</>}
        {' '}&middot; statuses are shared &mdash; everyone sees the same state.
      </footer>
    </div>
  );
}
