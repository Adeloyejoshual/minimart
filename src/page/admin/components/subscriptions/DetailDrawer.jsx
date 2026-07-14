import { useState, useEffect } from "react";
import {
  C, naira, fmt, fmtFull, fmtTime,
  PLAN_SLUGS, PLAN_BADGE, PLAN_LABELS,
  Btn, Divider, Section, InfoRow, MiniTag, Spinner, StatusPill,
} from "./SubscriptionUI.jsx";

const ADM = `${import.meta.env.VITE_API_BASE_URL}/api/admin`;

const TABS = [
  { id: "overview",  label: "Overview"  },
  { id: "actions",   label: "Actions"   },
  { id: "payments",  label: "Payments"  },
  { id: "features",  label: "Features"  },
  { id: "preview",   label: "Preview"   },
  { id: "overrides", label: "Overrides" },
  { id: "timeline",  label: "Timeline"  },
  { id: "notes",     label: "Notes"     },
  { id: "fraud",     label: "Fraud"     },
];

/* ─── RefundModal ────────────────────────────────────────────────────────── */
function RefundModal({ transaction, onConfirm, onClose, busy }) {
  const [reason, setReason] = useState("customer_request");
  const [amount, setAmount] = useState(transaction?.amountNaira ?? 0);

  const REASONS = [
    { value: "customer_request",    label: "Customer Request"     },
    { value: "duplicate",           label: "Duplicate Payment"    },
    { value: "fraud",               label: "Fraudulent Payment"   },
    { value: "service_not_received",label: "Service Not Received" },
    { value: "other",               label: "Other"                },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: C.card, borderRadius: 12, padding: 24, maxWidth: 400, width: "90%", boxShadow: "0 16px 48px rgba(0,0,0,.2)" }}>
        <div style={{ fontWeight: 700, fontSize: ".95rem", marginBottom: 16 }}>Refund Payment</div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: ".72rem", color: C.muted, marginBottom: 5 }}>Reason</div>
          <select value={reason} onChange={(e) => setReason(e.target.value)}
            style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: ".8rem", background: C.card, color: C.text }}>
            {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: ".72rem", color: C.muted, marginBottom: 5 }}>Refund Amount (₦)</div>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
            max={transaction?.amountNaira ?? 0}
            style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: ".8rem", background: C.card, color: C.text, boxSizing: "border-box" }} />
          <div style={{ fontSize: ".68rem", color: C.muted, marginTop: 3 }}>Max: ₦{(transaction?.amountNaira ?? 0).toLocaleString("en-NG")}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</Btn>
          <Btn variant="danger" onClick={() => onConfirm({ reason, amount: Number(amount) })} disabled={!amount || busy} style={{ flex: 1 }}>
            {busy ? <Spinner /> : "Refund"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

/* ─── GrantModal ─────────────────────────────────────────────────────────── */
function GrantModal({ onConfirm, onClose, busy }) {
  const [plan,     setPlan]     = useState("premium");
  const [duration, setDuration] = useState(30);
  const [reason,   setReason]   = useState("Promotion Winner");

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: C.card, borderRadius: 12, padding: 24, maxWidth: 400, width: "90%", boxShadow: "0 16px 48px rgba(0,0,0,.2)" }}>
        <div style={{ fontWeight: 700, fontSize: ".95rem", marginBottom: 16 }}>🎁 Grant Free Subscription</div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: ".72rem", color: C.muted, marginBottom: 5 }}>Plan</div>
          <select value={plan} onChange={(e) => setPlan(e.target.value)}
            style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: ".8rem", background: C.card, color: C.text }}>
            {PLAN_SLUGS.map((s) => <option key={s} value={s}>{PLAN_BADGE[s]} {PLAN_LABELS[s]}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: ".72rem", color: C.muted, marginBottom: 5 }}>Duration (days)</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[7, 14, 30, 60, 90].map((d) => (
              <Btn key={d} variant={duration === d ? "primary" : "ghost"} onClick={() => setDuration(d)} style={{ fontSize: ".72rem", padding: "4px 10px" }}>
                {d}d
              </Btn>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: ".72rem", color: C.muted, marginBottom: 5 }}>Reason</div>
          <input value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Promotion Winner, Compensation"
            style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: ".8rem", background: C.card, color: C.text, boxSizing: "border-box" }} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</Btn>
          <Btn variant="success" onClick={() => onConfirm({ plan, duration, reason })} disabled={busy} style={{ flex: 1 }}>
            {busy ? <Spinner /> : "Grant Access"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

/* ─── PaymentDetailModal ─────────────────────────────────────────────────── */
function PaymentDetailModal({ tx, onClose }) {
  if (!tx) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: C.card, borderRadius: 12, padding: 24, maxWidth: 440, width: "90%", boxShadow: "0 16px 48px rgba(0,0,0,.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: ".95rem" }}>Payment Details</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem", color: C.muted }}>×</button>
        </div>
        <InfoRow label="Amount"         value={tx.amount ? naira(tx.amount) : "—"} />
        <InfoRow label="Status"         value={<StatusPill status={tx.status ?? "pending"} />} />
        <InfoRow label="Gateway"        value={tx.provider      ?? "paystack"} />
        <InfoRow label="Reference"      value={tx.reference}    mono copy={tx.reference} />
        <InfoRow label="Channel"        value={tx.channel       ?? "—"} />
        <InfoRow label="Currency"       value={tx.currency      ?? "NGN"} />
        <InfoRow label="Fees"           value={tx.fees          ? naira(tx.fees) : "—"} />
        <InfoRow label="IP"             value={tx.ip_address    ?? "—"} />
        <InfoRow label="Paid At"        value={fmtTime(tx.paid_at)} />
        <InfoRow label="Webhook Status" value={tx.webhook_status ?? "—"} />
        <InfoRow label="Retry Count"    value={tx.retry_count    ?? 0} />
        <div style={{ marginTop: 16 }}>
          <Btn variant="ghost" onClick={onClose} style={{ width: "100%" }}>Close</Btn>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   DETAIL DRAWER
