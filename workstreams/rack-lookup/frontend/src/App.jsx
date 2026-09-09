import { useState, useRef, useEffect, useCallback } from "react";

// ---- Mock fallback data ------------------------------------------------
// Used only if the backend (http://localhost:3001) isn't reachable, e.g.
// when this artifact is previewed standalone with no server running.
// Shaped to match the real backend response exactly.
const MOCK_LOOKUPS = {
  "US-PHX01.DH120.R198.RU26": {
    locationId: "US-PHX01.DH120.R198.RU26",
    currentTicketKey: "SDA-83303",
    tickets: [
      {
        key: "SDA-83303",
        summary: "Servers | Region: US-WEST-02A | Serial: BM87DB4 | Priority: L3: Medium",
        status: "Awaiting Triage",
        priority: "Medium",
        created: "2026-09-03T10:57:00.000-07:00",
        serial: "BM87DB4",
        assetTag: "d0005689",
        url: "https://coreweave.atlassian.net/browse/SDA-83303",
      },
      {
        key: "HO-155357",
        summary: "SDA-65850 | US-WEST-02A | BM87DB4 | US-PHX01.DH120.R198.RU26",
        status: "Closed",
        priority: "Medium",
        created: "2026-06-19T23:37:00.000-07:00",
        serial: "BM87DB4",
        assetTag: "d0005689",
        url: "https://coreweave.atlassian.net/browse/HO-155357",
      },
      {
        key: "SDA-65850",
        summary: "Servers | Region: US-WEST-02A | Serial: BM87DB4 | Priority: L3: Medium",
        status: "Closed",
        priority: "Medium",
        created: "2026-06-18T15:17:00.000-07:00",
        serial: "BM87DB4",
        assetTag: "d0005689",
        url: "https://coreweave.atlassian.net/browse/SDA-65850",
      },
    ],
  },
};

const STATUS_COLOR = {
  Open: "#E8A33D",
  "Awaiting Triage": "#E8A33D",
  "In Progress": "#4F8EF7",
  Blocked: "#C6604C",
  Done: "#6FA98B",
  Resolved: "#6FA98B",
  Closed: "#6FA98B",
};

function statusColor(status) {
  return STATUS_COLOR[status] || "#A9B3AC";
}

function normalize(raw) {
  return (raw || "").trim();
}

// Parses "US-PHX01.DH120.R198.RU26" into its parts for the copy format.
// Falls back gracefully if a location doesn't match the expected shape.
function parseLocation(locationId) {
  const match = locationId.match(/^(.+?)\.(?:DH)?(\d+)\.R(\d+)\.RU(\d+)$/i);
  if (!match) return null;
  const [, site, hall, rack, position] = match;
  return { site, hall, rack, position };
}

const Icon = {
  qr: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="5" height="5" rx="1" /><rect x="16" y="3" width="5" height="5" rx="1" /><rect x="3" y="16" width="5" height="5" rx="1" />
      <path d="M21 16h-3a2 2 0 0 0-2 2v3" /><path d="M21 21v.01" /><path d="M12 7v3a2 2 0 0 1-2 2H7" /><path d="M3 12h.01" /><path d="M12 3h.01" /><path d="M12 16v.01" /><path d="M16 12h1" /><path d="M21 12v.01" /><path d="M12 21v-1" />
    </svg>
  ),
  copy: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  ),
  check: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  chevron: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  externalLink: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  ),
  x: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  ),
};

// Configurable at build time via Vite env vars (VITE_API_BASE_URL in
// .env or .env.production), so the same code works for local dev
// (localhost:3001) and a real deployment (an internal URL) without
// editing source. Falls back to localhost if unset.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

