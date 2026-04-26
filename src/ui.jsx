// Agora — UI primitives. Pure presentational atoms, no state outside helpers.

const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ─── Icons (inline, monoline, 16px default) ──────────────────────────────
function Icon({ name, size = 16, stroke = 1.6, ...rest }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24",
    fill: "none", stroke: "currentColor", strokeWidth: stroke,
    strokeLinecap: "round", strokeLinejoin: "round", ...rest };
  switch (name) {
    case "home":     return <svg {...common}><path d="M3 11l9-8 9 8M5 10v10h14V10"/></svg>;
    case "vote":     return <svg {...common}><path d="M9 11l3 3 7-7M3 12a9 9 0 1018 0 9 9 0 00-18 0z"/></svg>;
    case "user":     return <svg {...common}><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></svg>;
    case "shield":   return <svg {...common}><path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z"/></svg>;
    case "search":   return <svg {...common}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5"/></svg>;
    case "lock":     return <svg {...common}><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>;
    case "unlock":   return <svg {...common}><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 017-2.5"/></svg>;
    case "drag":     return <svg {...common}><circle cx="9" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="15" cy="18" r="1.2"/></svg>;
    case "check":    return <svg {...common}><path d="M5 12l4 4 10-10"/></svg>;
    case "x":        return <svg {...common}><path d="M6 6l12 12M18 6L6 18"/></svg>;
    case "plus":     return <svg {...common}><path d="M12 5v14M5 12h14"/></svg>;
    case "upload":   return <svg {...common}><path d="M12 16V4M6 10l6-6 6 6M4 20h16"/></svg>;
    case "file":     return <svg {...common}><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9l-6-6z"/><path d="M14 3v6h6"/></svg>;
    case "calendar": return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>;
    case "clock":    return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case "chev-r":   return <svg {...common}><path d="M9 6l6 6-6 6"/></svg>;
    case "chev-l":   return <svg {...common}><path d="M15 6l-6 6 6 6"/></svg>;
    case "chev-d":   return <svg {...common}><path d="M6 9l6 6 6-6"/></svg>;
    case "arrow-r":  return <svg {...common}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
    case "note":     return <svg {...common}><path d="M5 4h11l3 3v13a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>;
    case "users":    return <svg {...common}><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5"/><circle cx="17" cy="9" r="2.5"/><path d="M15 20c0-2 2-3.5 4-3.5s2 1 2 3.5"/></svg>;
    case "external": return <svg {...common}><path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1h5"/></svg>;
    case "dots":     return <svg {...common}><circle cx="6" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18" cy="12" r="1.2"/></svg>;
    case "trophy":   return <svg {...common}><path d="M8 21h8M12 17v4M6 4h12v4a6 6 0 01-12 0V4z"/><path d="M6 6H3v2a3 3 0 003 3M18 6h3v2a3 3 0 01-3 3"/></svg>;
    case "filter":   return <svg {...common}><path d="M4 5h16l-6 8v6l-4-2v-4L4 5z"/></svg>;
    case "info":     return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 8v.01M11 12h1v5h1"/></svg>;
    default:         return null;
  }
}

// ─── Button ──────────────────────────────────────────────────────────────
function Button({ kind = "secondary", size, block, icon, children, ...rest }) {
  const cls = ["btn", `btn--${kind}`,
    size === "lg" && "btn--lg", size === "sm" && "btn--sm",
    block && "btn--block", rest.className].filter(Boolean).join(" ");
  return <button {...rest} className={cls}>
    {icon && <Icon name={icon} />}{children}
  </button>;
}

// ─── Field ───────────────────────────────────────────────────────────────
function Field({ label, hint, error, children }) {
  return <div className="field">
    {label && <label className="field__label">{label}</label>}
    {children}
    {error ? <div className="field__error">{error}</div>
           : hint && <div className="field__hint">{hint}</div>}
  </div>;
}
function Input(props) { return <input className="input" {...props} />; }
function Textarea(props) { return <textarea className="textarea" {...props} />; }
function Select({ children, ...rest }) { return <select className="select" {...rest}>{children}</select>; }

