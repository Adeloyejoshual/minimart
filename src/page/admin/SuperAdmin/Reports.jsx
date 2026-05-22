import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import axios from "axios";

const BASE = "https://minimart-ivrm.onrender.com/api/admin";
const tok  = () => localStorage.getItem("admin_token") || "";
const hdr  = () => ({ Authorization: `Bearer ${tok()}` });
const api  = {
  get:   (p)    => axios.get(`${BASE}${p}`,       { headers: hdr() }),
  patch: (p, b) => axios.patch(`${BASE}${p}`, b,  { headers: hdr() }),
  post:  (p, b) => axios.post(`${BASE}${p}`, b,   { headers: hdr() }),
};

/* ── helpers ── */
const fmtDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};
const timeAgo = (d) => {
  if (!d) return "";
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

/* ── SVG icon set ── */
const Ic = {
  flag: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round"
      strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
      <line x1="4" y1="22" x2="4" y2="15"/>
    </svg>
  ),
  refresh: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
      <path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8"/>
      <path d="M3 3v5h5"/>
    </svg>
  ),
  search: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <circle cx="11" cy="11" r="8"/>
      <path d="M21 21l-4.35-4.35"/>
    </svg>
  ),
  close: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
      <path d="M18 6L6 18M6 6l12 12"/>
    </svg>
  ),
  check: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"
      strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5"/>
    </svg>
  ),
  x: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
      <path d="M18 6L6 18M6 6l12 12"/>
    </svg>
  ),
  eye: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round"
      strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  ban: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
    </svg>
  ),
  warn: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round"
      strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0
               001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  lock: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round"
      strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0110 0v4"/>
    </svg>
  ),
  user: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round"
      strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  msg: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round"
      strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
    </svg>
  ),
  img: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round"
      strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <path d="M21 15l-5-5L5 21"/>
    </svg>
  ),
  chevLeft: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
      <path d="M15 19l-7-7 7-7"/>
    </svg>
  ),
  chevRight: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
      <path d="M9 18l7-7-7-7"/>
    </svg>
  ),
  clock: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 6v6l4 2"/>
    </svg>
  ),
  stats: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round"
      strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6"  y1="20" x2="6"  y2="14"/>
    </svg>
  ),
  reporter: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round"
      strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  reported: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
    </svg>
  ),
};

/* ── constants ── */
const REASON_META = {
  scam:                  { label: "Scam / Fraud",          color: "#dc2626", bg: "#fef2f2" },
  fake_payment:          { label: "Fake Payment",          color: "#ea580c", bg: "#fff7ed" },
  harassment:            { label: "Harassment",            color: "#7c3aed", bg: "#f5f3ff" },
  threats:               { label: "Threats",               color: "#b91c1c", bg: "#fef2f2" },
  spam:                  { label: "Spam",                  color: "#6b7280", bg: "#f3f4f6" },
  inappropriate_content: { label: "Inappropriate",         color: "#db2777", bg: "#fdf4ff" },
  other:                 { label: "Other",                 color: "#6b7280", bg: "#f3f4f6" },
};

const STATUS_META = {
  pending:   { label: "Pending",   color: "#d97706", bg: "#fffbeb", ring: "#fde68a" },
  reviewing: { label: "Reviewing", color: "#2563eb", bg: "#eff6ff", ring: "#bfdbfe" },
  resolved:  { label: "Resolved",  color: "#16a34a", bg: "#f0fdf4", ring: "#bbf7d0" },
  dismissed: { label: "Dismissed", color: "#6b7280", bg: "#f9fafb", ring: "#e5e7eb" },
};

/* ══════════════════════════════════════════════
   MICRO COMPONENTS
══════════════════════════════════════════════ */
function Av({ src, name, size = 36 }) {
  const [err, setErr] = useState(false);
  return (
    <img
      src={
        !err && src
          ? src
          : `https://ui-avatars.com/api/?name=${encodeURIComponent(
              name || "?"
            )}&background=18181b&color=fff&size=80`
      }
      alt={name}
      onError={() => setErr(true)}
      style={{
        width: size, height: size, borderRadius: "50%",
        objectFit: "cover", flexShrink: 0,
        border: "2.5px solid #f0f0f0",
        boxShadow: "0 1px 4px rgba(0,0,0,.08)",
      }}
    />
  );
}

