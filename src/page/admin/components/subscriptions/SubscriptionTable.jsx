import { useState, useRef, useEffect } from "react";
import {
  C, naira, fmt, expiringSoon,
  PLAN_SLUGS, PLAN_BADGE, PLAN_LABELS,
  Btn, StatusPill, Spinner, Sel, Inp,
} from "./SubscriptionUI.jsx";

const LIMIT = 20;

/* ─── QuickMenu ──────────────────────────────────────────────────────────── */
function QuickMenu({ sub, onView, onAction, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  const items = [
    { label: "View Details",        action: "view",        color: C.blue    },
    { label: "Change Plan",         action: "changePlan",  color: C.text    },
    { label: "Extend Subscription", action: "extend",      color: C.text    },
    { label: "Grant Free Access",   action: "grant",       color: C.green   },
    { label: "Toggle Auto-Renew",   action: "toggleRenew", color: C.text    },
    { label: "View Payments",       action: "payments",    color: C.text    },
    ...(sub.status === "active" ? [
      { label: "Suspend",           action: "suspend",     color: "#c2410c" },
      { label: "Cancel",            action: "cancel",      color: C.red     },
    ] : []),
    ...((sub.status === "cancelled" || sub.status === "expired") ? [
      { label: "Reactivate",        action: "reactivate",  color: C.green   },
    ] : []),
    { label: "Send Email",          action: "sendEmail",   color: C.text    },
    { label: "Feature Overrides",   action: "overrides",   color: C.purple  },
  ];

  return (
    <div ref={ref} style={{
      position: "absolute", right: 0, top: "100%", zIndex: 200,
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,.13)",
      minWidth: 190, overflow: "hidden",
    }}>
      {items.map((item) => (
        <button
          key={item.action}
          onClick={() => { item.action === "view" ? onView() : onAction(item.action); onClose(); }}
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
}) {
  const [openMenuId, setOpenMenuId] = useState(null);

  const allSelected = subscriptions.length > 0 && selected.size === subscriptions.length;
  const toggleAll   = () => setSelected(allSelected ? new Set() : new Set(subscriptions.map((s) => s.id)));
  const toggle      = (id) => { const n = new Set(selected); n.has(id) ? n.delete(id) : n.add(id); setSelected(n); };
  const setFilter   = (key, val) => setFilters((prev) => ({ ...prev, [key]: val, _page: 1 }));
  const totalPgs    = Math.ceil(total / LIMIT);

  /* ── Bulk bar ─────────────────────────────────────────────────────────── */
  const BulkBar = () => (
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
      <Btn variant="ghost"   onClick={() => setSelected(new Set())} style={{ marginLeft: "auto" }}>
        Clear
      </Btn>
    </div>
  );

  /* ── Filters ──────────────────────────────────────────────────────────── */
  const FiltersBar = () => (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: 10, padding: "12px 14px", marginBottom: 12,
    }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <Inp
          value={filters.q ?? ""}
          onChange={(e) => setFilter("q", e.target.value)}
          placeholder="Name, email, phone, ID, reference…"
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
        <Btn variant="ghost" onClick={onRetry}>↻</Btn>
      </div>

      {/* Date range + export row */}
      <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: ".72rem", color: C.muted }}>Date range:</span>
        <Inp type="date" value={filters.date_from ?? ""} onChange={(e) => setFilter("date_from", e.target.value)} style={{ width: 140 }} />
        <span style={{ fontSize: ".72rem", color: C.muted }}>to</span>
        <Inp type="date" value={filters.date_to ?? ""}   onChange={(e) => setFilter("date_to",   e.target.value)} style={{ width: 140 }} />
        <div style={{ marginLeft: "auto", display: "flex", gap: 5 }}>
          {["csv", "excel", "pdf"].map((f) => (
            <Btn key={f} variant="ghost" onClick={() => onExport?.(f)} disabled={!!exporting}>
              {exporting === f
                ? <Spinner size={12} />
                : f === "csv" ? "📥 CSV" : f === "excel" ? "📊 Excel" : "🖨 PDF"
              }
            </Btn>
          ))}
        </div>
      </div>
    </div>
  );

  /* ── Render ───────────────────────────────────────────────────────────── */
  return (
    <div>
      <FiltersBar />
      {selected.size > 0 && <BulkBar />}

      {loading ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: C.muted }}>
          <Spinner size={22} />
          <div style={{ marginTop: 10, fontSize: ".82rem" }}>Loading subscriptions…</div>
        </div>
      ) : error ? (
        <div style={{
          background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8,
          padding: "14px 18px", color: C.red, fontSize: ".82rem",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          {error}
          <button onClick={onRetry} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", textDecoration: "underline", fontFamily: "inherit", fontSize: ".82rem" }}>
            Retry
          </button>
        </div>
      ) : !subscriptions.length ? (
        <div style={{ textAlign: "center", padding: "56px 0", color: C.muted }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>📋</div>
          <p style={{ fontSize: ".85rem" }}>No subscriptions match your filters.</p>
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
                        <input
                          type="checkbox"
                          checked={selected.has(sub.id)}
                          onChange={() => toggle(sub.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
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
                        {sub.amount ? naira(sub.amount) : "—"}
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
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ display: "flex", gap: 5, alignItems: "center", position: "relative" }}>
                          <Btn variant="blue" onClick={() => onView(sub)} style={{ fontSize: ".68rem", padding: "3px 9px" }}>
                            View
                          </Btn>
                          <div style={{ position: "relative" }}>
                            <Btn
                              variant="ghost"
                              onClick={() => setOpenMenuId((p) => p === sub.id ? null : sub.id)}
                              style={{ fontSize: ".75rem", padding: "3px 8px" }}
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
                <Btn variant="ghost" onClick={() => setPage(1)} disabled={page <= 1} style={{ fontSize: ".7rem", padding: "3px 8px" }}>«</Btn>
                <Btn variant="ghost" onClick={() => setPage((p) => p - 1)} disabled={page <= 1} style={{ fontSize: ".7rem", padding: "3px 8px" }}>‹</Btn>

                {Array.from({ length: Math.min(7, totalPgs) }, (_, i) => {
                  let p;
                  if      (totalPgs <= 7)           p = i + 1;
                  else if (page <= 4)               p = i + 1;
                  else if (page >= totalPgs - 3)    p = totalPgs - 6 + i;
                  else                              p = page - 3 + i;
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
                <Btn variant="ghost" onClick={() => setPage(totalPgs)} disabled={page >= totalPgs} style={{ fontSize: ".7rem", padding: "3px 8px" }}>»</Btn>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}