═══════════════════════════════════════════════════════════════════════════ */
export function DetailDrawer({ sub, api, onClose, onMutation, confirm }) {
  const [tab,           setTab]           = useState(sub?._tab ?? "overview");
  const [payments,      setPayments]      = useState([]);
  const [features,      setFeatures]      = useState({});
  const [overrides,     setOverrides]     = useState({});
  const [timeline,      setTimeline]      = useState([]);
  const [notes,         setNotes]         = useState([]);
  const [fraudSignals,  setFraudSignals]  = useState([]);
  const [newNote,       setNewNote]       = useState("");
  const [busy,          setBusy]          = useState(null);
  const [targetPlan,    setTargetPlan]    = useState(sub?.plan_slug ?? "premium");
  const [customDate,    setCustomDate]    = useState("");
  const [showRefund,    setShowRefund]    = useState(null);
  const [showGrant,     setShowGrant]     = useState(false);
  const [showPayDetail, setShowPayDetail] = useState(null);

  useEffect(() => {
    if (!sub) return;
    setTab(sub._tab ?? "overview");
    loadPayments();
    loadFeatures();
    loadTimeline();
    loadNotes();
    loadFraud();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub?.id]);

  const load = async (path, setter) => {
    try { const { data } = await api.get(path, ADM); setter(data); } catch {}
  };

  const loadPayments = () => load(`/subscriptions/${sub.user_id}/payments`,  (d) => setPayments(d?.transactions ?? []));
  const loadFeatures = () => load(`/subscriptions/${sub.user_id}/features`,  (d) => { setFeatures(d?.features ?? {}); setOverrides(d?.overrides ?? {}); });
  const loadTimeline = () => load(`/subscriptions/${sub.user_id}/timeline`,  (d) => setTimeline(d?.timeline   ?? []));
  const loadNotes    = () => load(`/subscriptions/${sub.user_id}/notes`,     (d) => setNotes(d?.notes         ?? []));
  const loadFraud    = () => load(`/subscriptions/${sub.user_id}/fraud`,     (d) => setFraudSignals(d?.signals ?? []));

  const run = async (key, fn) => {
    setBusy(key);
    try { await fn(); onMutation?.(); await Promise.all([loadPayments(), loadTimeline(), loadNotes()]); }
    catch (err) { alert(err?.response?.data?.message ?? err.message ?? "Action failed."); }
    finally { setBusy(null); }
  };

  const changePlan    = ()     => confirm({ title: "Change Plan", confirm: "Apply", body: `Move ${sub.user_name} → ${targetPlan}. No charge.`, action: () => run("changePlan", () => api.post(`/subscriptions/${sub.user_id}/change-plan`, { plan: targetPlan }, ADM)) });
  const extendSub     = (days) => confirm({ title: "Extend Subscription", confirm: "Extend", body: `Extend ${sub.user_name}'s subscription by ${days ? `${days} days` : `until ${customDate}`}.`, action: () => run("extend", () => api.post(`/subscriptions/${sub.user_id}/extend`, { days: days ?? null, until_date: days ? null : customDate }, ADM)) });
  const toggleRenew   = ()     => run("autoRenew", () => api.post(`/subscriptions/${sub.user_id}/toggle-auto-renew`, { autoRenew: !sub.auto_renew }, ADM));
  const reactivate    = ()     => confirm({ title: "Reactivate", confirm: "Reactivate",       body: `Reactivate ${sub.user_name}'s subscription for 30 days?`,              action: () => run("reactivate", () => api.post(`/subscriptions/${sub.user_id}/reactivate`, {}, ADM)) });
  const cancelSub     = ()     => confirm({ title: "Cancel",     confirm: "Cancel",  danger: true, body: `Cancel ${sub.user_name}'s subscription?`,                        action: () => run("cancel",     () => api.post(`/subscriptions/${sub.user_id}/cancel`,     {}, ADM)) });
  const suspendSub    = ()     => confirm({ title: "Suspend",    confirm: "Suspend", danger: true, body: `Suspend ${sub.user_name} immediately?`,                           action: () => run("suspend",    () => api.post(`/subscriptions/${sub.user_id}/suspend`,    {}, ADM)) });
  const grantFree     = (p)    => run("grant",    async () => { await api.post(`/subscriptions/${sub.user_id}/grant`,  p, ADM); setShowGrant(false); });
  const sendNotif     = (type) => run(`notif-${type}`, () => api.post(`/subscriptions/${sub.user_id}/notify`, { type }, ADM));
  const verifyPayment = (ref)  => run("verify", () => api.post(`/subscriptions/verify-payment`, { reference: ref }, ADM));
  const handleRefund  = (tx, payload) => run("refund", async () => { await api.post(`/subscriptions/${sub.user_id}/refund`, { transaction_id: tx.id, ...payload }, ADM); setShowRefund(null); loadPayments(); });
  const saveOverride  = (key, val) => run(`override-${key}`, () => api.post(`/subscriptions/${sub.user_id}/feature-override`, { key, value: val }, ADM));
  const addNote       = async () => { if (!newNote.trim()) return; await run("note", async () => { await api.post(`/subscriptions/${sub.user_id}/notes`, { content: newNote }, ADM); setNewNote(""); loadNotes(); }); };

  if (!sub) return null;

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 1000, backdropFilter: "blur(3px)" }} />

      {/* Panel */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: "min(720px, 96vw)", background: C.card, zIndex: 1001,
        display: "flex", flexDirection: "column",
        boxShadow: "-8px 0 40px rgba(0,0,0,.18)", overflowY: "auto",
      }}>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          padding: "18px 22px 14px", borderBottom: `1px solid ${C.border}`,
          position: "sticky", top: 0, background: C.card, zIndex: 10,
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: "1.25rem" }}>{PLAN_BADGE[sub.plan_slug] ?? ""}</span>
              <span style={{ fontSize: ".95rem", fontWeight: 700 }}>{sub.user_name ?? "Unknown"}</span>
              <StatusPill status={sub.status} />
            </div>
            <div style={{ fontSize: ".72rem", color: C.muted }}>
              {sub.user_email}
              {sub.user_phone && <span style={{ marginLeft: 8 }}>· {sub.user_phone}</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.4rem", color: C.muted }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, overflowX: "auto", flexShrink: 0 }}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "10px 14px", border: "none", background: "none",
              fontFamily: "inherit", fontSize: ".72rem", fontWeight: 600,
              whiteSpace: "nowrap", color: tab === t.id ? C.orange : C.muted,
              cursor: "pointer", borderBottom: `2px solid ${tab === t.id ? C.orange : "transparent"}`,
              transition: "color .12s",
            }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: "18px 22px", flex: 1 }}>

          {/* OVERVIEW */}
          {tab === "overview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Section title="Seller Information">
                <InfoRow label="Name"              value={sub.user_name     ?? "—"} />
                <InfoRow label="Email"             value={sub.user_email    ?? "—"} copy={sub.user_email} />
                <InfoRow label="Phone"             value={sub.user_phone    ?? "—"} />
                <InfoRow label="Business Name"     value={sub.business_name ?? "—"} />
                <InfoRow label="Business Verified" value={sub.store_verified ? "✅ Verified" : "❌ Not Verified"} />
                <InfoRow label="User ID"           value={sub.user_id}      mono copy={sub.user_id} />
              </Section>
              <Section title="Subscription">
                <InfoRow label="Subscription ID"   value={sub.id}           mono copy={sub.id} />
                <InfoRow label="Plan"              value={`${PLAN_BADGE[sub.plan_slug] ?? ""} ${sub.plan_name ?? sub.plan_slug}`} />
                <InfoRow label="Status"            value={<StatusPill status={sub.status} />} />
                <InfoRow label="Billing Cycle"     value={sub.billing_cycle ?? "—"} />
                <InfoRow label="Amount"            value={sub.amount ? naira(sub.amount) : "—"} />
                <InfoRow label="Started"           value={fmtFull(sub.started_at)} />
                <InfoRow label="Expires"           value={fmtFull(sub.expires_at)} />
                <InfoRow label="Last Renewal"      value={fmtFull(sub.last_renewed_at)} />
                <InfoRow label="Auto-Renew"        value={sub.auto_renew ? "✅ Enabled" : "❌ Disabled"} />
                <InfoRow label="Payment Ref"       value={sub.payment_reference ?? "—"} mono copy={sub.payment_reference} />
                <InfoRow label="Coupon Used"       value={sub.coupon_code ?? "—"} />
              </Section>
            </div>
          )}

          {/* ACTIONS */}
          {tab === "actions" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <Section title="Grant Free Subscription">
                <p style={{ fontSize: ".75rem", color: C.muted, marginBottom: 8 }}>
                  Give a seller free access to any plan without requiring payment.
                </p>
                <Btn variant="success" onClick={() => setShowGrant(true)}>🎁 Grant Free Access</Btn>
              </Section>
              <Divider />

              <Section title="Change Plan (No Payment)">
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <select value={targetPlan} onChange={(e) => setTargetPlan(e.target.value)}
                    style={{ flex: 1, minWidth: 140, padding: "7px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: ".8rem", background: C.card, color: C.text }}>
                    {["free", ...PLAN_SLUGS].map((s) => (
                      <option key={s} value={s}>{PLAN_BADGE[s] ?? ""} {PLAN_LABELS[s]}</option>
                    ))}
                  </select>
                  <Btn variant="primary" onClick={changePlan} disabled={busy === "changePlan"}>
                    {busy === "changePlan" ? <Spinner /> : "Apply Plan"}
                  </Btn>
                </div>
              </Section>
              <Divider />

              <Section title="Extend Subscription">
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                  {[7, 14, 30, 60, 90].map((d) => (
                    <Btn key={d} variant="blue" onClick={() => extendSub(d)} disabled={!!busy}>
                      {busy === "extend" ? <Spinner /> : `+${d}d`}
                    </Btn>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)}
                    style={{ flex: 1, padding: "7px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: ".78rem", background: C.card, color: C.text }} />
                  <Btn variant="blue" onClick={() => extendSub(null)} disabled={!customDate || !!busy}>
                    Extend to Date
                  </Btn>
                </div>
              </Section>
              <Divider />

              <Section title="Auto Renew">
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: ".82rem" }}>
                    {sub.auto_renew ? "✅ Currently Enabled" : "❌ Currently Disabled"}
                  </span>
                  <Btn variant={sub.auto_renew ? "warning" : "success"} onClick={toggleRenew} disabled={busy === "autoRenew"}>
                    {busy === "autoRenew" ? <Spinner /> : sub.auto_renew ? "Disable" : "Enable"}
                  </Btn>
                </div>
              </Section>
              <Divider />

              <Section title="Lifecycle Controls">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {(sub.status === "cancelled" || sub.status === "expired") && (
                    <Btn variant="success" onClick={reactivate} disabled={!!busy}>
                      {busy === "reactivate" ? <Spinner /> : "♻ Reactivate"}
                    </Btn>
                  )}
                  {sub.status === "active" && (
                    <>
                      <Btn variant="warning" onClick={suspendSub} disabled={!!busy}>
                        {busy === "suspend" ? <Spinner /> : "⏸ Suspend"}
                      </Btn>
                      <Btn variant="danger" onClick={cancelSub} disabled={!!busy}>
                        {busy === "cancel" ? <Spinner /> : "✕ Cancel"}
                      </Btn>
                    </>
                  )}
                </div>
              </Section>
              <Divider />

              <Section title="Send Notification">
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {[
                    { key: "renewal_reminder", label: "Renewal Reminder" },
                    { key: "expiry_reminder",  label: "Expiry Reminder"  },
                    { key: "invoice",          label: "Invoice"          },
                    { key: "receipt",          label: "Receipt"          },
                    { key: "upgrade_offer",    label: "Upgrade Offer"    },
                    { key: "payment_failure",  label: "Payment Failure"  },
                  ].map(({ key, label }) => (
                    <Btn key={key} variant="ghost" onClick={() => sendNotif(key)} disabled={!!busy}>
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
              <div style={{ fontWeight: 700, fontSize: ".85rem", marginBottom: 14 }}>Payment History</div>
              <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px", marginBottom: 16 }}>
                <div style={{ fontSize: ".72rem", color: C.muted, marginBottom: 6 }}>Manual Payment Verification</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input id="verifyRef" placeholder="Paystack reference…"
                    style={{ flex: 1, padding: "6px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: ".78rem", background: C.card, color: C.text }} />
                  <Btn variant="blue" disabled={busy === "verify"}
                    onClick={() => verifyPayment(document.getElementById("verifyRef").value)}>
                    {busy === "verify" ? <Spinner /> : "Verify"}
                  </Btn>
                </div>
              </div>
              {!payments.length ? (
                <p style={{ color: C.muted, fontSize: ".8rem" }}>No payment records.</p>
              ) : (
                payments.map((p, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i < payments.length - 1 ? `1px solid ${C.border}` : "none" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: ".8rem" }}>{p.amount ? naira(p.amount) : "—"}</div>
                      <div style={{ fontSize: ".68rem", color: C.muted, fontFamily: "monospace" }}>{p.reference ?? "—"}</div>
                      <div style={{ fontSize: ".68rem", color: C.muted }}>{fmtTime(p.paid_at ?? p.created_at)}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <StatusPill status={p.status ?? "pending"} />
                      <Btn variant="ghost" style={{ fontSize: ".68rem", padding: "3px 8px" }} onClick={() => setShowPayDetail(p)}>
                        Details
                      </Btn>
                      {p.status === "success" && (
                        <Btn variant="warning" style={{ fontSize: ".68rem", padding: "3px 8px" }} onClick={() => setShowRefund(p)}>
                          Refund
                        </Btn>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* FEATURES */}
          {tab === "features" && (
            <div>
              <div style={{ fontWeight: 700, fontSize: ".85rem", marginBottom: 14 }}>
                Features — {PLAN_BADGE[sub.plan_slug] ?? ""} {sub.plan_name ?? sub.plan_slug}
              </div>
              {!Object.keys(features).length ? (
                <p style={{ color: C.muted, fontSize: ".8rem" }}>No feature data.</p>
              ) : (
                Object.entries(features).map(([key, val]) => (
                  <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ fontSize: ".78rem", textTransform: "capitalize" }}>{key.replace(/_/g, " ")}</span>
                    <MiniTag val={val} featureKey={key} />
                  </div>
                ))
              )}
            </div>
          )}

          {/* PREVIEW */}
          {tab === "preview" && (
            <div>
              <div style={{ fontWeight: 700, fontSize: ".85rem", marginBottom: 14 }}>
                Subscription Preview (What the seller sees)
              </div>
              <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, maxWidth: 320 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <span style={{ fontSize: "2rem" }}>{PLAN_BADGE[sub.plan_slug] ?? "🆓"}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: ".95rem" }}>{sub.plan_name ?? "Free"}</div>
                    <StatusPill status={sub.status} />
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                  {[
                    ["Expires",    fmt(sub.expires_at)],
                    ["Remaining",  sub.expires_at ? `${Math.max(0, Math.ceil((new Date(sub.expires_at) - new Date()) / 86400000))} days` : "—"],
                    ["Auto Renew", sub.auto_renew ? "ON" : "OFF"],
                  ].map(([label, value]) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: ".78rem" }}>
                      <span style={{ color: C.muted }}>{label}</span>
                      <span style={{
                        fontWeight: 600,
                        color: label === "Auto Renew" ? (sub.auto_renew ? C.green : C.red) : C.text,
                      }}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
                {Object.keys(features).length > 0 && (
                  <div>
                    <div style={{ fontSize: ".68rem", fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>
                      Features
                    </div>
                    {Object.entries(features).map(([key, val]) => {
                      const on = val === "true" || val === true;
                      return (
                        <div key={key} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5, fontSize: ".75rem" }}>
                          <span style={{ color: on ? C.green : C.muted }}>{on ? "✓" : "✗"}</span>
                          <span style={{ textTransform: "capitalize", color: on ? C.text : C.muted }}>
                            {key.replace(/_/g, " ")}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* OVERRIDES */}
          {tab === "overrides" && (
            <div>
              <div style={{ fontWeight: 700, fontSize: ".85rem", marginBottom: 6 }}>Feature Overrides</div>
              <p style={{ fontSize: ".75rem", color: C.muted, marginBottom: 14 }}>
                Grant extra features beyond the plan. These expire with the subscription.
              </p>
              {[
                { key: "featured_listings",   label: "Featured Listings"   },
                { key: "homepage_promotion",  label: "Homepage Promotion"  },
                { key: "api_access",          label: "API Access"          },
                { key: "custom_branding",     label: "Custom Branding"     },
                { key: "inventory_management",label: "Inventory Management"},
                { key: "team_accounts",       label: "Team Accounts"       },
              ].map(({ key, label }) => {
                const current = overrides[key] ?? features[key] ?? "false";
                const isOn    = current === "true" || current === true;
                return (
                  <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ fontSize: ".8rem" }}>{label}</span>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: ".72rem", color: isOn ? C.green : C.muted }}>
                        {isOn ? "✓ Active" : "✗ Inactive"}
                      </span>
                      <Btn variant={isOn ? "warning" : "success"} onClick={() => saveOverride(key, isOn ? "false" : "true")} disabled={busy === `override-${key}`} style={{ fontSize: ".68rem", padding: "3px 8px" }}>
                        {busy === `override-${key}` ? <Spinner /> : isOn ? "Disable" : "Enable"}
                      </Btn>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TIMELINE */}
          {tab === "timeline" && (
            <div>
              <div style={{ fontWeight: 700, fontSize: ".85rem", marginBottom: 14 }}>Activity & Subscription History</div>
              {!timeline.length ? (
                <p style={{ color: C.muted, fontSize: ".8rem" }}>No activity recorded.</p>
              ) : (
                timeline.map((t, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, paddingBottom: 14 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: C.orange, flexShrink: 0, marginTop: 3 }} />
                      {i < timeline.length - 1 && <div style={{ width: 2, flex: 1, background: C.border, marginTop: 3 }} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: ".8rem" }}>{t.event ?? t.action ?? "Event"}</div>
                      {t.description && <div style={{ fontSize: ".72rem", color: C.muted, marginTop: 2 }}>{t.description}</div>}
                      <div style={{ fontSize: ".68rem", color: C.muted, marginTop: 3 }}>
                        {fmtTime(t.created_at)}
                        {t.admin_name && <span style={{ marginLeft: 8, color: C.blue }}>by {t.admin_name}</span>}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* NOTES */}
          {tab === "notes" && (
            <div>
              <div style={{ fontWeight: 700, fontSize: ".85rem", marginBottom: 14 }}>Admin Notes</div>
              <textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Add a note…" rows={3}
                style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 7, fontSize: ".8rem", background: C.card, color: C.text, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 8 }} />
              <Btn variant="primary" onClick={addNote} disabled={!newNote.trim() || busy === "note"}>
                {busy === "note" ? <Spinner /> : "Add Note"}
              </Btn>
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                {notes.map((n, i) => (
                  <div key={i} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px" }}>
                    <p style={{ margin: 0, fontSize: ".8rem", lineHeight: 1.5 }}>{n.content}</p>
                    <div style={{ fontSize: ".68rem", color: C.muted, marginTop: 6 }}>
                      {n.admin_name ?? "Admin"} · {fmtTime(n.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FRAUD */}
          {tab === "fraud" && (
            <div>
              <div style={{ fontWeight: 700, fontSize: ".85rem", marginBottom: 14 }}>🚨 Fraud Detection</div>
              {!fraudSignals.length ? (
                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "14px 18px", color: C.green, fontSize: ".82rem", fontWeight: 600 }}>
                  ✅ No fraud signals detected for this account.
                </div>
              ) : (
                fraudSignals.map((s, i) => (
                  <div key={i} style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "12px 14px", marginBottom: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: ".8rem", color: C.red, marginBottom: 3 }}>⚠ {s.type ?? "Suspicious Activity"}</div>
                    <div style={{ fontSize: ".72rem", color: "#7f1d1d" }}>{s.description}</div>
                    <div style={{ fontSize: ".68rem", color: C.muted, marginTop: 4 }}>{fmtTime(s.detected_at)}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showRefund    && <RefundModal      transaction={showRefund}  onConfirm={(p) => handleRefund(showRefund, p)} onClose={() => setShowRefund(null)}    busy={busy === "refund"} />}
      {showGrant     && <GrantModal       onConfirm={grantFree}                                                    onClose={() => setShowGrant(false)}     busy={busy === "grant"} />}
      {showPayDetail && <PaymentDetailModal tx={showPayDetail}                                                     onClose={() => setShowPayDetail(null)} />}
    </>
  );
}