// src/pages/admin/SuperAdmin/CouponRedemption.jsx

import { useState, useEffect, useCallback, useRef } from "react";
import { fmtDate } from "../adminlayout/helpers";

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const naira = (n) => "₦" + Number(n || 0).toLocaleString("en-NG");

const TYPE_CFG = {
  percentage   : { color: "#6366f1", bg: "#eef2ff", border: "#c7d2fe" },
  fixed        : { color: "#e8630a", bg: "#fff0e6", border: "#fed7aa" },
  free_shipping: { color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
};

const getCfg = (type) => TYPE_CFG[type] || TYPE_CFG.percentage;

const buildRewardLabel = (type, value) => {
  if (type === "percentage")    return `${value}% Discount`;
  if (type === "fixed")         return `${naira(value)} Coupon`;
  if (type === "free_shipping") return "Free Shipping";
  return String(value);
};

/* ═══════════════════════════════════════════════════════════════
   SVG ICONS
═══════════════════════════════════════════════════════════════ */
const IconSearch = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

const IconTag = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
    <line x1="7" y1="7" x2="7.01" y2="7"/>
  </svg>
);

const IconUser = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

const IconMail = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
    <polyline points="22,6 12,13 2,6"/>
  </svg>
);

const IconPhone = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
    <line x1="12" y1="18" x2="12.01" y2="18"/>
  </svg>
);

const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const IconAlert = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

const IconClock = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

const IconRefresh = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 019-9 9.75 9.75 0 016.74 2.74L21 8"/>
    <path d="M21 3v5h-5"/>
    <path d="M21 12a9 9 0 01-9 9 9.75 9.75 0 01-6.74-2.74L3 16"/>
    <path d="M3 21v-5h5"/>
  </svg>
);

const IconShield = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

const IconLock = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0110 0v4"/>
  </svg>
);

const IconGlobe = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
  </svg>
);

const IconNote = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
);

