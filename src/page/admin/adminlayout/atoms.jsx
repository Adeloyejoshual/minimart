// src/page/admin/adminlayout/atoms.jsx

import {
  PILL,
  ROLE_LABEL,
  TT,
  fmtDate,
  verificationColor,
  verificationLabel,
  riskColor,
  overdueDays,
  trustColor,
} from "./helpers";

/* ── Basic pill / status badge ─────────────────────────────────
   s     = raw value  e.g. "super_admin", "active", "banned"
   label = optional friendly override e.g. "Super Admin / Owner"
────────────────────────────────────────────────────────────── */
export const Pill = ({ s, label }) => {
  const text = label ?? ROLE_LABEL[s] ?? s ?? "—";
  return (
    <span className={PILL[s] || "pill pd"}>
      {text}
    </span>
  );
};

/* ── Verification status badge ── */
export const VerificationBadge = ({ status }) => {
  const s     = status ?? "unknown";
  const color = verificationColor(s);
  return (
    <span style={{
      display      : "inline-block",
      padding      : "2px 8px",
      borderRadius : 999,
      fontSize     : 11,
      fontWeight   : 700,
      background   : `${color}18`,
      color,
      border       : `1px solid ${color}40`,
    }}>
      {verificationLabel(s)}
    </span>
  );
};

/* ── Risk score badge ── */
export const RiskBadge = ({ score }) => {
  if (!score || score === 0) return null;
  const color = riskColor(score);
  return (
    <span style={{
      display      : "inline-block",
      padding      : "2px 8px",
      borderRadius : 999,
      fontSize     : 11,
      fontWeight   : 700,
      background   : `${color}18`,
      color,
      border       : `1px solid ${color}40`,
    }}>
      Risk: {score}
    </span>
  );
};

/* ── Overdue badge ── */
export const OverdueBadge = ({ createdAt }) => {
  const days = overdueDays(createdAt);
  if (!days) return null;
  return (
    <span style={{
      display      : "inline-block",
      padding      : "2px 6px",
      borderRadius : 999,
      fontSize     : 10,
      fontWeight   : 700,
      background   : "#dc262618",
      color        : "#dc2626",
      border       : "1px solid #dc262640",
      marginLeft   : 4,
    }}>
      {days}d overdue
    </span>
  );
};

/* ── Trust score cell ── */
export const TrustScore = ({ score }) => (
  <span style={{ fontWeight: 700, color: trustColor(score) }}>
    {score ?? 0}
  </span>
);

/* ── Stat card ── */
export const StatCard = ({ label, value, color = "c-blue", delta }) => (
  <div className="sc">
    <div className="sc-label">{label}</div>
    <div className={`sc-val ${color}`}>{value}</div>
    {delta && <div className="sc-delta">{delta}</div>}
  </div>
);

/* ── Verification stat card ── */
export const VerifStatCard = ({ label, value, color }) => (
  <div style={{
    background   : "#fafaf8",
    border       : "1.5px solid #f0eeea",
    borderRadius : 12,
    padding      : "14px 16px",
  }}>
    <div style={{
      fontSize      : 10,
      fontWeight    : 700,
      color         : "#aaa",
      textTransform : "uppercase",
      letterSpacing : ".4px",
      marginBottom  : 4,
    }}>
      {label}
    </div>
    <div style={{ fontSize: 20, fontWeight: 900, color }}>
      {(value ?? 0).toLocaleString()}
    </div>
  </div>
);

/* ── Card wrapper ── */
export const Card = ({ title, actions, tabs, children }) => (
  <div className="card">
    {tabs}
    {(title || actions) && (
      <div className="card-hd">
        {title   && <span className="card-title">{title}</span>}
        {actions && <div className="card-acts">{actions}</div>}
      </div>
    )}
    {children}
  </div>
);