function Switch({ on, onChange, label }) {
  return <div className="switch" data-on={on ? "true" : "false"}
    onClick={() => onChange(!on)} role="switch" aria-checked={on}>
    <div className="switch__track"><div className="switch__thumb" /></div>
    {label && <div className="switch__label">{label}</div>}
  </div>;
}

// ─── Badge ───────────────────────────────────────────────────────────────
function Badge({ tone = "neutral", icon, children }) {
  return <span className={`badge badge--${tone}`}>
    {icon && <Icon name={icon} size={11} />}{children}
  </span>;
}

// ─── Avatar ──────────────────────────────────────────────────────────────
function Avatar({ name, size = 28 }) {
  const initials = (name || "?").split(/\s+/).slice(0, 2).map(s => s[0]).join("").toUpperCase();
  const hue = (name || "").split("").reduce((a,c) => a + c.charCodeAt(0), 0) % 360;
  return <span className="avatar"
    style={{ width: size, height: size, fontSize: size * 0.42,
      background: `linear-gradient(135deg, oklch(0.55 0.12 ${hue}), oklch(0.30 0.08 ${(hue+40)%360}))` }}>
    {initials}
  </span>;
}

// ─── Logo ────────────────────────────────────────────────────────────────
function AgoraMark({ size = 28 }) {
  return <span className="agora-mark" style={{ width: size, height: size, fontSize: size * 0.55 }}>A</span>;
}
function AgoraWordmark({ size = 22 }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
    <AgoraMark size={size + 6} />
    <span style={{ fontFamily: "var(--serif)", fontSize: size, fontWeight: 600,
      letterSpacing: "-0.015em", color: "var(--navy)" }}>Agora</span>
  </span>;
}

// ─── Modal ───────────────────────────────────────────────────────────────
function Modal({ open, onClose, children }) {
  useEffect(() => {
    if (!open) return;
    const k = (e) => e.key === "Escape" && onClose && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return <div className="modal-backdrop" onClick={onClose}>
    <div className="modal" onClick={(e) => e.stopPropagation()}>{children}</div>
  </div>;
}

// ─── Toasts ──────────────────────────────────────────────────────────────
const ToastCtx = React.createContext({ push: () => {} });
function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((msg, opts = {}) => {
    const id = Math.random().toString(36).slice(2);
    setItems((xs) => [...xs, { id, msg, ...opts }]);
    setTimeout(() => setItems((xs) => xs.filter(x => x.id !== id)), opts.duration || 2400);
  }, []);
  return <ToastCtx.Provider value={{ push }}>
    {children}
    <div className="toast-wrap">
      {items.map(t => <div key={t.id} className="toast">
        {t.icon && <Icon name={t.icon} size={14} />}
        {t.msg}
      </div>)}
    </div>
  </ToastCtx.Provider>;
}
const useToast = () => React.useContext(ToastCtx);

// ─── Topic placeholder art (always SVG, never figurative) ────────────────
function ArtPlaceholder({ topic, height = "100%", showLabel = true }) {
  const t = topic.tint || { bg: "#EEF2F7", ink: "#0A2540" };
  return <div style={{
    background: t.bg, color: t.ink, height, width: "100%",
    display: "flex", flexDirection: "column", justifyContent: "space-between",
    padding: 16, position: "relative", overflow: "hidden",
  }}>
    {/* subtle compositional element — just a few rects/circles, never figurative */}
    <svg style={{ position: "absolute", inset: 0, opacity: 0.18 }} viewBox="0 0 100 80" preserveAspectRatio="none">
      {[...Array(8)].map((_, i) =>
        <line key={i} x1="0" y1={i*10 + (topic.id%5)} x2="100" y2={i*10 + 5 + (topic.id%5)}
          stroke={t.ink} strokeWidth="0.2" />)}
      <circle cx={20 + (topic.id*7)%50} cy={20 + (topic.id*3)%30} r={8 + (topic.id%4)} stroke={t.ink} strokeWidth="0.4" fill="none" />
    </svg>
    <div style={{ position: "relative", zIndex: 1 }}>
      <div className="topic-card__num" style={{ color: t.ink, opacity: 0.6 }}>
        Nº {String(topic.id).padStart(2, "0")}
      </div>
    </div>
    {showLabel && <div style={{ position: "relative", zIndex: 1 }}>
      <div style={{ fontFamily: "var(--serif)", fontSize: 22, fontWeight: 600,
        lineHeight: 1.15, letterSpacing: "-0.01em" }}>{topic.philosopher}</div>
      <div style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 13,
        color: t.ink, opacity: 0.7, marginTop: 4 }}>{topic.artTitle || topic.work}</div>
    </div>}
  </div>;
}

