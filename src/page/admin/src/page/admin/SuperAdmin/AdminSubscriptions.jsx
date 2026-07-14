// src/pages/admin/SuperAdmin/AdminSubscriptions.jsx

import { useState, useEffect, useCallback, useRef, useMemo } from "react";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;
const ADM      = `${BASE_URL}/api/admin`;

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════════════════ */
const LIMIT = 20;

const PLAN_SLUGS  = ["premium", "pro", "business", "elite", "diamond"];
const PLAN_BADGE  = { premium: "⭐", pro: "🔥", business: "👑", elite: "🌟", diamond: "💎", free: "" };
const PLAN_LABELS = { premium: "Premium", pro: "Pro", business: "Business", elite: "Elite", diamond: "Diamond" };

const STATUS_STYLES = {
  active     : { bg: "#dcfce7", color: "#166534" },
  expired    : { bg: "#f3f4f6", color: "#6b7280" },
  cancelled  : { bg: "#fef2f2", color: "#b91c1c" },
  superseded : { bg: "#dbeafe", color: "#2563eb" },
  pending    : { bg: "#fef9c3", color: "#854d0e" },
  failed     : { bg: "#fef2f2", color: "#b91c1c" },
  trial      : { bg: "#f3e8ff", color: "#7c3aed" },
  suspended  : { bg: "#fff7ed", color: "#c2410c" },
};

