// pages/seller/components/StatCard.jsx
import React from "react";

export default function StatCard({
  icon, label, value, sub,
  trend, trendUp, color = "#6366f1",
  loading = false, onClick,
}) {
  return (
    <div
      style={{
        ...s.card,
        cursor: onClick ? "pointer" : "default",
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow =
          "0 4px 20px rgba(0,0,0,0.09)";
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow =
          "0 1px 4px rgba(0,0,0,0.04)";
        e.currentTarget.style.transform = "none";
      }}
    >
      {loading ? (
        <div style={s.skel} />
      ) : (
        <>
          <div style={{ display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start" }}>
            <div style={{
              ...s.iconWrap,
              background: color + "18",
              color,
            }}>
              {icon}
            </div>
            {trend !== undefined && trend !== null && (
              <span style={{
                fontSize:     "0.7rem",
                fontWeight:   700,
                color:        trendUp ? "#10b981" : "#ef4444",
                background:   trendUp ? "#ecfdf5" : "#fef2f2",
                padding:      "0.2rem 0.55rem",
                borderRadius: "100px",
                whiteSpace:   "nowrap",
              }}>
                {trendUp ? "▲" : "▼"}{" "}
                {Math.abs(trend)}%
              </span>
            )}
          </div>
          <div style={{ marginTop: "1rem" }}>
            <p style={s.label}>{label}</p>
            <p style={s.value}>{value}</p>
            {sub && <p style={s.sub}>{sub}</p>}
          </div>
        </>
      )}
    </div>
  );
}

const s = {
  card: {
    background:   "white",
    borderRadius: "16px",
    padding:      "1.25rem",
    border:       "1px solid #f3f4f6",
    boxShadow:    "0 1px 4px rgba(0,0,0,0.04)",
    transition:   "box-shadow 0.2s, transform 0.2s",
  },
  iconWrap: {
    width:          "44px",
    height:         "44px",
    borderRadius:   "12px",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    fontSize:       "1.3rem",
    flexShrink:     0,
  },
  label: {
    color:     "#9ca3af",
    fontSize:  "0.78rem",
    fontWeight:600,
    margin:    "0 0 0.3rem",
    letterSpacing: "0.01em",
  },
  value: {
    fontWeight:  800,
    fontSize:    "1.6rem",
    color:       "#1f2937",
    margin:      0,
    lineHeight:  1.15,
  },
  sub: {
    color:     "#9ca3af",
    fontSize:  "0.72rem",
    margin:    "0.3rem 0 0",
  },
  skel: {
    height:           "88px",
    borderRadius:     "10px",
    background:       "linear-gradient(90deg,#f3f4f6 25%,#e9eaf0 50%,#f3f4f6 75%)",
    backgroundSize:   "400px 100%",
    animation:        "sdShimmer 1.4s infinite",
  },
};