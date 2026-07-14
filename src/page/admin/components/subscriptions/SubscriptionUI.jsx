// ─── Shared UI primitives, helpers, constants ─────────────────────────────

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════════════════ */
export const PLAN_SLUGS  = ["premium", "pro", "business", "elite", "diamond"];
export const PLAN_BADGE  = { premium: "⭐", pro: "🔥", business: "👑", elite: "🌟", diamond: "💎", free: "" };
export const PLAN_LABELS = { premium: "Premium", pro: "Pro", business: "Business", elite: "Elite", diamond: "Diamond", free: "Free" };

export const STATUS_STYLES = {
  active    : { bg: "#dcfce7", color: "#166534" },
  expired   : { bg: "#f3f4f6", color: "#6b7280" },
  cancelled : { bg: "#fef2f2", color: "#b91c1c" },
  superseded: { bg: "#dbeafe", color: "#2563eb" },
  pending   : { bg: "#fef9c3", color: "#854d0e" },
  failed    : { bg: "#fef2f2", color: "#b91c1c" },
  trial     : { bg: "#f3e8ff", color: "#7c3aed" },
  suspended : { bg: "#fff7ed", color: "#c2410c" },
  refunded  : { bg: "#f0fdf4", color: "#15803d" },
  paused    : { bg: "#f1f5f9", color: "#475569" },
};

