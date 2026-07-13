// src/pages/admin/SuperAdmin/CouponRedemption.jsx

import { useState, useEffect, useCallback, useRef } from "react";

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const naira = (n) => "₦" + Number(n || 0).toLocaleString("en-NG");

const fmtDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-NG", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

const TYPE_CFG = {
  percentage   : { color: "#6366f1", bg: "#eef2ff" },
  fixed        : { color: "#e8630a", bg: "#fff0e6" },
  free_shipping: { color: "#16a34a", bg: "#f0fdf4" },
};

const getCfg   = (type) => TYPE_CFG[type] || TYPE_CFG.percentage;

const rewardLabel = (type, value) => {
  if (type === "percentage")    return `${value}% Discount`;
  if (type === "fixed")         return `${naira(value)} Coupon`;
  if (type === "free_shipping") return "Free Shipping";
  return String(value);
};

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function CouponRedemption({ api, couponStats }) {

  /* ── Form state ── */
  const [code,      setCode]      = useState("");
  const [email,     setEmail]     = useState("");
  const [phone,     setPhone]     = useState("");
  const [note,      setNote]      = useState("");

  /* ── UI state ── */
  const [looking,   setLooking]   = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [coupon,    setCoupon]    = useState(null);   // found coupon object
  const [warning,   setWarning]   = useState(null);   // soft warning (mismatch)
  const [buyerFound,setBuyerFound]= useState(false);
  const [error,     setError]     = useState(null);   // hard error string
  const [success,   setSuccess]   = useState(null);   // success string

  /* ── Stats ── */
  const [stats,     setStats]     = useState(couponStats || null);

  /* ── History ── */
  const [history,     setHistory]     = useState([]);
  const [histLoading, setHistLoading] = useState(true);
  const [histTotal,   setHistTotal]   = useState(0);
  const [histPage,    setHistPage]    = useState(1);
  const [histPages,   setHistPages]   = useState(1);
  const [search,      setSearch]      = useState("");

  const toastRef = useRef(null);

  /* ── Sync couponStats prop ── */
  useEffect(() => {
    if (couponStats) setStats(couponStats);
  }, [couponStats]);

  /* ── Load stats ── */
  const loadStats = useCallback(async () => {
    try {
      const { data } = await api.get("/coupon-redemption/stats");
      if (data.success) setStats(data);
    } catch { /* non-fatal */ }
  }, [api]);

  /* ── Load history ── */
  const loadHistory = useCallback(async (pg = 1) => {
    setHistLoading(true);
    try {
      const p = new URLSearchParams({ page: pg, limit: 20 });
      if (search) p.append("search", search);
      const { data } = await api.get(`/coupon-redemption/history?${p}`);
      setHistory(data.history || []);
      setHistTotal(data.total  || 0);
      setHistPages(data.pages  || 1);
      setHistPage(pg);
    } catch (e) {
      console.error("[history]", e.response?.data || e.message);
    } finally {
      setHistLoading(false);
    }
  }, [api, search]);

  useEffect(() => {
    if (!couponStats) loadStats();
    loadHistory(1);
    return () => clearTimeout(toastRef.current);
  }, [search]);

  /* ── Reset ── */
  const reset = () => {
    setCode(""); setEmail(""); setPhone(""); setNote("");
    setCoupon(null); setWarning(null); setBuyerFound(false);
    setError(null); setSuccess(null);
  };

  /* ── Lookup ── */
  const handleLookup = async () => {
    const trimCode = code.trim().toUpperCase();
    if (!trimCode) { setError("Enter a coupon code."); return; }

    setLooking(true);
    setError(null);
    setWarning(null);
    setCoupon(null);
    setSuccess(null);
    setBuyerFound(false);

    try {
      const p = new URLSearchParams({ code: trimCode });
      if (email.trim()) p.append("email", email.trim());
      if (phone.trim()) p.append("phone", phone.trim());

      console.log("[lookup] GET /coupon-redemption/lookup?" + p.toString());

      const { data } = await api.get(`/coupon-redemption/lookup?${p}`);

      console.log("[lookup] response:", data);

      if (!data.success) {
        setError(data.message || "Coupon lookup failed.");
        return;
      }

      setCoupon(data.coupon);
      setBuyerFound(data.buyer_found ?? false);
      if (data.warning) setWarning(data.warning);

    } catch (e) {
      const msg = e.response?.data?.message || `Error ${e.response?.status || ""}: Lookup failed.`;
      console.error("[lookup] error:", e.response?.status, e.response?.data);
      setError(msg);
    } finally {
      setLooking(false);
    }
  };

  /* ── Redeem ── */
  const handleRedeem = async () => {
    if (!coupon) { setError("No coupon loaded."); return; }

    setRedeeming(true);
    setError(null);

    const payload = { code: coupon.code };
    if (email.trim()) payload.email = email.trim();
    if (phone.trim()) payload.phone = phone.trim();
    if (note.trim())  payload.note  = note.trim();

    console.log("[redeem] POST /coupon-redemption/redeem payload:", payload);

    try {
      const { data } = await api.post("/coupon-redemption/redeem", payload);

      console.log("[redeem] response:", data);

      if (!data.success) {
        setError(data.message || "Redemption failed.");
        return;
      }

      setSuccess(data.message);
      setCoupon(null);
      setNote("");
      setWarning(null);
      loadStats();
      loadHistory(1);

    } catch (e) {
      const status = e.response?.status;
      const msg    = e.response?.data?.message || `Error ${status || ""}: Redemption failed.`;
      const detail = JSON.stringify(e.response?.data || {});
      console.error("[redeem] error:", status, e.response?.data);
      /* Show full error detail so nothing is hidden */
      setError(`${msg}\n\nServer detail: ${detail}`);
    } finally {
      setRedeeming(false);
    }
  };

  /* ════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════ */
  return (
    <div style={{ maxWidth: 860, display: "flex", flexDirection: "column", gap: 24 }}>

      {/* ── Header ── */}
      <div>
        <h2 style={{ margin: 0, fontWeight: 900, fontSize: "1.2rem" }}>
          🎟️ Redeem Coupon
        </h2>
        <p style={{ margin: "4px 0 0", fontSize: ".82rem", color: "var(--muted)" }}>
          Enter a coupon code to look it up, then click Redeem.
        </p>
      </div>

      {/* ── Stats pills ── */}
      {stats && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {[
            { label: "Total",     value: stats.totalCoupons, color: "#6366f1" },
            { label: "Available", value: stats.available,    color: "#16a34a" },
            { label: "Redeemed",  value: stats.redeemed,     color: "#e8630a" },
            { label: "Today",     value: stats.today,        color: "#2563eb" },
          ].map((s) => (
            <div key={s.label} style={{
              background: "#fff", border: "1px solid #ede9e3",
              borderRadius: 12, padding: "10px 18px",
              display: "flex", flexDirection: "column", alignItems: "center",
              minWidth: 90,
            }}>
              <span style={{ fontSize: "1.4rem", fontWeight: 900, color: s.color }}>
                {s.value}
              </span>
              <span style={{ fontSize: ".72rem", color: "var(--muted)", fontWeight: 600 }}>
                {s.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Form card ── */}
      <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>

        <h3 style={{ margin: 0, fontSize: ".95rem", fontWeight: 800 }}>
          Enter Coupon Details
        </h3>

        {/* Code row */}
        <div>
          <label style={{ fontSize: ".78rem", fontWeight: 700, color: "#555", display: "block", marginBottom: 4 }}>
            Coupon Code <span style={{ color: "#dc2626" }}>*</span>
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="inp"
              placeholder="e.g. SPIN-AEACCP5Q"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setError(null);
                setCoupon(null);
                setSuccess(null);
                setWarning(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleLookup()}
              style={{ flex: 1, fontFamily: "monospace", letterSpacing: 1 }}
              spellCheck={false}
            />
            <button
              className="btn b-solid"
              onClick={handleLookup}
              disabled={looking || !code.trim()}
              style={{ whiteSpace: "nowrap" }}
            >
              {looking ? "Searching…" : "🔍 Find"}
            </button>
          </div>
        </div>

        {/* Email */}
        <div>
          <label style={{ fontSize: ".78rem", fontWeight: 700, color: "#555", display: "block", marginBottom: 4 }}>
            Buyer Email{" "}
            <span style={{ fontWeight: 400, color: "#aaa" }}>(optional — helps link to account)</span>
          </label>
          <input
            className="inp"
            placeholder="buyer@email.com"
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(null); }}
          />
        </div>

        {/* Phone */}
        <div>
          <label style={{ fontSize: ".78rem", fontWeight: 700, color: "#555", display: "block", marginBottom: 4 }}>
            Buyer Phone{" "}
            <span style={{ fontWeight: 400, color: "#aaa" }}>(optional)</span>
          </label>
          <input
            className="inp"
            placeholder="08012345678"
            type="tel"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setError(null); }}
          />
        </div>

        {/* Note */}
        <div>
          <label style={{ fontSize: ".78rem", fontWeight: 700, color: "#555", display: "block", marginBottom: 4 }}>
            Admin Note{" "}
            <span style={{ fontWeight: 400, color: "#aaa" }}>(optional)</span>
          </label>
          <textarea
            className="inp"
            rows={2}
            placeholder="e.g. Buyer purchased iPhone 14 via chat"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{ resize: "vertical", fontFamily: "inherit" }}
          />
        </div>

        {/* ── Error box — shows full detail ── */}
        {error && (
          <div style={{
            background: "#fef2f2", border: "1px solid #fecaca",
            borderRadius: 10, padding: "12px 14px",
            color: "#dc2626", fontSize: ".82rem",
            whiteSpace: "pre-wrap", wordBreak: "break-word",
            fontFamily: "monospace",
          }}>
            ❌ {error}
          </div>
        )}

        {/* ── Warning box — non-blocking ── */}
        {warning && !error && (
          <div style={{
            background: "#fffbeb", border: "1px solid #fde68a",
            borderRadius: 10, padding: "10px 14px",
            color: "#d97706", fontSize: ".82rem",
          }}>
            ⚠️ {warning}
          </div>
        )}

        {/* ── Success box ── */}
        {success && (
          <div style={{
            background: "#f0fdf4", border: "1px solid #bbf7d0",
            borderRadius: 10, padding: "12px 14px",
            color: "#166534", fontSize: ".82rem",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
          }}>
            <span>✅ {success}</span>
            <button
              onClick={reset}
              style={{
                background: "none", border: "1px solid #16a34a",
                borderRadius: 8, color: "#16a34a",
                fontWeight: 700, fontSize: ".76rem",
                padding: "3px 10px", cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              New Redemption
            </button>
          </div>
        )}

        {/* ── Coupon preview ── */}
        {coupon && (
          <div style={{
            border: `1.5px solid ${getCfg(coupon.type).color}33`,
            borderRadius: 14,
            background: getCfg(coupon.type).bg,
            padding: "16px 18px",
            display: "flex", flexDirection: "column", gap: 10,
          }}>
            {/* Top row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <span style={{
                background: "#fff",
                color: getCfg(coupon.type).color,
                border: `1px solid ${getCfg(coupon.type).color}44`,
                padding: "5px 14px", borderRadius: 20,
                fontWeight: 900, fontSize: ".9rem",
              }}>
                {coupon.reward_label || rewardLabel(coupon.type, coupon.value)}
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <span style={{
                  background: coupon.is_private ? "#f5f3ef" : "#eff6ff",
                  color: coupon.is_private ? "#888" : "#2563eb",
                  padding: "3px 10px", borderRadius: 20,
                  fontSize: ".72rem", fontWeight: 700,
                  border: `1px solid ${coupon.is_private ? "#e0d8cc" : "#bfdbfe"}`,
                }}>
                  {coupon.is_private ? "🔒 Private" : "🌐 Public"}
                </span>
                <span style={{
                  background: "#f0fdf4", color: "#16a34a",
                  border: "1px solid #bbf7d0",
                  padding: "3px 10px", borderRadius: 20,
                  fontSize: ".72rem", fontWeight: 700,
                }}>
                  ✅ Available
                </span>
              </div>
            </div>

            {/* Code */}
            <div style={{ fontSize: ".82rem", color: "#555" }}>
              Code:{" "}
              <span style={{
                fontFamily: "monospace", fontWeight: 900,
                background: "#fff", padding: "2px 10px",
                borderRadius: 6, letterSpacing: 1,
              }}>
                {coupon.code}
              </span>
            </div>

            {/* Description */}
            {coupon.description && (
              <div style={{ fontSize: ".8rem", color: "#666" }}>{coupon.description}</div>
            )}

            {/* Expiry + usage */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: ".78rem", color: "#888" }}>
              {coupon.expires_at && <span>🕐 Expires: {fmtDate(coupon.expires_at)}</span>}
              {coupon.usage_limit && (
                <span>📊 {coupon.usage_count || 0}/{coupon.usage_limit} uses</span>
              )}
            </div>

            {/* Owner / buyer */}
            {coupon.owner && (
              <div style={{
                background: "#fff", borderRadius: 10, padding: "10px 14px",
                border: "1px solid #ede9e3", fontSize: ".82rem",
                display: "flex", flexDirection: "column", gap: 4,
              }}>
                <div style={{
                  display: "flex", alignItems: "center",
                  justifyContent: "space-between", marginBottom: 4,
                }}>
                  <span style={{ fontWeight: 700, color: "#555", fontSize: ".72rem", textTransform: "uppercase", letterSpacing: ".05em" }}>
                    {coupon.is_private ? "Coupon Winner" : "Buyer"}
                  </span>
                  <span style={{
                    background: buyerFound ? "#f0fdf4" : "#fff7ed",
                    color: buyerFound ? "#16a34a" : "#c2410c",
                    border: `1px solid ${buyerFound ? "#bbf7d0" : "#fed7aa"}`,
                    padding: "2px 8px", borderRadius: 20,
                    fontSize: ".68rem", fontWeight: 700,
                  }}>
                    {buyerFound ? "✅ Account Found" : "ℹ️ No Account"}
                  </span>
                </div>
                <div style={{ fontWeight: 800, color: "#111" }}>
                  👤 {coupon.owner.name || "Unknown"}
                </div>
                {coupon.owner.email && (
                  <div style={{ color: "#666" }}>✉️ {coupon.owner.email}</div>
                )}
                {coupon.owner.phone && (
                  <div style={{ color: "#666" }}>📱 {coupon.owner.phone}</div>
                )}
                {!buyerFound && (
                  <div style={{ fontSize: ".74rem", color: "#aaa", marginTop: 4 }}>
                    No Loemart account found. Redemption will be recorded without an account link.
                  </div>
                )}
              </div>
            )}

            {/* Redeem button */}
            <button
              className="btn b-solid"
              onClick={handleRedeem}
              disabled={redeeming}
              style={{
                marginTop: 4,
                background: redeeming ? "#ccc" : getCfg(coupon.type).color,
                fontSize: ".95rem", padding: "13px",
              }}
            >
              {redeeming ? "Redeeming…" : `✅ Redeem ${rewardLabel(coupon.type, coupon.value)}`}
            </button>
          </div>
        )}
      </div>

      {/* ── History ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h3 style={{ margin: 0, fontWeight: 800, fontSize: "1rem" }}>
              📋 Redemption History
            </h3>
            <p style={{ margin: "2px 0 0", fontSize: ".78rem", color: "var(--muted)" }}>
              {histTotal} redemption{histTotal !== 1 ? "s" : ""}
            </p>
          </div>
          <input
            className="inp"
            placeholder="Search code, name, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 240 }}
          />
        </div>

        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {histLoading ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
              Loading…
            </div>
          ) : history.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
              <p style={{ margin: 0, color: "var(--muted)", fontWeight: 600 }}>
                No redemptions yet
              </p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Reward</th>
                    <th>User</th>
                    <th>Redeemed By</th>
                    <th>Note</th>
                    <th>Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((r) => {
                    const type  = r.reward_type  || r.type;
                    const value = r.reward_value ?? r.value;
                    const cfg   = getCfg(type);
                    return (
                      <tr key={r.id}>
                        <td>
                          <span style={{
                            fontFamily: "monospace", fontWeight: 800,
                            fontSize: ".8rem", background: "#f5f3ef",
                            padding: "2px 8px", borderRadius: 6, letterSpacing: 1,
                          }}>
                            {r.code}
                          </span>
                        </td>
                        <td>
                          <span style={{
                            background: cfg.bg, color: cfg.color,
                            padding: "2px 10px", borderRadius: 20,
                            fontSize: ".74rem", fontWeight: 700,
                          }}>
                            {rewardLabel(type, value)}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, fontSize: ".82rem" }}>
                            {r.user?.name || "—"}
                          </div>
                          <div style={{ fontSize: ".72rem", color: "var(--muted)" }}>
                            {r.user?.email || ""}
                          </div>
                        </td>
                        <td style={{ fontSize: ".8rem", fontWeight: 600 }}>
                          {r.redeemed_by || "Admin"}
                        </td>
                        <td style={{ fontSize: ".74rem", color: "#888", maxWidth: 160 }}>
                          {r.admin_note || "—"}
                        </td>
                        <td style={{ fontSize: ".76rem", color: "var(--muted)", whiteSpace: "nowrap" }}>
                          {fmtDate(r.redeemed_at)}
                        </td>
                        <td>
                          <span style={{
                            background: "#f0fdf4", color: "#16a34a",
                            border: "1px solid #bbf7d0",
                            padding: "2px 10px", borderRadius: 20,
                            fontSize: ".72rem", fontWeight: 700,
                          }}>
                            ✅ Used
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {histPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center" }}>
            <button
              className="btn b-ghost"
              onClick={() => loadHistory(histPage - 1)}
              disabled={histPage === 1}
            >
              ← Prev
            </button>
            <span style={{ fontSize: ".82rem", color: "var(--muted)" }}>
              Page {histPage} of {histPages}
            </span>
            <button
              className="btn b-ghost"
              onClick={() => loadHistory(histPage + 1)}
              disabled={histPage === histPages}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}