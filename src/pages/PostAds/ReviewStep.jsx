/**
 * src/pages/PostAds/ReviewStep.jsx
 *
 * Step 5 — Review & Submit
 * - Full listing preview
 * - Image thumbnails strip
 * - Variants, features, specs, box items
 * - Upload progress bar
 * - Prohibited content warning
 * - Edit shortcuts back to each step
 * - Last saved indicator
 * - Live debug panel (dev only — shows token + URL + error)
 */

import { memo, useCallback, useState } from "react";

/* ══════════════════════════════════════════════════════════════
   SVG ICONS
══════════════════════════════════════════════════════════════ */
const IconPackage = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <line x1="16.5" y1="9.4"  x2="7.5"  y2="4.21" />
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8
             a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);
const IconEdit = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);
const IconCheck = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const IconAlertTriangle = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94
             a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9"  x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);
const IconImage = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);
const IconTag = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
);
const IconLayers = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </svg>
);
const IconList = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <line x1="8"  y1="6"  x2="21" y2="6"  />
    <line x1="8"  y1="12" x2="21" y2="12" />
    <line x1="8"  y1="18" x2="21" y2="18" />
    <line x1="3"  y1="6"  x2="3.01" y2="6"  />
    <line x1="3"  y1="12" x2="3.01" y2="12" />
    <line x1="3"  y1="18" x2="3.01" y2="18" />
  </svg>
);
const IconBox = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8
             a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);
const IconGrid = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <rect x="3"  y="3"  width="7" height="7" />
    <rect x="14" y="3"  width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3"  y="14" width="7" height="7" />
  </svg>
);
const IconSend = ({ size = 17 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <line x1="22" y1="2"  x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);
const IconClock = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);
const IconShield = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);
const IconBug = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <path d="M8 2l1.88 1.88M16 2l-1.88 1.88M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" />
    <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6z" />
    <path d="M12 20v-9M6.53 9C4.6 8.8 3 7.1 3 5M6 13H2M3 21c0-2.1 1.7-3.9 4-4M17.47 9C19.4 8.8 21 7.1 21 5M18 13h4M21 21c0-2.1-1.7-3.9-4-4" />
  </svg>
);

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */
const fmt = (n) => Number(n || 0).toLocaleString("en-NG");

function timeAgo(ts) {
  if (!ts) return null;
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 10)   return "just now";
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