export const C = {
  orange : "#FF5C00",
  green  : "#16a34a",
  red    : "#b91c1c",
  blue   : "#2563eb",
  purple : "#7c3aed",
  muted  : "var(--muted)",
  card   : "var(--card)",
  border : "var(--border)",
  text   : "var(--text)",
  bg     : "var(--bg)",
  hover  : "var(--hover)",
};

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════════════════ */
export const naira   = (kobo) => "₦" + Number((kobo ?? 0) / 100).toLocaleString("en-NG");
export const fmt     = (d)    => d ? new Date(d).toLocaleDateString("en-NG", { year: "numeric", month: "short",  day: "numeric" }) : "—";
export const fmtFull = (d)    => d ? new Date(d).toLocaleDateString("en-NG", { year: "numeric", month: "long",   day: "numeric" }) : "—";
export const fmtTime = (d)    => d ? new Date(d).toLocaleString("en-NG",     { year: "numeric", month: "short",  day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export const expiringSoon = (sub) =>
  sub.status === "active" &&
  sub.expires_at &&
  new Date(sub.expires_at) < new Date(Date.now() + 3 * 86400000);

export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a   = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
};

/* ═══════════════════════════════════════════════════════════════════════════
   BUTTON
═══════════════════════════════════════════════════════════════════════════ */
export function Btn({ children, onClick, disabled, variant = "ghost", style = {}, title }) {
  const base = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    gap: 5, padding: "6px 12px", borderRadius: 6, border: "1px solid transparent",
    fontSize: ".75rem", fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? .5 : 1,
    transition: "background .12s, opacity .12s",
    fontFamily: "inherit", whiteSpace: "nowrap",
  };
  const variants = {
    ghost   : { background: C.card,    color: C.text,   border: `1px solid ${C.border}` },
    primary : { background: C.orange,  color: "#fff",   border: `1px solid ${C.orange}` },
    success : { background: "#dcfce7", color: C.green,  border: "1px solid #bbf7d0"     },
    danger  : { background: "#fef2f2", color: C.red,    border: "1px solid #fecaca"     },
    ink     : { background: "#141210", color: "#fff",   border: "1px solid #141210"     },
    blue    : { background: "#dbeafe", color: C.blue,   border: "1px solid #bfdbfe"     },
    warning : { background: "#fef9c3", color: "#854d0e",border: "1px solid #fde68a"     },
    purple  : { background: "#f3e8ff", color: C.purple, border: "1px solid #ddd6fe"     },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{ ...base, ...variants[variant], ...style }}
    >
      {children}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STATUS PILL
═══════════════════════════════════════════════════════════════════════════ */
export function StatusPill({ status }) {
  const s     = STATUS_STYLES[status] ?? { bg: "#f3f4f6", color: "#6b7280" };
  const label =
    status === "superseded" ? "Upgraded"
    : (status ?? "unknown").charAt(0).toUpperCase() + (status ?? "unknown").slice(1);
  return (
    <span style={{
      background: s.bg, color: s.color, borderRadius: 100,
      padding: "2px 10px", fontSize: ".6875rem", fontWeight: 600, whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SPINNER
═══════════════════════════════════════════════════════════════════════════ */
export function Spinner({ size = 14 }) {
  return (
    <span style={{
      display: "inline-block", width: size, height: size,
      border: "2px solid currentColor", borderTopColor: "transparent",
      borderRadius: "50%", animation: "aspin .6s linear infinite", flexShrink: 0,
    }} />
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   DIVIDER
═══════════════════════════════════════════════════════════════════════════ */
export const Divider = ({ margin = "14px 0" }) => (
  <div style={{ borderTop: `1px solid ${C.border}`, margin }} />
);

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION WRAPPER
═══════════════════════════════════════════════════════════════════════════ */
export function Section({ title, children, action }) {
  return (
    <div>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 10,
      }}>
        <div style={{
          fontSize: ".68rem", fontWeight: 700, textTransform: "uppercase",
          letterSpacing: ".05em", color: C.muted,
        }}>
          {title}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   INFO ROW
═══════════════════════════════════════════════════════════════════════════ */
export function InfoRow({ label, value, mono, copy }) {
  const handleCopy = () => {
    if (!copy && !value) return;
    navigator.clipboard.writeText(String(copy ?? value)).catch(() => {});
  };
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "7px 0", borderBottom: `1px solid ${C.border}`,
    }}>
      <span style={{ fontSize: ".75rem", color: C.muted, flexShrink: 0, marginRight: 12 }}>
        {label}
      </span>
      <span
        onClick={copy !== undefined ? handleCopy : undefined}
        title={copy !== undefined ? "Click to copy" : undefined}
        style={{
          fontSize: ".75rem", fontWeight: 500, color: C.text,
          textAlign: "right", wordBreak: "break-all",
          fontFamily: mono ? "'SF Mono', 'Fira Code', monospace" : "inherit",
          cursor: copy !== undefined ? "pointer" : "default",
          maxWidth: "60%",
        }}
      >
        {value ?? "—"}
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MINI TAG (feature value renderer)
═══════════════════════════════════════════════════════════════════════════ */
export function MiniTag({ val, featureKey }) {
  if (val === "true"  || val === true)  return <span style={{ color: C.green,  fontWeight: 700, fontSize: ".78rem" }}>✓ Yes</span>;
  if (val === "false" || val === false) return <span style={{ color: C.muted,  fontSize: ".78rem" }}>✕ No</span>;
  if (val === "0"     || val === 0)     return <span style={{ color: C.muted,  fontSize: ".78rem" }}>—</span>;
  if (featureKey === "advertising_credits")
    return <span style={{ color: C.orange, fontWeight: 700, fontSize: ".78rem" }}>₦{Number(val).toLocaleString("en-NG")}</span>;
  return <span style={{ color: C.text, fontWeight: 600, fontSize: ".78rem", textTransform: "capitalize" }}>{val}</span>;
}

/* ═══════════════════════════════════════════════════════════════════════════
   SIMPLE BAR CHART
═══════════════════════════════════════════════════════════════════════════ */
export function BarChart({ data = [], valueKey = "value", labelKey = "label", color = "#FF5C00", height = 120 }) {
  if (!data.length) {
    return (
      <div style={{ color: C.muted, fontSize: ".75rem", padding: "16px 0", textAlign: "center" }}>
        No data
      </div>
    );
  }
  const max = Math.max(...data.map((d) => d[valueKey] ?? 0), 1);
  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height, minWidth: data.length * 18 }}>
        {data.map((d, i) => {
          const pct = (d[valueKey] ?? 0) / max;
          return (
            <div
              key={i}
              title={`${d[labelKey]}: ${d[valueKey]}`}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flex: 1 }}
            >
              <div style={{
                width: "100%", background: color, borderRadius: "3px 3px 0 0",
                height: Math.max(3, pct * (height - 20)), opacity: .85,
                transition: "height .3s",
              }} />
              <span style={{
                fontSize: ".52rem", color: C.muted, whiteSpace: "nowrap",
                transform: "rotate(-30deg)", transformOrigin: "top left",
              }}>
                {d[labelKey]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SELECT
═══════════════════════════════════════════════════════════════════════════ */
export function Sel({ value, onChange, children, style = {} }) {
  return (
    <select
      value={value}
      onChange={onChange}
      style={{
        padding: "7px 10px", border: `1px solid ${C.border}`, borderRadius: 6,
        fontSize: ".78rem", background: C.card, color: C.text,
        cursor: "pointer", fontFamily: "inherit", ...style,
      }}
    >
      {children}
    </select>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   INPUT
═══════════════════════════════════════════════════════════════════════════ */
export function Inp({ value, onChange, placeholder, type = "text", style = {} }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{
        padding: "7px 10px", border: `1px solid ${C.border}`, borderRadius: 6,
        fontSize: ".78rem", background: C.card, color: C.text,
        fontFamily: "inherit", outline: "none", ...style,
      }}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   GLOBAL KEYFRAME  (inject once via <style>)
═══════════════════════════════════════════════════════════════════════════ */
export const GLOBAL_CSS = `@keyframes aspin { to { transform: rotate(360deg); } }`;