function Tag({ label, color, bg, ring, icon, small }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: small ? 10 : 11, fontWeight: 700,
      color, background: bg,
      border: `1.5px solid ${ring || color + "30"}`,
      borderRadius: 20,
      padding: small ? "2px 7px" : "3px 10px",
      letterSpacing: ".3px", whiteSpace: "nowrap",
    }}>
      {icon && (
        <span style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
          {icon}
        </span>
      )}
      {label}
    </span>
  );
}

function ReasonTag({ reason, small }) {
  const m = REASON_META[reason] || REASON_META.other;
  return <Tag {...m} small={small}/>;
}

function StatusTag({ status, small }) {
  const m = STATUS_META[status] || STATUS_META.pending;
  return <Tag {...m} icon={<StatusDot status={status}/>} small={small}/>;
}

function StatusDot({ status }) {
  const colors = {
    pending:   "#d97706",
    reviewing: "#2563eb",
    resolved:  "#16a34a",
    dismissed: "#9ca3af",
  };
  return (
    <span style={{
      display: "inline-block",
      width: 7, height: 7, borderRadius: "50%",
      background: colors[status] || "#9ca3af",
      flexShrink: 0,
    }}/>
  );
}

function Chip({ label, value, color = "#6366f1", icon }) {
  return (
    <div style={{
      background: "#fff", border: "1px solid #f0f0f0",
      borderRadius: 14, padding: "16px 18px",
      boxShadow: "0 1px 6px rgba(0,0,0,.05)",
      display: "flex", alignItems: "center", gap: 12,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: color + "15",
        display: "flex", alignItems: "center",
        justifyContent: "center", color, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{
          fontSize: 24, fontWeight: 900, color: "#18181b", lineHeight: 1,
        }}>
          {value ?? 0}
        </div>
        <div style={{ fontSize: 12, color: "#888", fontWeight: 500, marginTop: 2 }}>
          {label}
        </div>
      </div>
    </div>
  );
}

function Btn({ children, onClick, variant = "ghost", disabled, style: s }) {
  const base = {
    padding: "8px 16px", borderRadius: 10, fontSize: 13,
    fontWeight: 600, cursor: disabled ? "default" : "pointer",
    border: "none", transition: "all .15s",
    display: "inline-flex", alignItems: "center", gap: 6,
    opacity: disabled ? .5 : 1, lineHeight: 1,
  };
  const v = {
    ghost:   { background: "#f4f4f5", color: "#18181b" },
    primary: { background: "#18181b", color: "#fff" },
    blue:    { background: "#eff6ff", color: "#2563eb",
               border: "1.5px solid #bfdbfe" },
    green:   { background: "#22c55e", color: "#fff" },
    red:     { background: "#ef4444", color: "#fff" },
    orange:  { background: "#f97316", color: "#fff" },
    outline: { background: "#fff",    color: "#555",
               border: "1.5px solid #e5e5e5" },
  };
  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{ ...base, ...v[variant], ...s }}
    >
      {children}
    </button>
  );
}

function Spinner({ size = 14, light }) {
  return (
    <span style={{
      display: "inline-block",
      width: size, height: size,
      border: `2.5px solid ${light
        ? "rgba(255,255,255,.3)"
        : "rgba(0,0,0,.1)"}`,
      borderTopColor: light ? "#fff" : "#18181b",
      borderRadius: "50%",
      animation: "rpt-spin .6s linear infinite",
      flexShrink: 0,
    }}/>
  );
}

function EmptyState({ icon, title, subtitle }) {
  return (
    <div style={{
      padding: "64px 24px", textAlign: "center",
      display: "flex", flexDirection: "column",
      alignItems: "center", gap: 14,
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 20,
        background: "#f4f4f5",
        display: "flex", alignItems: "center",
        justifyContent: "center", color: "#aaa",
      }}>
        {icon}
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: "#18181b" }}>
        {title}
      </div>
      <div style={{ fontSize: 13, color: "#888", maxWidth: 280, lineHeight: 1.6 }}>
        {subtitle}
      </div>
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "#f4f4f5", margin: "2px 0" }}/>;
}

