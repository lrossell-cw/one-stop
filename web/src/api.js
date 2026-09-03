/**
 * Thin client for the fiber tracker API.
 *
 * Every mutation returns the server's view of the new state, and callers
 * refetch rather than guessing locally -- status is shared, so the server is
 * the only authority on what it currently is.
 */

const BASE = import.meta.env.VITE_API_BASE ?? '';

async function request(path, options) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `${res.status} ${res.statusText}`);
  }
  return res.json();
}

export const api = {
  circuits: () => request('/api/circuits'),

  /** Advance a hop one step around UP -> DOWN -> INVESTIGATE, server-side. */
  cycleHop: (circuitId, hopId, by = null) =>
    request(
      `/api/circuits/${encodeURIComponent(circuitId)}/hops/${encodeURIComponent(hopId)}/status`,
      { method: 'POST', body: JSON.stringify({ cycle: true, by }) },
    ),

  setHop: (circuitId, hopId, status, by = null) =>
    request(
      `/api/circuits/${encodeURIComponent(circuitId)}/hops/${encodeURIComponent(hopId)}/status`,
      { method: 'POST', body: JSON.stringify({ status, by }) },
    ),

  /** Drop the override, falling back to the cutsheet-derived default. */
  clearHop: (circuitId, hopId) =>
    request(
      `/api/circuits/${encodeURIComponent(circuitId)}/hops/${encodeURIComponent(hopId)}/status`,
      { method: 'DELETE' },
    ),

  reload: () => request('/api/reload', { method: 'POST' }),

  history: (limit = 100) => request(`/api/history?limit=${limit}`),
};
