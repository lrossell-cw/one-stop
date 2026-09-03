import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import SiteMap from './components/SiteMap.jsx';
import SegmentPanel from './components/SegmentPanel.jsx';
import HallView from './components/HallView.jsx';
import CutsheetView from './components/CutsheetView.jsx';
import { STATUS_COLORS, STATUS_LABELS } from './site.js';

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [view, setView] = useState('visual');      // 'visual' | 'cutsheet'
  const [showFiber, setShowFiber] = useState(true);
  const [hall, setHall] = useState(null);
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
    for (const g of groups.values()) {
      g.total = g.hops.length;
      g.down = g.hops.filter(({ hop }) => hop.status === 'DOWN').length;
      g.investigate = g.hops.filter(({ hop }) => hop.status === 'INVESTIGATE').length;
    }
    return groups;
  }, [circuits]);

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

          {view === 'visual' && !hall && (
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
          {data.warnings.map((w) => <li key={w}>{w}</li>)}
        </ul>
      )}

      <main className={view === 'visual' && !hall ? 'layout layout--split' : 'layout'}>
        {view === 'cutsheet' && (
          <CutsheetView
            circuits={circuits}
            hall={hall}
            onSelectHall={setHall}
            onCycle={cycle}
            busyKey={busyKey}
          />
        )}

        {view === 'visual' && hall && (
          <HallView
            hall={hall}
            circuits={circuits}
            onBack={() => setHall(null)}
            onSelectRun={cycle}
            selectedRunKey={null}
          />
        )}

        {view === 'visual' && !hall && (
          <>
            <SiteMap
              circuits={circuits}
              showFiber={showFiber}
              selectedHall={hall}
              onSelectHall={setHall}
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
        Source: <code>{data.meta?.source}</code>
        {data.meta?.colorsPath && <> + PDF color legend</>}
        {' '}&middot; statuses are shared &mdash; everyone sees the same state.
      </footer>
    </div>
  );
}
