import React, { memo } from "react";

const SpecsSection = memo(function SpecsSection({ specs }) {
  if (!specs?.length) return null;

  return (
    <div className="md-section">
      <h3 className="md-section-title">Specifications</h3>
      <div className="md-specs-table">
        {specs.map((s, i) => (
          <div
            key={i}
            className={`md-spec-row ${i % 2 === 0 ? "md-spec-row--alt" : ""}`}
          >
            <span className="md-spec-key">
              {s?.key ?? s?.spec_key ?? "—"}
            </span>
            <span className="md-spec-val">
              {s?.value ?? s?.spec_value ?? "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});

export default SpecsSection;