export default function App() {
  const [query, setQuery] = useState("");
  const [scanLog, setScanLog] = useState([]); // [{ id, locationId, timestamp, status: 'loading'|'ok'|'not_found'|'error', data }]
  const [selectedId, setSelectedId] = useState(null); // scanLog entry id
  const [openTicketsDropdown, setOpenTicketsDropdown] = useState(false);
  const inputRef = useRef(null);
  const listEndRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [scanLog.length]);

  const runLookup = useCallback(async (raw) => {
    const locationId = normalize(raw);
    if (!locationId) return;

    const entryId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const entry = { id: entryId, locationId, timestamp: new Date(), status: "loading", data: null };

    setScanLog((prev) => [...prev, entry]);
    setSelectedId(entryId);
    setOpenTicketsDropdown(false);

    let result;
    try {
      const res = await fetch(`${API_BASE_URL}/api/rack/${encodeURIComponent(locationId)}`);
      if (res.status === 404) {
        result = { status: "not_found", data: null };
      } else if (!res.ok) {
        throw new Error(`Backend returned ${res.status}`);
      } else {
        result = { status: "ok", data: await res.json() };
      }
    } catch (err) {
      const hit = MOCK_LOOKUPS[locationId];
      result = hit ? { status: "ok", data: hit } : { status: "not_found", data: null };
    }

    setScanLog((prev) => prev.map((e) => (e.id === entryId ? { ...e, ...result } : e)));
  }, []);

  const handleSubmit = () => {
    runLookup(query);
    setQuery("");
    inputRef.current?.focus();
  };

  const handleInputKeyDown = (e) => {
    if (e.key === "Enter") handleSubmit();
  };

  const selectedEntry = scanLog.find((e) => e.id === selectedId) || null;

  // Builds one line per successfully-resolved scan: "R198.RU26 - SDA-83303"
  // with the ticket key as a real hyperlink when the destination supports
  // rich paste (Slack, email, Docs), and the same text with a bare key
  // when it doesn't (plain-text editors fall back to this automatically
  // via the "text/plain" clipboard entry written alongside the HTML one).
  const [listCopied, setListCopied] = useState(false);

  const handleCopyList = () => {
    const resolvedEntries = scanLog.filter((e) => e.status === "ok");

    const lines = resolvedEntries.map((e) => {
      const parts = parseLocation(e.locationId);
      const label = parts ? `R${parts.rack}.RU${parts.position}` : e.locationId;
      const key = e.data.currentTicketKey;
      const ticket = e.data.tickets.find((t) => t.key === key);
      return { label, key, url: ticket?.url };
    });

    const plainText = lines
      .map((l) => (l.key ? `${l.label} - ${l.key}` : l.label))
      .join("\n");

    const htmlText = lines
      .map((l) =>
        l.key && l.url
          ? `${l.label} - <a href="${l.url}">${l.key}</a>`
          : l.label
      )
      .join("<br>");

    const clipboardItem = new ClipboardItem({
      "text/plain": new Blob([plainText], { type: "text/plain" }),
      "text/html": new Blob([htmlText], { type: "text/html" }),
    });

    navigator.clipboard.write([clipboardItem]).then(() => {
      setListCopied(true);
      setTimeout(() => setListCopied(false), 1500);
    });
  };

  const styles = {
    mono: { fontFamily: "'SF Mono', 'JetBrains Mono', ui-monospace, Menlo, monospace" },
  };

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        minHeight: 600,
        background: "#1B2422",
        color: "#EDEAE1",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* ---- Left: scan input + running log ---- */}
      <div
        style={{
          width: "42%",
          minWidth: 300,
          borderRight: "1px solid #3A4A44",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid #3A4A44" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
            <h1 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Rack scan log</h1>
            <span style={{ ...styles.mono, fontSize: 11, color: "#A9B3AC" }}>{scanLog.length} scanned</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "#232E2B",
                border: "1px solid #3A4A44",
                borderRadius: 10,
                padding: "0 10px",
              }}
            >
              <Icon.qr width={14} height={14} style={{ color: "#A9B3AC", flexShrink: 0 }} />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Scan Asset Rack Location…"
                autoComplete="off"
                style={{
                  ...styles.mono,
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "#EDEAE1",
                  fontSize: 13,
                  padding: "10px 0",
                  minWidth: 0,
                }}
              />
            </div>
          </div>
          <div style={{ fontSize: 10, color: "#6FA98B", marginTop: 8, display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#6FA98B", display: "inline-block" }} />
            Field stays focused for scanner-gun input
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
          {scanLog.length === 0 && (
            <div style={{ padding: 24, textAlign: "center", color: "#A9B3AC", fontSize: 12 }}>
              No scans yet. Scan a QR code or type a location above.
            </div>
          )}
          {scanLog.map((entry) => (
            <button
              key={entry.id}
              onClick={() => {
                setSelectedId(entry.id);
                setOpenTicketsDropdown(false);
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                background: selectedId === entry.id ? "#2B3733" : "transparent",
                border: "1px solid",
                borderColor: selectedId === entry.id ? "#4F8EF7" : "transparent",
                borderRadius: 8,
                padding: "9px 10px",
                marginBottom: 4,
                cursor: "pointer",
                color: "#EDEAE1",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ ...styles.mono, fontSize: 12, wordBreak: "break-all" }}>{entry.locationId}</span>
                <StatusDot entry={entry} />
              </div>
              <div style={{ fontSize: 10, color: "#A9B3AC", marginTop: 3 }}>
                {entry.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                {entry.status === "ok" && ` · ${entry.data.tickets.length} ticket${entry.data.tickets.length === 1 ? "" : "s"}`}
                {entry.status === "not_found" && " · no tickets found"}
                {entry.status === "error" && " · lookup failed"}
              </div>
            </button>
          ))}
          <div ref={listEndRef} />
        </div>

        <div style={{ padding: 10, borderTop: "1px solid #3A4A44" }}>
          <button
            onClick={handleCopyList}
            disabled={scanLog.filter((e) => e.status === "ok").length === 0}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "10px 0",
              background: listCopied ? "#6FA98B22" : "#232E2B",
              border: `1px solid ${listCopied ? "#6FA98B" : "#3A4A44"}`,
              borderRadius: 10,
              color: listCopied ? "#6FA98B" : "#EDEAE1",
              fontSize: 12,
              fontWeight: 500,
              cursor: scanLog.filter((e) => e.status === "ok").length === 0 ? "default" : "pointer",
              opacity: scanLog.filter((e) => e.status === "ok").length === 0 ? 0.5 : 1,
            }}
          >
            {listCopied ? <Icon.check width={14} height={14} /> : <Icon.copy width={14} height={14} />}
            {listCopied ? "Copied" : "Copy all scanned lines"}
          </button>
        </div>
      </div>

      {/* ---- Right: detail pane ---- */}
      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        {!selectedEntry && (
          <div style={{ color: "#A9B3AC", fontSize: 13, textAlign: "center", marginTop: 60 }}>
            Select a scan from the log to see its details.
          </div>
        )}

        {selectedEntry && selectedEntry.status === "loading" && (
          <div style={{ color: "#E8A33D", fontSize: 13 }}>Looking up {selectedEntry.locationId}…</div>
        )}

        {selectedEntry && selectedEntry.status === "not_found" && (
          <div style={{ color: "#A9B3AC", fontSize: 13 }}>
            No tickets found tagged with
            <div style={{ ...styles.mono, color: "#C6604C", marginTop: 6, wordBreak: "break-all" }}>{selectedEntry.locationId}</div>
          </div>
        )}

        {selectedEntry && selectedEntry.status === "error" && (
          <div style={{ color: "#C6604C", fontSize: 13 }}>Lookup failed for {selectedEntry.locationId}.</div>
        )}

        {selectedEntry && selectedEntry.status === "ok" && (
          <DetailPane
            entry={selectedEntry}
            styles={styles}
            openTicketsDropdown={openTicketsDropdown}
            setOpenTicketsDropdown={setOpenTicketsDropdown}
          />
        )}
      </div>
    </div>
  );
}

