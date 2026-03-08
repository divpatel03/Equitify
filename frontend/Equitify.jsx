import { useState, useEffect, useRef } from "react";

const API_URL = "http://localhost:8080/api/stock";
const TAPE_SYMBOLS = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META", "JPM", "V", "NFLX", "SPY", "QQQ"];
const POLL_INTERVAL = 15000; // 15s — respectful of Finnhub free tier rate limits

// ── Fetch prices from Spring Boot backend ─────────────────────────────────────
async function fetchPrices(symbols) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(symbols),
  });
  if (!res.ok) throw new Error(`Backend error: ${res.status}`);
  return res.json(); // [{ symbol, price }, ...]
}

// ── Sparkline SVG ─────────────────────────────────────────────────────────────
function Sparkline({ data, positive, width = 120, height = 32 }) {
  if (!data || data.length < 2) return (
    <div style={{ width, height, display: "flex", alignItems: "center", paddingLeft: 4 }}>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "#333355" }}>LOADING...</span>
    </div>
  );
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  });
  const fillPath = `M${pts[0]} L${pts.join(" L")} L${width},${height} L0,${height} Z`;
  const color = positive ? "#00d4aa" : "#ff4d6d";
  const gradId = `grad${data.length}${Math.round(data[0])}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${gradId})`} />
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Market clock & status ─────────────────────────────────────────────────────
function getMarketStatus() {
  const now = new Date();
  const est = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const h = est.getHours(), m = est.getMinutes(), day = est.getDay();
  const isWeekday = day >= 1 && day <= 5;
  const afterOpen = h > 9 || (h === 9 && m >= 30);
  const beforeClose = h < 16;
  return isWeekday && afterOpen && beforeClose ? "OPEN" : "CLOSED";
}

