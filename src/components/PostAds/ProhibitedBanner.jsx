import React, { memo } from "react";
import { FiShield, FiAlertTriangle, FiAlertCircle } from "react-icons/fi";

/* ─── Prohibited / suspicious banner ─── */
const ProhibitedBanner = memo(({ result, scanDone }) => {
  if (!scanDone || !result) return null;

  const { blocked, suspicious } = result;

  if (!blocked.length && !suspicious.length) {
    return (
      <div style={{
        display:      "flex",
        alignItems:   "center",
        gap:          "8px",
        padding:      "10px 14px",
        borderRadius: "12px",
        background:   "rgba(16,185,129,0.07)",
        border:       "1px solid rgba(16,185,129,0.15)",
        marginBottom: "14px",
        fontSize:     "12px",
        fontWeight:   700,
        color:        "#065f46",
      }}>
        <FiShield size={14} style={{ flexShrink: 0 }} />
        ✅ Content scan passed — no prohibited items detected
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "14px" }}>

      {/* Blocked items — hard stop */}
      {blocked.length > 0 && (
        <div style={{
          padding:      "14px 16px",
          borderRadius: "14px",
          background:   "rgba(220,38,38,0.07)",
          border:       "1.5px solid rgba(220,38,38,0.25)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
            <FiAlertTriangle size={16} color="#dc2626" />
            <span style={{ fontWeight: 800, fontSize: "13px", color: "#991b1b" }}>
              🚫 Prohibited Content Detected
            </span>
            <span style={{
              marginLeft:   "auto",
              background:   "#dc2626",
              color:        "#fff",
              fontSize:     "10px",
              fontWeight:   900,
              padding:      "2px 7px",
              borderRadius: "5px",
            }}>
              BLOCKED
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {blocked.map((b, i) => (
              <div key={i} style={{
                display:      "flex",
                alignItems:   "center",
                gap:          "8px",
                padding:      "8px 12px",
                borderRadius: "10px",
                background:   "rgba(220,38,38,0.05)",
                fontSize:     "12px",
              }}>
                <span style={{
                  padding:      "2px 8px",
                  borderRadius: "6px",
                  background:   "rgba(220,38,38,0.12)",
                  color:        "#991b1b",
                  fontWeight:   800,
                  fontSize:     "11px",
                  flexShrink:   0,
                }}>
                  {b.category}
                </span>
                <span style={{ color: "#991b1b", fontWeight: 700 }}>
                  "{b.text}"
                </span>
              </div>
            ))}
          </div>

          <p style={{
            margin:     "10px 0 0",
            fontSize:   "12px",
            fontWeight: 600,
            color:      "#991b1b",
            lineHeight: 1.5,
          }}>
            This listing cannot be published. Remove the prohibited content
            and try again. Violations may result in account suspension.
          </p>
        </div>
      )}

      {/* Suspicious — warning only */}
      {suspicious.length > 0 && (
        <div style={{
          padding:      "12px 14px",
          borderRadius: "14px",
          background:   "rgba(245,158,11,0.07)",
          border:       "1.5px solid rgba(245,158,11,0.2)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <FiAlertCircle size={15} color="#d97706" />
            <span style={{ fontWeight: 800, fontSize: "13px", color: "#92400e" }}>
              ⚠️ Suspicious Terms Detected
            </span>
            <span style={{
              marginLeft:   "auto",
              background:   "rgba(245,158,11,0.15)",
              color:        "#92400e",
              fontSize:     "10px",
              fontWeight:   900,
              padding:      "2px 7px",
              borderRadius: "5px",
            }}>
              WARNING
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            {suspicious.map((s, i) => (
              <div key={i} style={{
                display:    "flex",
                alignItems: "center",
                gap:        "8px",
                fontSize:   "12px",
                color:      "#92400e",
                fontWeight: 600,
              }}>
                <span>•</span>
                <span>{s.label}: <em>"{s.text}"</em></span>
              </div>
            ))}
          </div>

          <p style={{
            margin:     "8px 0 0",
            fontSize:   "11px",
            fontWeight: 600,
            color:      "#92400e",
            lineHeight: 1.5,
          }}>
            Your listing may be flagged for manual review. Edit your
            description to remove ambiguous terms.
          </p>
        </div>
      )}
    </div>
  );
});

export default ProhibitedBanner;