/* ── Admin log item ── */
export const LogItem = ({ log }) => (
  <div className="log-item">
    <span className="log-time">{fmtDate(log.created_at)}</span>
    <span className="log-body">
      {log.details}
      {log.admin_name && (
        <> — <span className="log-admin">{log.admin_name}</span></>
      )}
    </span>
  </div>
);

/* ── Refresh button ── */
export const Rfr = ({ onClick }) => (
  <button className="btn b-ghost" onClick={onClick}>
    Refresh
  </button>
);

/* ── Search input ── */
export const Srch = ({ value, onChange, placeholder }) => (
  <input
    className="input input-sm"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder || "Search…"}
  />
);

/* ── Empty state ── */
export const EmptyState = ({
  icon  = "📋",
  title = "Nothing here",
  body  = "No records found.",
}) => (
  <div style={{
    textAlign    : "center",
    padding      : 60,
    color        : "#aaa",
    background   : "#fafaf8",
    borderRadius : 14,
    border       : "1.5px dashed #e8e6e0",
  }}>
    <div style={{ fontSize: 32, marginBottom: 8 }}>{icon}</div>
    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
      {title}
    </div>
    <div style={{ fontSize: 13 }}>{body}</div>
  </div>
);

/* ── Drawer shell ── */
export const Drawer = ({ onClose, header, children, width = 580 }) => (
  <div style={{
    position : "fixed", inset: 0, zIndex: 600, display: "flex",
  }}>
    <div
      style={{ flex: 1, background: "rgba(0,0,0,.45)", cursor: "pointer" }}
      onClick={onClose}
    />
    <div style={{
      width         : `min(${width}px, 100%)`,
      background    : "#fff",
      overflowY     : "auto",
      display       : "flex",
      flexDirection : "column",
      boxShadow     : "-8px 0 32px rgba(0,0,0,.15)",
    }}>
      <div style={{
        padding         : "16px 20px",
        borderBottom    : "1px solid #f0eeea",
        display         : "flex",
        alignItems      : "center",
        justifyContent  : "space-between",
        position        : "sticky",
        top             : 0,
        background      : "#fff",
        zIndex          : 1,
      }}>
        <div style={{ flex: 1 }}>{header}</div>
        <button
          onClick={onClose}
          style={{
            border          : "1.5px solid #e8e6e0",
            background      : "#fafaf8",
            borderRadius    : "50%",
            width           : 32,
            height          : 32,
            cursor          : "pointer",
            fontSize        : 16,
            color           : "#555",
            display         : "flex",
            alignItems      : "center",
            justifyContent  : "center",
            flexShrink      : 0,
            marginLeft      : 12,
          }}
        >
          &times;
        </button>
      </div>
      <div style={{ padding: 20, flex: 1 }}>{children}</div>
    </div>
  </div>
);

/* ── Modal shell ── */
export const Modal = ({ title, onClose, children, maxWidth = 460 }) => (
  <div
    className="overlay"
    onClick={onClose}
    style={{ zIndex: 700 }}
  >
    <div
      className="modal"
      onClick={(e) => e.stopPropagation()}
      style={{ maxWidth }}
    >
      {title && <div className="modal-title">{title}</div>}
      {children}
    </div>
  </div>
);

/* ── Info box ── */
export const InfoBox = ({ label, children, style = {} }) => (
  <div style={{
    background   : "#fafaf8",
    border       : "1.5px solid #f0eeea",
    borderRadius : 12,
    padding      : "14px 16px",
    marginBottom : 16,
    fontSize     : 13,
    ...style,
  }}>
    {label && (
      <div style={{
        fontSize      : 11,
        fontWeight    : 700,
        color         : "#aaa",
        textTransform : "uppercase",
        letterSpacing : ".5px",
        marginBottom  : 8,
      }}>
        {label}
      </div>
    )}
    {children}
  </div>
);

/* ── Detail row ── */
export const DetailRow = ({ label, value, children }) => (
  <div style={{ marginBottom: 5 }}>
    <span style={{ color: "#888" }}>{label}: </span>
    {children ?? <strong>{value ?? "—"}</strong>}
  </div>
);