/* ══════════════════════════════════════════════
   REPORT DETAIL DRAWER
══════════════════════════════════════════════ */
function ReportDrawer({ reportId, onClose, onRefresh }) {
  const [detail,  setDetail]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy,    setBusy]    = useState(null);
  const [toast,   setToast]   = useState(null);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    if (!reportId) return;
    setLoading(true);
    setDetail(null);
    api.get(`/reports/${reportId}`)
      .then(({ data }) => setDetail(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [reportId]);

  const act = useCallback(async (type) => {
    if (busy) return;
    setBusy(type);
    try {
      if (type === "ban") {
        await api.post(`/reports/${reportId}/ban-seller`, {});
        showToast("User banned and report resolved");
      } else {
        await api.patch(`/reports/${reportId}`, { status: type });
        showToast(`Report marked as ${type}`);
      }
      onRefresh();
      setTimeout(onClose, 900);
    } catch (err) {
      showToast(err.response?.data?.message || "Action failed", "error");
    } finally {
      setBusy(null);
    }
  }, [busy, reportId, onClose, onRefresh, showToast]);

  const r      = detail?.report;
  const msgs   = detail?.messages || [];
  const closed = r?.status === "resolved" || r?.status === "dismissed";

  const InfoRow = ({ label, children }) => (
    <div style={{
      display: "flex", gap: 12, padding: "10px 0",
      borderBottom: "1px solid #f4f4f5",
    }}>
      <div style={{
        width: 130, flexShrink: 0, fontSize: 12,
        color: "#888", fontWeight: 600, paddingTop: 1,
      }}>
        {label}
      </div>
      <div style={{ flex: 1, fontSize: 13, color: "#18181b" }}>
        {children}
      </div>
    </div>
  );

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,.5)",
        backdropFilter: "blur(4px)",
        animation: "rpt-fadein .15s",
      }}/>

      {/* Drawer panel */}
      <div style={{
        position: "fixed", top: 0, right: 0,
        width: "min(580px, 97vw)", height: "100dvh",
        background: "#fff", zIndex: 1001,
        display: "flex", flexDirection: "column",
        boxShadow: "-12px 0 48px rgba(0,0,0,.14)",
        animation: "rpt-slideright .22s cubic-bezier(.4,0,.2,1)",
      }}>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: "1px solid #f0f0f0",
          background: "#fafafa", flexShrink: 0,
        }}>
          <div>
            <div style={{
              fontSize: 15, fontWeight: 800, color: "#18181b",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ color: "#ef4444" }}>{Ic.flag}</span>
              Report Detail
            </div>
            {r && (
              <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>
                ID #{r.id?.slice(0, 8)} · {fmtDate(r.created_at)}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {r && <StatusTag status={r.status}/>}
            <button onClick={onClose} style={{
              width: 32, height: 32, borderRadius: "50%",
              border: "none", background: "#f0f0f0",
              cursor: "pointer", color: "#555",
              display: "flex", alignItems: "center",
              justifyContent: "center",
            }}>
              {Ic.close}
            </button>
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div style={{
            padding: "10px 20px", flexShrink: 0,
            background: toast.type === "error" ? "#fef2f2" : "#f0fdf4",
            borderBottom: `1px solid ${
              toast.type === "error" ? "#fecaca" : "#bbf7d0"}`,
            fontSize: 13, fontWeight: 600,
            color: toast.type === "error" ? "#dc2626" : "#16a34a",
            display: "flex", gap: 8, alignItems: "center",
          }}>
            {toast.type === "error" ? Ic.warn : Ic.check}
            {toast.msg}
          </div>
        )}

        {/* Body */}
        {loading ? (
          <div style={{
            flex: 1, display: "flex", alignItems: "center",
            justifyContent: "center", flexDirection: "column",
            gap: 14, color: "#888",
          }}>
            <Spinner size={32}/>
            <div style={{ fontSize: 13 }}>Loading report…</div>
          </div>
        ) : !r ? (
          <EmptyState
            icon={Ic.warn}
            title="Report not found"
            subtitle="This report may have been deleted."
          />
        ) : (
          <div style={{ flex: 1, overflowY: "auto" }}>

            {/* Parties */}
            <section style={{ padding: "20px 20px 0" }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: "#888",
                textTransform: "uppercase", letterSpacing: ".6px",
                marginBottom: 12,
                display: "flex", alignItems: "center", gap: 6,
              }}>
                {Ic.user} Involved Parties
              </div>
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr", gap: 10,
              }}>
                {[
                  {
                    label: "Reporter",
                    sublabel: "Buyer",
                    img:   r.reporter_image,
                    name:  r.reporter_name,
                    email: r.reporter_email,
                    tagColor: "#2563eb",
                    tagBg:    "#eff6ff",
                    icon:  Ic.reporter,
                  },
                  {
                    label: "Reported",
                    sublabel: "Seller",
                    img:   r.reported_image,
                    name:  r.reported_name,
                    email: r.reported_email,
                    tagColor: "#dc2626",
                    tagBg:    "#fef2f2",
                    icon:  Ic.reported,
                  },
                ].map(p => (
                  <div key={p.label} style={{
                    background: "#fafafa", border: "1px solid #f0f0f0",
                    borderRadius: 12, padding: 14,
                    display: "flex", flexDirection: "column", gap: 10,
                  }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <Av src={p.img} name={p.name} size={38}/>
                      <div style={{ minWidth: 0 }}>
                        <div style={{
                          fontSize: 13, fontWeight: 700, color: "#18181b",
                          whiteSpace: "nowrap", overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}>
                          {p.name || "Unknown"}
                        </div>
                        <div style={{
                          fontSize: 11, color: "#888",
                          whiteSpace: "nowrap", overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}>
                          {p.email || "—"}
                        </div>
                      </div>
                    </div>
                    <Tag
                      label={`${p.label} · ${p.sublabel}`}
                      color={p.tagColor}
                      bg={p.tagBg}
                      icon={p.icon}
                      small
                    />
                  </div>
                ))}
              </div>
            </section>

            {/* Info rows */}
            <section style={{ padding: "20px 20px 0" }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: "#888",
                textTransform: "uppercase", letterSpacing: ".6px",
                marginBottom: 8,
                display: "flex", alignItems: "center", gap: 6,
              }}>
                {Ic.stats} Report Info
              </div>
              <div style={{
                background: "#fafafa", border: "1px solid #f0f0f0",
                borderRadius: 12, padding: "0 14px",
              }}>
                <InfoRow label="Reason">
                  <ReasonTag reason={r.reason}/>
                </InfoRow>
                <InfoRow label="Status">
                  <StatusTag status={r.status}/>
                </InfoRow>
                <InfoRow label="Submitted">
                  {fmtDate(r.created_at)} · {timeAgo(r.created_at)}
                </InfoRow>
                <InfoRow label="Under Review">
                  {r.is_under_review ? (
                    <Tag
                      label="Locked from cleanup"
                      color="#d97706" bg="#fffbeb" ring="#fde68a"
                      icon={Ic.lock} small
                    />
                  ) : (
                    <span style={{ color: "#bbb", fontSize: 12 }}>No</span>
                  )}
                </InfoRow>
                {r.updated_at && r.updated_at !== r.created_at && (
                  <InfoRow label="Last Updated">
                    {fmtDate(r.updated_at)}
                  </InfoRow>
                )}
              </div>
            </section>

            {/* Reporter description */}
            {r.details && (
              <section style={{ padding: "20px 20px 0" }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: "#888",
                  textTransform: "uppercase", letterSpacing: ".6px",
                  marginBottom: 8,
                }}>
                  Reporter's Description
                </div>
                <div style={{
                  background: "#fffbeb",
                  border: "1px solid #fde68a",
                  borderLeft: "4px solid #f59e0b",
                  borderRadius: "0 10px 10px 0",
                  padding: "12px 14px",
                  fontSize: 13, color: "#444",
                  lineHeight: 1.65, fontStyle: "italic",
                }}>
                  "{r.details}"
                </div>
              </section>
            )}

            {/* Flagged message */}
            {r.flagged_message && (
              <section style={{ padding: "20px 20px 0" }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: "#888",
                  textTransform: "uppercase", letterSpacing: ".6px",
                  marginBottom: 8,
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  {Ic.warn} Flagged Message
                </div>
                <div style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderLeft: "4px solid #ef4444",
                  borderRadius: "0 10px 10px 0",
                  padding: "12px 14px",
                }}>
                  <div style={{
                    fontSize: 11, color: "#ef4444",
                    fontWeight: 700, marginBottom: 6,
                    display: "flex", alignItems: "center", gap: 5,
                  }}>
                    {Ic.clock} Sent {fmtDate(r.flagged_at)}
                  </div>
                  <div style={{ fontSize: 13, color: "#18181b", lineHeight: 1.5 }}>
                    {r.flagged_message}
                  </div>
                </div>
              </section>
            )}

            {/* Conversation history */}
            <section style={{ padding: "20px" }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: "#888",
                textTransform: "uppercase", letterSpacing: ".6px",
                marginBottom: 10,
                display: "flex", alignItems: "center", gap: 6,
              }}>
                {Ic.msg} Conversation History ({msgs.length})
              </div>
              <div style={{
                background: "#f4f4f5", borderRadius: 14,
                padding: 12, maxHeight: 300, overflowY: "auto",
                display: "flex", flexDirection: "column", gap: 6,
              }}>
                {msgs.length === 0 ? (
                  <div style={{
                    textAlign: "center", color: "#bbb",
                    padding: 24, fontSize: 13,
                  }}>
                    No messages in this conversation
                  </div>
                ) : msgs.map(m => {
                  const isReporter = m.sender_id === r.reporter_id;
                  return (
                    <div key={m.id} style={{
                      display: "flex",
                      justifyContent: isReporter ? "flex-end" : "flex-start",
                    }}>
                      <div style={{
                        maxWidth: "76%",
                        background: isReporter ? "#18181b" : "#fff",
                        color: isReporter ? "#fff" : "#18181b",
                        borderRadius: isReporter
                          ? "14px 14px 4px 14px"
                          : "14px 14px 14px 4px",
                        padding: "8px 12px",
                        fontSize: 12.5, lineHeight: 1.5,
                        border: isReporter ? "none" : "1px solid #e8e8e8",
                        boxShadow: "0 1px 3px rgba(0,0,0,.06)",
                      }}>
                        <div style={{
                          fontSize: 10, opacity: .5,
                          marginBottom: 3, fontWeight: 600,
                          display: "flex", alignItems: "center", gap: 4,
                        }}>
                          {Ic.user}
                          {m.sender_name} · {timeAgo(m.created_at)}
                        </div>
                        {m.deleted ? (
                          <em style={{ opacity: .5, fontSize: 11 }}>
                            Message deleted
                          </em>
                        ) : m.media_url ? (
                          <span style={{
                            display: "flex", alignItems: "center",
                            gap: 5, opacity: .7, fontSize: 11,
                          }}>
                            {Ic.img} Image
                          </span>
                        ) : (
                          m.message
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Actions */}
            <section style={{ padding: "0 20px 32px" }}>
              {closed ? (
                <div style={{
                  background: "#f4f4f5", borderRadius: 12,
                  padding: "16px 18px", textAlign: "center",
                  fontSize: 13, color: "#888",
                }}>
                  This report was{" "}
                  <strong style={{ color: "#18181b" }}>{r.status}</strong>
                  {r.updated_at ? ` on ${fmtDate(r.updated_at)}` : ""}.
                </div>
              ) : (
                <>
                  <div style={{
                    fontSize: 11, fontWeight: 700, color: "#888",
                    textTransform: "uppercase", letterSpacing: ".6px",
                    marginBottom: 10,
                  }}>
                    Take Action
                  </div>

                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                  }}>
                    {r.status === "pending" && (
                      <Btn
                        variant="blue"
                        onClick={() => act("reviewing")}
                        disabled={!!busy}
                        style={{ gridColumn: "1 / -1" }}
                      >
                        {busy === "reviewing" ? <Spinner light/> : Ic.eye}
                        {busy === "reviewing" ? "Updating…" : "Start Reviewing"}
                      </Btn>
                    )}

                    <Btn
                      variant="green"
                      onClick={() => act("resolved")}
                      disabled={!!busy}
                    >
                      {busy === "resolved" ? <Spinner light/> : Ic.check}
                      {busy === "resolved" ? "Saving…" : "Mark Resolved"}
                    </Btn>

                    <Btn
                      variant="outline"
                      onClick={() => act("dismissed")}
                      disabled={!!busy}
                    >
                      {busy === "dismissed" ? <Spinner/> : Ic.x}
                      {busy === "dismissed" ? "Saving…" : "Dismiss"}
                    </Btn>

                    <Btn
                      variant="red"
                      onClick={() => act("ban")}
                      disabled={!!busy}
                      style={{ gridColumn: "1 / -1" }}
                    >
                      {busy === "ban" ? <Spinner light/> : Ic.ban}
                      {busy === "ban"
                        ? "Processing…"
                        : "Ban Reported User & Resolve"}
                    </Btn>
                  </div>

                  <div style={{
                    marginTop: 10, padding: "10px 14px",
                    background: "#fffbeb", borderRadius: 10,
                    border: "1px solid #fde68a",
                    fontSize: 11.5, color: "#92400e",
                    lineHeight: 1.5,
                    display: "flex", gap: 8, alignItems: "flex-start",
                  }}>
                    <span style={{ flexShrink: 0, marginTop: 1 }}>
                      {Ic.warn}
                    </span>
                    <span>
                      <strong>Ban</strong> will immediately restrict the reported
                      user's account and resolve this report.
                    </span>
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </div>

      <style>{`
        @keyframes rpt-slideright {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes rpt-fadein {
          from { opacity: 0; } to { opacity: 1; }
        }
        @keyframes rpt-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}

/* ══════════════════════════════════════════════
   REPORT TABLE ROW
══════════════════════════════════════════════ */
function ReportRow({ r, onClick, selected }) {
  const [hov, setHov] = useState(false);
  return (
    <tr
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        cursor: "pointer",
        background: selected ? "#eff6ff"
          : hov ? "#fafafa" : "transparent",
        transition: "background .1s",
        borderLeft: selected
          ? "3px solid #2563eb"
          : "3px solid transparent",
      }}
    >
      {/* Reporter */}
      <td style={{ padding: "12px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Av src={r.reporter_image} name={r.reporter_name} size={34}/>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 13, fontWeight: 700, color: "#18181b",
              whiteSpace: "nowrap", overflow: "hidden",
              textOverflow: "ellipsis", maxWidth: 150,
            }}>
              {r.reporter_name || "Unknown"}
            </div>
            <div style={{
              fontSize: 11, color: "#888",
              whiteSpace: "nowrap", overflow: "hidden",
              textOverflow: "ellipsis", maxWidth: 150,
            }}>
              {r.reporter_email}
            </div>
          </div>
        </div>
      </td>

      {/* Reported */}
      <td style={{ padding: "12px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Av src={r.reported_image} name={r.reported_name} size={34}/>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 13, fontWeight: 700, color: "#18181b",
              whiteSpace: "nowrap", overflow: "hidden",
              textOverflow: "ellipsis", maxWidth: 150,
            }}>
              {r.reported_name || "Unknown"}
            </div>
            <div style={{
              fontSize: 11, color: "#888",
              whiteSpace: "nowrap", overflow: "hidden",
              textOverflow: "ellipsis", maxWidth: 150,
            }}>
              {r.reported_email}
            </div>
          </div>
        </div>
      </td>

      {/* Reason */}
      <td style={{ padding: "12px 16px" }}>
        <ReasonTag reason={r.reason}/>
      </td>

      {/* Status */}
      <td style={{ padding: "12px 16px" }}>
        <StatusTag status={r.status}/>
      </td>

      {/* Time */}
      <td style={{ padding: "12px 16px" }}>
        <div style={{
          fontSize: 12, color: "#555",
          fontWeight: 600, whiteSpace: "nowrap",
          display: "flex", alignItems: "center", gap: 4,
        }}>
          {Ic.clock}
          {timeAgo(r.created_at)}
        </div>
        <div style={{ fontSize: 11, color: "#bbb", marginTop: 2 }}>
          {new Date(r.created_at).toLocaleDateString("en-GB", {
            day: "2-digit", month: "short", year: "numeric",
          })}
        </div>
      </td>

      {/* Lock */}
      <td style={{ padding: "12px 16px" }}>
        {r.is_under_review && (
          <Tag
            label="Locked"
            color="#d97706" bg="#fffbeb" ring="#fde68a"
            icon={Ic.lock} small
          />
        )}
      </td>
    </tr>
  );
}

/* ══════════════════════════════════════════════
   MAIN REPORTS PAGE
══════════════════════════════════════════════ */
export default function Reports() {
  const [reports,  setReports]  = useState([]);
  const [stats,    setStats]    = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState("all");
  const [search,   setSearch]   = useState("");
  const [selected, setSelected] = useState(null);
  const [page,     setPage]     = useState(1);
  const PER       = 20;
  const searchRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rr, sr] = await Promise.all([
        api.get(`/reports?status=${filter}&limit=500`),
        api.get("/reports/stats"),
      ]);
      setReports(
        Array.isArray(rr.data?.reports) ? rr.data.reports
        : Array.isArray(rr.data)        ? rr.data
        : []
      );
      setStats(sr.data);
    } catch (e) {
      console.error("Reports:", e.message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); setPage(1); }, [load]);

  /* "/" shortcut to focus search */
  useEffect(() => {
    const h = (e) => {
      if (e.key === "/" && document.activeElement !== searchRef.current) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return reports;
    const q = search.toLowerCase();
    return reports.filter(r =>
      [r.reporter_name, r.reporter_email,
       r.reported_name, r.reported_email, r.reason]
        .join(" ").toLowerCase().includes(q)
    );
  }, [reports, search]);

  const pages = Math.max(1, Math.ceil(filtered.length / PER));
  const slice = filtered.slice((page - 1) * PER, page * PER);

  const TABS = useMemo(() => [
    { key: "all",       label: "All",       n: stats?.total     ?? null },
    { key: "pending",   label: "Pending",   n: stats?.pending   ?? null },
    { key: "reviewing", label: "Reviewing", n: stats?.reviewing ?? null },
    { key: "resolved",  label: "Resolved",  n: stats?.resolved  ?? null },
    { key: "dismissed", label: "Dismissed", n: stats?.dismissed ?? null },
  ], [stats]);

  const TH = ({ children, width }) => (
    <th style={{
      padding: "10px 16px", textAlign: "left",
      fontSize: 11, fontWeight: 700, color: "#888",
      textTransform: "uppercase", letterSpacing: ".5px",
      background: "#fafafa",
      borderBottom: "1px solid #f0f0f0",
      whiteSpace: "nowrap", width,
    }}>
      {children}
    </th>
  );

  return (
    <div style={{ padding: "0 0 40px" }}>

      {/* Page header */}
      <div style={{
        display: "flex", alignItems: "flex-start",
        justifyContent: "space-between",
        marginBottom: 24, flexWrap: "wrap", gap: 12,
      }}>
        <div>
          <h1 style={{
            margin: 0, fontSize: 22, fontWeight: 900,
            color: "#18181b", letterSpacing: "-.3px",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{
              width: 36, height: 36, borderRadius: 10,
              background: "#fef2f2",
              display: "flex", alignItems: "center",
              justifyContent: "center", color: "#ef4444",
            }}>
              {Ic.flag}
            </span>
            Reports
          </h1>
          <p style={{ margin: "6px 0 0 46px", fontSize: 13, color: "#888" }}>
            Review and action user-submitted chat reports
          </p>
        </div>
        <Btn variant="ghost" onClick={load}>
          {Ic.refresh} Refresh
        </Btn>
      </div>

      {/* Stat chips */}
      {stats && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))",
          gap: 10, marginBottom: 24,
        }}>
          <Chip label="Total Reports"  value={stats.total}
            color="#6366f1" icon={Ic.stats}/>
          <Chip label="Pending"        value={stats.pending}
            color="#d97706" icon={Ic.warn}/>
          <Chip label="Reviewing"      value={stats.reviewing}
            color="#2563eb" icon={Ic.eye}/>
          <Chip label="Resolved"       value={stats.resolved}
            color="#16a34a" icon={Ic.check}/>
          <Chip label="Dismissed"      value={stats.dismissed}
            color="#6b7280" icon={Ic.x}/>
          <Chip label="Last 24 h"      value={stats.last_24h}
            color="#db2777" icon={Ic.clock}/>
          <Chip label="Last 7 days"    value={stats.last_7d}
            color="#7c3aed" icon={Ic.clock}/>
        </div>
      )}

      {/* Main card */}
      <div style={{
        background: "#fff", borderRadius: 16,
        border: "1px solid #f0f0f0",
        boxShadow: "0 1px 8px rgba(0,0,0,.06)",
        overflow: "hidden",
      }}>

        {/* Status tabs */}
        <div style={{
          display: "flex", overflowX: "auto",
          borderBottom: "1px solid #f0f0f0",
          scrollbarWidth: "none",
        }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => { setFilter(t.key); setPage(1); }}
              style={{
                padding: "13px 18px", border: "none",
                background: "transparent", fontSize: 13,
                fontWeight: filter === t.key ? 800 : 500,
                color: filter === t.key ? "#18181b" : "#888",
                cursor: "pointer", whiteSpace: "nowrap",
                borderBottom: filter === t.key
                  ? "2.5px solid #18181b"
                  : "2.5px solid transparent",
                display: "flex", alignItems: "center", gap: 7,
                transition: "all .15s",
              }}
            >
              {t.label}
              {t.n != null && (
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  background: filter === t.key ? "#18181b" : "#e5e7eb",
                  color: filter === t.key ? "#fff" : "#555",
                  borderRadius: 20, padding: "1px 7px",
                  minWidth: 20, textAlign: "center", lineHeight: "16px",
                }}>
                  {t.n}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search + result count */}
        <div style={{
          padding: "12px 16px", borderBottom: "1px solid #f0f0f0",
          display: "flex", gap: 10, alignItems: "center",
        }}>
          <div style={{ position: "relative", flex: 1 }}>
            <span style={{
              position: "absolute", left: 11, top: "50%",
              transform: "translateY(-50%)", opacity: .35,
              pointerEvents: "none",
              display: "flex", alignItems: "center",
            }}>
              {Ic.search}
            </span>
            <input
              ref={searchRef}
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search name, email or reason… (press / to focus)"
              style={{
                width: "100%", padding: "9px 12px 9px 34px",
                borderRadius: 10, border: "1.5px solid #e5e7eb",
                fontSize: 13, background: "#f9fafb",
                outline: "none", boxSizing: "border-box",
                transition: "border-color .15s",
              }}
              onFocus={e => (e.target.style.borderColor = "#18181b")}
              onBlur={e  => (e.target.style.borderColor = "#e5e7eb")}
            />
          </div>

          {search && (
            <Btn variant="ghost"
              onClick={() => { setSearch(""); setPage(1); }}>
              {Ic.close} Clear
            </Btn>
          )}

          <div style={{
            fontSize: 12, color: "#888",
            whiteSpace: "nowrap", fontWeight: 500,
          }}>
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{
            padding: "64px 24px", textAlign: "center",
            display: "flex", flexDirection: "column",
            alignItems: "center", gap: 14, color: "#888",
          }}>
            <Spinner size={32}/>
            Loading reports…
          </div>
        ) : filtered.length === 0 ? (
          filter === "all" && !search ? (
            <EmptyState
              icon={
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth={1.5}
                  strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                  <line x1="4" y1="22" x2="4" y2="15"/>
                </svg>
              }
              title="No reports yet"
              subtitle="When users submit reports from chat, they will appear here."
            />
          ) : (
            <EmptyState
              icon={Ic.search}
              title="No matching reports"
              subtitle={`No ${filter !== "all" ? filter : ""} reports match your search.`}
            />
          )
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{
              width: "100%", borderCollapse: "collapse",
              tableLayout: "auto",
            }}>
              <thead>
                <tr>
                  <TH>Reporter (Buyer)</TH>
                  <TH>Reported (Seller)</TH>
                  <TH width={160}>Reason</TH>
                  <TH width={120}>Status</TH>
                  <TH width={130}>Submitted</TH>
                  <TH width={90}>Lock</TH>
                </tr>
              </thead>
              <tbody>
                {slice.map(r => (
                  <ReportRow
                    key={r.id}
                    r={r}
                    selected={selected === r.id}
                    onClick={() =>
                      setSelected(selected === r.id ? null : r.id)
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div style={{
            display: "flex", alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderTop: "1px solid #f0f0f0",
            background: "#fafafa",
          }}>
            <div style={{ fontSize: 12, color: "#888" }}>
              {((page - 1) * PER) + 1}–
              {Math.min(page * PER, filtered.length)} of{" "}
              {filtered.length} reports
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <Btn
                variant="outline"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                {Ic.chevLeft} Prev
              </Btn>
              {Array.from(
                { length: Math.min(pages, 7) }, (_, i) => i + 1
              ).map(n => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  style={{
                    width: 32, height: 32, borderRadius: 8,
                    border: n === page
                      ? "1.5px solid #18181b"
                      : "1.5px solid #e5e7eb",
                    background: n === page ? "#18181b" : "#fff",
                    color: n === page ? "#fff" : "#555",
                    fontSize: 13, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  {n}
                </button>
              ))}
              <Btn
                variant="outline"
                onClick={() => setPage(p => Math.min(pages, p + 1))}
                disabled={page === pages}
              >
                Next {Ic.chevRight}
              </Btn>
            </div>
          </div>
        )}
      </div>

      {/* Drawer */}
      {selected && (
        <ReportDrawer
          reportId={selected}
          onClose={() => setSelected(null)}
          onRefresh={() => { load(); setSelected(null); }}
        />
      )}

      <style>{`
        @keyframes rpt-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}