/* ═══════════════════════════════════════════════════════════════
   SHARED UI COMPONENTS
═══════════════════════════════════════════════════════════════ */
function StatCard({ label, value, color = "#111", icon, sub }) {
  return (
    <div style={{
      background: "#fff", border: "1px solid #ede9e3",
      borderRadius: 14, padding: "16px 18px",
      display: "flex", alignItems: "center", gap: 14,
    }}>
      {icon && (
        <div style={{
          width: 42, height: 42, borderRadius: 12,
          background: color + "18",
          display: "flex", alignItems: "center", justifyContent: "center",
          color, flexShrink: 0,
        }}>
          {icon}
        </div>
      )}
      <div>
        <div style={{ fontSize: "1.5rem", fontWeight: 900, color, lineHeight: 1 }}>
          {value}
        </div>
        <div style={{ fontSize: ".74rem", color: "var(--muted)", marginTop: 3, fontWeight: 600 }}>
          {label}
        </div>
        {sub && <div style={{ fontSize: ".7rem", color: "#aaa", marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  );
}

function Field({ label, hint, icon, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{
        fontSize: ".75rem", fontWeight: 700, color: "#555",
        display: "flex", alignItems: "center", gap: 5,
      }}>
        {icon && <span style={{ color: "#aaa" }}>{icon}</span>}
        {label}
        {hint && <span style={{ fontWeight: 400, color: "#bbb" }}>({hint})</span>}
      </label>
      {children}
    </div>
  );
}

function Alert({ type, children }) {
  const S = {
    success : { bg: "#f0fdf4", border: "#bbf7d0", color: "#166534", icon: <IconCheck /> },
    error   : { bg: "#fef2f2", border: "#fecaca", color: "#dc2626", icon: <IconAlert /> },
    warn    : { bg: "#fffbeb", border: "#fde68a", color: "#d97706", icon: <IconAlert /> },
    info    : { bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8", icon: <IconAlert /> },
  };
  const s = S[type] || S.info;
  return (
    <div style={{
      padding: "10px 14px",
      background: s.bg, border: `1px solid ${s.border}`,
      borderRadius: 10, fontSize: ".82rem", color: s.color,
      display: "flex", gap: 8, alignItems: "flex-start",
    }}>
      <span style={{ flexShrink: 0, marginTop: 1 }}>{s.icon}</span>
      <div style={{ lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   COUPON PREVIEW CARD
═══════════════════════════════════════════════════════════════ */
function CouponPreview({ coupon, warning, buyerFound, note, setNote, onRedeem, loading }) {
  const cfg = getCfg(coupon.type);

  return (
    <div style={{
      border: `1.5px solid ${cfg.border}`, borderRadius: 18,
      overflow: "hidden", background: "#fff",
      boxShadow: "0 8px 32px rgba(0,0,0,.08)",
    }}>
      <div style={{ height: 5, background: `linear-gradient(90deg, ${cfg.color}, ${cfg.color}cc)` }} />

      <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Reward + type badges */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <span style={{
            background: cfg.bg, color: cfg.color,
            padding: "7px 18px", borderRadius: 20,
            fontWeight: 900, fontSize: ".95rem",
            border: `1px solid ${cfg.border}`,
          }}>
            {coupon.reward_label}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{
              display: "flex", alignItems: "center", gap: 4,
              background: coupon.is_private ? "#f5f3ef" : "#eff6ff",
              color: coupon.is_private ? "#888" : "#2563eb",
              border: `1px solid ${coupon.is_private ? "#e0d8cc" : "#bfdbfe"}`,
              padding: "3px 10px", borderRadius: 20,
              fontSize: ".72rem", fontWeight: 700,
            }}>
              {coupon.is_private ? <><IconLock /> Private</> : <><IconGlobe /> Public</>}
            </span>
            <span style={{
              background: "#f0fdf4", color: "#16a34a",
              border: "1px solid #bbf7d0",
              padding: "3px 10px", borderRadius: 20,
              fontSize: ".72rem", fontWeight: 700,
              display: "flex", alignItems: "center", gap: 4,
            }}>
              <IconCheck /> Available
            </span>
          </div>
        </div>

        {/* Code */}
        <div style={{
          background: "#f8f6f2", borderRadius: 12, padding: "12px 18px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          border: "1px solid #ede9e3",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IconTag />
            <span style={{ fontSize: ".7rem", color: "#aaa", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em" }}>
              Code
            </span>
          </div>
          <span style={{ fontFamily: "monospace", fontWeight: 900, fontSize: "1.05rem", color: "#111", letterSpacing: 2 }}>
            {coupon.code}
          </span>
        </div>

        {/* Description */}
        {coupon.description && (
          <p style={{ fontSize: ".82rem", color: "#666", margin: 0, lineHeight: 1.6 }}>
            {coupon.description}
          </p>
        )}

        {/* Expiry */}
        {coupon.expires_at && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: ".78rem", color: "#888" }}>
            <IconClock /> Expires: {fmtDate(coupon.expires_at)}
          </div>
        )}

        {/* Usage */}
        {coupon.usage_limit && (
          <div style={{ fontSize: ".78rem", color: "#888", display: "flex", alignItems: "center", gap: 6 }}>
            <IconShield />
            {coupon.usage_count || 0}/{coupon.usage_limit} uses
          </div>
        )}

        {/* Warning — mismatch but admin can still redeem */}
        {warning && (
          <Alert type="warn">
            ⚠️ {warning}
          </Alert>
        )}

        {/* Owner info */}
        {coupon.owner && (
          <div style={{
            background: "#f8f8f8", borderRadius: 12, padding: "14px 16px",
            border: "1px solid #f0ede8",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <p style={{ margin: 0, fontSize: ".7rem", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: ".05em" }}>
                {coupon.is_private ? "Coupon Winner" : "Buyer"}
              </p>
              {buyerFound ? (
                <span style={{
                  background: "#f0fdf4", color: "#16a34a",
                  border: "1px solid #bbf7d0",
                  padding: "2px 8px", borderRadius: 20,
                  fontSize: ".68rem", fontWeight: 700,
                }}>
                  ✅ Account Found
                </span>
              ) : (
                <span style={{
                  background: "#fff7ed", color: "#c2410c",
                  border: "1px solid #fed7aa",
                  padding: "2px 8px", borderRadius: 20,
                  fontSize: ".68rem", fontWeight: 700,
                }}>
                  ℹ️ No Account
                </span>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: ".88rem", fontWeight: 800, color: "#111" }}>
                <IconUser /> {coupon.owner.name || "Unknown Buyer"}
              </div>
              {coupon.owner.email && (
                <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: ".8rem", color: "#666" }}>
                  <IconMail /> {coupon.owner.email}
                </div>
              )}
              {coupon.owner.phone && (
                <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: ".8rem", color: "#666" }}>
                  <IconPhone /> {coupon.owner.phone}
                </div>
              )}
              {!buyerFound && (
                <p style={{ margin: "4px 0 0", fontSize: ".74rem", color: "#aaa", lineHeight: 1.4 }}>
                  This email or phone is not registered on Loemart.
                  You can still redeem — it will not be linked to an account.
                </p>
              )}
            </div>
          </div>
        )}

        {/* No buyer info provided */}
        {!coupon.owner && !coupon.is_private && (
          <Alert type="info">
            No buyer email or phone provided. The redemption will be recorded but not linked to any user account.
          </Alert>
        )}

        {/* Admin note */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{
            fontSize: ".75rem", fontWeight: 700, color: "#555",
            display: "flex", alignItems: "center", gap: 5,
          }}>
            <IconNote />
            Admin Note
            <span style={{ fontWeight: 400, color: "#bbb" }}>(optional)</span>
          </label>
          <textarea
            className="inp"
            rows={2}
            placeholder="e.g. Buyer purchased iPhone 14 via chat"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{ resize: "vertical", fontFamily: "inherit", fontSize: ".82rem" }}
          />
        </div>

        {/* Divider */}
        <div style={{ borderTop: "1px dashed #ede9e3" }} />

        {/* Redeem button */}
        <button
          onClick={onRedeem}
          disabled={loading}
          style={{
            width: "100%", padding: "14px",
            background: loading ? "#ccc" : `linear-gradient(135deg, ${cfg.color}, ${cfg.color}cc)`,
            color: "#fff", border: "none",
            borderRadius: 12, fontWeight: 800, fontSize: "1rem",
            cursor: loading ? "not-allowed" : "pointer",
            transition: "opacity .15s",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          <IconCheck />
          {loading ? "Redeeming…" : "Redeem Coupon"}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HISTORY ROW
═══════════════════════════════════════════════════════════════ */
function HistoryRow({ r }) {
  const cfg = getCfg(r.type);
  return (
    <tr>
      <td>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{
            fontFamily: "monospace", fontWeight: 800, fontSize: ".82rem",
            background: "#f5f3ef", padding: "3px 10px",
            borderRadius: 6, letterSpacing: 1, color: "#333",
          }}>
            {r.code}
          </span>
          {r.is_private && (
            <span title="Private (Spin & Win)" style={{ color: "#aaa" }}><IconLock /></span>
          )}
        </div>
      </td>
      <td>
        <span style={{
          background: cfg.bg, color: cfg.color,
          border: `1px solid ${cfg.border || "#e0d8cc"}`,
          padding: "3px 10px", borderRadius: 20,
          fontSize: ".74rem", fontWeight: 700, whiteSpace: "nowrap",
        }}>
          {r.reward_label}
        </span>
      </td>
      <td>
        <div style={{ fontWeight: 700, fontSize: ".82rem" }}>{r.user?.name || "—"}</div>
        <div style={{ fontSize: ".72rem", color: "var(--muted)" }}>{r.user?.email || ""}</div>
      </td>
      <td style={{ fontSize: ".8rem", fontWeight: 600 }}>
        {r.redeemed_by || "Admin"}
      </td>
      <td style={{ fontSize: ".74rem", color: "#888", maxWidth: 160 }}>
        {r.admin_note || "—"}
      </td>
      <td style={{ fontSize: ".76rem", color: "var(--muted)", whiteSpace: "nowrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <IconClock /> {fmtDate(r.redeemed_at)}
        </div>
      </td>
      <td>
        <span style={{
          background: "#f0fdf4", color: "#16a34a",
          border: "1px solid #bbf7d0",
          padding: "3px 10px", borderRadius: 20,
          fontSize: ".72rem", fontWeight: 700,
          display: "flex", alignItems: "center", gap: 4, width: "fit-content",
        }}>
          <IconCheck /> Used
        </span>
      </td>
    </tr>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function CouponRedemption({ api, couponStats }) {

  /* Lookup state */
  const [code,       setCode]       = useState("");
  const [email,      setEmail]      = useState("");
  const [phone,      setPhone]      = useState("");
  const [note,       setNote]       = useState("");
  const [looking,    setLooking]    = useState(false);
  const [redeeming,  setRedeeming]  = useState(false);
  const [coupon,     setCoupon]     = useState(null);
  const [warning,    setWarning]    = useState(null);
  const [buyerFound, setBuyerFound] = useState(false);
  const [lookupErr,  setLookupErr]  = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  /* Stats */
  const [stats, setStats] = useState(couponStats || null);

  /* History */
  const [history,     setHistory]     = useState([]);
  const [histLoading, setHistLoading] = useState(true);
  const [histTotal,   setHistTotal]   = useState(0);
  const [histPage,    setHistPage]    = useState(1);
  const [histPages,   setHistPages]   = useState(1);
  const [search,      setSearch]      = useState("");
  const [toast,       setToast]       = useState(null);
  const toastRef = useRef(null);

  /* ── Keep stats in sync when prop updates ── */
  useEffect(() => {
    if (couponStats) setStats(couponStats);
  }, [couponStats]);

  /* ── Toast ── */
  const showToast = useCallback((type, text) => {
    setToast({ type, text });
    clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 5_000);
  }, []);

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
      const params = new URLSearchParams({
        page  : pg,
        limit : 20,
        ...(search ? { search } : {}),
      });
      const { data } = await api.get(`/coupon-redemption/history?${params}`);
      setHistory(data.history || []);
      setHistTotal(data.total  || 0);
      setHistPages(data.pages  || 1);
      setHistPage(pg);
    } catch (e) {
      showToast("error", e.response?.data?.message || "Failed to load history.");
    } finally {
      setHistLoading(false);
    }
  }, [api, search, showToast]);

  useEffect(() => {
    if (!couponStats) loadStats();
    loadHistory(1);
    return () => clearTimeout(toastRef.current);
  }, [search]);

  /* ── Reset ── */
  const resetForm = () => {
    setCode("");
    setEmail("");
    setPhone("");
    setNote("");
    setCoupon(null);
    setWarning(null);
    setBuyerFound(false);
    setLookupErr(null);
    setSuccessMsg(null);
  };

  /* ── Lookup ── */
  const handleLookup = async () => {
    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedCode) return;

    setLooking(true);
    setLookupErr(null);
    setWarning(null);
    setCoupon(null);
    setSuccessMsg(null);
    setBuyerFound(false);

    try {
      const params = new URLSearchParams({ code: trimmedCode });
      if (email.trim()) params.append("email", email.trim());
      if (phone.trim()) params.append("phone", phone.trim());

      const { data } = await api.get(`/coupon-redemption/lookup?${params}`);

      if (!data.success) {
        setLookupErr(data.message || "Something went wrong.");
        return;
      }

      /* Show the coupon no matter what */
      setCoupon(data.coupon);
      setBuyerFound(data.buyer_found ?? false);

      /* Non-blocking warning (e.g. phone mismatch) */
      if (data.warning) {
        setWarning(data.warning);
      }

      /* Hint — optional info from backend */
      if (data.hint && !data.warning) {
        setWarning(null);
      }

    } catch (e) {
      const errData = e.response?.data;
      setLookupErr(
        errData?.message ||
        `Error ${e.response?.status || ""}: Could not look up coupon.`
      );
    } finally {
      setLooking(false);
    }
  };

  /* ── Redeem ── */
  const handleRedeem = async () => {
    if (!coupon) return;

    setRedeeming(true);
    setLookupErr(null);

    try {
      const payload = { code: coupon.code };
      if (email.trim()) payload.email = email.trim();
      if (phone.trim()) payload.phone = phone.trim();
      if (note.trim())  payload.note  = note.trim();

      const { data } = await api.post("/coupon-redemption/redeem", payload);

      if (!data.success) {
        setLookupErr(data.message);
        setCoupon(null);
        return;
      }

      setSuccessMsg(data.message);
      setCoupon(null);
      setNote("");
      setWarning(null);
      showToast("success", data.message);
      loadStats();
      loadHistory(1);

    } catch (e) {
      const msg = e.response?.data?.message || "Redemption failed. Please try again.";
      setLookupErr(msg);
      setCoupon(null);
    } finally {
      setRedeeming(false);
    }
  };

  /* ════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════ */
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 900, display: "flex", alignItems: "center", gap: 8 }}>
            <IconTag /> Redeem Coupon
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: ".82rem", color: "var(--muted)" }}>
            Verify and redeem coupon codes provided by buyers.
          </p>
        </div>
        <button
          className="btn b-ghost"
          onClick={() => { loadStats(); loadHistory(histPage); }}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: ".8rem" }}
        >
          <IconRefresh /> Refresh
        </button>
      </div>

      {/* ── Stats ── */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          <StatCard label="Total Coupons" value={stats.totalCoupons} color="#6366f1" icon={<IconTag />} />
          <StatCard label="Available"     value={stats.available}    color="#16a34a" icon={<IconCheck />} sub="Not yet redeemed" />
          <StatCard label="Redeemed"      value={stats.redeemed}     color="#e8630a" icon={<IconShield />} sub="Used up" />
          <StatCard label="Today"         value={stats.today}        color="#2563eb" icon={<IconClock />} sub="Redemptions today" />
        </div>
      )}

      {/* ── Main grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>

        {/* LEFT — Lookup form */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{
            background: "#fff", border: "1px solid #ede9e3",
            borderRadius: 16, padding: 22,
            display: "flex", flexDirection: "column", gap: 14,
            boxShadow: "0 2px 8px rgba(0,0,0,.04)",
          }}>
            <h3 style={{ margin: 0, fontSize: ".95rem", fontWeight: 800, display: "flex", alignItems: "center", gap: 7 }}>
              <IconSearch /> Enter Coupon Details
            </h3>

            {/* Code */}
            <Field label="Coupon Code" icon={<IconTag />}>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  className="inp"
                  placeholder="e.g. SPIN-AEACCP5Q or WELCOME10"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase());
                    setLookupErr(null);
                    setCoupon(null);
                    setSuccessMsg(null);
                    setWarning(null);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                  style={{ flex: 1, fontFamily: "monospace", letterSpacing: 1 }}
                  autoCapitalize="characters"
                  spellCheck={false}
                />
                <button
                  className="btn b-solid"
                  onClick={handleLookup}
                  disabled={looking || !code.trim()}
                  style={{ whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}
                >
                  {looking ? "…" : <><IconSearch /> Find</>}
                </button>
              </div>
            </Field>

            {/* Email */}
            <Field label="Buyer Email" hint="optional" icon={<IconMail />}>
              <input
                className="inp"
                placeholder="buyer@email.com"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setLookupErr(null); }}
              />
            </Field>

            {/* Phone */}
            <Field label="Buyer Phone" hint="optional" icon={<IconPhone />}>
              <input
                className="inp"
                placeholder="08012345678"
                type="tel"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setLookupErr(null); }}
              />
            </Field>

            {/* Info */}
            <Alert type="info">
              <span>
                Email and phone are <strong>optional</strong>.
                You can redeem any valid coupon without them.
                Providing them helps link the redemption to a buyer account.
              </span>
            </Alert>

            {/* Error */}
            {lookupErr && <Alert type="error">{lookupErr}</Alert>}

            {/* Success */}
            {successMsg && (
              <Alert type="success">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span>{successMsg}</span>
                  <button
                    onClick={resetForm}
                    style={{
                      background: "none", border: "1px solid #16a34a",
                      borderRadius: 8, cursor: "pointer",
                      color: "#16a34a", fontWeight: 700, fontSize: ".78rem",
                      padding: "3px 10px", whiteSpace: "nowrap",
                    }}
                  >
                    New Redemption
                  </button>
                </div>
              </Alert>
            )}
          </div>

          {/* How it works */}
          <div style={{
            background: "#fff", border: "1px solid #ede9e3",
            borderRadius: 16, padding: 18,
          }}>
            <h4 style={{ margin: "0 0 12px", fontSize: ".85rem", fontWeight: 800, color: "#555" }}>
              💡 How to redeem
            </h4>
            {[
              "Buyer copies their coupon code from Profile → My Coupons.",
              "Buyer sends the code to admin via chat or message.",
              "Admin enters the code here and clicks Find.",
              "Coupon details appear — admin confirms and clicks Redeem.",
              "Email and phone are optional — they help link to an account.",
            ].map((step, i) => (
              <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
                <span style={{
                  width: 22, height: 22, borderRadius: "50%",
                  background: "#e8630a", color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: ".7rem", fontWeight: 800, flexShrink: 0,
                }}>
                  {i + 1}
                </span>
                <p style={{ margin: 0, fontSize: ".8rem", color: "#555", lineHeight: 1.5 }}>
                  {step}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — Coupon preview */}
        <div>
          {coupon ? (
            <CouponPreview
              coupon={coupon}
              warning={warning}
              buyerFound={buyerFound}
              note={note}
              setNote={setNote}
              onRedeem={handleRedeem}
              loading={redeeming}
            />
          ) : (
            <div style={{
              border: "2px dashed #e0d8cc", borderRadius: 18,
              padding: "72px 32px", textAlign: "center",
              display: "flex", flexDirection: "column",
              alignItems: "center", gap: 10,
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: "50%",
                background: "#f5f3ef",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#ccc",
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
                  <line x1="7" y1="7" x2="7.01" y2="7"/>
                </svg>
              </div>
              <p style={{ margin: 0, fontWeight: 700, color: "#aaa", fontSize: ".9rem" }}>
                Coupon details will appear here
              </p>
              <p style={{ margin: 0, fontSize: ".78rem", color: "#ccc" }}>
                Enter a code above and click Find
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── History ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, display: "flex", alignItems: "center", gap: 7 }}>
              📋 Redemption History
            </h3>
            <p style={{ margin: "2px 0 0", fontSize: ".78rem", color: "var(--muted)" }}>
              {histTotal} total redemption{histTotal !== 1 ? "s" : ""}
            </p>
          </div>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#aaa", pointerEvents: "none" }}>
              <IconSearch />
            </span>
            <input
              className="inp"
              placeholder="Search code, name, email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 32, maxWidth: 260 }}
            />
          </div>
        </div>

        <div style={{
          background: "#fff", border: "1px solid #ede9e3",
          borderRadius: 16, overflow: "hidden",
          boxShadow: "0 2px 8px rgba(0,0,0,.04)",
        }}>
          {histLoading ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--muted)" }}>Loading…</div>
          ) : history.length === 0 ? (
            <div style={{ padding: 60, textAlign: "center" }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%", background: "#f5f3ef",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#ccc", margin: "0 auto 12px",
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
              </div>
              <p style={{ margin: 0, color: "var(--muted)", fontWeight: 700 }}>No redemptions yet</p>
              <p style={{ margin: "4px 0 0", fontSize: ".78rem", color: "#aaa" }}>
                Redeemed coupons will appear here
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
                  {history.map((r) => <HistoryRow key={r.id} r={r} />)}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {histPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center" }}>
            <button className="btn b-ghost" onClick={() => loadHistory(histPage - 1)} disabled={histPage === 1}>
              ← Prev
            </button>
            <span style={{ fontSize: ".82rem", color: "var(--muted)" }}>
              Page {histPage} of {histPages} · {histTotal} total
            </span>
            <button className="btn b-ghost" onClick={() => loadHistory(histPage + 1)} disabled={histPage === histPages}>
              Next →
            </button>
          </div>
        )}
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24,
          padding: "12px 20px", borderRadius: 12,
          background: toast.type === "success" ? "#111" : "#dc2626",
          color: "#fff", fontWeight: 700, fontSize: ".84rem",
          boxShadow: "0 4px 20px rgba(0,0,0,.25)",
          zIndex: 9999, display: "flex", alignItems: "center", gap: 8,
          animation: "slideIn .2s ease",
        }}>
          {toast.type === "success" ? <IconCheck /> : <IconAlert />}
          {toast.text}
        </div>
      )}

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}