const COLORS = {
  orange : "#FF5C00",
  green  : "#16a34a",
  red    : "#b91c1c",
  blue   : "#2563eb",
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
const naira   = (kobo) => "₦" + Number((kobo ?? 0) / 100).toLocaleString("en-NG");
const fmt     = (d)    => d ? new Date(d).toLocaleDateString("en-NG", { year: "numeric", month: "short",  day: "numeric" }) : "—";
const fmtFull = (d)    => d ? new Date(d).toLocaleDateString("en-NG", { year: "numeric", month: "long",   day: "numeric" }) : "—";
const fmtTime = (d)    => d ? new Date(d).toLocaleString("en-NG",     { year: "numeric", month: "short",  day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const expiringSoon = (sub) =>
  sub.status === "active" && sub.expires_at &&
  new Date(sub.expires_at) < new Date(Date.now() + 3 * 86400000);

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href    = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

/* ═══════════════════════════════════════════════════════════════════════════
   MICRO COMPONENTS
═══════════════════════════════════════════════════════════════════════════ */

/* ── StatusPill ─────────────────────────────────────────────────────────── */
function StatusPill({ status }) {
  const s = STATUS_STYLES[status] ?? { bg: "#f3f4f6", color: "#6b7280" };
  const label =
    status === "superseded" ? "Upgraded"
    : status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span style={{
      background: s.bg, color: s.color,
      borderRadius: 100, padding: "2px 10px",
      fontSize: ".6875rem", fontWeight: 600, whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

/* ── StatCard ────────────────────────────────────────────────────────────── */
function StatCard({ label, value, sub, accent, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: COLORS.card, border: `1px solid ${COLORS.border}`,
        borderRadius: 10, padding: "16px 18px",
        cursor: onClick ? "pointer" : "default",
        transition: "box-shadow .15s",
      }}
      onMouseEnter={(e) => onClick && (e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,.08)")}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "")}
    >
      <div style={{ fontSize: ".72rem", color: COLORS.muted, marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: "1.4rem", fontWeight: 700, color: accent ?? COLORS.text, lineHeight: 1.1 }}>
        {value ?? "—"}
      </div>
      {sub && <div style={{ fontSize: ".68rem", color: COLORS.muted, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

/* ── Btn ─────────────────────────────────────────────────────────────────── */
function Btn({ children, onClick, disabled, variant = "ghost", style = {} }) {
  const base = {
    display: "inline-flex", alignItems: "center", gap: 5,
    padding: "6px 12px", borderRadius: 6, border: "1px solid transparent",
    fontSize: ".75rem", fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? .5 : 1, transition: "background .12s", fontFamily: "inherit",
  };
  const variants = {
    ghost   : { background: COLORS.card,    color: COLORS.text,  border: `1px solid ${COLORS.border}` },
    primary : { background: COLORS.orange,  color: "#fff",        border: `1px solid ${COLORS.orange}` },
    success : { background: "#dcfce7",      color: COLORS.green,  border: "1px solid #bbf7d0" },
    danger  : { background: "#fef2f2",      color: COLORS.red,    border: "1px solid #fecaca" },
    ink     : { background: "#141210",      color: "#fff",        border: "1px solid #141210" },
    blue    : { background: "#dbeafe",      color: COLORS.blue,   border: "1px solid #bfdbfe" },
    warning : { background: "#fef9c3",      color: "#854d0e",     border: "1px solid #fde68a" },
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ ...base, ...variants[variant], ...style }}
    >
      {children}
    </button>
  );
}

/* ── Divider ─────────────────────────────────────────────────────────────── */
const Divider = () => <div style={{ borderTop: `1px solid ${COLORS.border}`, margin: "14px 0" }} />;

/* ── MiniTag ─────────────────────────────────────────────────────────────── */
function MiniTag({ val, good }) {
  if (val === "true"  || val === true)  return <span style={{ color: COLORS.green, fontWeight: 700 }}>✓ Yes</span>;
  if (val === "false" || val === false) return <span style={{ color: COLORS.muted }}>✕ No</span>;
  if (val === "0" || val === 0)         return <span style={{ color: COLORS.muted }}>—</span>;
  return <span style={{ color: COLORS.text, fontWeight: 600, textTransform: "capitalize" }}>{val}</span>;
}

/* ── Spinner ─────────────────────────────────────────────────────────────── */
const Spinner = ({ size = 14 }) => (
  <span style={{
    display: "inline-block", width: size, height: size,
    border: "2px solid currentColor", borderTopColor: "transparent",
    borderRadius: "50%", animation: "aspin .6s linear infinite",
    flexShrink: 0,
  }} />
);

/* ── SimpleBar chart ─────────────────────────────────────────────────────── */
function BarChart({ data, valueKey, labelKey, color = COLORS.orange, height = 120 }) {
  if (!data?.length) return <div style={{ color: COLORS.muted, fontSize: ".78rem", padding: "20px 0" }}>No data</div>;

  const max  = Math.max(...data.map((d) => d[valueKey] ?? 0));
  const barW = Math.max(12, Math.min(40, Math.floor(600 / data.length) - 6));

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height, minWidth: data.length * (barW + 4) }}>
        {data.map((d, i) => {
          const pct = max > 0 ? (d[valueKey] ?? 0) / max : 0;
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, flex: 1 }}>
              <div style={{
                width: "100%", background: color, borderRadius: "3px 3px 0 0",
                height: Math.max(3, pct * (height - 20)), opacity: .88,
                title: naira((d[valueKey] ?? 0) * 100),
              }} />
              <span style={{ fontSize: ".55rem", color: COLORS.muted, whiteSpace: "nowrap" }}>
                {d[labelKey]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Plan distribution bar ───────────────────────────────────────────────── */
function PlanDistribution({ byPlan }) {
  const total = Object.values(byPlan).reduce((a, b) => a + b, 0) || 1;
  const planColors = {
    premium: "#eab308", pro: "#FF5C00", business: "#9333ea",
    elite: "#2563eb", diamond: "#06b6d4",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {PLAN_SLUGS.map((slug) => {
        const count = byPlan[slug] ?? 0;
        const pct   = Math.round((count / total) * 100);
        return (
          <div key={slug} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 70, fontSize: ".72rem", color: COLORS.text, fontWeight: 600 }}>
              {PLAN_BADGE[slug]} {PLAN_LABELS[slug]}
            </span>
            <div style={{ flex: 1, background: COLORS.border, borderRadius: 100, height: 8, overflow: "hidden" }}>
              <div style={{
                width: `${pct}%`, height: "100%", borderRadius: 100,
                background: planColors[slug], transition: "width .4s",
              }} />
            </div>
            <span style={{ width: 32, fontSize: ".72rem", color: COLORS.muted, textAlign: "right" }}>{count}</span>
            <span style={{ width: 34, fontSize: ".68rem", color: COLORS.muted }}>{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Expiring widget ─────────────────────────────────────────────────────── */
function ExpiringWidget({ expiring, onFilter }) {
  const today = expiring?.filter((s) =>
    new Date(s.expires_at) <= new Date(Date.now() + 86400000)
  ).length ?? 0;

  const in3 = expiring?.filter((s) => {
    const d = new Date(s.expires_at);
    return d > new Date(Date.now() + 86400000) && d <= new Date(Date.now() + 3 * 86400000);
  }).length ?? 0;

  const inWeek = expiring?.filter((s) => {
    const d = new Date(s.expires_at);
    return d > new Date(Date.now() + 3 * 86400000) && d <= new Date(Date.now() + 7 * 86400000);
  }).length ?? 0;

  const items = [
    { label: "Expires Today",      count: today, color: COLORS.red   },
    { label: "Expires in 3 Days",  count: in3,   color: "#c2410c"    },
    { label: "Expires this Week",  count: inWeek, color: "#854d0e"   },
  ];

  return (
    <div style={{
      background: COLORS.card, border: `1px solid ${COLORS.border}`,
      borderRadius: 10, padding: "14px 18px",
    }}>
      <div style={{ fontSize: ".78rem", fontWeight: 600, marginBottom: 10 }}>⏰ Expiring Soon</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {items.map((item) => (
          <div
            key={item.label}
            onClick={() => onFilter?.("expiring")}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              cursor: "pointer", padding: "4px 0",
            }}
          >
            <span style={{ fontSize: ".75rem", color: COLORS.muted }}>{item.label}</span>
            <span style={{
              background: item.count > 0 ? "#fef2f2" : COLORS.bg,
              color: item.count > 0 ? item.color : COLORS.muted,
              borderRadius: 100, padding: "1px 10px", fontWeight: 700, fontSize: ".78rem",
            }}>
              {item.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   DETAIL DRAWER
═══════════════════════════════════════════════════════════════════════════ */
function DetailDrawer({ sub, api, onClose, onMutation, confirm }) {
  const [tab,          setTab]          = useState("overview");
  const [payments,     setPayments]     = useState([]);
  const [features,     setFeatures]     = useState({});
  const [timeline,     setTimeline]     = useState([]);
  const [notes,        setNotes]        = useState([]);
  const [newNote,      setNewNote]      = useState("");
  const [loading,      setLoading]      = useState(false);
  const [busy,         setBusy]         = useState(null);
  const [extendDays,   setExtendDays]   = useState(30);
  const [customDate,   setCustomDate]   = useState("");
  const [targetPlan,   setTargetPlan]   = useState(sub?.plan_slug ?? "premium");

  /* ── Load tab data ──────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!sub) return;
    setTab("overview");
    loadPayments();
    loadFeatures();
    loadTimeline();
    loadNotes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub?.id]);

  const loadPayments = async () => {
    try {
      const { data } = await api.get(`/subscriptions/${sub.user_id}/payments`, ADM);
      setPayments(data.transactions ?? []);
    } catch { setPayments([]); }
  };

  const loadFeatures = async () => {
    try {
      const { data } = await api.get(`/subscriptions/${sub.user_id}/features`, ADM);
      setFeatures(data.features ?? {});
    } catch { setFeatures({}); }
  };

  const loadTimeline = async () => {
    try {
      const { data } = await api.get(`/subscriptions/${sub.user_id}/timeline`, ADM);
      setTimeline(data.timeline ?? []);
    } catch { setTimeline([]); }
  };

  const loadNotes = async () => {
    try {
      const { data } = await api.get(`/subscriptions/${sub.user_id}/notes`, ADM);
      setNotes(data.notes ?? []);
    } catch { setNotes([]); }
  };

  /* ── Actions ────────────────────────────────────────────────────────────── */
  const run = async (key, fn) => {
    setBusy(key);
    try { await fn(); onMutation?.(); }
    catch (err) { alert(err?.response?.data?.message ?? err.message); }
    finally { setBusy(null); }
  };

  const handleChangePlan = () => {
    confirm({
      title   : "Change Plan",
      body    : `Move ${sub.user_name} from ${sub.plan_slug} → ${targetPlan}? No payment will be charged.`,
      confirm : "Change Plan",
      action  : () => run("changePlan", async () => {
        await api.post(`/subscriptions/${sub.user_id}/change-plan`, { plan: targetPlan }, ADM);
      }),
    });
  };

  const handleExtend = (days) => {
    const label = days ? `+${days} days` : `until ${customDate}`;
    confirm({
      title   : "Extend Subscription",
      body    : `Extend ${sub.user_name}'s subscription by ${label}?`,
      confirm : "Extend",
      action  : () => run("extend", async () => {
        await api.post(`/subscriptions/${sub.user_id}/extend`, {
          days      : days ?? null,
          until_date: days ? null : customDate,
        }, ADM);
      }),
    });
  };

  const handleToggleAutoRenew = () =>
    run("autoRenew", async () => {
      await api.post(`/subscriptions/${sub.user_id}/toggle-auto-renew`, {
        autoRenew: !sub.auto_renew,
      }, ADM);
    });

  const handleReactivate = () => {
    confirm({
      title   : "Reactivate Subscription",
      body    : `Reactivate ${sub.user_name}'s ${sub.plan_slug} subscription?`,
      confirm : "Reactivate",
      action  : () => run("reactivate", async () => {
        await api.post(`/subscriptions/${sub.user_id}/reactivate`, {}, ADM);
      }),
    });
  };

  const handleCancel = () => {
    confirm({
      title   : "Cancel Subscription",
      body    : `Cancel ${sub.user_name}'s subscription? They retain access until expiry.`,
      danger  : true,
      confirm : "Cancel",
      action  : () => run("cancel", async () => {
        await api.post(`/subscriptions/${sub.user_id}/cancel`, {}, ADM);
      }),
    });
  };

  const handleSuspend = () => {
    confirm({
      title   : "Suspend Subscription",
      body    : `Suspend ${sub.user_name}'s subscription immediately?`,
      danger  : true,
      confirm : "Suspend",
      action  : () => run("suspend", async () => {
        await api.post(`/subscriptions/${sub.user_id}/suspend`, {}, ADM);
      }),
    });
  };

  const handleSendNotification = (type) =>
    run(`notif-${type}`, async () => {
      await api.post(`/subscriptions/${sub.user_id}/notify`, { type }, ADM);
      alert(`${type} sent to ${sub.user_email}`);
    });

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    await run("addNote", async () => {
      await api.post(`/subscriptions/${sub.user_id}/notes`, { content: newNote }, ADM);
      setNewNote("");
      loadNotes();
    });
  };

  /* ── Tabs ────────────────────────────────────────────────────────────────── */
  const TABS = [
    { id: "overview",  label: "Overview"  },
    { id: "actions",   label: "Actions"   },
    { id: "payments",  label: "Payments"  },
    { id: "features",  label: "Features"  },
    { id: "timeline",  label: "Timeline"  },
    { id: "notes",     label: "Notes"     },
  ];

  if (!sub) return null;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.45)",
          zIndex: 1000, backdropFilter: "blur(3px)",
        }}
      />

      {/* Drawer */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: "min(680px, 95vw)", background: COLORS.card,
        zIndex: 1001, display: "flex", flexDirection: "column",
        boxShadow: "-8px 0 40px rgba(0,0,0,.18)",
        overflowY: "auto",
      }}>

        {/* ── Drawer header ─────────────────────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          padding: "20px 24px 16px", borderBottom: `1px solid ${COLORS.border}`,
          position: "sticky", top: 0, background: COLORS.card, zIndex: 10,
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: "1.25rem" }}>{PLAN_BADGE[sub.plan_slug] ?? ""}</span>
              <span style={{ fontSize: "1rem", fontWeight: 700 }}>
                {sub.user_name ?? "Unknown Seller"}
              </span>
              <StatusPill status={sub.status} />
            </div>
            <div style={{ fontSize: ".75rem", color: COLORS.muted }}>
              {sub.user_email} · {sub.plan_name ?? sub.plan_slug}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.25rem", color: COLORS.muted, padding: 4 }}
          >
            ×
          </button>
        </div>

        {/* ── Tabs ──────────────────────────────────────────────────────── */}
        <div style={{
          display: "flex", gap: 0, borderBottom: `1px solid ${COLORS.border}`,
          overflowX: "auto", flexShrink: 0,
        }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: "10px 16px", border: "none", background: "none",
                fontFamily: "inherit", fontSize: ".78rem", fontWeight: 600,
                color: tab === t.id ? COLORS.orange : COLORS.muted,
                borderBottom: `2px solid ${tab === t.id ? COLORS.orange : "transparent"}`,
                cursor: "pointer", whiteSpace: "nowrap", transition: "color .12s",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab content ───────────────────────────────────────────────── */}
        <div style={{ padding: "20px 24px", flex: 1 }}>

          {/* OVERVIEW */}
          {tab === "overview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Seller info */}
              <Section title="Seller Information">
                <InfoRow label="Name"              value={sub.user_name       ?? "—"} />
                <InfoRow label="Email"             value={sub.user_email      ?? "—"} />
                <InfoRow label="Phone"             value={sub.user_phone      ?? "—"} />
                <InfoRow label="Business Name"     value={sub.business_name   ?? "—"} />
                <InfoRow label="Business Verified" value={sub.store_verified ? "Yes" : "No"} />
              </Section>

              {/* Subscription info */}
              <Section title="Subscription Details">
                <InfoRow label="Subscription ID"  value={sub.id} mono />
                <InfoRow label="Plan"             value={`${PLAN_BADGE[sub.plan_slug] ?? ""} ${sub.plan_name ?? sub.plan_slug}`} />
                <InfoRow label="Status"           value={<StatusPill status={sub.status} />} />
                <InfoRow label="Billing Cycle"    value={sub.billing_cycle ?? "—"} />
                <InfoRow label="Amount"           value={sub.amount ? naira(sub.amount) : "—"} />
                <InfoRow label="Started"          value={fmtFull(sub.started_at)} />
                <InfoRow label="Next Billing"     value={fmtFull(sub.expires_at)} />
                <InfoRow label="Last Renewal"     value={fmtFull(sub.last_renewed_at)} />
                <InfoRow label="Auto Renew"       value={sub.auto_renew ? "✅ Enabled" : "❌ Disabled"} />
                <InfoRow label="Payment Ref"      value={sub.payment_reference ?? "—"} mono />
              </Section>
            </div>
          )}

          {/* ACTIONS */}
          {tab === "actions" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

              {/* Change plan */}
              <Section title="Change Plan (No Payment Required)">
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <select
                    value={targetPlan}
                    onChange={(e) => setTargetPlan(e.target.value)}
                    style={{
                      flex: 1, minWidth: 140, padding: "7px 10px",
                      border: `1px solid ${COLORS.border}`, borderRadius: 6,
                      fontSize: ".8rem", background: COLORS.card, color: COLORS.text,
                    }}
                  >
                    {["free", ...PLAN_SLUGS].map((s) => (
                      <option key={s} value={s}>
                        {PLAN_BADGE[s] ?? ""} {PLAN_LABELS[s] ?? s.charAt(0).toUpperCase() + s.slice(1)}
                      </option>
                    ))}
                  </select>
                  <Btn variant="primary" onClick={handleChangePlan} disabled={busy === "changePlan"}>
                    {busy === "changePlan" ? <Spinner /> : "Apply Plan"}
                  </Btn>
                </div>
                <p style={{ fontSize: ".7rem", color: COLORS.muted, marginTop: 6 }}>
                  This changes the plan immediately without charging the seller.
                </p>
              </Section>

              <Divider />

              {/* Extend subscription */}
              <Section title="Extend Subscription">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[7, 30, 90].map((d) => (
                    <Btn key={d} variant="blue" onClick={() => handleExtend(d)} disabled={!!busy}>
                      {busy === "extend" ? <Spinner /> : `+${d} Days`}
                    </Btn>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
                  <input
                    type="date"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    style={{
                      flex: 1, padding: "7px 10px", border: `1px solid ${COLORS.border}`,
                      borderRadius: 6, fontSize: ".8rem", background: COLORS.card, color: COLORS.text,
                    }}
                  />
                  <Btn variant="blue" onClick={() => handleExtend(null)} disabled={!customDate || !!busy}>
                    Extend to Date
                  </Btn>
                </div>
              </Section>

              <Divider />

              {/* Toggle auto-renew */}
              <Section title="Auto Renew">
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: ".82rem" }}>
                    {sub.auto_renew ? "✅ Currently Enabled" : "❌ Currently Disabled"}
                  </span>
                  <Btn
                    variant={sub.auto_renew ? "warning" : "success"}
                    onClick={handleToggleAutoRenew}
                    disabled={busy === "autoRenew"}
                  >
                    {busy === "autoRenew" ? <Spinner /> : sub.auto_renew ? "Disable" : "Enable"}
                  </Btn>
                </div>
              </Section>

              <Divider />

              {/* Reactivate / Cancel / Suspend */}
              <Section title="Subscription Control">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {(sub.status === "cancelled" || sub.status === "expired") && (
                    <Btn variant="success" onClick={handleReactivate} disabled={!!busy}>
                      {busy === "reactivate" ? <Spinner /> : "♻ Reactivate"}
                    </Btn>
                  )}
                  {sub.status === "active" && (
                    <>
                      <Btn variant="warning" onClick={handleSuspend} disabled={!!busy}>
                        {busy === "suspend" ? <Spinner /> : "⏸ Suspend"}
                      </Btn>
                      <Btn variant="danger" onClick={handleCancel} disabled={!!busy}>
                        {busy === "cancel" ? <Spinner /> : "✕ Cancel"}
                      </Btn>
                    </>
                  )}
                </div>
              </Section>

              <Divider />

              {/* Notifications */}
              <Section title="Send Notification">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[
                    { key: "renewal_reminder", label: "Renewal Reminder" },
                    { key: "invoice",          label: "Invoice" },
                    { key: "receipt",          label: "Receipt" },
                    { key: "upgrade_offer",    label: "Upgrade Offer" },
                  ].map(({ key, label }) => (
                    <Btn key={key} variant="ghost" onClick={() => handleSendNotification(key)} disabled={!!busy}>
                      {busy === `notif-${key}` ? <Spinner /> : `📧 ${label}`}
                    </Btn>
                  ))}
                </div>
              </Section>
            </div>
          )}

          {/* PAYMENTS */}
          {tab === "payments" && (
            <div>
              <div style={{ fontWeight: 600, marginBottom: 12, fontSize: ".85rem" }}>Payment History</div>
              {!payments.length ? (
                <p style={{ color: COLORS.muted, fontSize: ".8rem" }}>No payment records found.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {payments.map((p, i) => (
                    <div key={i} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "10px 0", borderBottom: i < payments.length - 1 ? `1px solid ${COLORS.border}` : "none",
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: ".8rem" }}>{p.amount ? naira(p.amount) : "—"}</div>
                        <div style={{ fontSize: ".7rem", color: COLORS.muted }}>{fmtTime(p.paid_at ?? p.created_at)}</div>
                        <div style={{ fontSize: ".68rem", color: COLORS.muted, fontFamily: "monospace" }}>
                          {p.reference ?? "—"}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <StatusPill status={p.status ?? "pending"} />
                        <div style={{ fontSize: ".68rem", color: COLORS.muted, marginTop: 3, textTransform: "capitalize" }}>
                          {p.provider ?? "paystack"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* FEATURES */}
          {tab === "features" && (
            <div>
              <div style={{ fontWeight: 600, marginBottom: 12, fontSize: ".85rem" }}>
                Features for {PLAN_BADGE[sub.plan_slug] ?? ""} {sub.plan_name ?? sub.plan_slug}
              </div>
              {!Object.keys(features).length ? (
                <p style={{ color: COLORS.muted, fontSize: ".8rem" }}>No feature data available.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {Object.entries(features).map(([key, val]) => (
                    <div key={key} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "9px 0", borderBottom: `1px solid ${COLORS.border}`,
                    }}>
                      <span style={{ fontSize: ".8rem", color: COLORS.text, textTransform: "capitalize" }}>
                        {key.replace(/_/g, " ")}
                      </span>
                      <MiniTag val={val} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TIMELINE */}
          {tab === "timeline" && (
            <div>
              <div style={{ fontWeight: 600, marginBottom: 12, fontSize: ".85rem" }}>Activity Timeline</div>
              {!timeline.length ? (
                <p style={{ color: COLORS.muted, fontSize: ".8rem" }}>No activity recorded yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {timeline.map((t, i) => (
                    <div key={i} style={{ display: "flex", gap: 12, paddingBottom: 14 }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <div style={{
                          width: 10, height: 10, borderRadius: "50%",
                          background: COLORS.orange, flexShrink: 0, marginTop: 3,
                        }} />
                        {i < timeline.length - 1 && (
                          <div style={{ width: 2, flex: 1, background: COLORS.border, marginTop: 3 }} />
                        )}
                      </div>
                      <div style={{ flex: 1, paddingBottom: 4 }}>
                        <div style={{ fontWeight: 600, fontSize: ".8rem", color: COLORS.text }}>
                          {t.event ?? t.action ?? "Event"}
                        </div>
                        {t.description && (
                          <div style={{ fontSize: ".72rem", color: COLORS.muted, marginTop: 2 }}>
                            {t.description}
                          </div>
                        )}
                        <div style={{ fontSize: ".68rem", color: COLORS.muted, marginTop: 3 }}>
                          {fmtTime(t.created_at)}
                          {t.admin_name && (
                            <span style={{ marginLeft: 8, color: COLORS.blue }}>
                              by {t.admin_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* NOTES */}
          {tab === "notes" && (
            <div>
              <div style={{ fontWeight: 600, marginBottom: 12, fontSize: ".85rem" }}>Admin Notes</div>

              {/* Add note */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a note about this subscription…"
                  rows={3}
                  style={{
                    width: "100%", padding: "8px 10px",
                    border: `1px solid ${COLORS.border}`, borderRadius: 7,
                    fontSize: ".8rem", background: COLORS.card, color: COLORS.text,
                    resize: "vertical", fontFamily: "inherit", boxSizing: "border-box",
                  }}
                />
                <Btn variant="primary" onClick={handleAddNote} disabled={!newNote.trim() || busy === "addNote"}>
                  {busy === "addNote" ? <Spinner /> : "Add Note"}
                </Btn>
              </div>

              {/* Notes list */}
              {!notes.length ? (
                <p style={{ color: COLORS.muted, fontSize: ".8rem" }}>No notes yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {notes.map((n, i) => (
                    <div key={i} style={{
                      background: COLORS.bg, border: `1px solid ${COLORS.border}`,
                      borderRadius: 8, padding: "10px 14px",
                    }}>
                      <p style={{ margin: 0, fontSize: ".8rem", lineHeight: 1.5 }}>{n.content}</p>
                      <div style={{ fontSize: ".68rem", color: COLORS.muted, marginTop: 6 }}>
                        {n.admin_name ?? "Admin"} · {fmtTime(n.created_at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ── Section wrapper ─────────────────────────────────────────────────────── */
function Section({ title, children }) {
  return (
    <div>
      <div style={{ fontSize: ".7rem", fontWeight: 700, textTransform: "uppercase",
                    letterSpacing: ".05em", color: COLORS.muted, marginBottom: 10 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

/* ── InfoRow ─────────────────────────────────────────────────────────────── */
function InfoRow({ label, value, mono }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "7px 0", borderBottom: `1px solid ${COLORS.border}`,
    }}>
      <span style={{ fontSize: ".78rem", color: COLORS.muted, flexShrink: 0, marginRight: 12 }}>{label}</span>
      <span style={{
        fontSize: ".78rem", fontWeight: 500, color: COLORS.text,
        textAlign: "right", wordBreak: "break-all",
        fontFamily: mono ? "monospace" : "inherit",
      }}>
        {value ?? "—"}
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   QUICK ACTION MENU
═══════════════════════════════════════════════════════════════════════════ */
function QuickMenu({ sub, onView, onAction, onClose }) {
  const menuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const items = [
    { label: "View Details",        action: "view",          color: COLORS.blue   },
    { label: "Change Plan",         action: "changePlan",    color: COLORS.text   },
    { label: "Extend Subscription", action: "extend",        color: COLORS.text   },
    { label: "Toggle Auto-Renew",   action: "toggleRenew",   color: COLORS.text   },
    ...(sub.status === "active" ? [
      { label: "Suspend",           action: "suspend",       color: "#c2410c"     },
      { label: "Cancel",            action: "cancel",        color: COLORS.red    },
    ] : []),
    ...((sub.status === "cancelled" || sub.status === "expired") ? [
      { label: "Reactivate",        action: "reactivate",    color: COLORS.green  },
    ] : []),
    { label: "View Payments",       action: "payments",      color: COLORS.text   },
    { label: "Send Email",          action: "sendEmail",     color: COLORS.text   },
  ];

  return (
    <div
      ref={menuRef}
      style={{
        position: "absolute", right: 0, top: "100%", zIndex: 100,
        background: COLORS.card, border: `1px solid ${COLORS.border}`,
        borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,.12)",
        minWidth: 180, overflow: "hidden",
      }}
    >
      {items.map((item) => (
        <button
          key={item.action}
          onClick={() => {
            if (item.action === "view") onView();
            else onAction(item.action);
            onClose();
          }}
          style={{
            display: "block", width: "100%", padding: "9px 14px",
            textAlign: "left", background: "none", border: "none",
            fontSize: ".78rem", fontWeight: 500, color: item.color ?? COLORS.text,
            cursor: "pointer", fontFamily: "inherit",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.hover)}
          onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   AUDIT LOG PANEL
═══════════════════════════════════════════════════════════════════════════ */
function AuditLog({ api }) {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/subscriptions/audit-log", ADM)
      .then(({ data }) => setLogs(data.logs ?? []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [api]);

  if (loading) return <div style={{ color: COLORS.muted, fontSize: ".78rem" }}>Loading…</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {!logs.length ? (
        <p style={{ color: COLORS.muted, fontSize: ".78rem" }}>No audit logs found.</p>
      ) : (
        logs.map((log, i) => (
          <div key={i} style={{
            display: "flex", gap: 12, padding: "10px 0",
            borderBottom: i < logs.length - 1 ? `1px solid ${COLORS.border}` : "none",
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: "50%", background: COLORS.bg,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: ".75rem", fontWeight: 700, color: COLORS.orange, flexShrink: 0,
            }}>
              {(log.admin_name ?? "?").charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: ".78rem", fontWeight: 600 }}>
                {log.action ?? "Action"}
              </div>
              <div style={{ fontSize: ".72rem", color: COLORS.muted }}>
                Admin: <strong>{log.admin_name ?? "—"}</strong>
                {log.target_user && ` · Seller: ${log.target_user}`}
              </div>
              <div style={{ fontSize: ".68rem", color: COLORS.muted, marginTop: 2 }}>
                {fmtTime(log.created_at)}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════════════ */
export default function AdminSubscriptions({
  api,
  subscriptionStats,
  cancelSellerSubscription,
  onMutation,
  confirm,
}) {
  /* ── State ───────────────────────────────────────────────────────────── */
  const [subscriptions,  setSubscriptions]  = useState([]);
  const [expiring,       setExpiring]       = useState([]);
  const [revenueData,    setRevenueData]    = useState({ daily: [], weekly: [], monthly: [] });
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);
  const [selectedSub,    setSelectedSub]    = useState(null);
  const [openMenuId,     setOpenMenuId]     = useState(null);
  const [selected,       setSelected]       = useState(new Set());
  const [section,        setSection]        = useState("table"); // table | audit
  const [revenueRange,   setRevenueRange]   = useState("daily");
  const [total,          setTotal]          = useState(0);
  const [exporting,      setExporting]      = useState(null);

  // Filters
  const [searchQ,       setSearchQ]       = useState("");
  const [planFilter,    setPlanFilter]    = useState("all");
  const [statusFilter,  setStatusFilter]  = useState("all");
  const [cycleFilter,   setCycleFilter]   = useState("all");
  const [autoRenewFilt, setAutoRenewFilt] = useState("all");
  const [dateFrom,      setDateFrom]      = useState("");
  const [dateTo,        setDateTo]        = useState("");
  const [page,          setPage]          = useState(1);

  /* ── Fetch ───────────────────────────────────────────────────────────── */
  const fetchSubscriptions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page, limit: LIMIT,
        ...(planFilter    !== "all" && { plan:       planFilter    }),
        ...(statusFilter  !== "all" && { status:     statusFilter  }),
        ...(cycleFilter   !== "all" && { cycle:      cycleFilter   }),
        ...(autoRenewFilt !== "all" && { auto_renew: autoRenewFilt }),
        ...(dateFrom                && { date_from:  dateFrom      }),
        ...(dateTo                  && { date_to:    dateTo        }),
        ...(searchQ.trim()          && { q:          searchQ.trim()}),
      });

      const { data } = await api.get(`/subscriptions?${params}`, ADM);
      setSubscriptions(data.subscriptions ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(err?.response?.data?.message ?? err.message ?? "Failed.");
    } finally {
      setLoading(false);
    }
  }, [api, page, planFilter, statusFilter, cycleFilter, autoRenewFilt, dateFrom, dateTo, searchQ]);

  const fetchExpiring = useCallback(async () => {
    try {
      const { data } = await api.get("/subscriptions/expiring", ADM);
      setExpiring(data.subscriptions ?? []);
    } catch { setExpiring([]); }
  }, [api]);

  const fetchRevenue = useCallback(async () => {
    try {
      const { data } = await api.get("/subscriptions/revenue", ADM);
      setRevenueData(data);
    } catch { setRevenueData({ daily: [], weekly: [], monthly: [] }); }
  }, [api]);

  useEffect(() => {
    fetchSubscriptions();
    fetchExpiring();
    fetchRevenue();
  }, [fetchSubscriptions, fetchExpiring, fetchRevenue]);

  /* ── Bulk actions ────────────────────────────────────────────────────── */
  const allSelected = subscriptions.length > 0 && selected.size === subscriptions.length;

  const toggleSelectAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(subscriptions.map((s) => s.id)));
  };

  const toggleSelect = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const handleBulkAction = async (action) => {
    const ids = [...selected];
    if (!ids.length) return alert("Select at least one row.");
    confirm({
      title   : `Bulk ${action} (${ids.length} subscriptions)`,
      body    : `Are you sure you want to ${action} ${ids.length} subscription(s)?`,
      danger  : action === "cancel",
      confirm : action.charAt(0).toUpperCase() + action.slice(1),
      action  : async () => {
        try {
          await api.post(`/subscriptions/bulk/${action}`, { ids }, ADM);
          setSelected(new Set());
          fetchSubscriptions();
          onMutation?.();
        } catch (err) { alert(err?.response?.data?.message ?? "Bulk action failed."); }
      },
    });
  };

  /* ── Export ──────────────────────────────────────────────────────────── */
  const handleExport = async (format) => {
    setExporting(format);
    try {
      const params = new URLSearchParams({ format,
        ...(planFilter   !== "all" && { plan:   planFilter   }),
        ...(statusFilter !== "all" && { status: statusFilter }),
        ...(searchQ.trim()         && { q:      searchQ.trim()}),
      });
      const res  = await fetch(`${ADM}/subscriptions/export?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("admin_token")}` },
      });
      const blob = await res.blob();
      const ext  = format === "pdf" ? "pdf" : format === "excel" ? "xlsx" : "csv";
      downloadBlob(blob, `subscriptions_${Date.now()}.${ext}`);
    } catch (err) { alert("Export failed: " + err.message); }
    finally { setExporting(null); }
  };

  /* ── Quick menu action handler ───────────────────────────────────────── */
  const handleQuickAction = (sub, action) => {
    switch (action) {
      case "view":        return setSelectedSub(sub);
      case "changePlan":  return setSelectedSub({ ...sub, _tab: "actions" });
      case "extend":      return setSelectedSub({ ...sub, _tab: "actions" });
      case "toggleRenew": return setSelectedSub({ ...sub, _tab: "actions" });
      case "suspend":
        confirm({
          title: "Suspend Subscription", body: `Suspend ${sub.user_name}'s subscription?`,
          danger: true, confirm: "Suspend",
          action: async () => {
            await api.post(`/subscriptions/${sub.user_id}/suspend`, {}, ADM);
            fetchSubscriptions(); onMutation?.();
          },
        });
        break;
      case "cancel":
        confirm({
          title: "Cancel Subscription", body: `Cancel ${sub.user_name}'s subscription?`,
          danger: true, confirm: "Cancel",
          action: async () => {
            await api.post(`/subscriptions/${sub.user_id}/cancel`, {}, ADM);
            fetchSubscriptions(); onMutation?.();
          },
        });
        break;
      case "reactivate":
        confirm({
          title: "Reactivate Subscription", body: `Reactivate ${sub.user_name}'s subscription?`,
          confirm: "Reactivate",
          action: async () => {
            await api.post(`/subscriptions/${sub.user_id}/reactivate`, {}, ADM);
            fetchSubscriptions(); onMutation?.();
          },
        });
        break;
      case "payments":
        return setSelectedSub({ ...sub, _tab: "payments" });
      case "sendEmail":
        return setSelectedSub({ ...sub, _tab: "actions" });
      default: break;
    }
  };

  /* ── Stats ───────────────────────────────────────────────────────────── */
  const stats    = subscriptionStats ?? {};
  const byPlan   = stats.byPlan ?? {};
  const totalPgs = Math.ceil(total / LIMIT);

  const revenueChartData = useMemo(() => {
    const map = { daily: "daily", weekly: "weekly", monthly: "monthly" };
    const key  = map[revenueRange] ?? "daily";
    return (revenueData[key] ?? []).map((d) => ({
      label : d.label ?? d.date ?? "—",
      value : d.amount ?? 0,
    }));
  }, [revenueData, revenueRange]);

  /* ════════════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════════════ */
  return (
    <div>
      <style>{`@keyframes aspin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Page title ────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>Seller Subscriptions</h2>
          <p style={{ fontSize: ".78rem", color: COLORS.muted, margin: "4px 0 0" }}>
            Full subscription management — upgrade, extend, cancel, audit.
          </p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Btn variant={section === "table" ? "primary" : "ghost"} onClick={() => setSection("table")}>Table</Btn>
          <Btn variant={section === "audit" ? "primary" : "ghost"} onClick={() => setSection("audit")}>Audit Log</Btn>
        </div>
      </div>

      {/* ── Stat cards ────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 18 }}>
        <StatCard label="Active"     value={stats.active    ?? "—"} accent={COLORS.green}  sub="paid subscribers" onClick={() => setStatusFilter("active")} />
        <StatCard label="MRR"        value={stats.mrr ? naira(stats.mrr) : "—"} accent={COLORS.orange} sub="monthly recurring" />
        <StatCard label="ARR"        value={stats.arr ? naira(stats.arr) : "—"} accent={COLORS.orange} sub="annual recurring" />
        <StatCard label="Total"      value={stats.total     ?? "—"} sub="all time" />
        <StatCard label="Expired"    value={stats.expired   ?? "—"} accent={COLORS.muted}  sub="lapsed" onClick={() => setStatusFilter("expired")} />
        <StatCard label="Cancelled"  value={stats.cancelled ?? "—"} accent={COLORS.red}    sub="cancelled" onClick={() => setStatusFilter("cancelled")} />
        <StatCard label="Today"      value={stats.today     ?? "—"} accent={COLORS.blue}   sub="new today" />
      </div>

      {/* ── Analytics row ─────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 18 }}>

        {/* Revenue chart */}
        <div style={{
          gridColumn: "1 / 3",
          background: COLORS.card, border: `1px solid ${COLORS.border}`,
          borderRadius: 10, padding: "16px 18px",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontWeight: 600, fontSize: ".82rem" }}>📈 Subscription Revenue</span>
            <div style={{ display: "flex", gap: 4 }}>
              {["daily", "weekly", "monthly"].map((r) => (
                <Btn key={r} variant={revenueRange === r ? "primary" : "ghost"} onClick={() => setRevenueRange(r)}
                  style={{ fontSize: ".65rem", padding: "3px 8px" }}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </Btn>
              ))}
            </div>
          </div>
          <BarChart data={revenueChartData} valueKey="value" labelKey="label" height={100} />
        </div>

        {/* Expiring soon */}
        <ExpiringWidget expiring={expiring} onFilter={() => setStatusFilter("active")} />
      </div>

      {/* ── Plan distribution ─────────────────────────────────────────── */}
      {Object.keys(byPlan).length > 0 && (
        <div style={{
          background: COLORS.card, border: `1px solid ${COLORS.border}`,
          borderRadius: 10, padding: "14px 18px", marginBottom: 18,
        }}>
          <div style={{ fontWeight: 600, fontSize: ".82rem", marginBottom: 12 }}>📊 Plan Distribution</div>
          <PlanDistribution byPlan={byPlan} />
        </div>
      )}

      {/* ── TABLE / AUDIT SECTIONS ─────────────────────────────────────── */}
      {section === "audit" ? (
        <div style={{
          background: COLORS.card, border: `1px solid ${COLORS.border}`,
          borderRadius: 10, padding: "16px 18px",
        }}>
          <div style={{ fontWeight: 600, fontSize: ".85rem", marginBottom: 14 }}>🔍 Audit Log</div>
          <AuditLog api={api} />
        </div>
      ) : (
        <>
          {/* ── Filters ─────────────────────────────────────────────── */}
          <div style={{
            background: COLORS.card, border: `1px solid ${COLORS.border}`,
            borderRadius: 10, padding: "14px 16px", marginBottom: 14,
          }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {/* Search */}
              <input
                type="text"
                placeholder="Name, email, phone, ID, reference, business…"
                value={searchQ}
                onChange={(e) => { setSearchQ(e.target.value); setPage(1); }}
                style={{
                  flex: 1, minWidth: 220, padding: "7px 10px",
                  border: `1px solid ${COLORS.border}`, borderRadius: 6,
                  fontSize: ".8rem", background: COLORS.card, color: COLORS.text,
                }}
              />

              {/* Plan */}
              <select value={planFilter}   onChange={(e) => { setPlanFilter(e.target.value);   setPage(1); }}
                style={{ padding: "7px 10px", border: `1px solid ${COLORS.border}`, borderRadius: 6, fontSize: ".8rem", background: COLORS.card, color: COLORS.text, cursor: "pointer" }}>
                <option value="all">All Plans</option>
                {PLAN_SLUGS.map((s) => (
                  <option key={s} value={s}>{PLAN_BADGE[s]} {PLAN_LABELS[s]}</option>
                ))}
              </select>

              {/* Status */}
              <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                style={{ padding: "7px 10px", border: `1px solid ${COLORS.border}`, borderRadius: 6, fontSize: ".8rem", background: COLORS.card, color: COLORS.text, cursor: "pointer" }}>
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="cancelled">Cancelled</option>
                <option value="superseded">Upgraded</option>
                <option value="trial">Trial</option>
                <option value="suspended">Suspended</option>
              </select>

              {/* Cycle */}
              <select value={cycleFilter} onChange={(e) => { setCycleFilter(e.target.value); setPage(1); }}
                style={{ padding: "7px 10px", border: `1px solid ${COLORS.border}`, borderRadius: 6, fontSize: ".8rem", background: COLORS.card, color: COLORS.text, cursor: "pointer" }}>
                <option value="all">Any Cycle</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>

              {/* Auto-renew */}
              <select value={autoRenewFilt} onChange={(e) => { setAutoRenewFilt(e.target.value); setPage(1); }}
                style={{ padding: "7px 10px", border: `1px solid ${COLORS.border}`, borderRadius: 6, fontSize: ".8rem", background: COLORS.card, color: COLORS.text, cursor: "pointer" }}>
                <option value="all">Auto Renew: Any</option>
                <option value="true">✅ Enabled</option>
                <option value="false">❌ Disabled</option>
              </select>
            </div>

            {/* Date range row */}
            <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: ".72rem", color: COLORS.muted }}>Date range:</span>
              <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                style={{ padding: "5px 8px", border: `1px solid ${COLORS.border}`, borderRadius: 5, fontSize: ".78rem", background: COLORS.card, color: COLORS.text }} />
              <span style={{ fontSize: ".72rem", color: COLORS.muted }}>to</span>
              <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                style={{ padding: "5px 8px", border: `1px solid ${COLORS.border}`, borderRadius: 5, fontSize: ".78rem", background: COLORS.card, color: COLORS.text }} />
              <Btn variant="ghost" onClick={() => { setDateFrom(""); setDateTo(""); setSearchQ(""); setPlanFilter("all"); setStatusFilter("all"); setCycleFilter("all"); setAutoRenewFilt("all"); setPage(1); }}>
                Clear
              </Btn>
              <Btn variant="ghost" onClick={fetchSubscriptions}>↻ Refresh</Btn>

              {/* Export buttons */}
              <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                <Btn variant="ghost" onClick={() => handleExport("csv")} disabled={!!exporting}>
                  {exporting === "csv" ? <Spinner /> : "📥 CSV"}
                </Btn>
                <Btn variant="ghost" onClick={() => handleExport("excel")} disabled={!!exporting}>
                  {exporting === "excel" ? <Spinner /> : "📊 Excel"}
                </Btn>
                <Btn variant="ghost" onClick={() => handleExport("pdf")} disabled={!!exporting}>
                  {exporting === "pdf" ? <Spinner /> : "🖨 PDF"}
                </Btn>
              </div>
            </div>
          </div>

          {/* ── Bulk action bar ──────────────────────────────────────── */}
          {selected.size > 0 && (
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              background: "#dbeafe", border: "1px solid #bfdbfe",
              borderRadius: 8, padding: "8px 14px", marginBottom: 10,
              flexWrap: "wrap",
            }}>
              <span style={{ fontSize: ".8rem", fontWeight: 600, color: COLORS.blue }}>
                {selected.size} selected
              </span>
              <Btn variant="blue"    onClick={() => handleBulkAction("extend")}>Extend</Btn>
              <Btn variant="warning" onClick={() => handleBulkAction("cancel")}>Cancel</Btn>
              <Btn variant="ghost"   onClick={() => handleBulkAction("export")}>Export</Btn>
              <Btn variant="ghost"   onClick={() => setSelected(new Set())} style={{ marginLeft: "auto" }}>
                Clear
              </Btn>
            </div>
          )}

          {/* ── Table ───────────────────────────────────────────────── */}
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: COLORS.muted, fontSize: ".85rem" }}>
              <Spinner size={20} /> <span style={{ marginLeft: 8 }}>Loading…</span>
            </div>
          ) : error ? (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "14px 18px", color: COLORS.red, fontSize: ".82rem" }}>
              {error}
              <button onClick={fetchSubscriptions} style={{ marginLeft: 10, background: "none", border: "none", color: COLORS.red, cursor: "pointer", textDecoration: "underline", fontFamily: "inherit", fontSize: ".82rem" }}>
                Retry
              </button>
            </div>
          ) : !subscriptions.length ? (
            <div style={{ textAlign: "center", padding: "48px 0", color: COLORS.muted }}>
              <div style={{ fontSize: "2rem", marginBottom: 8 }}>📋</div>
              <p style={{ fontSize: ".85rem" }}>No subscriptions match your filters.</p>
            </div>
          ) : (
            <>
              <div style={{ overflowX: "auto", background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".78rem" }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${COLORS.border}`, background: COLORS.bg }}>
                      <th style={{ padding: "10px 12px", textAlign: "left" }}>
                        <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
                      </th>
                      {["Seller", "Plan", "Cycle", "Amount", "Status", "Auto Renew", "Started", "Expires", "Actions"].map((h) => (
                        <th key={h} style={{
                          padding: "10px 12px", textAlign: "left",
                          fontWeight: 600, color: COLORS.muted,
                          fontSize: ".68rem", textTransform: "uppercase",
                          letterSpacing: ".04em", whiteSpace: "nowrap",
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions.map((sub) => (
                      <tr
                        key={sub.id}
                        style={{
                          borderBottom: `1px solid ${COLORS.border}`,
                          background: expiringSoon(sub) ? "#fff7ed" : undefined,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.hover)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = expiringSoon(sub) ? "#fff7ed" : "")}
                      >
                        {/* Checkbox */}
                        <td style={{ padding: "10px 12px" }}>
                          <input
                            type="checkbox"
                            checked={selected.has(sub.id)}
                            onChange={() => toggleSelect(sub.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>

                        {/* Seller */}
                        <td style={{ padding: "10px 12px" }}>
                          <div style={{ fontWeight: 600, color: COLORS.text, whiteSpace: "nowrap" }}>
                            {sub.user_name ?? "—"}
                          </div>
                          <div style={{ fontSize: ".68rem", color: COLORS.muted }}>
                            {sub.user_email ?? ""}
                          </div>
                        </td>

                        {/* Plan */}
                        <td style={{ padding: "10px 12px", whiteSpace: "nowrap", fontWeight: 600 }}>
                          {PLAN_BADGE[sub.plan_slug] ?? ""} {sub.plan_name ?? sub.plan_slug}
                        </td>

                        {/* Cycle */}
                        <td style={{ padding: "10px 12px", color: COLORS.muted, textTransform: "capitalize" }}>
                          {sub.billing_cycle ?? "—"}
                        </td>

                        {/* Amount */}
                        <td style={{ padding: "10px 12px", fontWeight: 700, whiteSpace: "nowrap" }}>
                          {sub.amount ? naira(sub.amount) : "—"}
                        </td>

                        {/* Status */}
                        <td style={{ padding: "10px 12px" }}>
                          <StatusPill status={sub.status} />
                        </td>

                        {/* Auto renew */}
                        <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                          <span style={{ color: sub.auto_renew ? COLORS.green : COLORS.muted, fontWeight: 600, fontSize: ".75rem" }}>
                            {sub.auto_renew ? "✅ On" : "❌ Off"}
                          </span>
                        </td>

                        {/* Started */}
                        <td style={{ padding: "10px 12px", color: COLORS.muted, whiteSpace: "nowrap", fontSize: ".72rem" }}>
                          {fmt(sub.started_at)}
                        </td>

                        {/* Expires */}
                        <td style={{
                          padding: "10px 12px", whiteSpace: "nowrap", fontSize: ".72rem",
                          color: expiringSoon(sub) ? COLORS.red : COLORS.muted,
                          fontWeight: expiringSoon(sub) ? 600 : 400,
                        }}>
                          {fmt(sub.expires_at)}
                          {expiringSoon(sub) && <span style={{ marginLeft: 4, fontSize: ".6rem" }}>⚠</span>}
                        </td>

                        {/* Actions */}
                        <td style={{ padding: "10px 12px" }}>
                          <div style={{ display: "flex", gap: 5, alignItems: "center", position: "relative" }}>
                            {/* View button */}
                            <Btn variant="blue" onClick={() => setSelectedSub(sub)} style={{ fontSize: ".7rem", padding: "4px 9px" }}>
                              View
                            </Btn>

                            {/* ⋮ menu */}
                            <div style={{ position: "relative" }}>
                              <Btn
                                variant="ghost"
                                onClick={() => setOpenMenuId((prev) => prev === sub.id ? null : sub.id)}
                                style={{ fontSize: ".78rem", padding: "4px 8px" }}
                              >
                                ⋮
                              </Btn>
                              {openMenuId === sub.id && (
                                <QuickMenu
                                  sub={sub}
                                  onView={() => { setSelectedSub(sub); setOpenMenuId(null); }}
                                  onAction={(action) => { handleQuickAction(sub, action); setOpenMenuId(null); }}
                                  onClose={() => setOpenMenuId(null)}
                                />
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── Pagination ────────────────────────────────────────── */}
              {totalPgs > 1 && (
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  marginTop: 14, flexWrap: "wrap", gap: 8,
                }}>
                  <span style={{ fontSize: ".72rem", color: COLORS.muted }}>
                    {total} record{total !== 1 ? "s" : ""} · Page {page} of {totalPgs}
                  </span>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    <Btn variant="ghost" onClick={() => setPage(1)} disabled={page <= 1} style={{ fontSize: ".72rem", padding: "4px 9px" }}>«</Btn>
                    <Btn variant="ghost" onClick={() => setPage((p) => p - 1)} disabled={page <= 1} style={{ fontSize: ".72rem", padding: "4px 9px" }}>‹ Prev</Btn>

                    {Array.from({ length: Math.min(7, totalPgs) }, (_, i) => {
                      let p;
                      if (totalPgs <= 7) { p = i + 1; }
                      else if (page <= 4) { p = i + 1; }
                      else if (page >= totalPgs - 3) { p = totalPgs - 6 + i; }
                      else { p = page - 3 + i; }
                      return (
                        <Btn key={p} onClick={() => setPage(p)}
                          variant={p === page ? "primary" : "ghost"}
                          style={{ fontSize: ".72rem", padding: "4px 9px" }}>
                          {p}
                        </Btn>
                      );
                    })}

                    <Btn variant="ghost" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPgs} style={{ fontSize: ".72rem", padding: "4px 9px" }}>Next ›</Btn>
                    <Btn variant="ghost" onClick={() => setPage(totalPgs)} disabled={page >= totalPgs} style={{ fontSize: ".72rem", padding: "4px 9px" }}>»</Btn>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── Detail Drawer ──────────────────────────────────────────────── */}
      {selectedSub && (
        <DetailDrawer
          sub={selectedSub}
          api={api}
          confirm={confirm}
          onClose={() => setSelectedSub(null)}
          onMutation={() => { fetchSubscriptions(); fetchRevenue(); onMutation?.(); }}
        />
      )}
    </div>
  );
}