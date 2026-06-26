/**
 * src/page/admin/SuperAdmin/Verification.jsx — v8
 *
 * Fixed in v8:
 *  - API paths corrected: /verification/${userId}/approve (no /user/ prefix)
 *  - All 5 API call sites updated (doApprove, handleReject, handleReset,
 *    handleBulkApprove, handleBulkReject)
 *  - Full error surfacing with ActionErrorBanner inside drawer
 *  - extractError helper for consistent error messages
 *  - All v4-v7 features retained
 */

import {
  useState, useEffect, useCallback,
  useMemo, useRef, memo,
} from "react";
import adminApi from "../../../../services/adminApi";
import { fmtDate, fmtDateS } from "../adminlayout/helpers";
import { Pill, Rfr } from "../adminlayout/atoms";

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════════ */
const PAGE_SIZE = 50;

const QUEUE_TABS = [
  { key: "pending",  label: "Pending"  },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "flagged",  label: "Flagged"  },
  { key: "reset",    label: "Reset"    },
  { key: "all",      label: "All"      },
];

const SORT_OPTIONS = [
  { value: "submitted_desc", label: "Newest first"  },
  { value: "submitted_asc",  label: "Oldest first"  },
  { value: "risk_desc",      label: "Highest risk"  },
  { value: "trust_asc",      label: "Lowest trust"  },
  { value: "overdue_desc",   label: "Most overdue"  },
];

const DOC_LABELS = {
  nin             : "NIN",
  passport        : "Passport",
  drivers_license : "Driver's License",
  voters_card     : "Voter's Card",
};

const STATUS_COLOR = {
  pending  : "#d97706",
  approved : "#16a34a",
  rejected : "#dc2626",
  flagged  : "#9333ea",
  reset    : "#6b7280",
  unknown  : "#6b7280",
};

const RISK_COLOR = {
  critical : "#dc2626",
  high     : "#ea580c",
  medium   : "#d97706",
  low      : "#6b7280",
};

const TIMELINE_ICONS = {
  approved : "✅",
  rejected : "❌",
  reset    : "↺",
  flagged  : "🚩",
  note     : "📝",
  assigned : "👤",
  default  : "•",
};

/* ══════════════════════════════════════════════════════════════
   STYLE TOKENS
══════════════════════════════════════════════════════════════ */
const S = {
  label: {
    display: "block", fontSize: ".75rem", fontWeight: 700,
    color: "#888", textTransform: "uppercase",
    letterSpacing: ".5px", marginBottom: 4,
  },
  textarea: {
    width: "100%", padding: "10px 12px",
    border: "1.5px solid #e8e6e0", borderRadius: 10,
    fontSize: 13, fontFamily: "inherit", resize: "vertical",
    outline: "none", boxSizing: "border-box", background: "#fff",
  },
  closeBtn: {
    border: "1.5px solid #e8e6e0", background: "#fafaf8",
    borderRadius: "50%", width: 32, height: 32,
    cursor: "pointer", fontSize: 18, color: "#555",
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  badge: (color) => ({
    display: "inline-block", padding: "2px 8px",
    borderRadius: 999, fontSize: 11, fontWeight: 700,
    background: `${color}18`, color,
    border: `1px solid ${color}40`,
  }),
  infoBox: {
    background: "#fafaf8", border: "1.5px solid #f0eeea",
    borderRadius: 12, padding: "14px 16px", marginBottom: 16, fontSize: 13,
  },
  sectionLabel: {
    fontSize: 11, fontWeight: 700, color: "#aaa",
    textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8,
  },
  statCard: {
    background: "#fafaf8", border: "1.5px solid #f0eeea",
    borderRadius: 12, padding: "14px 16px",
  },
  navBtn: {
    border: "1.5px solid #e8e6e0", background: "#fafaf8",
    borderRadius: 8, padding: "4px 10px",
    cursor: "pointer", fontSize: 14, color: "#555",
    transition: "all .15s",
  },
  iconBtn: (active) => ({
    padding: "6px 12px", borderRadius: 8,
    border: `1.5px solid ${active ? "#1a1a1a" : "#e8e6e0"}`,
    background: active ? "#1a1a1a" : "#fafaf8",
    color: active ? "#fff" : "#555",
    cursor: "pointer", fontSize: 11, fontWeight: 700,
    transition: "all .15s",
  }),
};

/* ══════════════════════════════════════════════════════════════
   UTILS
══════════════════════════════════════════════════════════════ */
const parseRiskFlags = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return [];
};

const parseDocumentsUrl = (raw) => {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return null;
};

const hoursAgo = (d) =>
  (Date.now() - new Date(d).getTime()) / 3_600_000;

const isPdfUrl = (url) => {
  if (!url) return false;
  const c = url.split("?")[0];
  return c.endsWith(".pdf") || c.includes("/pdf");
};

/** Extract best error string from Axios error */
const extractError = (err) =>
  err?.response?.data?.error ??
  err?.response?.data?.message ??
  err?.message ??
  "Unknown error";

/* ══════════════════════════════════════════════════════════════
   HOOKS
══════════════════════════════════════════════════════════════ */
function useUndoable(delayMs = 7000) {
  const [pending, setPending] = useState(null);
  const timerRef = useRef(null);

  const schedule = useCallback((label, action) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPending({ label, action });
    timerRef.current = setTimeout(async () => {
      setPending(null);
      await action();
    }, delayMs);
  }, [delayMs]);

  const undo = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPending(null);
  }, []);

  const flush = useCallback(async () => {
    if (!timerRef.current) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
    if (pending) {
      const act = pending.action;
      setPending(null);
      await act?.();
    }
  }, [pending]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return { pending, schedule, undo, flush };
}

/* ══════════════════════════════════════════════════════════════
   SMALL COMPONENTS
══════════════════════════════════════════════════════════════ */
function StatusBadge({ status }) {
  const s = status ?? "unknown";
  return (
    <span style={S.badge(STATUS_COLOR[s] ?? "#6b7280")}>
      {s.charAt(0).toUpperCase() + s.slice(1)}
    </span>
  );
}

function OverdueBadge({ createdAt }) {
  if (!createdAt) return null;
  const hours = hoursAgo(createdAt);
  if (hours < 24) return null;
  return (
    <span style={{ ...S.badge("#dc2626"), fontSize: 10, marginLeft: 4 }}>
      {Math.floor(hours / 24)}d overdue
    </span>
  );
}

function RiskBadge({ score }) {
  if (!score || score === 0) return null;
  const color =
    score >= 80 ? "#dc2626" :
    score >= 50 ? "#ea580c" :
    score >= 20 ? "#d97706" : "#6b7280";
  return <span style={S.badge(color)}>Risk {score}</span>;
}

function TrustScore({ score }) {
  const n = score ?? 0;
  const color = n >= 60 ? "#16a34a" : n >= 30 ? "#d97706" : "#dc2626";
  return <span style={{ fontWeight: 700, color }}>{n}</span>;
}

/* ── Action Error Banner ── */
function ActionErrorBanner({ error, onDismiss }) {
  if (!error) return null;
  return (
    <div style={{
      padding: "10px 14px",
      background: "#fef2f2",
      border: "1.5px solid #fecaca",
      borderRadius: 10,
      fontSize: 12,
      color: "#991b1b",
      display: "flex",
      alignItems: "flex-start",
      gap: 8,
      marginBottom: 8,
    }}>
      <span style={{ flexShrink: 0, fontSize: 14 }}>⚠</span>
      <div style={{ flex: 1 }}>
        <strong style={{ display: "block", marginBottom: 2 }}>
          Action failed
        </strong>
        {error}
      </div>
      <button
        onClick={onDismiss}
        style={{
          background: "none", border: "none",
          color: "#991b1b", cursor: "pointer",
          fontSize: 18, padding: 0, lineHeight: 1,
          flexShrink: 0,
        }}
        aria-label="Dismiss error"
      >
        ×
      </button>
    </div>
  );
}

/* ── Toast ── */
function Toast({ message, type = "success", onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 9999,
      background: type === "error" ? "#dc2626" : "#1a1a1a",
      color: "#fff", padding: "12px 20px", borderRadius: 12,
      fontSize: 13, fontWeight: 600,
      boxShadow: "0 8px 24px rgba(0,0,0,.25)",
      animation: "slideUp .25s ease",
      maxWidth: 420,
    }}>
      {message}
    </div>
  );
}

