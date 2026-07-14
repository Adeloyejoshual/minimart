import { useState, useRef, useEffect } from "react";
import {
  C, naira, fmt, expiringSoon,
  PLAN_SLUGS, PLAN_BADGE, PLAN_LABELS,
  Btn, StatusPill, Spinner, Sel, Inp,
} from "./SubscriptionUI.jsx";

const LIMIT = 20;
const ADM   = `${import.meta.env.VITE_API_BASE_URL}/api/admin`;

/* ─── QuickMenu ──────────────────────────────────────────────────────────── */
function QuickMenu({ sub, onView, onAction, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
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
      position: "absolute", right: 0, top: "100%", zIndex: 200,
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,.15)",
      minWidth: 210, overflow: "hidden",
    }}>
      {items.map((item, i) => (
        <button
          key={`${item.action}-${i}`}
          onClick={() => {
            item.action === "view" ? onView() : onAction(item.action);
            onClose();
          }}
          style={{
            display: "block", width: "100%", padding: "9px 14px",
            textAlign: "left", background: "none", border: "none",
            fontSize: ".75rem", fontWeight: 500, color: item.color ?? C.text,
            cursor: "pointer", fontFamily: "inherit",
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

/* ─── Assign Plan Modal ──────────────────────────────────────────────────── */
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

  const searchUsers = async () => {
    const q = searchQ.trim();
    if (!q) return;

    setSearching(true);
    setError(null);
    setUsers([]);

    try {
      // Try multiple search patterns that admin user routes may support
      let foundUsers = [];

      // Attempt 1: /users?q=xxx (most common)
      try {
        const { data } = await api.get(`/users?q=${encodeURIComponent(q)}&limit=10`, ADM);
        const list = Array.isArray(data) ? data : (data.users ?? data.data ?? []);
        if (list.length) foundUsers = list;
      } catch {}

      // Attempt 2: /users?search=xxx (alternative query param)
      if (!foundUsers.length) {
        try {
          const { data } = await api.get(`/users?search=${encodeURIComponent(q)}&limit=10`, ADM);
          const list = Array.isArray(data) ? data : (data.users ?? data.data ?? []);
          if (list.length) foundUsers = list;
        } catch {}
      }

      // Attempt 3: /users?email=xxx (direct email lookup)
      if (!foundUsers.length && q.includes("@")) {
        try {
          const { data } = await api.get(`/users?email=${encodeURIComponent(q)}&limit=10`, ADM);
          const list = Array.isArray(data) ? data : (data.users ?? data.data ?? []);
          if (list.length) foundUsers = list;
        } catch {}
      }

      // Attempt 4: Fetch all and filter client-side (fallback for small datasets)
      if (!foundUsers.length) {
        try {
          const { data } = await api.get(`/users?limit=200`, ADM);
          const list = Array.isArray(data) ? data : (data.users ?? data.data ?? []);
          const lower = q.toLowerCase();
          foundUsers = list.filter((u) =>
            (u.name ?? "").toLowerCase().includes(lower) ||
            (u.email ?? "").toLowerCase().includes(lower) ||
            (u.phone ?? u.phone_number ?? "").includes(q)
          ).slice(0, 10);
        } catch {}
      }

      setUsers(foundUsers);

      if (!foundUsers.length) {
        setError(`No users found for "${q}". Try a different name, email, or phone.`);
      }
    } catch (err) {
      setError(err?.response?.data?.message ?? err?.message ?? "Search failed. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  const handleAssign = async () => {
    if (!pickedUser) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(
        `/subscriptions/${pickedUser.id}/grant`,
        { plan, duration: Number(duration), reason, billingCycle: cycle },
        ADM
      );
      onSuccess?.(`${PLAN_BADGE[plan]} ${PLAN_LABELS[plan]} granted to ${pickedUser.name ?? pickedUser.email} for ${duration} days.`);
      onClose();
    } catch (err) {
      setError(
        err?.response?.data?.message ??
        err?.message ??
        "Failed to grant subscription. Check the backend logs."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 3000,
      background: "rgba(0,0,0,.55)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
    }}>
      <div style={{
        background: C.card, borderRadius: 14, padding: 24,
        maxWidth: 540, width: "100%",
        boxShadow: "0 24px 64px rgba(0,0,0,.3)",
        maxHeight: "90vh", overflowY: "auto",
      }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: ".95rem" }}>
              🎁 Assign Subscription to Seller
            </div>
            <div style={{ fontSize: ".72rem", color: C.muted, marginTop: 3 }}>
              {step === "search"
                ? "Search for a seller, then choose a plan to grant."
                : `Granting access to ${pickedUser?.name ?? pickedUser?.email}`}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.3rem", color: C.muted, padding: 4 }}>×</button>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 7,
            padding: "8px 12px", color: C.red, fontSize: ".78rem", marginBottom: 12,
            display: "flex", alignItems: "flex-start", gap: 8,
          }}>
            <span style={{ flexShrink: 0 }}>⚠</span>
            <span>{error}</span>
          </div>
        )}

        {/* ── Step 1: Search ──────────────────────────────────────────── */}
        {step === "search" && (
          <div>
            <div style={{ fontSize: ".75rem", color: C.muted, marginBottom: 8 }}>
              Search by name, email, or phone number
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <input
                value={searchQ}
                onChange={(e) => { setSearchQ(e.target.value); setError(null); }}
                onKeyDown={(e) => e.key === "Enter" && searchUsers()}
                placeholder="e.g. John Doe, john@email.com, 08012345678"
                autoFocus
                style={{
                  flex: 1, padding: "9px 12px",
                  border: `1px solid ${C.border}`, borderRadius: 8,
                  fontSize: ".82rem", background: C.card, color: C.text,
                  fontFamily: "inherit", outline: "none",
                }}
              />
              <Btn variant="primary" onClick={searchUsers} disabled={searching || !searchQ.trim()}>
                {searching ? <Spinner size={13} /> : "Search"}
              </Btn>
            </div>

            {/* Search results */}
            {users.length > 0 && (
              <div style={{
                border: `1px solid ${C.border}`, borderRadius: 8,
                overflow: "hidden", marginBottom: 14,
              }}>
                <div style={{ fontSize: ".68rem", color: C.muted, padding: "6px 14px", background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                  {users.length} user{users.length !== 1 ? "s" : ""} found — click to select
                </div>
                {users.map((u, i) => (
                  <div
                    key={u.id ?? i}
                    onClick={() => { setPickedUser(u); setStep("assign"); setError(null); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 14px", cursor: "pointer",
                      borderBottom: i < users.length - 1 ? `1px solid ${C.border}` : "none",
                      transition: "background .1s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = C.hover)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: 36, height: 36, borderRadius: "50%",
                      background: C.orange, color: "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: ".82rem", fontWeight: 700, flexShrink: 0,
                      overflow: "hidden",
                    }}>
                      {u.profile_image
                        ? <img src={u.profile_image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : (u.name ?? u.email ?? "?").charAt(0).toUpperCase()
                      }
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: ".82rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {u.name ?? "No Name"}
                      </div>
                      <div style={{ fontSize: ".7rem", color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {u.email ?? ""}
                        {(u.phone || u.phone_number) && <span style={{ marginLeft: 6 }}>· {u.phone || u.phone_number}</span>}
                      </div>
                    </div>

                    <div style={{ flexShrink: 0, textAlign: "right" }}>
                      {u.subscription_plan && u.subscription_plan !== "free" ? (
                        <span style={{
                          fontSize: ".65rem", fontWeight: 700, padding: "2px 8px",
                          borderRadius: 100, background: "#dcfce7", color: "#166534",
                        }}>
                          {PLAN_BADGE[u.subscription_plan]} {u.subscription_plan}
                        </span>
                      ) : (
                        <span style={{ fontSize: ".65rem", color: C.muted }}>Free</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* No results after search */}
            {!searching && users.length === 0 && searchQ.trim() && !error && (
              <div style={{ fontSize: ".78rem", color: C.muted, textAlign: "center", padding: "20px 0" }}>
                No users found. Try a different search term.
              </div>
            )}

            <Btn variant="ghost" onClick={onClose} style={{ width: "100%", marginTop: 4 }}>
              Cancel
            </Btn>
          </div>
        )}

        {/* ── Step 2: Assign ─────────────────────────────────────────── */}
        {step === "assign" && pickedUser && (
          <div>
            {/* Selected user card */}
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              background: C.bg, border: `1px solid ${C.border}`,
              borderRadius: 8, padding: "10px 14px", marginBottom: 18,
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: "50%",
                background: C.orange, color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: ".85rem", fontWeight: 700, flexShrink: 0,
              }}>
                {(pickedUser.name ?? pickedUser.email ?? "?").charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: ".82rem" }}>{pickedUser.name ?? "—"}</div>
                <div style={{ fontSize: ".7rem", color: C.muted }}>{pickedUser.email ?? "—"}</div>
                {pickedUser.subscription_plan && pickedUser.subscription_plan !== "free" && (
                  <div style={{ fontSize: ".65rem", color: C.orange, marginTop: 2 }}>
                    Currently: {PLAN_BADGE[pickedUser.subscription_plan]} {pickedUser.subscription_plan}
                  </div>
                )}
              </div>
              <button
                onClick={() => { setStep("search"); setPickedUser(null); setError(null); }}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: ".75rem", color: C.orange, fontFamily: "inherit" }}
              >
                Change
              </button>
            </div>

            {/* Plan picker */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: ".72rem", color: C.muted, marginBottom: 6, fontWeight: 600 }}>Select Plan</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {PLAN_SLUGS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setPlan(s)}
                    style={{
                      padding: "7px 14px", borderRadius: 8, cursor: "pointer",
                      fontFamily: "inherit", fontSize: ".78rem", fontWeight: 600,
                      border: `2px solid ${plan === s ? C.orange : C.border}`,
                      background: plan === s ? "#fff3ee" : C.card,
                      color: plan === s ? C.orange : C.text,
                      transition: "all .12s",
                    }}
                  >
                    {PLAN_BADGE[s]} {PLAN_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            {/* Billing cycle */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: ".72rem", color: C.muted, marginBottom: 6, fontWeight: 600 }}>Billing Cycle</div>
              <div style={{ display: "flex", gap: 6 }}>
                {["monthly", "yearly"].map((c) => (
                  <button
                    key={c}
                    onClick={() => setCycle(c)}
                    style={{
                      padding: "7px 18px", borderRadius: 8, cursor: "pointer",
                      fontFamily: "inherit", fontSize: ".78rem", fontWeight: 600,
                      border: `2px solid ${cycle === c ? C.blue : C.border}`,
                      background: cycle === c ? "#dbeafe" : C.card,
                      color: cycle === c ? C.blue : C.text,
                      transition: "all .12s",
                    }}
                  >
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: ".72rem", color: C.muted, marginBottom: 6, fontWeight: 600 }}>Duration (days)</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[7, 14, 30, 60, 90, 180, 365].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    style={{
                      padding: "6px 12px", borderRadius: 7, cursor: "pointer",
                      fontFamily: "inherit", fontSize: ".75rem", fontWeight: 600,
                      border: `2px solid ${duration === d ? "#16a34a" : C.border}`,
                      background: duration === d ? "#dcfce7" : C.card,
                      color: duration === d ? "#16a34a" : C.text,
                      transition: "all .12s",
                    }}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>

            {/* Reason */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: ".72rem", color: C.muted, marginBottom: 6, fontWeight: 600 }}>Reason</div>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Promotion Winner, Compensation, Test Account"
                style={{
                  width: "100%", padding: "9px 12px", border: `1px solid ${C.border}`,
                  borderRadius: 8, fontSize: ".82rem", background: C.card, color: C.text,
                  fontFamily: "inherit", boxSizing: "border-box", outline: "none",
                }}
              />
            </div>

            {/* Summary card */}
            <div style={{
              background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10,
              padding: "12px 16px", marginBottom: 18,
            }}>
              <div style={{ fontSize: ".7rem", fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>
                Summary
              </div>
              {[
                ["Seller",   pickedUser.name ?? pickedUser.email],
                ["Plan",     `${PLAN_BADGE[plan]} ${PLAN_LABELS[plan]}`],
                ["Cycle",    cycle.charAt(0).toUpperCase() + cycle.slice(1)],
                ["Duration", `${duration} days`],
                ["Cost",     "Free (admin grant)"],
              ].map(([label, value]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: ".78rem" }}>
                  <span style={{ color: C.muted }}>{label}</span>
                  <span style={{ fontWeight: 600, color: C.text }}>{value}</span>
                </div>
              ))}
            </div>

            {/* Buttons */}
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="ghost" onClick={() => { setStep("search"); setError(null); }} style={{ flex: 1 }}>
                ← Back
              </Btn>
              <Btn variant="success" onClick={handleAssign} disabled={busy} style={{ flex: 2 }}>
                {busy ? <><Spinner size={13} /> Granting…</> : `🎁 Grant ${PLAN_LABELS[plan]}`}
              </Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SUBSCRIPTION TABLE
═══════════════════════════════════════════════════════════════════════════ */
export function SubscriptionTable({
  subscriptions, total, page, setPage,
  loading, error, onRetry,
  filters, setFilters,
  selected, setSelected,
  onView, onQuickAction,
  onExport, exporting,
  api,
}) {
  const [openMenuId,  setOpenMenuId]  = useState(null);
  const [showAssign,  setShowAssign]  = useState(false);
  const [assignToast, setAssignToast] = useState(null);

  const allSelected = subscriptions.length > 0 && selected.size === subscriptions.length;
  const toggleAll   = () => setSelected(allSelected ? new Set() : new Set(subscriptions.map((s) => s.id)));
  const toggle      = (id) => { const n = new Set(selected); n.has(id) ? n.delete(id) : n.add(id); setSelected(n); };
  const setFilter   = (key, val) => setFilters((prev) => ({ ...prev, [key]: val, _page: 1 }));
  const totalPgs    = Math.ceil(total / LIMIT);

  const showSuccess = (msg) => {
    setAssignToast(msg);
    setTimeout(() => setAssignToast(null), 6000);
    onRetry?.();
  };

  return (
    <div>
      {/* Success toast */}
      {assignToast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 9999,
          background: "#dcfce7", border: "1px solid #bbf7d0",
          borderRadius: 10, padding: "14px 18px", color: "#166534",
          fontSize: ".82rem", fontWeight: 600,
          boxShadow: "0 6px 20px rgba(0,0,0,.12)",
          display: "flex", alignItems: "center", gap: 10,
          maxWidth: 420,
        }}>
          <span style={{ fontSize: "1rem" }}>✅</span>
          <span style={{ flex: 1 }}>{assignToast}</span>
          <button onClick={() => setAssignToast(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#166534", fontSize: "1rem" }}>×</button>
        </div>
      )}

      {/* Top bar — always visible */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 14, flexWrap: "wrap", gap: 10,
      }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: ".82rem", fontWeight: 600 }}>
            {total > 0
              ? `${total} subscription${total !== 1 ? "s" : ""}`
              : "No subscriptions yet"}
          </span>
        </div>
        <Btn variant="success" onClick={() => setShowAssign(true)}>
          🎁 Assign Subscription to Seller
        </Btn>
      </div>

      {/* Filters */}
      <div style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 10, padding: "12px 14px", marginBottom: 12,
      }}>
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
          <Btn variant="ghost" onClick={() => setFilters({ q: "", plan: "all", status: "all", cycle: "all", auto_renew: "all", date_from: "", date_to: "" })}>
            Clear
          </Btn>
          <Btn variant="ghost" onClick={onRetry}>↻ Refresh</Btn>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: ".72rem", color: C.muted }}>Date range:</span>
          <Inp type="date" value={filters.date_from ?? ""} onChange={(e) => setFilter("date_from", e.target.value)} style={{ width: 140 }} />
          <span style={{ fontSize: ".72rem", color: C.muted }}>to</span>
          <Inp type="date" value={filters.date_to ?? ""}   onChange={(e) => setFilter("date_to",   e.target.value)} style={{ width: 140 }} />
          <div style={{ marginLeft: "auto", display: "flex", gap: 5 }}>
            {["csv", "excel", "pdf"].map((f) => (
              <Btn key={f} variant="ghost" onClick={() => onExport?.(f)} disabled={!!exporting}>
                {exporting === f ? <Spinner size={12} /> : f === "csv" ? "📥 CSV" : f === "excel" ? "📊 Excel" : "🖨 PDF"}
              </Btn>
            ))}
          </div>
        </div>
      </div>

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "#dbeafe", border: "1px solid #bfdbfe",
          borderRadius: 8, padding: "7px 14px", marginBottom: 10, flexWrap: "wrap",
        }}>
          <span style={{ fontSize: ".78rem", fontWeight: 700, color: C.blue }}>
            {selected.size} selected
          </span>
          <Btn variant="blue"    onClick={() => onQuickAction(null, "bulkExtend")}>Extend 30d</Btn>
          <Btn variant="warning" onClick={() => onQuickAction(null, "bulkCancel")}>Cancel</Btn>
          <Btn variant="ghost"   onClick={() => onQuickAction(null, "bulkEmail")}>Send Email</Btn>
          <Btn variant="ghost"   onClick={() => onExport?.("csv", [...selected])}>Export</Btn>
          <Btn variant="ghost"   onClick={() => setSelected(new Set())} style={{ marginLeft: "auto" }}>Clear</Btn>
        </div>
      )}

      {/* Table content */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "56px 0", color: C.muted }}>
          <Spinner size={24} />
          <div style={{ marginTop: 12, fontSize: ".82rem" }}>Loading subscriptions…</div>
        </div>
      ) : error ? (
        <div style={{
          background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8,
          padding: "14px 18px", color: C.red, fontSize: ".82rem",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span>⚠</span> {error}
          <button onClick={onRetry} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", textDecoration: "underline", fontFamily: "inherit", fontSize: ".82rem" }}>
            Retry
          </button>
        </div>
      ) : !subscriptions.length ? (
        <div style={{
          textAlign: "center", padding: "64px 20px",
          background: C.card, border: `1px solid ${C.border}`,
          borderRadius: 12,
        }}>
          <div style={{ fontSize: "3rem", marginBottom: 12 }}>📋</div>
          <p style={{ fontSize: ".92rem", fontWeight: 700, color: C.text, marginBottom: 8 }}>
            No subscriptions found
          </p>
          <p style={{ fontSize: ".78rem", color: C.muted, marginBottom: 24, maxWidth: 360, margin: "0 auto 24px" }}>
            Sellers can subscribe through the app, or you can manually assign a
            subscription plan to any seller right now.
          </p>
          <Btn variant="success" onClick={() => setShowAssign(true)} style={{ padding: "10px 24px", fontSize: ".82rem" }}>
            🎁 Assign Subscription to Seller
          </Btn>
        </div>
      ) : (
        <>
          <div style={{ overflowX: "auto", background: C.card, border: `1px solid ${C.border}`, borderRadius: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".76rem" }}>
              <thead>
                <tr style={{ background: C.bg, borderBottom: `2px solid ${C.border}` }}>
                  <th style={{ padding: "10px 12px" }}>
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                  </th>
                  {["Seller","Plan","Cycle","Amount","Status","Auto Renew","Started","Expires","Actions"].map((h) => (
                    <th key={h} style={{
                      padding: "10px 12px", textAlign: "left", fontWeight: 600,
                      color: C.muted, fontSize: ".66rem", textTransform: "uppercase",
                      letterSpacing: ".04em", whiteSpace: "nowrap",
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
                      style={{ borderBottom: `1px solid ${C.border}`, background: soon ? "#fff7ed" : undefined }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = soon ? "#fff3cd" : C.hover)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = soon ? "#fff7ed" : "")}
                    >
                      <td style={{ padding: "10px 12px" }}>
                        <input type="checkbox" checked={selected.has(sub.id)} onChange={() => toggle(sub.id)} onClick={(e) => e.stopPropagation()} />
                      </td>
                      <td style={{ padding: "10px 12px", maxWidth: 180 }}>
                        <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {sub.user_name ?? "—"}
                        </div>
                        <div style={{ fontSize: ".66rem", color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {sub.user_email ?? ""}
                        </div>
                      </td>
                      <td style={{ padding: "10px 12px", fontWeight: 600, whiteSpace: "nowrap" }}>
                        {PLAN_BADGE[sub.plan_slug] ?? ""} {sub.plan_name ?? sub.plan_slug}
                      </td>
                      <td style={{ padding: "10px 12px", color: C.muted, textTransform: "capitalize", whiteSpace: "nowrap" }}>
                        {sub.billing_cycle ?? "—"}
                      </td>
                      <td style={{ padding: "10px 12px", fontWeight: 700, whiteSpace: "nowrap" }}>
                        {sub.amount ? naira(sub.amount) : <span style={{ fontSize: ".68rem", color: C.muted }}>Free grant</span>}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <StatusPill status={sub.status} />
                      </td>
                      <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                        <span style={{ color: sub.auto_renew ? C.green : C.muted, fontWeight: 600, fontSize: ".72rem" }}>
                          {sub.auto_renew ? "✅ On" : "❌ Off"}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", color: C.muted, whiteSpace: "nowrap", fontSize: ".7rem" }}>
                        {fmt(sub.started_at)}
                      </td>
                      <td style={{
                        padding: "10px 12px", whiteSpace: "nowrap", fontSize: ".7rem",
                        color: soon ? C.red : C.muted, fontWeight: soon ? 700 : 400,
                      }}>
                        {fmt(sub.expires_at)}
                        {soon && <span style={{ marginLeft: 3, fontSize: ".6rem" }}>⚠</span>}
                      </td>

                      {/* Actions — always visible */}
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ display: "flex", gap: 4, alignItems: "center", position: "relative" }}>
                          <Btn variant="blue" onClick={() => onView(sub)} style={{ fontSize: ".68rem", padding: "3px 9px" }} title="View details">
                            View
                          </Btn>
                          {sub.status === "active" ? (
                            <Btn variant="warning" onClick={() => onQuickAction(sub, "changePlan")} style={{ fontSize: ".68rem", padding: "3px 9px" }} title="Change plan">
                              Edit
                            </Btn>
                          ) : (
                            <Btn variant="success" onClick={() => onQuickAction(sub, "reactivate")} style={{ fontSize: ".68rem", padding: "3px 9px" }} title="Reactivate">
                              Reactivate
                            </Btn>
                          )}
                          <div style={{ position: "relative" }}>
                            <Btn variant="ghost" onClick={() => setOpenMenuId((p) => p === sub.id ? null : sub.id)} style={{ fontSize: ".78rem", padding: "3px 8px" }} title="More actions">
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

          {/* Pagination */}
          {totalPgs > 1 && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginTop: 12, flexWrap: "wrap", gap: 8,
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
                    <Btn key={p} onClick={() => setPage(p)} variant={p === page ? "primary" : "ghost"} style={{ fontSize: ".7rem", padding: "3px 8px" }}>
                      {p}
                    </Btn>
                  );
                })}
                <Btn variant="ghost" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPgs} style={{ fontSize: ".7rem", padding: "3px 8px" }}>›</Btn>
                <Btn variant="ghost" onClick={() => setPage(totalPgs)}     disabled={page >= totalPgs} style={{ fontSize: ".7rem", padding: "3px 8px" }}>»</Btn>
              </div>
            </div>
          )}
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