/* ══════════════════════════════════════════════════════════════
   LIVE DEBUG PANEL
   Shows everything relevant to diagnosing submit failures.
   Only renders in dev (import.meta.env.DEV).
══════════════════════════════════════════════════════════════ */
function DebugPanel({ lastError, posting }) {
  const [open, setOpen] = useState(false);

  if (!import.meta.env.DEV) return null;

  /* Collect all relevant state */
  const SUBMIT_URL   = `${import.meta.env.VITE_API_BASE_URL}/api/products`;
  const API_BASE     = import.meta.env.VITE_API_BASE_URL;

  const TOKEN_KEYS   = [
    "sellerToken",
    "seller_token",
    "market_token",
    "sellerAuthToken",
    "token",
  ];

  const tokens = TOKEN_KEYS.reduce((acc, key) => {
    const val = localStorage.getItem(key);
    acc[key]  = val
      ? `${val.slice(0, 40)}... (len ${val.length})`
      : "null";
    return acc;
  }, {});

  const allKeys  = Object.keys(localStorage);
  const foundKey = TOKEN_KEYS.find((k) => localStorage.getItem(k));

  /* Decode JWT payload if found */
  let jwtPayload = null;
  if (foundKey) {
    try {
      const raw = localStorage.getItem(foundKey);
      const b64 = raw.split(".")[1];
      jwtPayload = JSON.parse(atob(b64));
    } catch {
      jwtPayload = { error: "could not decode" };
    }
  }

  return (
    <div style={{
      margin      : "1rem 0",
      border      : "2px dashed #f59e0b",
      borderRadius: "12px",
      overflow    : "hidden",
      fontSize    : "0.75rem",
      fontFamily  : "monospace",
    }}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width      : "100%",
          padding    : "0.6rem 1rem",
          background : "#fffbeb",
          border     : "none",
          cursor     : "pointer",
          display    : "flex",
          alignItems : "center",
          gap        : "0.5rem",
          fontFamily : "monospace",
          fontSize   : "0.75rem",
          fontWeight : 700,
          color      : "#92400e",
          textAlign  : "left",
        }}>
        <IconBug size={13} />
        🔍 SUBMIT DEBUG PANEL {open ? "▲" : "▼"}
        {lastError && (
          <span style={{
            marginLeft  : "auto",
            background  : "#ef4444",
            color       : "white",
            padding     : "0.15rem 0.5rem",
            borderRadius: "6px",
            fontSize    : "0.7rem",
          }}>
            ❌ LAST ERROR
          </span>
        )}
      </button>

      {open && (
        <div style={{
          padding    : "1rem",
          background : "#fefce8",
          display    : "flex",
          flexDirection: "column",
          gap        : "0.75rem",
        }}>

          {/* Endpoint */}
          <section>
            <div style={{ fontWeight: 700, color: "#78350f", marginBottom: "0.3rem" }}>
              📡 ENDPOINT
            </div>
            <div style={{
              background  : "#1e293b",
              color       : "#86efac",
              padding     : "0.5rem 0.75rem",
              borderRadius: "8px",
            }}>
              POST {SUBMIT_URL}
            </div>
            <div style={{ color: "#92400e", marginTop: "0.25rem" }}>
              API_BASE: {API_BASE || "⚠️ VITE_API_BASE_URL not set"}
            </div>
          </section>

          {/* Token status */}
          <section>
            <div style={{ fontWeight: 700, color: "#78350f", marginBottom: "0.3rem" }}>
              🔑 TOKENS IN localStorage
            </div>
            {TOKEN_KEYS.map((key) => {
              const val   = localStorage.getItem(key);
              const found = Boolean(val);
              return (
                <div key={key} style={{
                  display       : "flex",
                  gap           : "0.5rem",
                  padding       : "0.25rem 0",
                  borderBottom  : "1px solid #fde68a",
                  alignItems    : "flex-start",
                }}>
                  <span style={{
                    color     : found ? "#16a34a" : "#9ca3af",
                    flexShrink: 0,
                    width     : 16,
                  }}>
                    {found ? "✅" : "❌"}
                  </span>
                  <span style={{
                    color    : "#78350f",
                    width    : 140,
                    flexShrink: 0,
                  }}>
                    {key}
                  </span>
                  <span style={{
                    color       : found ? "#1e293b" : "#9ca3af",
                    wordBreak   : "break-all",
                    fontSize    : "0.68rem",
                  }}>
                    {val ? `${val.slice(0, 50)}...` : "null"}
                  </span>
                </div>
              );
            })}

            <div style={{
              marginTop : "0.5rem",
              color     : foundKey ? "#16a34a" : "#ef4444",
              fontWeight: 700,
            }}>
              {foundKey
                ? `✅ Will use token from key: "${foundKey}"`
                : "❌ NO SELLER TOKEN FOUND — submit will redirect to /seller/login"}
            </div>
          </section>

          {/* JWT Payload */}
          {jwtPayload && (
            <section>
              <div style={{ fontWeight: 700, color: "#78350f", marginBottom: "0.3rem" }}>
                🪙 JWT PAYLOAD (decoded, not verified)
              </div>
              <pre style={{
                background  : "#1e293b",
                color       : "#7dd3fc",
                padding     : "0.5rem 0.75rem",
                borderRadius: "8px",
                overflow    : "auto",
                margin      : 0,
                fontSize    : "0.68rem",
              }}>
                {JSON.stringify(jwtPayload, null, 2)}
              </pre>
              {jwtPayload.exp && (
                <div style={{
                  marginTop : "0.25rem",
                  color     : Date.now() / 1000 > jwtPayload.exp
                    ? "#ef4444" : "#16a34a",
                  fontWeight: 700,
                }}>
                  {Date.now() / 1000 > jwtPayload.exp
                    ? "❌ TOKEN EXPIRED"
                    : `✅ Token valid — expires ${new Date(jwtPayload.exp * 1000).toLocaleString()}`}
                </div>
              )}
              {jwtPayload.id && (
                <div style={{ color: "#78350f", marginTop: "0.2rem" }}>
                  user id in token: <strong>{jwtPayload.id}</strong>
                  <br />
                  <span style={{ fontSize: "0.68rem", color: "#92400e" }}>
                    ← this must match market.users.id (NOT public.users.id)
                  </span>
                </div>
              )}
            </section>
          )}

          {/* All localStorage keys */}
          <section>
            <div style={{ fontWeight: 700, color: "#78350f", marginBottom: "0.3rem" }}>
              📦 ALL localStorage KEYS ({allKeys.length} total)
            </div>
            <div style={{
              background  : "#1e293b",
              color       : "#e2e8f0",
              padding     : "0.5rem 0.75rem",
              borderRadius: "8px",
              fontSize    : "0.68rem",
              lineHeight  : 1.8,
            }}>
              {allKeys.length
                ? allKeys.map((k) => (
                    <div key={k} style={{
                      color: TOKEN_KEYS.includes(k) ? "#86efac" : "#e2e8f0",
                    }}>
                      {TOKEN_KEYS.includes(k) ? "★ " : "  "}{k}
                    </div>
                  ))
                : "(empty)"}
            </div>
          </section>

          {/* Last error */}
          {lastError && (
            <section>
              <div style={{ fontWeight: 700, color: "#dc2626", marginBottom: "0.3rem" }}>
                ❌ LAST SUBMIT ERROR
              </div>
              <pre style={{
                background  : "#1e293b",
                color       : "#fca5a5",
                padding     : "0.5rem 0.75rem",
                borderRadius: "8px",
                overflow    : "auto",
                margin      : 0,
                fontSize    : "0.68rem",
                whiteSpace  : "pre-wrap",
              }}>
                {JSON.stringify(lastError, null, 2)}
              </pre>

              {/* Diagnosis */}
              <div style={{
                marginTop   : "0.5rem",
                padding     : "0.5rem 0.75rem",
                background  : "#fef2f2",
                borderRadius: "8px",
                color       : "#991b1b",
                lineHeight  : 1.6,
              }}>
                {lastError.status === 404 && (
                  <>
                    <strong>404 — Route not found</strong><br />
                    The URL <code>{SUBMIT_URL}</code> is not registered on the server.<br />
                    Check that <code>router.use("/", addProduct)</code> is in
                    <code> routes/market/index.js</code> and that the route
                    registers <code>POST /</code> (not <code>POST /products</code>).
                  </>
                )}
                {lastError.status === 401 && (
                  <>
                    <strong>401 — Unauthenticated</strong><br />
                    No token sent or token is invalid.<br />
                    Check that <code>sellerToken</code> exists in localStorage.
                  </>
                )}
                {lastError.status === 403 && (
                  <>
                    <strong>403 — Forbidden</strong><br />
                    Token found but seller account is unverified or suspended.<br />
                    Server message: {lastError.message}
                  </>
                )}
                {lastError.status === 500 && (
                  <>
                    <strong>500 — Server error</strong><br />
                    Check Render logs for the crash detail.<br />
                    Common causes: wrong column name in SQL query,
                    missing env variable, pool import issue.
                  </>
                )}
                {lastError.status === 422 && (
                  <>
                    <strong>422 — Validation failed</strong><br />
                    Server message: {lastError.message}
                  </>
                )}
                {!lastError.status && (
                  <>
                    <strong>Network error</strong><br />
                    Could not reach the server. Check VITE_API_BASE_URL
                    and that the server is running.
                  </>
                )}
              </div>
            </section>
          )}

          {/* Quick actions */}
          <section>
            <div style={{ fontWeight: 700, color: "#78350f", marginBottom: "0.3rem" }}>
              🛠 QUICK ACTIONS
            </div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <a
                href={`${API_BASE}/api/seller-auth/health`}
                target="_blank"
                rel="noreferrer"
                style={{
                  padding     : "0.3rem 0.75rem",
                  background  : "#3b82f6",
                  color       : "white",
                  borderRadius: "6px",
                  fontSize    : "0.72rem",
                  textDecoration: "none",
                  fontWeight  : 600,
                }}>
                /api/seller-auth/health ↗
              </a>
              <a
                href={`${API_BASE}/api/products/debug`}
                target="_blank"
                rel="noreferrer"
                style={{
                  padding     : "0.3rem 0.75rem",
                  background  : "#8b5cf6",
                  color       : "white",
                  borderRadius: "6px",
                  fontSize    : "0.72rem",
                  textDecoration: "none",
                  fontWeight  : 600,
                }}>
                /api/products/debug ↗
              </a>
              <button
                type="button"
                onClick={() => {
                  const tok = localStorage.getItem(foundKey ?? "sellerToken");
                  if (tok) {
                    navigator.clipboard?.writeText(tok);
                    alert("Token copied to clipboard!");
                  } else {
                    alert("No seller token found in localStorage");
                  }
                }}
                style={{
                  padding     : "0.3rem 0.75rem",
                  background  : "#10b981",
                  color       : "white",
                  borderRadius: "6px",
                  fontSize    : "0.72rem",
                  border      : "none",
                  cursor      : "pointer",
                  fontWeight  : 600,
                  fontFamily  : "monospace",
                }}>
                Copy Token
              </button>
            </div>
          </section>

        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SECTION HEADER with edit button
══════════════════════════════════════════════════════════════ */
const SectionHead = memo(({ icon: Icon, label, step }) => {
  const handleEdit = useCallback(() => {
    window.dispatchEvent(new CustomEvent("pa-edit-step", { detail: step }));
  }, [step]);

  return (
    <div className="rv-section-head">
      <span className="rv-section-icon">
        <Icon size={13} />
      </span>
      <h3 className="rv-section-title">{label}</h3>
      <button
        type="button"
        className="rv-edit-btn"
        onClick={handleEdit}
        aria-label={`Edit ${label}`}>
        <IconEdit size={13} />
        <span>Edit</span>
      </button>
    </div>
  );
});
SectionHead.displayName = "SectionHead";

/* ══════════════════════════════════════════════════════════════
   REVIEW STEP
══════════════════════════════════════════════════════════════ */
export default function ReviewStep({
  filledImages,
  title,
  brand,
  tags,
  basePrice,
  originalPrice,
  discountPct,
  description,
  category,
  activeCategory,
  variants,
  keyFeatures,
  specifications,
  whatsInBox,
  posting,
  uploadPct,
  onSubmit,
  lastSaved,
  prohibitedResult,
  scanDone,
  /* Pass lastError down from PostAds.jsx — see note below */
  lastError,
}) {
  const base      = Number(basePrice)     || 0;
  const original  = Number(originalPrice) || 0;
  const hasFilled = (arr) => arr?.some?.((x) =>
    typeof x === "string" ? x.trim() : x?.key?.trim()
  );

  const validVariants = variants?.filter(
    (v) => v.sku?.trim() && v.name?.trim()
  ) ?? [];

  const showProhibited =
    scanDone && prohibitedResult?.blocked?.length > 0;

  return (
    <div className="rv-wrap">

      {/* ══ LIVE DEBUG PANEL ══════════════════════════════════ */}
      <DebugPanel lastError={lastError} posting={posting} />

      {/* ── Prohibited warning ── */}
      {showProhibited && (
        <div className="rv-prohibited" role="alert" aria-live="assertive">
          <IconAlertTriangle size={16} />
          <div className="rv-prohibited-body">
            <strong>Prohibited content detected.</strong>
            {" "}Go back to Details and remove the flagged terms before submitting.
          </div>
        </div>
      )}

      {/* ── Cover image + title card ── */}
      <div className="rv-hero">
        <div className="rv-cover">
          {filledImages[0] ? (
            <img
              src={filledImages[0].preview}
              alt="Cover photo"
              className="rv-cover-img"
            />
          ) : (
            <div className="rv-cover-placeholder" aria-label="No cover photo">
              <IconImage size={32} />
            </div>
          )}
          {filledImages.length > 1 && (
            <span className="rv-photo-count"
              aria-label={`${filledImages.length} photos`}>
              +{filledImages.length - 1}
            </span>
          )}
        </div>

        <div className="rv-hero-body">
          <h2 className="rv-title">{title || "—"}</h2>
          {brand && <p className="rv-brand">{brand}</p>}

          <div className="rv-price-row">
            <span className="rv-price">₦{fmt(base)}</span>
            {original > 0 && original > base && (
              <span className="rv-price-original" aria-label="Original price">
                ₦{fmt(original)}
              </span>
            )}
            {discountPct > 0 && (
              <span className="rv-discount-badge"
                aria-label={`${discountPct} percent off`}>
                -{discountPct}%
              </span>
            )}
          </div>

          <div className="rv-pills">
            {activeCategory && (
              <span className="rv-pill rv-pill--cat">
                {activeCategory.name}
              </span>
            )}
            {tags?.map((t) => (
              <span key={t} className="rv-pill">
                <IconTag size={11} />
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Thumbnail strip ── */}
      {filledImages.length > 1 && (
        <div className="rv-thumbs" role="list" aria-label="All photos">
          {filledImages.map((img, i) => (
            <div key={i} className="rv-thumb" role="listitem">
              <img
                src={img.preview}
                alt={`Photo ${i + 1}`}
                className="rv-thumb-img"
              />
              {i === 0 && (
                <span className="rv-thumb-cover" aria-label="Cover photo">
                  Cover
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Description ── */}
      {description && (
        <div className="rv-section">
          <SectionHead icon={IconList} label="Description" step={2} />
          <p className="rv-description">
            {description.slice(0, 200)}
            {description.length > 200 && (
              <span className="rv-description-more"> …</span>
            )}
          </p>
        </div>
      )}

      {/* ── Variants ── */}
      {validVariants.length > 0 && (
        <div className="rv-section">
          <SectionHead icon={IconLayers} label="Variants" step={3} />
          <div className="rv-variant-list" role="list">
            {validVariants.map((v) => (
              <div key={v.id} className="rv-variant-row" role="listitem">
                <div className="rv-variant-left">
                  <span className="rv-variant-name">{v.name}</span>
                  <span className="rv-variant-sku">{v.sku}</span>
                </div>
                <div className="rv-variant-right">
                  <span className="rv-variant-price">₦{fmt(v.price)}</span>
                  <span className="rv-variant-stock">{v.stock} in stock</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Key Features ── */}
      {hasFilled(keyFeatures) && (
        <div className="rv-section">
          <SectionHead icon={IconCheck} label="Key Features" step={2} />
          <ul className="rv-list" role="list">
            {keyFeatures
              .filter((f) => f.trim())
              .map((f, i) => (
                <li key={i} className="rv-list-item">
                  <span className="rv-list-bullet" aria-hidden="true">
                    <IconCheck size={11} />
                  </span>
                  {f}
                </li>
              ))}
          </ul>
        </div>
      )}

      {/* ── Specifications ── */}
      {specifications?.some((r) => r.key?.trim() && r.value?.trim()) && (
        <div className="rv-section">
          <SectionHead icon={IconGrid} label="Specifications" step={2} />
          <table className="rv-spec-table" aria-label="Product specifications">
            <tbody>
              {specifications
                .filter((r) => r.key?.trim() && r.value?.trim())
                .map((r, i) => (
                  <tr key={i}>
                    <td className="rv-spec-key">{r.key}</td>
                    <td className="rv-spec-val">{r.value}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── What's in the Box ── */}
      {hasFilled(whatsInBox) && (
        <div className="rv-section">
          <SectionHead icon={IconBox} label="What's in the Box" step={2} />
          <ul className="rv-list" role="list">
            {whatsInBox
              .filter((f) => f.trim())
              .map((f, i) => (
                <li key={i} className="rv-list-item">
                  <span className="rv-list-bullet" aria-hidden="true">
                    <IconCheck size={11} />
                  </span>
                  {f}
                </li>
              ))}
          </ul>
        </div>
      )}

      {/* ── Trust note ── */}
      <div className="rv-trust" role="note">
        <IconShield size={15} />
        <span>
          Your listing will be reviewed before going live.
          You will be notified once it is approved.
        </span>
      </div>

      {/* ── Last saved ── */}
      {lastSaved && (
        <p className="rv-last-saved" aria-live="polite">
          <IconClock size={12} />
          <span>Draft saved {timeAgo(lastSaved)}</span>
        </p>
      )}

      {/* ── Upload progress ── */}
      {posting && uploadPct > 0 && uploadPct < 100 && (
        <div className="rv-progress" role="progressbar"
          aria-valuenow={uploadPct} aria-valuemin={0} aria-valuemax={100}
          aria-label={`Uploading — ${uploadPct}%`}>
          <div className="rv-progress-track">
            <div
              className="rv-progress-fill"
              style={{ width: `${uploadPct}%` }}
            />
          </div>
          <span className="rv-progress-label">{uploadPct}%</span>
        </div>
      )}

      {/* ── Submit button ── */}
      <button
        type="button"
        className={`rv-submit${posting ? " rv-submit--posting" : ""}${showProhibited ? " rv-submit--blocked" : ""}`}
        disabled={posting || showProhibited}
        onClick={onSubmit}
        aria-label={posting ? `Uploading — ${uploadPct}%` : "Submit listing for review"}
        aria-busy={posting}>
        {posting ? (
          <>
            <span className="rv-submit-spinner" aria-hidden="true" />
            <span>
              {uploadPct > 0 && uploadPct < 100
                ? `Uploading — ${uploadPct}%`
                : "Submitting..."}
            </span>
          </>
        ) : (
          <>
            <IconSend size={17} />
            <span>Submit Listing</span>
          </>
        )}
      </button>

    </div>
  );
}