// ── Ticker tape ───────────────────────────────────────────────────────────────
function TickerTape({ prices }) {
  return (
    <div style={{
      background: "#0a0a0f", borderBottom: "1px solid #1e1e2e",
      overflow: "hidden", height: 32, display: "flex", alignItems: "center",
    }}>
      <div style={{
        display: "flex", gap: 40,
        animation: "ticker 50s linear infinite",
        whiteSpace: "nowrap", paddingLeft: "100%",
      }}>
        {[...TAPE_SYMBOLS, ...TAPE_SYMBOLS].map((s, i) => {
          const p = prices[s];
          const change = p?.prevClose ? ((p.current - p.prevClose) / p.prevClose * 100) : null;
          const pos = change === null ? true : change >= 0;
          return (
            <span key={i} style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.05em" }}>
              <span style={{ color: "#8888aa", marginRight: 6 }}>{s}</span>
              <span style={{ color: "#e0e0f0" }}>{p ? `$${p.current.toFixed(2)}` : "—"}</span>
              {change !== null && (
                <span style={{ color: pos ? "#00d4aa" : "#ff4d6d", marginLeft: 5 }}>
                  {pos ? "▲" : "▼"} {Math.abs(change).toFixed(2)}%
                </span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ── Stock Row ─────────────────────────────────────────────────────────────────
function StockRow({ symbol, data, onRemove }) {
  const { current, prevClose, sparkline } = data;
  const change = current && prevClose ? current - prevClose : 0;
  const changePct = prevClose ? (change / prevClose) * 100 : 0;
  const positive = change >= 0;
  const [flash, setFlash] = useState(false);
  const prevRef = useRef(current);

  useEffect(() => {
    if (prevRef.current !== current && current) {
      setFlash(true);
      setTimeout(() => setFlash(false), 500);
      prevRef.current = current;
    }
  }, [current]);

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "80px 1fr 110px 90px 40px",
      alignItems: "center", gap: 16, padding: "14px 20px",
      borderBottom: "1px solid #13131f",
      background: flash ? (positive ? "rgba(0,212,170,0.05)" : "rgba(255,77,109,0.05)") : "transparent",
      transition: "background 0.4s",
    }}>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 13, color: "#e0e0f8", letterSpacing: "0.08em" }}>
        {symbol}
      </span>
      <div style={{ display: "flex", alignItems: "center" }}>
        <Sparkline data={sparkline} positive={positive} />
      </div>
      <span style={{
        fontFamily: "'IBM Plex Mono', monospace", fontSize: 15, fontWeight: 700,
        color: flash ? (positive ? "#00d4aa" : "#ff4d6d") : "#f0f0ff",
        textAlign: "right", transition: "color 0.3s",
      }}>
        {current ? `$${current.toFixed(2)}` : "—"}
      </span>
      <span style={{
        fontFamily: "'IBM Plex Mono', monospace", fontSize: 12,
        color: positive ? "#00d4aa" : "#ff4d6d", textAlign: "right",
      }}>
        {current ? `${positive ? "+" : ""}${changePct.toFixed(2)}%` : "—"}
      </span>
      <button
        onClick={() => onRemove(symbol)}
        style={{
          background: "none", border: "1px solid #2a2a3e", color: "#555577",
          borderRadius: 4, width: 28, height: 28, cursor: "pointer",
          fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.2s",
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "#ff4d6d"; e.currentTarget.style.color = "#ff4d6d"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "#2a2a3e"; e.currentTarget.style.color = "#555577"; }}
      >×</button>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function Equitify() {
  const [symbolInput, setSymbolInput] = useState("");
  const [watchlist, setWatchlist] = useState([]);
  // prices[sym] = { current, prevClose, sparkline: [...] }
  const [prices, setPrices] = useState({});
  // tapePrices[sym] = { current, prevClose }
  const [tapePrices, setTapePrices] = useState({});
  const [time, setTime] = useState(new Date());
  const [marketStatus, setMarketStatus] = useState(getMarketStatus());
  const [error, setError] = useState("");
  const [backendError, setBackendError] = useState(false);

  // Clock
  useEffect(() => {
    const id = setInterval(() => {
      setTime(new Date());
      setMarketStatus(getMarketStatus());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Tape: initial load + polling ──────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const results = await fetchPrices(TAPE_SYMBOLS);
        setTapePrices(prev => {
          const next = { ...prev };
          results.forEach(({ symbol, price }) => {
            if (price != null) next[symbol] = { current: price, prevClose: prev[symbol]?.prevClose ?? price };
          });
          return next;
        });
        setBackendError(false);
      } catch {
        setBackendError(true);
      }
    };
    load();
    const id = setInterval(load, POLL_INTERVAL);
    return () => clearInterval(id);
  }, []);

  // ── Watchlist: poll prices + build sparkline history ─────────────────────
  useEffect(() => {
    if (watchlist.length === 0) return;
    const load = async () => {
      try {
        const results = await fetchPrices(watchlist);
        setPrices(prev => {
          const next = { ...prev };
          results.forEach(({ symbol, price }) => {
            if (price != null) {
              const existing = prev[symbol];
              const prevClose = existing?.prevClose ?? price;
              const history = existing?.sparkline ?? [];
              const newHistory = [...history, price].slice(-30); // keep last 30 data points
              next[symbol] = { current: price, prevClose, sparkline: newHistory };
            }
          });
          return next;
        });
        setBackendError(false);
      } catch {
        setBackendError(true);
      }
    };
    load();
    const id = setInterval(load, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [watchlist]);

  const handleAddStock = async () => {
    const sym = symbolInput.trim().toUpperCase();
    if (!sym) return;
    if (watchlist.includes(sym)) { setError(`${sym} is already in your watchlist.`); setSymbolInput(""); return; }
    if (watchlist.length >= 12) { setError("Max 12 stocks in watchlist."); return; }
    setError("");
    setSymbolInput("");

    try {
      const results = await fetchPrices([sym]);
      const { price } = results[0];
      if (price == null || price === 0) { setError(`${sym} not found or no data available.`); return; }
      setPrices(prev => ({ ...prev, [sym]: { current: price, prevClose: price, sparkline: [price] } }));
      setWatchlist(prev => [...prev, sym]);
      setBackendError(false);
    } catch {
      setBackendError(true);
      setError("Could not reach backend. Is Spring Boot running on port 8080?");
    }
  };

  const handleRemove = (sym) => {
    setWatchlist(prev => prev.filter(s => s !== sym));
    setPrices(prev => { const n = { ...prev }; delete n[sym]; return n; });
  };

  const estTime = time.toLocaleString("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const gainers = watchlist.filter(s => prices[s]?.current >= prices[s]?.prevClose).length;
  const losers = watchlist.length - gainers;

  return (
    <div style={{ minHeight: "100vh", background: "#07070d", fontFamily: "'IBM Plex Sans', sans-serif", color: "#e0e0f0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@300;400;500;600&family=Bebas+Neue&display=swap');
        @keyframes ticker { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }
        @keyframes blink { 0%,100% { opacity:1 } 50% { opacity:0.3 } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px } ::-webkit-scrollbar-track { background: #0d0d1a }
        ::-webkit-scrollbar-thumb { background: #2a2a4a; border-radius: 2px }
      `}</style>

      {/* Top bar */}
      <header style={{
        background: "#0a0a12", borderBottom: "1px solid #1a1a2e",
        padding: "0 28px", height: 52,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, color: "#e0e0ff", letterSpacing: "0.2em" }}>
          EQUITIFY
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {backendError && (
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#ff4d6d", letterSpacing: "0.1em" }}>
              ⚠ BACKEND OFFLINE
            </span>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 7, height: 7, borderRadius: "50%",
              background: marketStatus === "OPEN" ? "#00d4aa" : "#ff4d6d",
              boxShadow: marketStatus === "OPEN" ? "0 0 6px #00d4aa" : "0 0 6px #ff4d6d",
              animation: marketStatus === "OPEN" ? "blink 2s infinite" : "none",
            }} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: marketStatus === "OPEN" ? "#00d4aa" : "#ff4d6d", letterSpacing: "0.15em" }}>
              MARKET {marketStatus}
            </span>
          </div>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "#555577", letterSpacing: "0.1em" }}>
            {estTime} EST
          </span>
        </div>
      </header>

      {/* Ticker tape */}
      <TickerTape prices={tapePrices} />

      {/* Main content */}
      <div style={{ padding: "28px", animation: "fadeUp 0.5s ease forwards" }}>

        {/* Stats row */}
        {watchlist.length > 0 && (
          <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
            {[
              { label: "WATCHING", value: watchlist.length, color: "#8888cc" },
              { label: "ADVANCING", value: gainers, color: "#00d4aa" },
              { label: "DECLINING", value: losers, color: "#ff4d6d" },
            ].map(stat => (
              <div key={stat.label} style={{
                background: "rgba(255,255,255,0.02)", border: "1px solid #1a1a2e",
                borderRadius: 2, padding: "14px 20px", minWidth: 110,
              }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "#444466", letterSpacing: "0.2em", marginBottom: 6 }}>
                  {stat.label}
                </div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: stat.color, lineHeight: 1 }}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add stock input */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, maxWidth: 440 }}>
          <input
            type="text"
            value={symbolInput}
            onChange={e => { setSymbolInput(e.target.value.toUpperCase()); setError(""); }}
            onKeyDown={e => e.key === "Enter" && handleAddStock()}
            placeholder="ADD SYMBOL  (e.g. AAPL)"
            maxLength={6}
            style={{
              flex: 1, background: "rgba(0,0,0,0.4)",
              border: "1px solid #2a2a3e", borderRadius: 2,
              color: "#e0e0ff", fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 13, padding: "11px 14px", outline: "none",
              letterSpacing: "0.1em", transition: "border-color 0.2s",
            }}
            onFocus={e => e.target.style.borderColor = "#00d4aa"}
            onBlur={e => e.target.style.borderColor = "#2a2a3e"}
          />
          <button
            onClick={handleAddStock}
            style={{
              background: "#00d4aa", border: "none", borderRadius: 2,
              color: "#07070d", fontFamily: "'IBM Plex Mono', monospace",
              fontWeight: 600, fontSize: 12, letterSpacing: "0.15em",
              padding: "11px 20px", cursor: "pointer", transition: "background 0.2s",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "#00f0c0"}
            onMouseLeave={e => e.currentTarget.style.background = "#00d4aa"}
          >+ ADD</button>
        </div>

        {error && (
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#ff4d6d", marginBottom: 14, letterSpacing: "0.05em" }}>
            ⚠ {error}
          </div>
        )}

        {/* Watchlist table */}
        {watchlist.length > 0 ? (
          <div style={{ border: "1px solid #1a1a2e", borderRadius: 2, overflow: "hidden" }}>
            <div style={{
              display: "grid", gridTemplateColumns: "80px 1fr 110px 90px 40px",
              gap: 16, padding: "10px 20px",
              background: "#0a0a12", borderBottom: "1px solid #1a1a2e",
            }}>
              {["SYMBOL", "PRICE HISTORY", "LAST PRICE", "DAY CHANGE", ""].map((h, i) => (
                <span key={i} style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: 9,
                  color: "#444466", letterSpacing: "0.2em",
                  textAlign: i >= 2 ? "right" : "left",
                }}>{h}</span>
              ))}
            </div>
            {watchlist.map(sym => (
              <StockRow
                key={sym}
                symbol={sym}
                data={prices[sym] || { current: null, prevClose: null, sparkline: [] }}
                onRemove={handleRemove}
              />
            ))}
          </div>
        ) : (
          <div style={{
            border: "1px dashed #1a1a2e", borderRadius: 2,
            padding: "60px 20px", textAlign: "center",
          }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: "#222240", letterSpacing: "0.2em", marginBottom: 8 }}>
              WATCHLIST EMPTY
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#333355", letterSpacing: "0.1em" }}>
              ADD A STOCK SYMBOL ABOVE TO BEGIN TRACKING
            </div>
          </div>
        )}

        <div style={{ marginTop: 20, fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "#222240", letterSpacing: "0.1em" }}>
          LIVE DATA VIA FINNHUB · POLLS EVERY 15s · NOT FINANCIAL ADVICE
        </div>
      </div>
    </div>
  );
}