/* ── Undo Toast ── */
function UndoToast({ label, onUndo, onClose }) {
  const [progress, setProgress] = useState(100);
  const DELAY = 7000;

  useEffect(() => {
    const start = Date.now();
    const tick = setInterval(() => {
      const pct = Math.max(0, 100 - ((Date.now() - start) / DELAY) * 100);
      setProgress(pct);
      if (pct === 0) clearInterval(tick);
    }, 50);
    return () => clearInterval(tick);
  }, []);

  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 9999,
      background: "#1a1a1a", color: "#fff",
      borderRadius: 14, overflow: "hidden",
      boxShadow: "0 8px 32px rgba(0,0,0,.3)",
      animation: "slideUp .25s ease", minWidth: 280,
    }}>
      <div style={{ height: 3, background: "rgba(255,255,255,.15)" }}>
        <div style={{
          height: "100%", width: `${progress}%`,
          background: "#16a34a", transition: "width .05s linear",
        }} />
      </div>
      <div style={{
        padding: "12px 16px",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{label}</span>
        <button onClick={onUndo} style={{
          background: "rgba(255,255,255,.15)",
          border: "1px solid rgba(255,255,255,.25)",
          color: "#fff", borderRadius: 6,
          padding: "4px 12px", fontSize: 12,
          cursor: "pointer", fontWeight: 700,
        }}>
          Undo
        </button>
        <button onClick={onClose} style={{
          background: "none", border: "none",
          color: "rgba(255,255,255,.5)",
          cursor: "pointer", fontSize: 16, padding: 0,
        }}>
          ×
        </button>
      </div>
    </div>
  );
}

/* ── Bulk Progress Bar ── */
function BulkProgressBar({ current, total }) {
  const pct = total > 0 ? (current / total) * 100 : 0;
  return (
    <div style={{ minWidth: 180 }}>
      <div style={{
        display: "flex", justifyContent: "space-between",
        fontSize: 11, fontWeight: 700, color: "#555", marginBottom: 4,
      }}>
        <span>Processing…</span>
        <span>{current} / {total}</span>
      </div>
      <div style={{
        height: 6, background: "#f0eeea",
        borderRadius: 999, overflow: "hidden",
      }}>
        <div style={{
          height: "100%", width: `${pct}%`,
          background: "linear-gradient(90deg,#16a34a,#15803d)",
          borderRadius: 999, transition: "width .2s ease",
        }} />
      </div>
    </div>
  );
}

/* ── Filter Chip ── */
function FilterChip({ label, active, onClick, color = "#1a1a1a" }) {
  return (
    <button onClick={onClick} style={{
      padding: "4px 12px", borderRadius: 999, cursor: "pointer",
      border: `1.5px solid ${active ? color : "#e8e6e0"}`,
      background: active ? `${color}12` : "#fff",
      color: active ? color : "#888",
      fontWeight: 700, fontSize: 11,
      transition: "all .15s", whiteSpace: "nowrap",
    }}>
      {active && "✓ "}{label}
    </button>
  );
}

/* ── Image Lightbox ── */
function ImageLightbox({ url, label, onClose }) {
  const [zoom, setZoom]     = useState(1);
  const [rotate, setRotate] = useState(0);
  const [pan, setPan]       = useState({ x: 0, y: 0 });
  const [isDrag, setIsDrag] = useState(false);
  const dragOrigin = useRef(null);
  const panStart   = useRef(null);

  const zoomIn  = () => setZoom((z) => Math.min(+(z + 0.25).toFixed(2), 5));
  const zoomOut = () => setZoom((z) => Math.max(+(z - 0.25).toFixed(2), 0.25));
  const rot     = () => setRotate((r) => (r + 90) % 360);
  const reset   = () => { setZoom(1); setRotate(0); setPan({ x: 0, y: 0 }); };

  useEffect(() => {
    const h = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "+" || e.key === "=") zoomIn();
      if (e.key === "-") zoomOut();
      if (e.key === "r" || e.key === "R") rot();
      if (e.key === "0") reset();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]); // eslint-disable-line

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    setZoom((z) =>
      Math.min(Math.max(+(z - e.deltaY * 0.001).toFixed(2), 0.25), 5)
    );
  }, []);

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1200,
        background: "rgba(0,0,0,.93)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        userSelect: "none",
      }}
      onClick={onClose}
      onMouseMove={(e) => {
        if (isDrag && dragOrigin.current) {
          setPan({
            x: panStart.current.x + (e.clientX - dragOrigin.current.x),
            y: panStart.current.y + (e.clientY - dragOrigin.current.y),
          });
        }
      }}
      onMouseUp={() => { setIsDrag(false); dragOrigin.current = null; }}
    >
      {/* Toolbar */}
      <div
        style={{ position: "absolute", top: 16, display: "flex", gap: 8 }}
        onClick={(e) => e.stopPropagation()}
      >
        {[
          ["＋", "Zoom in (+)", zoomIn],
          ["－", "Zoom out (−)", zoomOut],
          ["↻", "Rotate (R)", rot],
          ["Reset", "Reset (0)", reset],
        ].map(([lbl, title, fn]) => (
          <button
            key={lbl} title={title} onClick={fn}
            style={{
              background: "rgba(255,255,255,.12)",
              border: "1px solid rgba(255,255,255,.2)",
              color: "#fff", borderRadius: 8,
              padding: "6px 14px", fontSize: 13,
              cursor: "pointer", fontWeight: 600,
            }}
          >
            {lbl}
          </button>
        ))}
        <a
          href={url} download target="_blank" rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{
            background: "rgba(255,255,255,.12)",
            border: "1px solid rgba(255,255,255,.2)",
            color: "#fff", borderRadius: 8,
            padding: "6px 14px", fontSize: 13,
            fontWeight: 600, textDecoration: "none",
          }}
        >
          ↓
        </a>
        <button
          onClick={onClose}
          style={{
            background: "rgba(220,38,38,.7)",
            border: "none", color: "#fff", borderRadius: 8,
            padding: "6px 14px", fontSize: 13,
            cursor: "pointer", fontWeight: 600,
          }}
        >
          ✕
        </button>
      </div>

      {/* Image */}
      <img
        src={url} alt={label} draggable={false}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => {
          if (zoom <= 1) return;
          setIsDrag(true);
          dragOrigin.current = { x: e.clientX, y: e.clientY };
          panStart.current = { ...pan };
        }}
        onWheel={handleWheel}
        style={{
          maxWidth: "88vw", maxHeight: "80vh",
          objectFit: "contain",
          transform: `scale(${zoom}) rotate(${rotate}deg) translate(${pan.x / zoom}px,${pan.y / zoom}px)`,
          transformOrigin: "center",
          transition: isDrag ? "none" : "transform .15s ease",
          cursor: zoom > 1 ? (isDrag ? "grabbing" : "grab") : "zoom-in",
        }}
      />

      {/* Footer */}
      <div style={{
        position: "absolute", bottom: 16,
        fontSize: 11, color: "rgba(255,255,255,.45)",
        fontWeight: 500, pointerEvents: "none",
      }}>
        {label} · {Math.round(zoom * 100)}% · {rotate}°
        · Scroll=zoom · R=rotate · 0=reset · Esc=close
      </div>
    </div>
  );
}

/* ── Image Viewer ── */
function ImageViewer({ url, label }) {
  const [lightbox, setLightbox] = useState(false);
  if (!url) return null;

  if (isPdfUrl(url)) {
    return (
      <div style={{ marginBottom: 12 }}>
        <label style={S.label}>{label}</label>
        <a
          href={url} target="_blank" rel="noopener noreferrer"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 14px", background: "#f5f4f0",
            borderRadius: 8, fontSize: 13, color: "#ff5722",
            textDecoration: "none", border: "1.5px solid #e8e6e0",
          }}
        >
          📄 View PDF ↗
        </a>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <label style={S.label}>{label}</label>
      <div
        onClick={() => setLightbox(true)}
        style={{
          position: "relative", cursor: "zoom-in",
          display: "inline-block", width: "100%",
        }}
      >
        <img
          src={url} alt={label}
          style={{
            width: "100%", maxHeight: 200, objectFit: "cover",
            borderRadius: 10, border: "1.5px solid #e8e6e0",
            display: "block",
          }}
        />
        <div style={{
          position: "absolute", bottom: 8, right: 8,
          background: "rgba(0,0,0,.55)", color: "#fff",
          borderRadius: 6, padding: "2px 8px",
          fontSize: 10, fontWeight: 600,
        }}>
          Click to zoom
        </div>
      </div>
      {lightbox && (
        <ImageLightbox
          url={url} label={label}
          onClose={() => setLightbox(false)}
        />
      )}
    </div>
  );
}

