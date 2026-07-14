// ════════════════════════════════════════════════════════════
// FILE: src/page/admin/components/subscriptions/SubscriptionTable.jsx
// ════════════════════════════════════════════════════════════

import { useState, useRef, useEffect } from "react";
import {
  C, naira, fmt, expiringSoon,
  PLAN_SLUGS, PLAN_BADGE, PLAN_LABELS,
  Btn, StatusPill, Spinner, Sel, Inp,
} from "./SubscriptionUI.jsx";

const LIMIT    = 20;
const ADM_BASE = `${import.meta.env.VITE_API_BASE_URL}/api/admin`;

/* ═══════════════════════════════════════════════════════════════════════════
   QUICK ACTION MENU  (⋮ dropdown per row)
═══════════════════════════════════════════════════════════════════════════ */
function QuickMenu({ sub, onView, onAction, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const items = [
    { label: "👁 View Details",         action: "view",         color: C.blue    },
    { label: "⬆ Change Plan",           action: "changePlan",   color: C.green   },
    { label: "⏰ Extend Subscription",  action: "extend",       color: C.text    },
    { label: "🎁 Grant Free Access",    action: "grant",        color: C.green   },
    { label: "🔄 Toggle Auto-Renew",    action: "toggleRenew",  color: C.text    },
    { label: "💳 View Payments",        action: "payments",     color: C.text    },
    { label: "🔧 Feature Overrides",    action: "overrides",    color: C.purple  },
    { label: "📧 Send Email",           action: "sendEmail",    color: C.text    },
    ...(sub.status === "active" ? [
      { label: "⏸ Suspend",            action: "suspend",      color: "#c2410c" },
      { label: "✕ Cancel",             action: "cancel",       color: C.red     },
    ] : []),
    ...((sub.status === "cancelled" || sub.status === "expired" || sub.status === "suspended") ? [
      { label: "♻ Reactivate",         action: "reactivate",   color: C.green   },
    ] : []),
  ];

  return (
    <div ref={ref} style={{
      position   : "absolute",
      right      : 0,
      top        : "100%",
      zIndex     : 200,
      background : C.card,
      border     : `1px solid ${C.border}`,
      borderRadius : 8,
      boxShadow  : "0 8px 24px rgba(0,0,0,.15)",
      minWidth   : 210,
      overflow   : "hidden",
    }}>
      {items.map((item, i) => (
        <button
          key={`${item.action}-${i}`}
          onClick={() => {
            item.action === "view" ? onView() : onAction(item.action);
            onClose();
          }}
          style={{
            display      : "block",
            width        : "100%",
            padding      : "9px 14px",
            textAlign    : "left",
            background   : "none",
            border       : "none",
            fontSize     : ".75rem",
            fontWeight   : 500,
            color        : item.color ?? C.text,
            cursor       : "pointer",
            fontFamily   : "inherit",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = C.hover)}
          onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ASSIGN PLAN MODAL
═══════════════════════════════════════════════════════════════════════════ */
function AssignPlanModal({ api, onClose, onSuccess }) {
  const [step,       setStep]       = useState("search");
  const [searchQ,    setSearchQ]    = useState("");
  const [users,      setUsers]      = useState([]);
  const [searching,  setSearching]  = useState(false);
  const [pickedUser, setPickedUser] = useState(null);
  const [plan,       setPlan]       = useState("premium");
  const [cycle,      setCycle]      = useState("monthly");
  const [duration,   setDuration]   = useState(30);
  const [reason,     setReason]     = useState("Admin Assignment");
  const [busy,       setBusy]       = useState(false);
  const [error,      setError]      = useState(null);

  /* ── Search ────────────────────────────────────────────────────────────── */
  const searchUsers = async () => {
    const q = searchQ.trim();
    if (!q) {
      setError("Please enter a name, email, or phone number.");
      return;
    }

    setSearching(true);
    setError(null);
    setUsers([]);

    try {
      // Primary: dedicated search endpoint
      const { data } = await api.get(
        `/subscriptions/search-users?q=${encodeURIComponent(q)}&limit=15`,
        ADM_BASE
      );

      const list = data.users ?? (Array.isArray(data) ? data : []);

      if (list.length) {
        setUsers(list);
        return;
      }

      // Primary returned 0 — try fallback
      await fallbackSearch(q);

    } catch (err) {
      console.error(
        "[AssignModal] primary search error:",
        err?.response?.status,
        err?.response?.data ?? err.message
      );

      // Log real server error
      const serverMsg = err?.response?.data?.message ?? err?.response?.data?.error;
      if (serverMsg) console.error("[AssignModal] server error:", serverMsg);

      // Always attempt fallback
      await fallbackSearch(q);
    } finally {
      setSearching(false);
    }
  };

  const fallbackSearch = async (q) => {
    try {
      // Fallback A: admin users list — filter client-side
      const { data } = await api.get(`/users?limit=200`, ADM_BASE);
      const raw      = Array.isArray(data) ? data : (data.users ?? data.data ?? []);
      const lower    = q.toLowerCase();

      const filtered = raw.filter((u) =>
        (u.name          ?? "").toLowerCase().includes(lower) ||
        (u.email         ?? "").toLowerCase().includes(lower) ||
        (u.phone         ?? "").includes(q) ||
        (u.phone_number  ?? "").includes(q) ||
        (u.username      ?? "").toLowerCase().includes(lower) ||
        (u.business_name ?? "").toLowerCase().includes(lower) ||
        (u.store_name    ?? "").toLowerCase().includes(lower)
      ).slice(0, 15);

      if (filtered.length) {
        setUsers(filtered);
        return;
      }

      // Fallback B: users endpoint with q param
      try {
        const { data: d2 } = await api.get(
          `/users?q=${encodeURIComponent(q)}&limit=50`,
          ADM_BASE
        );
        const list2 = Array.isArray(d2) ? d2 : (d2.users ?? d2.data ?? []);
        const f2    = list2.filter((u) =>
          (u.name  ?? "").toLowerCase().includes(lower) ||
          (u.email ?? "").toLowerCase().includes(lower) ||
          (u.phone ?? u.phone_number ?? "").includes(q)
        ).slice(0, 15);

        if (f2.length) {
          setUsers(f2);
          return;
        }
      } catch {}

      setError(`No users found for "${q}". Try the exact email address or full name.`);
    } catch (err) {
      console.error("[AssignModal] fallback error:", err.message);
      setError("Search failed. Please check the server logs and try again.");
    }
  };

  /* ── Grant ─────────────────────────────────────────────────────────────── */
  const handleAssign = async () => {
    if (!pickedUser) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(
        `/subscriptions/${pickedUser.id}/grant`,
        { plan, duration: Number(duration), reason, billingCycle: cycle },
        ADM_BASE
      );
      onSuccess?.(
        `${PLAN_BADGE[plan]} ${PLAN_LABELS[plan]} granted to ${pickedUser.name ?? pickedUser.email} for ${duration} days.`
      );
      onClose();
    } catch (err) {
      setError(
        err?.response?.data?.message ??
        err?.message ??
        "Failed to grant subscription."
      );
    } finally {
      setBusy(false);
    }
  };

  const userPhone = (u) => u?.phone || u?.phone_number || null;

  /* ── Render ────────────────────────────────────────────────────────────── */
  return (
    <div style={{
      position       : "fixed",
      inset          : 0,
      zIndex         : 3000,
      background     : "rgba(0,0,0,.55)",
      backdropFilter : "blur(4px)",
      display        : "flex",
      alignItems     : "center",
      justifyContent : "center",
      padding        : 16,
    }}>
      <div style={{
        background   : C.card,
        borderRadius : 14,
        padding      : 24,
        maxWidth     : 540,
        width        : "100%",
        boxShadow    : "0 24px 64px rgba(0,0,0,.3)",
        maxHeight    : "92vh",
        overflowY    : "auto",
      }}>

        {/* Header */}
        <div style={{
          display        : "flex",
          justifyContent : "space-between",
          alignItems     : "flex-start",
          marginBottom   : 18,
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: ".95rem" }}>
              🎁 Assign Subscription to Seller
            </div>
            <div style={{ fontSize: ".72rem", color: C.muted, marginTop: 3 }}>
              {step === "search"
                ? "Search by name, email, or phone number."
                : `Granting access to ${pickedUser?.name ?? pickedUser?.email}`}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.3rem", color: C.muted }}
          >
            ×
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div style={{
            background   : "#fef2f2",
            border       : "1px solid #fecaca",
            borderRadius : 7,
            padding      : "9px 12px",
            color        : C.red,
            fontSize     : ".78rem",
            marginBottom : 12,
            display      : "flex",
            gap          : 8,
            alignItems   : "flex-start",
          }}>
            <span style={{ flexShrink: 0 }}>⚠</span>
            <span>{error}</span>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            STEP 1 — SEARCH
        ════════════════════════════════════════════════════════ */}
        {step === "search" && (
          <div>
            {/* Input */}
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input
                value={searchQ}
                autoFocus
                onChange={(e) => {
                  setSearchQ(e.target.value);
                  setError(null);
                  setUsers([]);
                }}
                onKeyDown={(e) => e.key === "Enter" && searchUsers()}
                placeholder="adeloye@gmail.com, John Doe, 08012345678…"
                style={{
                  flex         : 1,
                  padding      : "9px 12px",
                  border       : `1px solid ${C.border}`,
                  borderRadius : 8,
                  fontSize     : ".82rem",
                  background   : C.card,
                  color        : C.text,
                  fontFamily   : "inherit",
                  outline      : "none",
                }}
              />
              <Btn
                variant="primary"
                onClick={searchUsers}
                disabled={searching || !searchQ.trim()}
              >
                {searching ? <Spinner size={13} /> : "Search"}
              </Btn>
            </div>

            {/* Hint */}
            {!searching && users.length === 0 && !error && (
              <div style={{ fontSize: ".72rem", color: C.muted, textAlign: "center", padding: "16px 0" }}>
                Type a name, email, or phone then press Enter
              </div>
            )}

            {/* Results */}
            {users.length > 0 && (
              <div style={{
                border       : `1px solid ${C.border}`,
                borderRadius : 8,
                overflow     : "hidden",
                marginBottom : 14,
              }}>
                <div style={{
                  fontSize     : ".68rem",
                  color        : C.muted,
                  padding      : "6px 14px",
                  background   : C.bg,
                  borderBottom : `1px solid ${C.border}`,
                }}>
                  {users.length} user{users.length !== 1 ? "s" : ""} found — click to select
                </div>

                {users.map((u, i) => (
                  <div
                    key={u.id ?? i}
                    onClick={() => {
                      setPickedUser(u);
                      setStep("assign");
                      setError(null);
                    }}
                    style={{
                      display      : "flex",
                      alignItems   : "center",
                      gap          : 10,
                      padding      : "10px 14px",
                      cursor       : "pointer",
                      borderBottom : i < users.length - 1 ? `1px solid ${C.border}` : "none",
                      transition   : "background .1s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = C.hover)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                  >
                    {/* Avatar */}
                    <div style={{
                      width        : 38,
                      height       : 38,
                      borderRadius : "50%",
                      background   : C.orange,
                      color        : "#fff",
                      flexShrink   : 0,
                      display      : "flex",
                      alignItems   : "center",
                      justifyContent : "center",
                      fontSize     : ".82rem",
                      fontWeight   : 700,
                      overflow     : "hidden",
                    }}>
                      {u.profile_image ? (
                        <img
                          src={u.profile_image}
                          alt=""
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        (u.name ?? u.email ?? "?").charAt(0).toUpperCase()
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontWeight     : 600,
                        fontSize       : ".82rem",
                        overflow       : "hidden",
                        textOverflow   : "ellipsis",
                        whiteSpace     : "nowrap",
                      }}>
                        {u.name ?? "No Name"}
                        {u.username && (
                          <span style={{ color: C.muted, fontSize: ".7rem", marginLeft: 5 }}>
                            @{u.username}
                          </span>
                        )}
                      </div>
                      <div style={{
                        fontSize     : ".7rem",
                        color        : C.muted,
                        overflow     : "hidden",
                        textOverflow : "ellipsis",
                        whiteSpace   : "nowrap",
                      }}>
                        {u.email}
                        {userPhone(u) && <span style={{ marginLeft: 6 }}>· {userPhone(u)}</span>}
                      </div>
                      {u.business_name && (
                        <div style={{ fontSize: ".65rem", color: C.muted }}>
                          {u.business_name}
                        </div>
                      )}
                    </div>

                    {/* Current plan / status */}
                    <div style={{ flexShrink: 0, textAlign: "right" }}>
                      {u.subscription_plan && u.subscription_plan !== "free" ? (
                        <span style={{
                          fontSize     : ".65rem",
                          fontWeight   : 700,
                          padding      : "2px 8px",
                          borderRadius : 100,
                          background   : "#dcfce7",
                          color        : "#166534",
                          display      : "inline-block",
                        }}>
                          {PLAN_BADGE[u.subscription_plan] ?? ""} {u.subscription_plan}
                        </span>
                      ) : (
                        <span style={{ fontSize: ".65rem", color: C.muted }}>Free</span>
                      )}
                      {u.status && u.status !== "active" && (
                        <div style={{ fontSize: ".6rem", color: C.red, marginTop: 2 }}>
                          {u.status}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Btn variant="ghost" onClick={onClose} style={{ width: "100%", marginTop: 4 }}>
              Cancel
            </Btn>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            STEP 2 — ASSIGN PLAN
        ════════════════════════════════════════════════════════ */}
        {step === "assign" && pickedUser && (
          <div>
            {/* Selected user card */}
            <div style={{
              display      : "flex",
              alignItems   : "center",
              gap          : 10,
              background   : C.bg,
              border       : `1px solid ${C.border}`,
              borderRadius : 9,
              padding      : "11px 14px",
              marginBottom : 18,
            }}>
              <div style={{
                width          : 40,
                height         : 40,
                borderRadius   : "50%",
                background     : C.orange,
                color          : "#fff",
                display        : "flex",
                alignItems     : "center",
                justifyContent : "center",
                fontSize       : ".88rem",
                fontWeight     : 700,
                flexShrink     : 0,
              }}>
                {(pickedUser.name ?? pickedUser.email ?? "?").charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: ".85rem" }}>
                  {pickedUser.name ?? "—"}
                </div>
                <div style={{ fontSize: ".72rem", color: C.muted }}>
                  {pickedUser.email}
                </div>
                {userPhone(pickedUser) && (
                  <div style={{ fontSize: ".7rem", color: C.muted }}>
                    {userPhone(pickedUser)}
                  </div>
                )}
                {pickedUser.subscription_plan && pickedUser.subscription_plan !== "free" && (
                  <div style={{ fontSize: ".68rem", color: C.orange, marginTop: 2 }}>
                    Currently on: {PLAN_BADGE[pickedUser.subscription_plan] ?? ""} {pickedUser.subscription_plan}
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  setStep("search");
                  setPickedUser(null);
                  setError(null);
                  setUsers([]);
                }}
                style={{
                  background  : "none",
                  border      : "none",
                  cursor      : "pointer",
                  fontSize    : ".75rem",
                  color       : C.orange,
                  fontFamily  : "inherit",
                  flexShrink  : 0,
                }}
              >
                Change
              </button>
            </div>

            {/* Plan picker */}
            <div style={{ marginBottom: 14 }}>
              <div style={{
                fontSize       : ".7rem",
                fontWeight     : 700,
                color          : C.muted,
                marginBottom   : 7,
                textTransform  : "uppercase",
                letterSpacing  : ".04em",
              }}>
                Select Plan
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {PLAN_SLUGS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setPlan(s)}
                    style={{
                      padding      : "7px 14px",
                      borderRadius : 8,
                      cursor       : "pointer",
                      fontFamily   : "inherit",
                      fontSize     : ".78rem",
                      fontWeight   : 600,
                      border       : `2px solid ${plan === s ? C.orange : C.border}`,
                      background   : plan === s ? "#fff3ee" : C.card,
                      color        : plan === s ? C.orange : C.text,
                      transition   : "all .12s",
                    }}
                  >
                    {PLAN_BADGE[s]} {PLAN_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            {/* Billing cycle */}
            <div style={{ marginBottom: 14 }}>
              <div style={{
                fontSize      : ".7rem",
                fontWeight    : 700,
                color         : C.muted,
                marginBottom  : 7,
                textTransform : "uppercase",
                letterSpacing : ".04em",
              }}>
                Billing Cycle
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {["monthly", "yearly"].map((c) => (
                  <button
                    key={c}
                    onClick={() => setCycle(c)}
                    style={{
                      padding      : "7px 18px",
                      borderRadius : 8,
                      cursor       : "pointer",
                      fontFamily   : "inherit",
                      fontSize     : ".78rem",
                      fontWeight   : 600,
                      border       : `2px solid ${cycle === c ? C.blue : C.border}`,
                      background   : cycle === c ? "#dbeafe" : C.card,
                      color        : cycle === c ? C.blue : C.text,
                      transition   : "all .12s",
                    }}
                  >
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div style={{ marginBottom: 14 }}>
              <div style={{
                fontSize      : ".7rem",
                fontWeight    : 700,
                color         : C.muted,
                marginBottom  : 7,
                textTransform : "uppercase",
                letterSpacing : ".04em",
              }}>
                Duration
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[7, 14, 30, 60, 90, 180, 365].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    style={{
                      padding      : "6px 12px",
                      borderRadius : 7,
                      cursor       : "pointer",
                      fontFamily   : "inherit",
                      fontSize     : ".75rem",
                      fontWeight   : 600,
                      border       : `2px solid ${duration === d ? C.green : C.border}`,
                      background   : duration === d ? "#dcfce7" : C.card,
                      color        : duration === d ? C.green : C.text,
                      transition   : "all .12s",
                    }}
                  >
                    {d === 365 ? "1 yr" : `${d}d`}
                  </button>
                ))}
              </div>
            </div>

            {/* Reason */}
            <div style={{ marginBottom: 18 }}>
              <div style={{
                fontSize      : ".7rem",
                fontWeight    : 700,
                color         : C.muted,
                marginBottom  : 7,
                textTransform : "uppercase",
                letterSpacing : ".04em",
              }}>
                Reason
              </div>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Promotion winner, Compensation, Test account"
                style={{
                  width        : "100%",
                  padding      : "9px 12px",
                  border       : `1px solid ${C.border}`,
                  borderRadius : 8,
                  fontSize     : ".82rem",
                  background   : C.card,
                  color        : C.text,
                  fontFamily   : "inherit",
                  boxSizing    : "border-box",
                  outline      : "none",
                }}
              />
            </div>

            {/* Summary card */}
            <div style={{
              background   : C.bg,
              border       : `1px solid ${C.border}`,
              borderRadius : 10,
              padding      : "12px 16px",
              marginBottom : 18,
            }}>
              <div style={{
                fontSize      : ".68rem",
                fontWeight    : 700,
                color         : C.muted,
                textTransform : "uppercase",
                letterSpacing : ".04em",
                marginBottom  : 8,
              }}>
                Summary
              </div>
              {[
                ["Seller",   pickedUser.name ?? pickedUser.email],
                ["Plan",     `${PLAN_BADGE[plan]} ${PLAN_LABELS[plan]}`],
                ["Cycle",    cycle.charAt(0).toUpperCase() + cycle.slice(1)],
                ["Duration", duration === 365 ? "1 year" : `${duration} days`],
                ["Cost",     "₦0 — Admin grant"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    display        : "flex",
                    justifyContent : "space-between",
                    padding        : "3px 0",
                    fontSize       : ".78rem",
                  }}
                >
                  <span style={{ color: C.muted }}>{label}</span>
                  <span style={{ fontWeight: 600 }}>{value}</span>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 8 }}>
              <Btn
                variant="ghost"
                onClick={() => { setStep("search"); setError(null); }}
                style={{ flex: 1 }}
              >
                ← Back
              </Btn>
              <Btn
                variant="success"
                onClick={handleAssign}
                disabled={busy}
                style={{ flex: 2 }}
              >
                {busy
                  ? <><Spinner size={13} /> Granting…</>
                  : `🎁 Grant ${PLAN_LABELS[plan]}`
                }
              </Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN EXPORT — SUBSCRIPTION TABLE
═══════════════════════════════════════════════════════════════════════════ */
export function SubscriptionTable({
  subscriptions,
  total,
  page,
  setPage,
  loading,
  error,
  onRetry,
  filters,
  setFilters,
  selected,
  setSelected,
  onView,
  onQuickAction,
  onExport,
  exporting,
  api,
}) {
  const [openMenuId,  setOpenMenuId]  = useState(null);
  const [showAssign,  setShowAssign]  = useState(false);
  const [assignToast, setAssignToast] = useState(null);

  const allSelected = subscriptions.length > 0 && selected.size === subscriptions.length;
  const toggleAll   = () => setSelected(
    allSelected ? new Set() : new Set(subscriptions.map((s) => s.id))
  );
  const toggleRow   = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };
  const setFilter   = (key, val) =>
    setFilters((prev) => ({ ...prev, [key]: val, _page: 1 }));
  const totalPgs    = Math.ceil(total / LIMIT);

  const showSuccess = (msg) => {
    setAssignToast(msg);
    setTimeout(() => setAssignToast(null), 6000);
    onRetry?.();
  };

  /* ── Success toast ──────────────────────────────────────────────────────── */
  const SuccessToast = () =>
    assignToast ? (
      <div style={{
        position     : "fixed",
        top          : 20,
        right        : 20,
        zIndex       : 9999,
        background   : "#dcfce7",
        border       : "1px solid #bbf7d0",
        borderRadius : 10,
        padding      : "14px 18px",
        color        : "#166534",
        fontSize     : ".82rem",
        fontWeight   : 600,
        boxShadow    : "0 6px 20px rgba(0,0,0,.12)",
        display      : "flex",
        alignItems   : "center",
        gap          : 10,
        maxWidth     : 440,
      }}>
        <span style={{ fontSize: "1rem" }}>✅</span>
        <span style={{ flex: 1 }}>{assignToast}</span>
        <button
          onClick={() => setAssignToast(null)}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#166534", fontSize: "1rem" }}
        >
          ×
        </button>
      </div>
    ) : null;

  /* ── Top bar ────────────────────────────────────────────────────────────── */
  const TopBar = () => (
    <div style={{
      display        : "flex",
      alignItems     : "center",
      justifyContent : "space-between",
      marginBottom   : 14,
      flexWrap       : "wrap",
      gap            : 10,
    }}>
      <span style={{ fontSize: ".82rem", fontWeight: 600, color: C.text }}>
        {total > 0
          ? `${total} subscription${total !== 1 ? "s" : ""}`
          : "No subscriptions yet"}
      </span>
      <Btn
        variant="success"
        onClick={() => setShowAssign(true)}
        data-assign-btn=""
      >
        🎁 Assign Subscription to Seller
      </Btn>
    </div>
  );

  /* ── Filters ────────────────────────────────────────────────────────────── */
  const FiltersBar = () => (
    <div style={{
      background   : C.card,
      border       : `1px solid ${C.border}`,
      borderRadius : 10,
      padding      : "12px 14px",
      marginBottom : 12,
    }}>
      {/* Row 1 */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <Inp
          value={filters.q ?? ""}
          onChange={(e) => setFilter("q", e.target.value)}
          placeholder="Search name, email, phone, ID, reference…"
          style={{ flex: 1, minWidth: 200 }}
        />
        <Sel value={filters.plan ?? "all"} onChange={(e) => setFilter("plan", e.target.value)}>
          <option value="all">All Plans</option>
          {PLAN_SLUGS.map((s) => (
            <option key={s} value={s}>{PLAN_BADGE[s]} {PLAN_LABELS[s]}</option>
          ))}
        </Sel>
        <Sel value={filters.status ?? "all"} onChange={(e) => setFilter("status", e.target.value)}>
          <option value="all">All Statuses</option>
          {["active","expired","cancelled","superseded","trial","suspended","failed"].map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </Sel>
        <Sel value={filters.cycle ?? "all"} onChange={(e) => setFilter("cycle", e.target.value)}>
          <option value="all">Any Cycle</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </Sel>
        <Sel value={filters.auto_renew ?? "all"} onChange={(e) => setFilter("auto_renew", e.target.value)}>
          <option value="all">Auto-Renew: Any</option>
          <option value="true">✅ Enabled</option>
          <option value="false">❌ Disabled</option>
        </Sel>
        <Btn variant="ghost" onClick={() => setFilters({
          q: "", plan: "all", status: "all",
          cycle: "all", auto_renew: "all",
          date_from: "", date_to: "",
        })}>
          Clear
        </Btn>
        <Btn variant="ghost" onClick={onRetry}>↻ Refresh</Btn>
      </div>

      {/* Row 2 — date range + export */}
      <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: ".72rem", color: C.muted }}>Date range:</span>
        <Inp
          type="date"
          value={filters.date_from ?? ""}
          onChange={(e) => setFilter("date_from", e.target.value)}
          style={{ width: 140 }}
        />
        <span style={{ fontSize: ".72rem", color: C.muted }}>to</span>
        <Inp
          type="date"
          value={filters.date_to ?? ""}
          onChange={(e) => setFilter("date_to", e.target.value)}
          style={{ width: 140 }}
        />
        <div style={{ marginLeft: "auto", display: "flex", gap: 5 }}>
          {["csv", "excel", "pdf"].map((f) => (
            <Btn key={f} variant="ghost" onClick={() => onExport?.(f)} disabled={!!exporting}>
              {exporting === f
                ? <Spinner size={12} />
                : f === "csv" ? "📥 CSV" : f === "excel" ? "📊 Excel" : "🖨 PDF"}
            </Btn>
          ))}
        </div>
      </div>
    </div>
  );

  /* ── Bulk bar ───────────────────────────────────────────────────────────── */
  const BulkBar = () => (
    <div style={{
      display      : "flex",
      alignItems   : "center",
      gap          : 8,
      background   : "#dbeafe",
      border       : "1px solid #bfdbfe",
      borderRadius : 8,
      padding      : "7px 14px",
      marginBottom : 10,
      flexWrap     : "wrap",
    }}>
      <span style={{ fontSize: ".78rem", fontWeight: 700, color: C.blue }}>
        {selected.size} selected
      </span>
      <Btn variant="blue"    onClick={() => onQuickAction(null, "bulkExtend")}>Extend 30d</Btn>
      <Btn variant="warning" onClick={() => onQuickAction(null, "bulkCancel")}>Cancel</Btn>
      <Btn variant="ghost"   onClick={() => onQuickAction(null, "bulkEmail")}>Send Email</Btn>
      <Btn variant="ghost"   onClick={() => onExport?.("csv", [...selected])}>Export</Btn>
      <Btn variant="ghost"   onClick={() => setSelected(new Set())} style={{ marginLeft: "auto" }}>
        Clear
      </Btn>
    </div>
  );

  /* ── Empty state ────────────────────────────────────────────────────────── */
  const EmptyState = () => (
    <div style={{
      textAlign    : "center",
      padding      : "64px 20px",
      background   : C.card,
      border       : `1px solid ${C.border}`,
      borderRadius : 12,
    }}>
      <div style={{ fontSize: "3rem", marginBottom: 12 }}>📋</div>
      <p style={{ fontSize: ".92rem", fontWeight: 700, color: C.text, marginBottom: 8 }}>
        No subscriptions found
      </p>
      <p style={{ fontSize: ".78rem", color: C.muted, marginBottom: 24, maxWidth: 360, margin: "0 auto 24px" }}>
        Sellers subscribe through the app, or you can manually assign
        a subscription plan to any seller right now.
      </p>
      <Btn
        variant="success"
        onClick={() => setShowAssign(true)}
        data-assign-btn=""
        style={{ padding: "10px 24px", fontSize: ".82rem" }}
      >
        🎁 Assign Subscription to Seller
      </Btn>
    </div>
  );

  /* ── Table ──────────────────────────────────────────────────────────────── */
  const TableGrid = () => (
    <div style={{
      overflowX    : "auto",
      background   : C.card,
      border       : `1px solid ${C.border}`,
      borderRadius : 10,
    }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".76rem" }}>
        <thead>
          <tr style={{ background: C.bg, borderBottom: `2px solid ${C.border}` }}>
            <th style={{ padding: "10px 12px" }}>
              <input type="checkbox" checked={allSelected} onChange={toggleAll} />
            </th>
            {[
              "Seller", "Plan", "Cycle", "Amount",
              "Status", "Auto Renew", "Started", "Expires", "Actions",
            ].map((h) => (
              <th key={h} style={{
                padding       : "10px 12px",
                textAlign     : "left",
                fontWeight    : 600,
                color         : C.muted,
                fontSize      : ".66rem",
                textTransform : "uppercase",
                letterSpacing : ".04em",
                whiteSpace    : "nowrap",
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {subscriptions.map((sub) => {
            const soon = expiringSoon(sub);
            return (
              <tr
                key={sub.id}
                style={{
                  borderBottom : `1px solid ${C.border}`,
                  background   : soon ? "#fff7ed" : undefined,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = soon ? "#fff3cd" : C.hover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = soon ? "#fff7ed" : "")}
              >
                {/* Checkbox */}
                <td style={{ padding: "10px 12px" }}>
                  <input
                    type="checkbox"
                    checked={selected.has(sub.id)}
                    onChange={() => toggleRow(sub.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </td>

                {/* Seller */}
                <td style={{ padding: "10px 12px", maxWidth: 180 }}>
                  <div style={{
                    fontWeight   : 600,
                    overflow     : "hidden",
                    textOverflow : "ellipsis",
                    whiteSpace   : "nowrap",
                  }}>
                    {sub.user_name ?? "—"}
                  </div>
                  <div style={{
                    fontSize     : ".66rem",
                    color        : C.muted,
                    overflow     : "hidden",
                    textOverflow : "ellipsis",
                    whiteSpace   : "nowrap",
                  }}>
                    {sub.user_email ?? ""}
                  </div>
                </td>

                {/* Plan */}
                <td style={{ padding: "10px 12px", fontWeight: 600, whiteSpace: "nowrap" }}>
                  {PLAN_BADGE[sub.plan_slug] ?? ""} {sub.plan_name ?? sub.plan_slug}
                </td>

                {/* Cycle */}
                <td style={{
                  padding       : "10px 12px",
                  color         : C.muted,
                  textTransform : "capitalize",
                  whiteSpace    : "nowrap",
                }}>
                  {sub.billing_cycle ?? "—"}
                </td>

                {/* Amount */}
                <td style={{ padding: "10px 12px", fontWeight: 700, whiteSpace: "nowrap" }}>
                  {sub.amount
                    ? naira(sub.amount)
                    : <span style={{ fontSize: ".68rem", color: C.muted }}>Free grant</span>}
                </td>

                {/* Status */}
                <td style={{ padding: "10px 12px" }}>
                  <StatusPill status={sub.status} />
                </td>

                {/* Auto-renew */}
                <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                  <span style={{
                    color      : sub.auto_renew ? C.green : C.muted,
                    fontWeight : 600,
                    fontSize   : ".72rem",
                  }}>
                    {sub.auto_renew ? "✅ On" : "❌ Off"}
                  </span>
                </td>

                {/* Started */}
                <td style={{
                  padding    : "10px 12px",
                  color      : C.muted,
                  whiteSpace : "nowrap",
                  fontSize   : ".7rem",
                }}>
                  {fmt(sub.started_at)}
                </td>

                {/* Expires */}
                <td style={{
                  padding    : "10px 12px",
                  whiteSpace : "nowrap",
                  fontSize   : ".7rem",
                  color      : soon ? C.red : C.muted,
                  fontWeight : soon ? 700 : 400,
                }}>
                  {fmt(sub.expires_at)}
                  {soon && <span style={{ marginLeft: 3, fontSize: ".6rem" }}>⚠</span>}
                </td>

                {/* Actions */}
                <td style={{ padding: "10px 12px" }}>
                  <div style={{ display: "flex", gap: 4, alignItems: "center", position: "relative" }}>
                    {/* View */}
                    <Btn
                      variant="blue"
                      onClick={() => onView(sub)}
                      style={{ fontSize: ".68rem", padding: "3px 9px" }}
                      title="View full details"
                    >
                      View
                    </Btn>

                    {/* Edit / Reactivate */}
                    {sub.status === "active" ? (
                      <Btn
                        variant="warning"
                        onClick={() => onQuickAction(sub, "changePlan")}
                        style={{ fontSize: ".68rem", padding: "3px 9px" }}
                        title="Change plan"
                      >
                        Edit
                      </Btn>
                    ) : (
                      <Btn
                        variant="success"
                        onClick={() => onQuickAction(sub, "reactivate")}
                        style={{ fontSize: ".68rem", padding: "3px 9px" }}
                        title="Reactivate"
                      >
                        Reactivate
                      </Btn>
                    )}

                    {/* ⋮ menu */}
                    <div style={{ position: "relative" }}>
                      <Btn
                        variant="ghost"
                        onClick={() => setOpenMenuId((p) => p === sub.id ? null : sub.id)}
                        style={{ fontSize: ".78rem", padding: "3px 8px" }}
                        title="More actions"
                      >
                        ⋮
                      </Btn>
                      {openMenuId === sub.id && (
                        <QuickMenu
                          sub={sub}
                          onView={() => { onView(sub); setOpenMenuId(null); }}
                          onAction={(a) => { onQuickAction(sub, a); setOpenMenuId(null); }}
                          onClose={() => setOpenMenuId(null)}
                        />
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  /* ── Pagination ─────────────────────────────────────────────────────────── */
  const Pagination = () => (
    <div style={{
      display        : "flex",
      alignItems     : "center",
      justifyContent : "space-between",
      marginTop      : 12,
      flexWrap       : "wrap",
      gap            : 8,
    }}>
      <span style={{ fontSize: ".7rem", color: C.muted }}>
        {total} record{total !== 1 ? "s" : ""} · Page {page} of {totalPgs}
      </span>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        <Btn variant="ghost" onClick={() => setPage(1)}             disabled={page <= 1}         style={{ fontSize: ".7rem", padding: "3px 8px" }}>«</Btn>
        <Btn variant="ghost" onClick={() => setPage((p) => p - 1)} disabled={page <= 1}         style={{ fontSize: ".7rem", padding: "3px 8px" }}>‹</Btn>

        {Array.from({ length: Math.min(7, totalPgs) }, (_, i) => {
          let p;
          if      (totalPgs <= 7)        p = i + 1;
          else if (page <= 4)            p = i + 1;
          else if (page >= totalPgs - 3) p = totalPgs - 6 + i;
          else                           p = page - 3 + i;
          return (
            <Btn
              key={p}
              onClick={() => setPage(p)}
              variant={p === page ? "primary" : "ghost"}
              style={{ fontSize: ".7rem", padding: "3px 8px" }}
            >
              {p}
            </Btn>
          );
        })}

        <Btn variant="ghost" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPgs} style={{ fontSize: ".7rem", padding: "3px 8px" }}>›</Btn>
        <Btn variant="ghost" onClick={() => setPage(totalPgs)}     disabled={page >= totalPgs} style={{ fontSize: ".7rem", padding: "3px 8px" }}>»</Btn>
      </div>
    </div>
  );

  /* ════════════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════════════ */
  return (
    <div>
      <SuccessToast />
      <TopBar />
      <FiltersBar />

      {selected.size > 0 && <BulkBar />}

      {/* Content states */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "56px 0", color: C.muted }}>
          <Spinner size={24} />
          <div style={{ marginTop: 12, fontSize: ".82rem" }}>Loading subscriptions…</div>
        </div>
      ) : error ? (
        <div style={{
          background   : "#fef2f2",
          border       : "1px solid #fecaca",
          borderRadius : 8,
          padding      : "14px 18px",
          color        : C.red,
          fontSize     : ".82rem",
          display      : "flex",
          alignItems   : "center",
          gap          : 10,
        }}>
          <span>⚠</span>
          {error}
          <button
            onClick={onRetry}
            style={{
              background     : "none",
              border         : "none",
              color          : C.red,
              cursor         : "pointer",
              textDecoration : "underline",
              fontFamily     : "inherit",
              fontSize       : ".82rem",
            }}
          >
            Retry
          </button>
        </div>
      ) : !subscriptions.length ? (
        <EmptyState />
      ) : (
        <>
          <TableGrid />
          {totalPgs > 1 && <Pagination />}
        </>
      )}

      {/* Assign modal */}
      {showAssign && (
        <AssignPlanModal
          api={api}
          onClose={() => setShowAssign(false)}
          onSuccess={showSuccess}
        />
      )}
    </div>
  );
}