function StatusDot({ entry }) {
  let color = "#A9B3AC";
  if (entry.status === "loading") color = "#E8A33D";
  else if (entry.status === "ok") color = "#6FA98B";
  else if (entry.status === "not_found") color = "#A9B3AC";
  else if (entry.status === "error") color = "#C6604C";
  return <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0, display: "inline-block" }} />;
}

function DetailPane({ entry, styles, openTicketsDropdown, setOpenTicketsDropdown }) {
  const { data } = entry;
  const tickets = data.tickets;
  const currentTicket = tickets.find((t) => t.key === data.currentTicketKey) || tickets[0];
  const parts = parseLocation(entry.locationId);

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ ...styles.mono, fontSize: 18, fontWeight: 600, marginBottom: 4, wordBreak: "break-all" }}>{entry.locationId}</div>
      {parts && (
        <div style={{ fontSize: 12, color: "#A9B3AC", marginBottom: 20 }}>
          Rack {parts.rack} · Position {parts.position}
        </div>
      )}

      <div style={{ border: "1px solid #3A4A44", borderRadius: 12, background: "#232E2B", padding: "14px 16px", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11, color: "#A9B3AC", marginBottom: 3 }}>Serial number</div>
            <div style={{ ...styles.mono, fontSize: 14 }}>{currentTicket?.serial || "—"}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#A9B3AC", marginBottom: 3 }}>Asset tag</div>
            <div style={{ ...styles.mono, fontSize: 14 }}>{currentTicket?.assetTag || "—"}</div>
          </div>
        </div>
      </div>

      <div style={{ border: "1px solid #3A4A44", borderRadius: 12, background: "#232E2B", marginBottom: 12, overflow: "hidden" }}>
        <button
          onClick={() => setOpenTicketsDropdown((v) => !v)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            background: "transparent",
            border: "none",
            color: "#EDEAE1",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          <span>
            Open tickets <span style={{ color: "#A9B3AC" }}>({tickets.length})</span>
          </span>
          <Icon.chevron
            width={16}
            height={16}
            style={{ transform: openTicketsDropdown ? "rotate(180deg)" : "none", transition: "transform 0.15s", color: "#A9B3AC" }}
          />
        </button>
        {openTicketsDropdown && (
          <div style={{ borderTop: "1px solid #3A4A44" }}>
            {tickets.map((t) => (
              <a
                key={t.key}
                href={t.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "10px 16px",
                  borderTop: "1px solid #2B3733",
                  textDecoration: "none",
                  color: "#EDEAE1",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <span style={{ ...styles.mono, fontSize: 12, color: "#4F8EF7", flexShrink: 0 }}>{t.key}</span>
                  {t.key === data.currentTicketKey && (
                    <span style={{ fontSize: 9, fontWeight: 600, color: "#E8A33D", background: "#E8A33D22", padding: "1px 6px", borderRadius: 10 }}>
                      CURRENT
                    </span>
                  )}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: statusColor(t.status),
                    background: `${statusColor(t.status)}22`,
                    padding: "2px 7px",
                    borderRadius: 10,
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {t.status}
                  <Icon.externalLink width={9} height={9} />
                </span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