/* ── Notes Panel ── */
function NotesPanel({ identityId }) {
  const [notes, setNotes]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving]   = useState(false);

  const load = useCallback(async () => {
    if (!identityId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await adminApi.get(
        `/verification/identity/${identityId}`
      );
      setNotes(data.notes ?? []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [identityId]);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!newNote.trim() || !identityId) return;
    setSaving(true);
    try {
      await adminApi.post(
        `/verification/identity/${identityId}/note`,
        { note: newNote.trim() }
      );
      setNewNote("");
      await load();
    } catch (err) {
      console.error("[notes]", err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={S.sectionLabel}>Review Notes</div>

      {loading ? (
        <div style={{ fontSize: 12, color: "#aaa", marginBottom: 8 }}>
          Loading notes…
        </div>
      ) : notes.length === 0 ? (
        <div style={{ fontSize: 12, color: "#aaa", marginBottom: 8 }}>
          No notes yet.
        </div>
      ) : (
        <div style={{
          maxHeight: 180, overflowY: "auto", marginBottom: 10,
          display: "flex", flexDirection: "column", gap: 6,
        }}>
          {notes.map((n) => (
            <div key={n.id} style={{
              padding: "8px 12px", background: "#f9f8f5",
              border: "1px solid #f0eeea", borderRadius: 8, fontSize: 12,
            }}>
              <div style={{
                display: "flex", justifyContent: "space-between",
                marginBottom: 3,
              }}>
                <span style={{ fontWeight: 700, color: "#555" }}>
                  {n.admin_name}
                </span>
                <span style={{ color: "#aaa", fontSize: 11 }}>
                  {fmtDateS(n.created_at)}
                </span>
              </div>
              <div style={{
                display: "flex", gap: 6, alignItems: "center",
                flexWrap: "wrap",
              }}>
                <StatusBadge status={n.action} />
                <span style={{ color: "#333" }}>{n.note}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Add a note…"
          style={{
            flex: 1, padding: "8px 12px",
            border: "1.5px solid #e8e6e0",
            borderRadius: 8, fontSize: 12, outline: "none",
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button
          className="btn b-ghost"
          disabled={!newNote.trim() || saving}
          onClick={submit}
          style={{ fontSize: 11, padding: "6px 12px" }}
        >
          {saving ? "…" : "Add"}
        </button>
      </div>
    </div>
  );
}

/* ── Risk Flags Panel ── */
function RiskFlagsPanel({ riskScore, riskFlags }) {
  const score = riskScore ?? 0;
  const flags = parseRiskFlags(riskFlags);
  if (score === 0 && flags.length === 0) return null;

  return (
    <div style={{
      marginBottom: 16, padding: "12px 14px",
      background: score >= 80 ? "#fef2f2" : "#fffbeb",
      border: `1px solid ${score >= 80 ? "#fecaca" : "#fde68a"}`,
      borderRadius: 10,
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        marginBottom: flags.length ? 8 : 0,
      }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>
          Risk Score: {score}
        </span>
        <RiskBadge score={score} />
      </div>
      {flags.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {flags.map((f, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 6, fontSize: 12,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%",
                flexShrink: 0,
                background: RISK_COLOR[f.severity] ?? "#6b7280",
              }} />
              <span style={{ fontWeight: 600, color: "#555" }}>
                {String(f.type ?? "").replace(/_/g, " ")}:
              </span>
              <span style={{ color: "#888" }}>{f.detail}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Duplicate Warnings ── */
function DuplicateWarnings({ warnings }) {
  const [expanded, setExpanded] = useState(false);
  if (!warnings?.length) return null;
  const shown = expanded ? warnings : warnings.slice(0, 2);

  return (
    <div style={{
      marginBottom: 16, padding: "12px 14px",
      background: "#fef2f2", border: "1.5px solid #fecaca",
      borderRadius: 10,
    }}>
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between", marginBottom: 8,
      }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: "#dc2626" }}>
          ⚠ {warnings.length} Duplicate Signal{warnings.length > 1 ? "s" : ""}
        </span>
        {warnings.filter((w) => w.severity === "critical").length > 0 && (
          <span style={S.badge("#dc2626")}>
            {warnings.filter((w) => w.severity === "critical").length} Critical
          </span>
        )}
      </div>
      {shown.map((w, i) => (
        <div key={i} style={{
          fontSize: 12, color: "#7f1d1d",
          display: "flex", alignItems: "flex-start",
          gap: 6, marginBottom: 5,
        }}>
          <span style={{ flexShrink: 0 }}>
            {w.severity === "critical" ? "🔴" : "🟡"}
          </span>
          <div>
            <strong style={{ textTransform: "capitalize" }}>
              {String(w.type ?? "").replace(/_/g, " ")}:
            </strong>{" "}
            {w.detail}
            {w.matching_user_ids?.length > 0 && (
              <span style={{ color: "#aaa", fontSize: 11 }}>
                {" "}(UIDs: {w.matching_user_ids.join(", ")})
              </span>
            )}
          </div>
        </div>
      ))}
      {warnings.length > 2 && (
        <button
          onClick={() => setExpanded((x) => !x)}
          style={{
            background: "none", border: "none",
            color: "#dc2626", fontSize: 11,
            fontWeight: 700, cursor: "pointer",
            padding: "2px 0",
          }}
        >
          {expanded ? "Show less" : `Show ${warnings.length - 2} more…`}
        </button>
      )}
    </div>
  );
}

/* ── Verification Timeline ── */
function VerificationTimeline({ events }) {
  if (!events?.length) return null;
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={S.sectionLabel}>Timeline</div>
      <div style={{
        position: "relative", paddingLeft: 24,
        borderLeft: "2px solid #f0eeea",
        display: "flex", flexDirection: "column", gap: 14,
      }}>
        {events.map((ev, i) => (
          <div key={i} style={{ position: "relative", paddingLeft: 10 }}>
            <div style={{
              position: "absolute", left: -21, top: 2,
              width: 10, height: 10, borderRadius: "50%",
              background: STATUS_COLOR[ev.type] ?? "#e8e6e0",
              border: "2px solid #fff",
              boxShadow: "0 0 0 1.5px #e8e6e0",
            }} />
            <div style={{
              fontSize: 12, fontWeight: 700, color: "#333",
              marginBottom: 1,
            }}>
              {TIMELINE_ICONS[ev.type] ?? TIMELINE_ICONS.default} {ev.label}
            </div>
            <div style={{ fontSize: 11, color: "#aaa" }}>
              {fmtDateS(ev.created_at)}
              {ev.admin_name && (
                <span style={{ marginLeft: 6, color: "#bbb" }}>
                  · {ev.admin_name}
                </span>
              )}
            </div>
            {ev.note && (
              <div style={{
                fontSize: 11, color: "#888", marginTop: 3,
                fontStyle: "italic", background: "#fafaf8",
                padding: "4px 8px", borderRadius: 6,
                border: "1px solid #f0eeea",
              }}>
                "{ev.note}"
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MODALS
══════════════════════════════════════════════════════════════ */
function RejectModal({ title, onSubmit, onClose }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy]     = useState(false);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const submit = async () => {
    if (!reason.trim()) return;
    setBusy(true);
    try { await onSubmit(reason.trim()); }
    finally { setBusy(false); onClose(); }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 460 }}
      >
        <div className="modal-title" style={{ color: "#dc2626" }}>
          {title}
        </div>
        <label style={S.label}>Reason (required)</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder='e.g. "Documents are unclear"'
          style={S.textarea}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.metaKey) submit();
          }}
        />
        <div className="modal-btns" style={{ marginTop: 14 }}>
          <button className="btn b-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn b-red"
            disabled={!reason.trim() || busy}
            onClick={submit}
          >
            {busy ? "Submitting…" : "Confirm Reject"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ResetModal({ title, onSubmit, onClose }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const submit = async () => {
    setBusy(true);
    try { await onSubmit(note.trim() || null); }
    finally { setBusy(false); onClose(); }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 460 }}
      >
        <div className="modal-title">Reset Verification</div>
        <p style={{ fontSize: ".82rem", color: "#888", marginBottom: 12 }}>
          The user's verified status will be cleared and they will be asked
          to resubmit. A resubmission email will be sent automatically.
        </p>
        <label style={S.label}>Note to user (optional)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="e.g. Resubmit with clearer photos"
          style={S.textarea}
          autoFocus
        />
        <div className="modal-btns" style={{ marginTop: 14 }}>
          <button className="btn b-ghost" onClick={onClose}>Cancel</button>
          <button className="btn b-solid" disabled={busy} onClick={submit}>
            {busy ? "Resetting…" : "Reset & Allow Resubmit"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   VERIFICATION DRAWER
══════════════════════════════════════════════════════════════ */
function VerificationDrawer({
  record, totalCount, currentIndex,
  onClose, onPrev, onNext,
  onApprove, onReject, onReset,
  busy, onToast,
}) {
  const [actionError, setActionError]   = useState(null);
  const [assignBusy, setAssignBusy]     = useState(false);
  const [recalcBusy, setRecalcBusy]     = useState(false);

  /* Clear error when navigating */
  useEffect(() => { setActionError(null); }, [record?.identity_id]);

  if (!record) return null;

  const isPending  = record.identity_status === "pending";
  const isApproved = record.identity_status === "approved";
  const isFlagged  = record.identity_status === "flagged";
  const isRejected = record.identity_status === "rejected";
  const isBusy     = busy === `approve-${record.user_id}`;
  const hasPrev    = currentIndex > 0;
  const hasNext    = currentIndex < totalCount - 1;
  const logoUrl    = parseDocumentsUrl(record.store_documents)?.logo_url ?? null;

  /* Keyboard shortcuts */
  useEffect(() => {
    const h = (e) => {
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Escape")                    onClose();
      if (e.key === "ArrowLeft"  && hasPrev)     onPrev();
      if (e.key === "ArrowRight" && hasNext)     onNext();
      if (e.key === "a" && isPending) {
        setActionError(null);
        onApprove(record.user_id, { onError: setActionError });
      }
      if (e.key === "r" && isPending) onReject(record);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [
    onClose, onPrev, onNext, onApprove, onReject,
    hasPrev, hasNext, isPending, record,
  ]);

  const handleApproveClick = () => {
    setActionError(null);
    onApprove(record.user_id, { onError: setActionError });
  };

  const handleAssign = async () => {
    setAssignBusy(true);
    try {
      await adminApi.post(
        `/verification/identity/${record.identity_id}/assign`
      );
      onToast?.("Assigned to you");
    } catch (err) {
      onToast?.("Assignment failed: " + extractError(err), "error");
    } finally {
      setAssignBusy(false);
    }
  };

  const handleRecalcTrust = async () => {
    setRecalcBusy(true);
    try {
      const { data } = await adminApi.post(
        `/verification/trust/${record.user_id}/recalculate`
      );
      onToast?.(`Trust score updated to ${data.trust_score}`);
    } catch (err) {
      onToast?.(
        "Trust recalculation failed: " + extractError(err),
        "error"
      );
    } finally {
      setRecalcBusy(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 600, display: "flex",
    }}>
      {/* Backdrop */}
      <div
        style={{
          flex: 1, background: "rgba(0,0,0,.45)", cursor: "pointer",
        }}
        onClick={onClose}
      />

      {/* Panel */}
      <div style={{
        width: "min(620px,100%)", background: "#fff",
        display: "flex", flexDirection: "column",
        boxShadow: "-8px 0 32px rgba(0,0,0,.15)",
        overflow: "hidden",
      }}>

        {/* Header */}
        <div style={{
          padding: "14px 20px",
          borderBottom: "1px solid #f0eeea",
          display: "flex", alignItems: "center",
          justifyContent: "space-between", gap: 12,
          flexShrink: 0,
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>
              Verification Review
            </div>
            <div style={{
              fontSize: 12, color: "#888", marginTop: 2,
              overflow: "hidden", textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {record.user_name} · {record.user_email}
            </div>
          </div>
          <div style={{
            display: "flex", alignItems: "center",
            gap: 8, flexShrink: 0,
          }}>
            <button
              onClick={onPrev} disabled={!hasPrev}
              title="Previous (←)" aria-label="Previous"
              style={{
                ...S.navBtn,
                opacity: hasPrev ? 1 : .35,
                cursor: hasPrev ? "pointer" : "default",
              }}
            >
              ←
            </button>
            <span style={{
              fontSize: 11, color: "#aaa", fontWeight: 700,
              whiteSpace: "nowrap",
            }}>
              {currentIndex + 1} / {totalCount}
            </span>
            <button
              onClick={onNext} disabled={!hasNext}
              title="Next (→)" aria-label="Next"
              style={{
                ...S.navBtn,
                opacity: hasNext ? 1 : .35,
                cursor: hasNext ? "pointer" : "default",
              }}
            >
              →
            </button>
            <button
              onClick={onClose} style={S.closeBtn}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>

          {/* Status row */}
          <div style={{
            display: "flex", gap: 8, flexWrap: "wrap",
            alignItems: "center", marginBottom: 16,
          }}>
            <span style={{
              fontSize: 12, fontWeight: 700, color: "#888",
            }}>
              Identity:
            </span>
            <StatusBadge status={record.identity_status} />
            <span style={{
              fontSize: 12, fontWeight: 700, color: "#888",
              marginLeft: 8,
            }}>
              Store:
            </span>
            <StatusBadge status={record.store_status ?? "pending"} />
            {record.flagged_for_review && (
              <span style={S.badge("#9333ea")}>Flagged</span>
            )}
            <RiskBadge score={record.risk_score} />
            {isPending && <OverdueBadge createdAt={record.submitted_at} />}
          </div>

          {/* Keyboard hint */}
          {isPending && (
            <div style={{
              fontSize: 10, color: "#bbb", marginBottom: 12,
              display: "flex", gap: 10, flexWrap: "wrap",
            }}>
              <span>⌨ <strong>A</strong>=Approve</span>
              <span><strong>R</strong>=Reject</span>
              <span><strong>←→</strong>=Navigate</span>
              <span><strong>Esc</strong>=Close</span>
            </div>
          )}

          <DuplicateWarnings warnings={record.duplicate_warnings} />
          <RiskFlagsPanel
            riskScore={record.risk_score}
            riskFlags={record.risk_flags}
          />

          {record.rejection_reason && (
            <div style={{
              background: "#fff5f5", border: "1px solid #fecaca",
              borderRadius: 10, padding: "10px 14px",
              fontSize: 12, color: "#991b1b", marginBottom: 16,
            }}>
              <strong>Rejection reason:</strong> {record.rejection_reason}
            </div>
          )}

          {record.face_match !== null && record.face_match !== undefined && (
            <div style={{
              marginBottom: 16, padding: "10px 14px",
              borderRadius: 10, fontSize: 12,
              background: record.face_match
                ? "#f0fdf4"
                : record.face_skipped ? "#fffbeb" : "#fef2f2",
              border: `1px solid ${
                record.face_match
                  ? "#bbf7d0"
                  : record.face_skipped ? "#fde68a" : "#fecaca"
              }`,
            }}>
              {record.face_skipped ? (
                <span style={{ color: "#d97706" }}>
                  ⚠ Face check skipped — manual review required
                </span>
              ) : record.face_match ? (
                <span style={{ color: "#16a34a" }}>
                  ✓ Face match confirmed
                  {record.face_confidence != null &&
                    ` (${Math.round(record.face_confidence * 100)}% confidence)`}
                </span>
              ) : (
                <span style={{ color: "#dc2626" }}>
                  ✗ Face mismatch detected
                </span>
              )}
            </div>
          )}

          {/* Submission details */}
          <div style={S.infoBox}>
            <div style={S.sectionLabel}>Submission Details</div>
            <div style={{ display: "grid", gap: 6 }}>
              <div>
                <span style={{ color: "#888" }}>Document type: </span>
                <strong>
                  {DOC_LABELS[record.document_type] ?? record.document_type}
                </strong>
              </div>
              <div>
                <span style={{ color: "#888" }}>Submitted: </span>
                <strong>{fmtDate(record.submitted_at)}</strong>
              </div>
              {record.reviewed_at && (
                <div>
                  <span style={{ color: "#888" }}>Last reviewed: </span>
                  <strong>{fmtDate(record.reviewed_at)}</strong>
                </div>
              )}
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <span style={{ color: "#888" }}>Assigned to: </span>
                {record.assigned_admin_name ? (
                  <strong>{record.assigned_admin_name}</strong>
                ) : (
                  <>
                    <span style={{ color: "#aaa", fontSize: 12 }}>
                      Unassigned
                    </span>
                    {isPending && (
                      <button
                        className="btn b-ghost"
                        onClick={handleAssign}
                        disabled={assignBusy}
                        style={{
                          fontSize: 10, padding: "2px 8px", height: 22,
                        }}
                      >
                        {assignBusy ? "…" : "Assign to me"}
                      </button>
                    )}
                  </>
                )}
              </div>
              {record.liveness_passed != null && (
                <div>
                  <span style={{ color: "#888" }}>Liveness: </span>
                  <strong>
                    {record.liveness_passed ? "✓ Passed" : "✗ Not passed"}
                  </strong>
                </div>
              )}
            </div>
          </div>

          {/* Documents */}
          <div style={S.sectionLabel}>Identity Documents</div>
          <ImageViewer url={record.front_image_url} label="Document Front" />
          <ImageViewer url={record.back_image_url}  label="Document Back"  />
          <ImageViewer url={record.selfie_url}       label="Selfie Photo"  />
          {record.liveness_frame_url && (
            <ImageViewer
              url={record.liveness_frame_url}
              label="Liveness Frame"
            />
          )}
          {logoUrl && (
            <>
              <div style={{ ...S.sectionLabel, marginTop: 8 }}>
                Store Document
              </div>
              <ImageViewer url={logoUrl} label="Store Logo / Business Doc" />
            </>
          )}

          {/* User info */}
          <div style={{ ...S.infoBox, fontSize: 12 }}>
            <div style={S.sectionLabel}>User Info</div>
            <div style={{ display: "grid", gap: 5 }}>
              <div>
                <span style={{ color: "#888" }}>Name: </span>
                <strong>{record.user_name}</strong>
              </div>
              <div>
                <span style={{ color: "#888" }}>Email: </span>
                <strong>{record.user_email}</strong>
              </div>
              {record.user_phone && (
                <div>
                  <span style={{ color: "#888" }}>Phone: </span>
                  <strong>{record.user_phone}</strong>
                </div>
              )}
              <div>
                <span style={{ color: "#888" }}>Email verified: </span>
                <strong style={{
                  color: record.email_verified ? "#16a34a" : "#dc2626",
                }}>
                  {record.email_verified ? "Yes" : "No"}
                </strong>
              </div>
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <span style={{ color: "#888" }}>Trust score: </span>
                <TrustScore score={record.trust_score} />
                <button
                  className="btn b-ghost"
                  onClick={handleRecalcTrust}
                  disabled={recalcBusy}
                  style={{ fontSize: 10, padding: "2px 8px", height: 22 }}
                >
                  {recalcBusy ? "…" : "Recalculate"}
                </button>
              </div>
              <div>
                <span style={{ color: "#888" }}>Account status: </span>
                <Pill s={record.user_status} />
              </div>
            </div>
          </div>

          {/* Timeline */}
          {record.timeline?.length > 0 && (
            <VerificationTimeline events={record.timeline} />
          )}

          {/* Notes */}
          {record.identity_id && (
            <NotesPanel identityId={record.identity_id} />
          )}
        </div>

        {/* ── Sticky action bar ── */}
        <div style={{
          padding: "12px 20px",
          borderTop: "1px solid #f0eeea",
          background: "#fff",
          boxShadow: "0 -4px 16px rgba(0,0,0,.06)",
          flexShrink: 0,
          display: "flex", flexDirection: "column", gap: 8,
        }}>
          {/* Error banner */}
          <ActionErrorBanner
            error={actionError}
            onDismiss={() => setActionError(null)}
          />

          {/* Pending → Approve + Reject */}
          {isPending && (
            <div style={{ display: "flex", gap: 10 }}>
              <button
                disabled={isBusy}
                onClick={handleApproveClick}
                style={{
                  flex: 1, height: 46, fontSize: 14, fontWeight: 800,
                  background: isBusy
                    ? "#9ca3af"
                    : "linear-gradient(135deg,#16a34a,#15803d)",
                  color: "#fff", border: "none", borderRadius: 10,
                  cursor: isBusy ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center",
                  justifyContent: "center", gap: 6,
                }}
              >
                {isBusy ? "Approving…" : "✓ Approve  [A]"}
              </button>
              <button
                onClick={() => { setActionError(null); onReject(record); }}
                style={{
                  flex: 1, height: 46, fontSize: 14, fontWeight: 700,
                  background: "#fff", color: "#dc2626",
                  border: "2px solid #dc2626",
                  borderRadius: 10, cursor: "pointer",
                }}
              >
                Reject  [R]
              </button>
            </div>
          )}

          {/* Approved / Flagged → Revoke */}
          {(isApproved || isFlagged) && (
            <button
              onClick={() => onReset(record)}
              style={{
                width: "100%", height: 40, fontSize: 13, fontWeight: 600,
                background: "#fffbeb", color: "#d97706",
                border: "1.5px solid #fde68a",
                borderRadius: 10, cursor: "pointer",
              }}
            >
              Revoke & Request Resubmission
            </button>
          )}

          {/* Rejected → Approve Anyway + Resubmit */}
          {isRejected && (
            <>
              <button
                disabled={isBusy}
                onClick={handleApproveClick}
                style={{
                  width: "100%", height: 46, fontSize: 14, fontWeight: 800,
                  background: isBusy
                    ? "#9ca3af"
                    : "linear-gradient(135deg,#16a34a,#15803d)",
                  color: "#fff", border: "none",
                  borderRadius: 10,
                  cursor: isBusy ? "not-allowed" : "pointer",
                }}
              >
                {isBusy ? "Approving…" : "✓ Approve Anyway"}
              </button>
              <button
                onClick={() => onReset(record)}
                style={{
                  width: "100%", height: 40, fontSize: 13, fontWeight: 600,
                  background: "#fffbeb", color: "#d97706",
                  border: "1.5px solid #fde68a",
                  borderRadius: 10, cursor: "pointer",
                }}
              >
                Allow Resubmission
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   TABLE ROW
══════════════════════════════════════════════════════════════ */
const TableRow = memo(function TableRow({
  r, isSelected, showCheckbox, isBusy,
  onSelect, onView, onApprove, onReject, confirm,
}) {
  return (
    <tr
      style={{
        borderBottom: "1px solid #f5f4f0",
        cursor: "pointer",
        background: isSelected ? "#fff7ed" : "transparent",
        transition: "background .12s",
      }}
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.background = "#fafaf8";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background =
          isSelected ? "#fff7ed" : "transparent";
      }}
      onClick={() => onView(r)}
    >
      {showCheckbox && (
        <td
          style={{ padding: "10px 6px" }}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelect(r.user_id)}
            style={{ cursor: "pointer" }}
          />
        </td>
      )}
      <td style={{ padding: "10px 10px" }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>{r.user_name}</div>
        <div style={{ fontSize: 11, color: "#888" }}>{r.user_email}</div>
      </td>
      <td style={{ padding: "10px 10px" }}>
        <span style={S.badge("#6b7280")}>
          {DOC_LABELS[r.document_type] ?? r.document_type ?? "—"}
        </span>
      </td>
      <td style={{ padding: "10px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <StatusBadge status={r.identity_status} />
          {r.identity_status === "pending" && (
            <OverdueBadge createdAt={r.submitted_at} />
          )}
        </div>
      </td>
      <td style={{ padding: "10px 10px" }}>
        <StatusBadge status={r.store_status ?? "pending"} />
      </td>
      <td style={{ padding: "10px 10px" }}>
        {r.duplicate_warnings?.length > 0 && (
          <span
            title={`${r.duplicate_warnings.length} duplicate signal(s)`}
            style={{ marginRight: 4 }}
          >
            ⚠
          </span>
        )}
        <RiskBadge score={r.risk_score} />
      </td>
      <td style={{ padding: "10px 10px" }}>
        <TrustScore score={r.trust_score} />
      </td>
      <td style={{
        padding: "10px 10px", color: "#888",
        whiteSpace: "nowrap", fontSize: 12,
      }}>
        {fmtDateS(r.submitted_at)}
      </td>
      <td
        style={{ padding: "10px 10px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", gap: 6 }}>
          {r.identity_status === "pending" && (
            <>
              <button
                className="btn b-solid"
                disabled={isBusy}
                onClick={() => confirm({
                  title: "Approve submission?",
                  body: `Approve ${r.user_name}'s identity and store together?`,
                  confirm: "Approve",
                  action: () => onApprove(r.user_id),
                })}
                style={{ fontSize: 11, padding: "4px 10px", height: 28 }}
              >
                {isBusy ? "…" : "Approve"}
              </button>
              <button
                className="btn b-red"
                onClick={() => onReject(r)}
                style={{ fontSize: 11, padding: "4px 10px", height: 28 }}
              >
                Reject
              </button>
            </>
          )}
          <button
            className="btn b-ghost"
            onClick={() => onView(r)}
            style={{ fontSize: 11, padding: "4px 10px", height: 28 }}
          >
            View
          </button>
        </div>
      </td>
    </tr>
  );
});

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
export default function Verification({ confirm, onMutation }) {
  /* ── State ── */
  const [activeTab,    setActiveTab]    = useState("pending");
  const [list,         setList]         = useState([]);
  const [stats,        setStats]        = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [busy,         setBusy]         = useState(null);
  const [drawerId,     setDrawerId]     = useState(null);
  const [rejectModal,  setRejectModal]  = useState(null);
  const [resetModal,   setResetModal]   = useState(null);
  const [q,            setQ]            = useState("");
  const [toast,        setToast]        = useState(null);
  const [hasMore,      setHasMore]      = useState(false);
  const [selected,     setSelected]     = useState(new Set());
  const [bulkProgress, setBulkProgress] = useState(null);
  const [sort,         setSort]         = useState("submitted_desc");
  const [filters,      setFilters]      = useState({
    riskHigh: false, overdue48: false, faceMismatch: false,
    unassigned: false, assignedToMe: false, noStore: false,
  });
  const [showFilters, setShowFilters] = useState(false);

  /* ── Refs ── */
  const offsetRef = useRef(0);
  const abortRef  = useRef(null);

  /* ── Undo ── */
  const undoable = useUndoable(7000);

  /* ── Toast ── */
  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
  }, []);

  /* ── Drawer record derived from list ── */
  const drawer = useMemo(
    () => list.find((r) => r.identity_id === drawerId) ?? null,
    [list, drawerId]
  );

  /* ── Filtered + sorted list ── */
  const displayedAll = useMemo(() => {
    const lq = q.toLowerCase().trim();
    let out = lq
      ? list.filter((r) =>
          (r.user_name ?? "").toLowerCase().includes(lq) ||
          (r.user_email ?? "").toLowerCase().includes(lq) ||
          (r.document_type ?? "").toLowerCase().includes(lq)
        )
      : [...list];

    if (filters.riskHigh)     out = out.filter((r) => (r.risk_score ?? 0) >= 80);
    if (filters.overdue48)    out = out.filter((r) => hoursAgo(r.submitted_at) >= 48);
    if (filters.faceMismatch) out = out.filter((r) => r.face_match === false);
    if (filters.unassigned)   out = out.filter((r) => !r.assigned_admin_id);
    if (filters.noStore)      out = out.filter((r) => !r.store_id);

    out.sort((a, b) => {
      if (sort === "submitted_asc")
        return new Date(a.submitted_at) - new Date(b.submitted_at);
      if (sort === "submitted_desc")
        return new Date(b.submitted_at) - new Date(a.submitted_at);
      if (sort === "risk_desc")
        return (b.risk_score ?? 0) - (a.risk_score ?? 0);
      if (sort === "trust_asc")
        return (a.trust_score ?? 0) - (b.trust_score ?? 0);
      if (sort === "overdue_desc")
        return hoursAgo(b.submitted_at) - hoursAgo(a.submitted_at);
      return 0;
    });

    return out;
  }, [list, q, filters, sort]);

  /* ── Drawer navigation ── */
  const drawerIndex = useMemo(
    () => drawer
      ? displayedAll.findIndex((r) => r.identity_id === drawer.identity_id)
      : -1,
    [displayedAll, drawer]
  );

  const handleDrawerPrev = useCallback(() => {
    if (drawerIndex > 0)
      setDrawerId(displayedAll[drawerIndex - 1].identity_id);
  }, [drawerIndex, displayedAll]);

  const handleDrawerNext = useCallback(() => {
    if (drawerIndex < displayedAll.length - 1)
      setDrawerId(displayedAll[drawerIndex + 1].identity_id);
  }, [drawerIndex, displayedAll]);

  /* ── Load stats ── */
  const loadStats = useCallback(async () => {
    try {
      const { data } = await adminApi.get("/verification/stats");
      setStats(data);
    } catch (err) {
      console.error("[stats]", err.message);
    }
  }, []);

  /* ── Load queue ── */
  const loadQueue = useCallback(async (append = false) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    if (!append) {
      setLoading(true);
      setSelected(new Set());
      offsetRef.current = 0;
    }

    const currentOffset = offsetRef.current;

    try {
      const { data: idData } = await adminApi.get(
        `/verification/identity?status=${activeTab}&limit=${PAGE_SIZE}&offset=${currentOffset}`,
        { signal }
      );
      const idList = idData.verifications ?? [];

      // Fetch store records for merge
      let storeMap = {};
      if (idList.length > 0) {
        try {
          const { data: stData } = await adminApi.get(
            `/verification/store?status=all&limit=200&offset=0`,
            { signal }
          );
          (stData.verifications ?? []).forEach((s) => {
            if (
              !storeMap[s.user_id] ||
              new Date(s.created_at) >
                new Date(storeMap[s.user_id].created_at)
            ) {
              storeMap[s.user_id] = s;
            }
          });
        } catch { /* store queue may be empty */ }
      }

      // Merge
      const merged = idList.map((id) => {
        const st   = storeMap[id.user_id] ?? {};
        const docs = parseDocumentsUrl(st.documents_url);
        return {
          identity_id        : id.id,
          identity_status    : id.status,
          document_type      : id.document_type,
          risk_score         : id.risk_score         ?? 0,
          risk_flags         : id.risk_flags         ?? [],
          flagged_for_review : id.flagged_for_review ?? false,
          duplicate_warnings : id.duplicate_warnings ?? [],
          timeline           : id.timeline           ?? [],
          rejection_reason   : id.rejection_reason,
          reviewed_at        : id.reviewed_at,
          assigned_admin_id  : id.assigned_admin_id,
          assigned_admin_name: id.assigned_admin_name,
          front_image_url    : id.front_image_url,
          back_image_url     : id.back_image_url,
          selfie_url         : id.selfie_url,
          liveness_frame_url : id.liveness_frame_url,
          liveness_passed    : id.liveness_passed,
          face_match         : id.face_match,
          face_confidence    : id.face_confidence,
          face_skipped       : id.face_skipped,
          submitted_at       : id.created_at,
          store_id           : st.id     ?? null,
          store_status       : st.status ?? null,
          store_documents    : docs,
          user_id            : id.user_id,
          user_name          : id.user_name,
          user_email         : id.user_email,
          user_phone         : id.user_phone,
          user_status        : id.user_status,
          email_verified     : id.email_verified,
          identity_verified  : id.identity_verified,
          trust_score        : id.trust_score,
        };
      });

      if (append) setList((prev) => [...prev, ...merged]);
      else        setList(merged);

      offsetRef.current = currentOffset + idList.length;
      setHasMore(idList.length === PAGE_SIZE);

    } catch (err) {
      if (err.name === "CanceledError" || err.name === "AbortError") return;
      const msg = err.response?.data?.error ?? err.message;
      console.error("[queue]", msg);
      showToast("Failed to load queue: " + msg, "error");
    } finally {
      setLoading(false);
    }
  }, [activeTab, showToast]);

  /* Tab change → reload */
  useEffect(() => {
    setSelected(new Set());
    loadQueue();
  }, [activeTab]); // eslint-disable-line

  /* Stats on mount */
  useEffect(() => { loadStats(); }, [loadStats]);

  /* Abort on unmount */
  useEffect(() => () => abortRef.current?.abort(), []);

  /* After mutation */
  const afterMutation = useCallback(async () => {
    setSelected(new Set());
    setDrawerId(null);
    setRejectModal(null);
    setResetModal(null);
    offsetRef.current = 0;
    await Promise.all([loadQueue(), loadStats()]);
    onMutation?.();
  }, [loadQueue, loadStats, onMutation]);

  /* ══════════════════════════════════════════════════════════
     ACTIONS
     API path: /verification/${userId}/approve  (NO /user/ prefix)
  ══════════════════════════════════════════════════════════ */

  const doApprove = useCallback(async (userId, { onError } = {}) => {
    setBusy(`approve-${userId}`);
    try {
      await adminApi.post(`/verification/${userId}/approve`, {
        note: "Approved via admin panel.",
      });
      await afterMutation();
      showToast("✓ Approved — identity & store verified. Email sent.");
    } catch (err) {
      const detail = extractError(err);
      const status = err.response?.status;
      const msg    = status ? `(${status}) ${detail}` : detail;

      showToast(`Approval failed: ${msg}`, "error");
      onError?.(msg);

      console.error("[approve] failed", {
        userId, status, detail,
        data: err.response?.data,
      });
    } finally {
      setBusy(null);
    }
  }, [afterMutation, showToast]);

  const handleApprove = useCallback((userId, callbacks = {}) => {
    undoable.schedule(
      `✓ Approving ${
        list.find((r) => r.user_id === userId)?.user_name ?? "user"
      }…`,
      () => doApprove(userId, callbacks)
    );
  }, [undoable, doApprove, list]);

  const handleReject = useCallback(async (userId, reason) => {
    setBusy(`reject-${userId}`);
    try {
      await adminApi.post(`/verification/${userId}/reject`, { reason });
      showToast("✗ Rejected — rejection email sent.");
      await afterMutation();
    } catch (err) {
      showToast("Rejection failed: " + extractError(err), "error");
      console.error("[reject] failed", {
        userId,
        status: err.response?.status,
        detail: extractError(err),
      });
    } finally {
      setBusy(null);
    }
  }, [afterMutation, showToast]);

  const handleReset = useCallback(async (userId, note) => {
    setBusy(`reset-${userId}`);
    try {
      await adminApi.post(`/verification/${userId}/reset`, { note });
      showToast("↺ Reset — resubmission email sent.");
      await afterMutation();
    } catch (err) {
      showToast("Reset failed: " + extractError(err), "error");
      console.error("[reset] failed", {
        userId,
        status: err.response?.status,
        detail: extractError(err),
      });
    } finally {
      setBusy(null);
    }
  }, [afterMutation, showToast]);

  /* ── Bulk approve ── */
  const handleBulkApprove = useCallback(async () => {
    if (!selected.size) return;
    const ids = [...selected];
    setBusy("bulk-approve");
    setBulkProgress({ current: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      try {
        await adminApi.post(`/verification/${ids[i]}/approve`, {
          note: "Bulk approved.",
        });
        ok++;
      } catch { /* continue */ }
      setBulkProgress({ current: i + 1, total: ids.length });
    }
    showToast(`✓ Approved ${ok} of ${ids.length} submissions`);
    setBulkProgress(null);
    setBusy(null);
    await afterMutation();
  }, [selected, afterMutation, showToast]);

  /* ── Bulk reject ── */
  const handleBulkReject = useCallback(async (reason) => {
    if (!selected.size) return;
    const ids = [...selected];
    setBusy("bulk-reject");
    setBulkProgress({ current: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      try {
        await adminApi.post(`/verification/${ids[i]}/reject`, { reason });
        ok++;
      } catch { /* continue */ }
      setBulkProgress({ current: i + 1, total: ids.length });
    }
    showToast(`✗ Rejected ${ok} of ${ids.length} submissions`);
    setBulkProgress(null);
    setBusy(null);
    await afterMutation();
  }, [selected, afterMutation, showToast]);

  /* ── Selection ── */
  const toggleSelect = useCallback((userId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelected((prev) =>
      prev.size === displayedAll.length && displayedAll.length > 0
        ? new Set()
        : new Set(displayedAll.map((r) => r.user_id))
    );
  }, [displayedAll]);

  const setFilter = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <div>
      {/* Toasts */}
      {toast && !undoable.pending && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      {undoable.pending && (
        <UndoToast
          label={undoable.pending.label}
          onUndo={() => {
            undoable.undo();
            showToast("Approval cancelled");
          }}
          onClose={() => undoable.flush()}
        />
      )}

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 20, flexWrap: "wrap", gap: 12,
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
            Verification Queue
          </h2>
          <p style={{
            margin: "4px 0 0", fontSize: 13, color: "#888",
          }}>
            One click approves identity + store together and emails the user
          </p>
        </div>
        <Rfr onClick={() => {
          if (loading) return;
          loadQueue();
          loadStats();
        }} />
      </div>

      {/* Stats */}
      {stats && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))",
          gap: 10, marginBottom: 20,
        }}>
          {[
            { label: "Pending",         value: stats.identity?.pending        ?? 0, color: "#d97706" },
            { label: "Approved",         value: stats.identity?.approved       ?? 0, color: "#16a34a" },
            { label: "Overdue (>24h)",   value: stats.identity?.overdue        ?? 0, color: "#dc2626" },
            { label: "Flagged",          value: stats.identity?.flagged        ?? 0, color: "#9333ea" },
            { label: "Email Verified",   value: stats.users?.email_verified    ?? 0, color: "#0369a1" },
            { label: "Fully Verified",   value: stats.users?.identity_verified ?? 0, color: "#15803d" },
            { label: "Limited Listings", value: stats.limited_listings?.total  ?? 0, color: "#9333ea" },
          ].map(({ label, value, color }) => (
            <div key={label} style={S.statCard}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: "#aaa",
                textTransform: "uppercase", letterSpacing: ".4px",
                marginBottom: 4,
              }}>
                {label}
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color }}>
                {(value ?? 0).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{
        display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14,
      }}>
        {QUEUE_TABS.map((t) => {
          const cnt   = stats?.identity?.[t.key] ?? 0;
          const isAct = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                padding: "6px 16px", borderRadius: 999,
                cursor: "pointer",
                border: isAct ? "none" : "1.5px solid #e8e6e0",
                background: isAct ? "#1a1a1a" : "#fafaf8",
                color: isAct ? "#fff" : "#555",
                fontWeight: 700, fontSize: 12,
                display: "flex", alignItems: "center", gap: 5,
              }}
            >
              {t.label}
              {t.key !== "all" && cnt > 0 && (
                <span style={{
                  background: isAct
                    ? "rgba(255,255,255,.2)" : "#e8e6e0",
                  color: isAct ? "#fff" : "#555",
                  borderRadius: 999, fontSize: 10, padding: "1px 6px",
                }}>
                  {cnt}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div style={{
        display: "flex", gap: 10, marginBottom: 12,
        alignItems: "center", flexWrap: "wrap",
      }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, email or document type…"
          style={{
            flex: 1, minWidth: 200, maxWidth: 380,
            padding: "9px 14px",
            border: "1.5px solid #e8e6e0", borderRadius: 10,
            fontSize: 13, outline: "none",
            background: "#fafaf8", boxSizing: "border-box",
          }}
        />

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          style={{
            padding: "9px 12px",
            border: "1.5px solid #e8e6e0", borderRadius: 10,
            fontSize: 13, background: "#fafaf8",
            cursor: "pointer", outline: "none", color: "#333",
          }}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <button
          style={S.iconBtn(showFilters || activeFilterCount > 0)}
          onClick={() => setShowFilters((x) => !x)}
        >
          🔍 Filters
          {activeFilterCount > 0 && (
            <span style={{
              background: "#dc2626", color: "#fff",
              borderRadius: "50%", width: 16, height: 16,
              display: "inline-flex", alignItems: "center",
              justifyContent: "center", fontSize: 9,
              marginLeft: 4, fontWeight: 900,
            }}>
              {activeFilterCount}
            </span>
          )}
        </button>

        {activeTab === "pending" && selected.size > 0 && (
          <div style={{
            display: "flex", gap: 6, alignItems: "center",
          }}>
            {bulkProgress ? (
              <BulkProgressBar
                current={bulkProgress.current}
                total={bulkProgress.total}
              />
            ) : (
              <>
                <span style={{
                  fontSize: 12, fontWeight: 700, color: "#555",
                }}>
                  {selected.size} selected
                </span>
                <button
                  className="btn b-solid"
                  disabled={!!busy}
                  onClick={() => confirm({
                    title: `Bulk approve ${selected.size} submissions?`,
                    body: "Identity and store approved. Emails sent.",
                    confirm: "Approve All",
                    action: handleBulkApprove,
                  })}
                  style={{
                    fontSize: 11, padding: "4px 12px", height: 28,
                  }}
                >
                  Approve All
                </button>
                <button
                  className="btn b-red"
                  disabled={!!busy}
                  onClick={() => setRejectModal({ type: "bulk" })}
                  style={{
                    fontSize: 11, padding: "4px 12px", height: 28,
                  }}
                >
                  Reject All
                </button>
                <button
                  className="btn b-ghost"
                  onClick={() => setSelected(new Set())}
                  style={{
                    fontSize: 11, padding: "4px 10px", height: 28,
                  }}
                >
                  Clear
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Filter chips */}
      {showFilters && (
        <div style={{
          display: "flex", gap: 8, flexWrap: "wrap",
          marginBottom: 14, padding: "10px 14px",
          background: "#fafaf8", border: "1.5px solid #f0eeea",
          borderRadius: 10,
        }}>
          <FilterChip label="Risk ≥ 80"      active={filters.riskHigh}     onClick={() => setFilter("riskHigh",     !filters.riskHigh)}     color="#dc2626" />
          <FilterChip label="Overdue 48h+"   active={filters.overdue48}    onClick={() => setFilter("overdue48",    !filters.overdue48)}    color="#d97706" />
          <FilterChip label="Face Mismatch"  active={filters.faceMismatch} onClick={() => setFilter("faceMismatch", !filters.faceMismatch)} color="#dc2626" />
          <FilterChip label="Unassigned"     active={filters.unassigned}   onClick={() => setFilter("unassigned",   !filters.unassigned)}   color="#6b7280" />
          <FilterChip label="Assigned to Me" active={filters.assignedToMe} onClick={() => setFilter("assignedToMe", !filters.assignedToMe)} color="#0369a1" />
          <FilterChip label="No Store"       active={filters.noStore}      onClick={() => setFilter("noStore",      !filters.noStore)}      color="#9333ea" />
          {activeFilterCount > 0 && (
            <button
              onClick={() => setFilters({
                riskHigh: false, overdue48: false,
                faceMismatch: false, unassigned: false,
                assignedToMe: false, noStore: false,
              })}
              style={{
                padding: "4px 12px", borderRadius: 999,
                border: "1.5px solid #e8e6e0",
                background: "#fff", color: "#888",
                fontWeight: 700, fontSize: 11, cursor: "pointer",
              }}
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div style={{
          textAlign: "center", padding: 60, color: "#aaa",
        }}>
          Loading…
        </div>
      ) : displayedAll.length === 0 ? (
        <div style={{
          textAlign: "center", padding: 60, color: "#aaa",
          background: "#fafaf8", borderRadius: 14,
          border: "1.5px dashed #e8e6e0",
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
            Nothing here
          </div>
          <div style={{ fontSize: 13 }}>
            No {activeTab} verifications found.
          </div>
        </div>
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={{
              width: "100%", borderCollapse: "collapse",
              fontSize: 13, minWidth: 740,
            }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #f0eeea" }}>
                  {activeTab === "pending" && (
                    <th style={{ padding: "10px 6px", width: 32 }}>
                      <input
                        type="checkbox"
                        checked={
                          selected.size === displayedAll.length &&
                          displayedAll.length > 0
                        }
                        onChange={toggleSelectAll}
                        style={{ cursor: "pointer" }}
                      />
                    </th>
                  )}
                  {[
                    "User", "Document", "Identity",
                    "Store", "Risk", "Trust", "Submitted", "Actions",
                  ].map((h) => (
                    <th key={h} style={{
                      padding: "10px 10px", textAlign: "left",
                      fontSize: 11, fontWeight: 700, color: "#aaa",
                      textTransform: "uppercase",
                      letterSpacing: ".4px", whiteSpace: "nowrap",
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayedAll.map((r) => (
                  <TableRow
                    key={r.identity_id}
                    r={r}
                    isSelected={selected.has(r.user_id)}
                    showCheckbox={activeTab === "pending"}
                    isBusy={busy === `approve-${r.user_id}`}
                    onSelect={toggleSelect}
                    onView={(rec) => setDrawerId(rec.identity_id)}
                    onApprove={(userId) => confirm({
                      title: "Approve submission?",
                      body: `Approve ${r.user_name}'s identity and store?`,
                      confirm: "Approve",
                      action: () => handleApprove(userId),
                    })}
                    onReject={(rec) => setRejectModal({
                      type: "single",
                      userId: rec.user_id,
                      name: rec.user_name,
                    })}
                    confirm={confirm}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div style={{
            textAlign: "right", fontSize: 11,
            color: "#aaa", marginTop: 8,
          }}>
            Showing {displayedAll.length}
            {hasMore ? "+" : ""} record
            {displayedAll.length !== 1 ? "s" : ""}
          </div>

          {hasMore && (
            <div style={{ textAlign: "center", marginTop: 12 }}>
              <button
                className="btn b-ghost"
                onClick={() => loadQueue(true)}
                disabled={loading}
                style={{ fontSize: 13, padding: "8px 28px" }}
              >
                Load more
              </button>
            </div>
          )}
        </>
      )}

      {/* Drawer */}
      {drawer && (
        <VerificationDrawer
          record={drawer}
          totalCount={displayedAll.length}
          currentIndex={drawerIndex}
          onClose={() => setDrawerId(null)}
          onPrev={handleDrawerPrev}
          onNext={handleDrawerNext}
          onApprove={(userId, callbacks) => confirm({
            title: "Approve submission?",
            body: `Approve ${drawer.user_name}'s identity and store?`,
            confirm: "Approve",
            action: () => handleApprove(userId, callbacks),
          })}
          onReject={(r) => setRejectModal({
            type: "single",
            userId: r.user_id,
            name: r.user_name,
          })}
          onReset={(r) => setResetModal({
            userId: r.user_id,
            name: r.user_name,
          })}
          busy={busy}
          onToast={showToast}
        />
      )}

      {/* Reject modal */}
      {rejectModal && (
        <RejectModal
          title={
            rejectModal.type === "bulk"
              ? `Bulk Reject ${selected.size} Submissions`
              : `Reject Verification — ${rejectModal.name}`
          }
          onSubmit={(reason) =>
            rejectModal.type === "bulk"
              ? handleBulkReject(reason)
              : handleReject(rejectModal.userId, reason)
          }
          onClose={() => setRejectModal(null)}
        />
      )}

      {/* Reset modal */}
      {resetModal && (
        <ResetModal
          title={`Reset Verification — ${resetModal.name}`}
          onSubmit={(note) => handleReset(resetModal.userId, note)}
          onClose={() => setResetModal(null)}
        />
      )}

      <style>{`
        @keyframes slideUp {
          from { opacity:0; transform:translateY(20px); }
          to   { opacity:1; transform:translateY(0); }
        }
      `}</style>
    </div>
  );
}