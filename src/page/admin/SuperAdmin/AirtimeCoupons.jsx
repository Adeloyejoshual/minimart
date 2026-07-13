// src/pages/admin/SuperAdmin/AirtimeCoupons.jsx

import { useState, useEffect, useCallback, useRef } from "react";

/* ════════════════════════════════════════════════════════════
   CONSTANTS
════════════════════════════════════════════════════════════ */
const AIRTIME_STATUS = {
  AVAILABLE  : "available",
  REDEEMED   : "redeemed",
  PROCESSING : "processing",
  COMPLETED  : "completed",
  FAILED     : "failed",
};

const STATUS_CFG = {
  available  : { label: "Available",  color: "#16a34a", bg: "#f0fdf4" },
  redeemed   : { label: "Pending",    color: "#d97706", bg: "#fffbeb" },
  processing : { label: "Processing", color: "#2563eb", bg: "#eff6ff" },
  completed  : { label: "Completed",  color: "#16a34a", bg: "#f0fdf4" },
  failed     : { label: "Failed",     color: "#dc2626", bg: "#fef2f2" },
};

const naira = (n) => "₦" + Number(n || 0).toLocaleString("en-NG");

const fmtDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-NG", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

/* ════════════════════════════════════════════════════════════
   ASSIGN MODAL
════════════════════════════════════════════════════════════ */
function AssignModal({ api, onClose, onSuccess }) {
  const [userId,  setUserId]  = useState("");
  const [amount,  setAmount]  = useState("100");
  const [code,    setCode]    = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const submit = async () => {
    if (!userId.trim()) { setError("User ID is required."); return; }
    if (!amount || Number(amount) <= 0) { setError("Enter a valid amount."); return; }
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post("/airtime-coupons/assign", {
        user_id : userId.trim(),
        amount  : Number(amount),
        code    : code.trim() || undefined,
      });
      onSuccess(data.message);
      onClose();
    } catch (e) {
      setError(e.response?.data?.message || "Failed to assign coupon.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-title">📱 Assign Airtime Coupon</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, margin: "12px 0" }}>
          <input
            className="inp"
            placeholder="User ID (UUID)"
            value={userId}
            onChange={(e) => { setUserId(e.target.value); setError(null); }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <select
              className="inp"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{ flex: 1 }}
            >
              {[50, 100, 200, 500, 1000].map((a) => (
                <option key={a} value={a}>{naira(a)}</option>
              ))}
            </select>
            <input
              className="inp"
              placeholder="Custom code (optional)"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              style={{ flex: 1 }}
            />
          </div>
        </div>

        {error && (
          <p style={{ fontSize: ".8rem", color: "#dc2626", margin: "0 0 10px" }}>
            ❌ {error}
          </p>
        )}

        <div className="modal-btns">
          <button className="btn b-ghost" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button className="btn b-solid" onClick={submit} disabled={loading}>
            {loading ? "Assigning…" : "Assign Coupon"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   FAILED NOTE MODAL
════════════════════════════════════════════════════════════ */
function FailedModal({ coupon, api, onClose, onSuccess }) {
  const [note,    setNote]    = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const submit = async () => {
    if (!note.trim()) { setError("A note explaining the failure is required."); return; }
    setLoading(true);
    setError(null);
    try {
      await api.post(`/airtime-coupons/${coupon.id}/failed`, { note: note.trim() });
      onSuccess(`Coupon ${coupon.code} marked as failed.`);
      onClose();
    } catch (e) {
      setError(e.response?.data?.message || "Failed to update status.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-title">❌ Mark as Failed</div>
        <p style={{ fontSize: ".82rem", color: "var(--muted)", margin: "6px 0 12px" }}>
          Coupon: <strong>{coupon.code}</strong> · {naira(coupon.amount)} · {coupon.user?.name}
        </p>
        <textarea
          className="inp"
          rows={3}
          placeholder="Explain why this failed (user will see this note)"
          value={note}
          onChange={(e) => { setNote(e.target.value); setError(null); }}
          style={{ resize: "vertical" }}
        />
        {error && (
          <p style={{ fontSize: ".8rem", color: "#dc2626", margin: "4px 0" }}>
            ❌ {error}
          </p>
        )}
        <div className="modal-btns">
          <button className="btn b-ghost" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button className="btn b-red" onClick={submit} disabled={loading}>
            {loading ? "Saving…" : "Mark as Failed"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════ */
export default function AirtimeCoupons({ api, confirm, onMutation }) {
  const [requests,    setRequests]    = useState([]);
  const [summary,     setSummary]     = useState({});
  const [stats,       setStats]       = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [statusTab,   setStatusTab]   = useState("redeemed");
  const [search,      setSearch]      = useState("");
  const [page,        setPage]        = useState(1);
  const [totalPages,  setTotalPages]  = useState(1);
  const [total,       setTotal]       = useState(0);
  const [toast,       setToast]       = useState(null);
  const [showAssign,  setShowAssign]  = useState(false);
  const [failedModal, setFailedModal] = useState(null);
  const [busy,        setBusy]        = useState(null);
  const toastRef = useRef(null);

  /* ── Toast ── */
  const showToast = useCallback((type, text) => {
    setToast({ type, text });
    clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 4_000);
  }, []);

  /* ── Load ── */
  const load = useCallback(async (pg = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status : statusTab,
        page   : pg,
        limit  : 20,
        ...(search ? { search } : {}),
      });

      const [listRes, statsRes] = await Promise.all([
        api.get(`/airtime-coupons?${params}`),
        api.get("/airtime-coupons/stats/summary"),
      ]);

      setRequests(listRes.data.requests   || []);
      setSummary(listRes.data.summary     || {});
      setTotal(listRes.data.total         || 0);
      setTotalPages(listRes.data.pages    || 1);
      setStats(statsRes.data);
    } catch (e) {
      showToast("error", e.response?.data?.message || "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [api, statusTab, search, page, showToast]);

  useEffect(() => {
    setPage(1);
    load(1);
  }, [statusTab, search]);

  useEffect(() => {
    load(page);
  }, [page]);

  useEffect(() => () => clearTimeout(toastRef.current), []);

  /* ── Status action ── */
  const doAction = async (id, action, note) => {
    setBusy(id);
    try {
      await api.post(`/airtime-coupons/${id}/${action}`, note ? { note } : {});
      showToast("success", `Marked as ${action}.`);
      onMutation?.();
      load(page);
    } catch (e) {
      showToast("error", e.response?.data?.message || "Action failed.");
    } finally {
      setBusy(null);
    }
  };

  /* ── Status tabs ── */
  const TABS = [
    { key: "redeemed",   label: "Pending",    badge: summary.redeemed   },
    { key: "processing", label: "Processing", badge: summary.processing },
    { key: "completed",  label: "Completed",  badge: summary.completed  },
    { key: "failed",     label: "Failed",     badge: summary.failed     },
    { key: "all",        label: "All",        badge: null               },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800 }}>
            📱 Airtime Redemptions
          </h2>
          <p style={{ margin: "2px 0 0", fontSize: ".8rem", color: "var(--muted)" }}>
            Manage and process user airtime coupon requests
          </p>
        </div>
        <button className="btn b-solid" onClick={() => setShowAssign(true)}>
          + Assign Coupon
        </button>
      </div>

      {/* ── Stats row ── */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
          {[
            { label: "Total Sent",    value: naira(stats.total_sent),         color: "#16a34a" },
            { label: "Pending Today", value: naira(stats.today?.total || 0),  color: "#d97706" },
            { label: "Requests Today",value: stats.today?.count || 0,         color: "#2563eb" },
            { label: "Pending Queue", value: (stats.by_status?.redeemed?.count || 0) + (stats.by_status?.processing?.count || 0), color: "#e8630a" },
          ].map((s) => (
            <div key={s.label} className="stat-card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: "1.4rem", fontWeight: 900, color: s.color }}>
                {s.value}
              </div>
              <div style={{ fontSize: ".75rem", color: "var(--muted)", marginTop: 2 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Network breakdown ── */}
      {stats?.by_network?.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {stats.by_network.map((n) => (
            <span key={n.network} style={{
              padding: "4px 12px", borderRadius: 20,
              background: "#f5f3ef", fontSize: ".78rem",
              fontWeight: 700, color: "#555",
            }}>
              {n.network}: {naira(n.total)} ({n.count})
            </span>
          ))}
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="tabs" style={{ gap: 0 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab${statusTab === t.key ? " active" : ""}`}
            onClick={() => { setStatusTab(t.key); setPage(1); }}
            style={{ display: "flex", alignItems: "center", gap: 5 }}
          >
            {t.label}
            {t.badge > 0 && (
              <span style={{
                background: statusTab === t.key ? "#e8630a" : "#e5e7eb",
                color: statusTab === t.key ? "#fff" : "#555",
                fontSize: ".7rem", fontWeight: 700,
                padding: "1px 7px", borderRadius: 20,
              }}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Search ── */}
      <input
        className="inp"
        placeholder="Search by code, name, email or phone…"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        style={{ maxWidth: 360 }}
      />

      {/* ── Table ── */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
            Loading…
          </div>
        ) : requests.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: "var(--muted)" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📱</div>
            <p style={{ margin: 0, fontWeight: 600 }}>No {statusTab === "redeemed" ? "pending" : statusTab} requests</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Code</th>
                  <th>Amount</th>
                  <th>Phone</th>
                  <th>Network</th>
                  <th>Status</th>
                  <th>Redeemed</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => {
                  const cfg = STATUS_CFG[r.status] || STATUS_CFG.available;
                  const isBusy = busy === r.id;
                  return (
                    <tr key={r.id}>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: ".82rem" }}>{r.user?.name || "—"}</div>
                        <div style={{ fontSize: ".74rem", color: "var(--muted)" }}>{r.user?.email}</div>
                      </td>
                      <td>
                        <code style={{ fontSize: ".78rem", background: "#f5f3ef", padding: "2px 8px", borderRadius: 6 }}>
                          {r.code}
                        </code>
                      </td>
                      <td style={{ fontWeight: 800, color: "#e8630a" }}>
                        {r.amount_fmt || naira(r.amount)}
                      </td>
                      <td style={{ fontSize: ".82rem", fontFamily: "monospace" }}>
                        <div title={r.phone}>{r.phone_masked || "—"}</div>
                        {/* Admin sees full number on hover */}
                        {r.phone && (
                          <div style={{ fontSize: ".7rem", color: "var(--muted)" }}>{r.phone}</div>
                        )}
                      </td>
                      <td>
                        <span style={{
                          padding: "2px 10px", borderRadius: 20,
                          fontSize: ".74rem", fontWeight: 700,
                          background: "#f5f3ef", color: "#555",
                        }}>
                          {r.network || "—"}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          padding: "3px 10px", borderRadius: 20,
                          fontSize: ".74rem", fontWeight: 700,
                          background: cfg.bg, color: cfg.color,
                        }}>
                          {cfg.label}
                        </span>
                        {r.admin_note && (
                          <div style={{ fontSize: ".7rem", color: "#dc2626", marginTop: 2 }}>
                            {r.admin_note}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: ".76rem", color: "var(--muted)" }}>
                        {fmtDate(r.redeemed_at)}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                          {/* redeemed → processing */}
                          {r.status === AIRTIME_STATUS.REDEEMED && (
                            <button
                              className="btn b-ghost"
                              style={{ fontSize: ".74rem", padding: "4px 10px" }}
                              disabled={isBusy}
                              onClick={() =>
                                confirm({
                                  title   : "Mark as Processing?",
                                  body    : `Confirm you are now sending ₦${r.amount} airtime to ${r.phone} (${r.user?.name}).`,
                                  confirm : "Processing",
                                  action  : () => doAction(r.id, "processing"),
                                })
                              }
                            >
                              {isBusy ? "…" : "⚙️ Processing"}
                            </button>
                          )}

                          {/* processing → completed */}
                          {r.status === AIRTIME_STATUS.PROCESSING && (
                            <button
                              className="btn b-solid"
                              style={{ fontSize: ".74rem", padding: "4px 10px", background: "#16a34a" }}
                              disabled={isBusy}
                              onClick={() =>
                                confirm({
                                  title   : "Mark as Completed?",
                                  body    : `Confirm that ₦${r.amount} airtime was successfully sent to ${r.phone} (${r.user?.name}).`,
                                  confirm : "✅ Completed",
                                  action  : () => doAction(r.id, "completed"),
                                })
                              }
                            >
                              {isBusy ? "…" : "✅ Complete"}
                            </button>
                          )}

                          {/* → failed */}
                          {[AIRTIME_STATUS.REDEEMED, AIRTIME_STATUS.PROCESSING].includes(r.status) && (
                            <button
                              className="btn b-red"
                              style={{ fontSize: ".74rem", padding: "4px 10px" }}
                              disabled={isBusy}
                              onClick={() => setFailedModal(r)}
                            >
                              ❌ Failed
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center" }}>
          <button
            className="btn b-ghost"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            ← Prev
          </button>
          <span style={{ fontSize: ".82rem", color: "var(--muted)" }}>
            Page {page} of {totalPages} · {total} total
          </span>
          <button
            className="btn b-ghost"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next →
          </button>
        </div>
      )}

      {/* ── Modals ── */}
      {showAssign && (
        <AssignModal
          api={api}
          onClose={() => setShowAssign(false)}
          onSuccess={(msg) => {
            showToast("success", msg);
            onMutation?.();
            load(page);
          }}
        />
      )}

      {failedModal && (
        <FailedModal
          coupon={failedModal}
          api={api}
          onClose={() => setFailedModal(null)}
          onSuccess={(msg) => {
            showToast("success", msg);
            onMutation?.();
            load(page);
          }}
        />
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24,
          padding: "12px 20px", borderRadius: 12,
          background: toast.type === "success" ? "#111" : "#dc2626",
          color: "#fff", fontWeight: 700, fontSize: ".84rem",
          boxShadow: "0 4px 20px rgba(0,0,0,.25)",
          zIndex: 9999,
        }}>
          {toast.type === "success" ? "✅" : "❌"} {toast.text}
        </div>
      )}
    </div>
  );
}