// ─── Topic card (renders each of 4 states) ──────────────────────────────
function TopicCard({ topic, isMine, onOpen }) {
  const s = topic.status;
  return <div className={`topic-card ${s === "unassigned" ? "topic-card--unassigned" : ""}`}
    onClick={onOpen}>
    {isMine && <div className="topic-card__yours">
      <Badge tone="amber">Yours</Badge>
    </div>}
    {s === "published" ? (
      <ArtPlaceholder topic={topic} />
    ) : (
      <div className="topic-card__hero" style={{ background: s === "unassigned" ? "#FAFCFE" : "#fff" }}>
        <div className="topic-card__num">Nº {String(topic.id).padStart(2, "0")}</div>
        <div>
          <div className="topic-card__phil">{topic.philosopher}</div>
          <div className="topic-card__work">{topic.work}</div>
        </div>
      </div>
    )}
    <div className="topic-card__meta">
      {s === "unassigned" && <span className="topic-card__presenter" style={{ fontStyle: "italic" }}>Presenter TBA</span>}
      {s === "assigned" && <>
        <span className="topic-card__presenter">{topic.presenter}{topic.scheduledFor ? ` · ${fmtDate(topic.scheduledFor)}` : ""}</span>
        <Badge tone="neutral">Upcoming</Badge>
      </>}
      {s === "presented" && <>
        <span className="topic-card__presenter">Presented {fmtDate(topic.presentedAt)}</span>
        <a style={{ fontSize: 12, color: "var(--violet-600)", fontWeight: 500 }}>Take notes</a>
      </>}
      {s === "published" && <>
        <span className="topic-card__presenter">by {topic.presenter}</span>
        {topic.noteCount > 0 && <Badge tone="neutral" icon="note">{topic.noteCount}</Badge>}
      </>}
    </div>
  </div>;
}

// ─── Status banner ───────────────────────────────────────────────────────
function StatusBanner({ tone = "violet", title, sub, action }) {
  const cls = tone === "amber" ? "banner banner--amber" : tone === "neutral" ? "banner banner--neutral" : "banner";
  return <div className={cls}>
    <div style={{ flex: 1 }}>
      <div className="banner__title">{title}</div>
      {sub && <div className="banner__sub">{sub}</div>}
    </div>
    {action}
  </div>;
}

// ─── Tabs ────────────────────────────────────────────────────────────────
function Tabs({ items, value, onChange }) {
  return <div className="tabs">
    {items.map(it => <div key={it.id}
      className={`tab ${value === it.id ? "tab--active" : ""}`}
      onClick={() => onChange(it.id)}>
      {it.label}{it.count != null && <span className="muted" style={{ marginLeft: 6 }}>{it.count}</span>}
    </div>)}
  </div>;
}

// ─── Filter chips ────────────────────────────────────────────────────────
function Chips({ items, value, onChange }) {
  return <div className="row" style={{ gap: 4 }}>
    {items.map(it => <div key={it.id}
      className={`chip ${value === it.id ? "chip--active" : ""}`}
      onClick={() => onChange(it.id)}>
      {it.label}{it.count != null && <span className="muted" style={{ marginLeft: 6 }}>{it.count}</span>}
    </div>)}
  </div>;
}

// ─── Skeleton row ───────────────────────────────────────────────────────
function Skeleton({ w = "100%", h = 14 }) {
  return <div className="skel" style={{ width: w, height: h }} />;
}

Object.assign(window, {
  Icon, Button, Field, Input, Textarea, Select, Switch,
  Badge, Avatar, AgoraMark, AgoraWordmark,
  Modal, ToastProvider, useToast,
  ArtPlaceholder, TopicCard, StatusBanner, Tabs, Chips, Skeleton,
});
