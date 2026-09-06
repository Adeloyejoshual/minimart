import React, { memo } from "react";

const EXCLUDED_KEYS = /^(sku|stock|quantity|views|rating|featured|trending)$/i;

const SpecsSection = memo(function SpecsSection({ specs }) {
  if (!specs?.length) return null;

  // Filter out any metadata that shouldn't display in specs table
  const filteredSpecs = specs.filter((s) => {
    const key = s?.key ?? s?.spec_key ?? "";
    return !EXCLUDED_KEYS.test(key);
  });

  if (!filteredSpecs.length) return null;

  return (
    <div className="md-section" style={{ margin: "12px 0" }}>
      <h3
        className="md-section-title"
        style={{
          fontSize: "15px",
          fontWeight: "700",
          color: "var(--ink, #111111)",
          marginBottom: "12px",
        }}
      >
        Specifications
      </h3>

      {/* Demarcated Table Container */}
      <div
        className="md-specs-table"
        style={{
          border: "1px solid var(--bd, #e5e5e5)",
          borderRadius: "8px",
          overflow: "hidden",
          background: "var(--wh, #ffffff)",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {filteredSpecs.map((s, i) => {
          const key = s?.key ?? s?.spec_key ?? "—";
          const val = s?.value ?? s?.spec_value ?? "—";
          const isEven = i % 2 === 0;
          const isLast = i === filteredSpecs.length - 1;

          return (
            <div
              key={i}
              className={`md-spec-row ${isEven ? "md-spec-row--alt" : ""}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "11px 14px",
                background: isEven ? "var(--bg, #f9f9f9)" : "var(--wh, #ffffff)",
                borderBottom: isLast ? "none" : "1px solid var(--bd, #e5e5e5)",
                gap: "12px",
                boxSizing: "border-box",
              }}
            >
              {/* Spec Key (Left) */}
              <span
                className="md-spec-key"
                style={{
                  fontSize: "13px",
                  color: "var(--ink2, #666666)",
                  fontWeight: "500",
                  flex: "1",
                  maxWidth: "45%",
                  wordBreak: "break-word",
                }}
              >
                {key}
              </span>

              {/* Spec Value (Right) */}
              <span
                className="md-spec-val"
                style={{
                  fontSize: "13px",
                  color: "var(--ink, #111111)",
                  fontWeight: "600",
                  flex: "1",
                  textAlign: "right",
                  wordBreak: "break-word",
                }}
              >
                {val}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default SpecsSection;