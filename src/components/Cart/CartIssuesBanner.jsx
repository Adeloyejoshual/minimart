// src/components/Cart/CartIssuesBanner.jsx
import React, { useState } from "react";
import { ISSUE_LABELS } from "../../features/cart/utils/cartHelpers";

export default function CartIssuesBanner({ issues }) {
  const [dismissed, setDismissed] = useState(false);

  if (!issues || issues.length === 0 || dismissed) {
    return null;
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        maxWidth:      "1100px",
        margin:        "0 auto var(--sp-4)",
        background:    "var(--cart-warning-bg)",
        border:        "1.5px solid var(--cart-warning)",
        borderRadius:  "var(--cart-radius)",
        padding:       "var(--sp-4) var(--sp-5)",
        position:      "relative",
      }}
    >
      {/* Dismiss */}
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss cart issues"
        style={{
          position:      "absolute",
          top:           "var(--sp-3)",
          right:         "var(--sp-3)",
          background:    "none",
          border:        "none",
          cursor:        "pointer",
          fontSize:      "16px",
          color:         "#92400e",
          lineHeight:    "1",
          padding:       "var(--sp-1)",
          borderRadius:  "var(--cart-radius-sm)",
        }}
      >
        ✕
      </button>

      {/* Title */}
      <p style={{
        fontWeight:    700,
        fontSize:      "var(--fs-base)",
        color:         "#92400e",
        marginBottom:  "var(--sp-3)",
        display:       "flex",
        alignItems:    "center",
        gap:           "var(--sp-2)",
      }}>
        ⚠️{" "}
        {issues.length} item{issues.length > 1 ? "s" : ""}{" "}
        need{issues.length === 1 ? "s" : ""} your attention
      </p>

      {/* Issues list */}
      <ul style={{
        listStyle:      "none",
        display:        "flex",
        flexDirection:  "column",
        gap:            "var(--sp-2)",
      }}>
        {issues.map((issue, idx) => (
          <li
            key={`${issue.item_id ?? idx}-${issue.type}`}
            style={{
              display:    "flex",
              alignItems: "flex-start",
              gap:        "var(--sp-2)",
              fontSize:   "var(--fs-sm)",
              color:      "#92400e",
              lineHeight: "1.5",
            }}
          >
            <span style={{
              flexShrink:    0,
              marginTop:     "1px",
              fontSize:      "var(--fs-xs)",
              fontWeight:    700,
              background:    "var(--cart-warning)",
              color:         "#fff",
              padding:       "2px 8px",
              borderRadius:  "var(--cart-radius-pill)",
              whiteSpace:    "nowrap",
            }}>
              {ISSUE_LABELS[issue.type] ?? issue.type}
            </span>

            {issue.message}
          </li>
        ))}
      </ul>
    </div>
  );
}