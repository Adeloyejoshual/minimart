/**
 * src/pages/MarketDetail/VariantSelector.jsx
 * Direct On-Page Color / Size / Storage Selection Pills
 */

import { useMemo, memo } from "react";
import { formatPrice } from "../../config/marketplace";

function VariantSelector({
  variants = [],
  selectedVariant,
  onSelectVariant,
}) {
  if (!Array.isArray(variants) || variants.length === 0) return null;

  // Extract all attribute keys (e.g. ["color", "storage", "size"])
  const attributeKeys = useMemo(() => {
    const keys = new Set();
    variants.forEach((v) => {
      if (v?.attributes && typeof v.attributes === "object") {
        Object.keys(v.attributes).forEach((k) => keys.add(k));
      }
    });
    return [...keys];
  }, [variants]);

  // Helper to get unique values for an attribute key
  const getUniqueAttrValues = (key) => {
    const set = new Set();
    variants.forEach((v) => {
      const val = v.attributes?.[key];
      if (val != null) set.add(val);
    });
    return [...set];
  };

  // Switch variant when an option pill is clicked
  const handleSelect = (key, val) => {
    const current = selectedVariant?.attributes || {};
    // Find variant matching the new key/val while keeping other current selections if possible
    const match =
      variants.find(
        (v) =>
          v.attributes?.[key] === val &&
          Object.keys(current).every(
            (k) => k === key || v.attributes?.[k] === current[k]
          )
      ) || variants.find((v) => v.attributes?.[key] === val);

    if (match) onSelectVariant(match);
  };

  // If attributes object is missing, render variants by name
  if (attributeKeys.length === 0) {
    return (
      <div className="mdp-variant-section">
        <div className="mdp-variant-group">
          <label className="mdp-variant-label">
            Option: <strong>{selectedVariant?.name || "Select"}</strong>
          </label>
          <div className="mdp-variant-pills">
            {variants.map((v) => {
              const active = selectedVariant?.id === v.id;
              const oos = Number(v.stock ?? 1) <= 0;
              return (
                <button
                  key={v.id}
                  type="button"
                  className={`mdp-pill ${active ? "mdp-pill--active" : ""} ${oos ? "mdp-pill--oos" : ""}`}
                  onClick={() => onSelectVariant(v)}
                  disabled={oos}
                >
                  {v.name}
                  {v.price ? ` (${formatPrice(v.price)})` : ""}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mdp-variant-section">
      {attributeKeys.map((key) => {
        const values = getUniqueAttrValues(key);
        if (!values.length) return null;

        const currentVal = selectedVariant?.attributes?.[key];
        const displayVal =
          typeof currentVal === "object"
            ? currentVal?.name || currentVal?.title || String(currentVal)
            : String(currentVal || "");

        return (
          <div key={String(key)} className="mdp-variant-group">
            <div className="mdp-variant-label-row">
              <span className="mdp-variant-label" style={{ textTransform: "capitalize" }}>
                {String(key)}:
              </span>
              <span className="mdp-variant-val">{displayVal}</span>
            </div>

            <div className="mdp-variant-pills">
              {values.map((val) => {
                const matchedVar = variants.find(
                  (v) => v.attributes?.[key] === val
                );
                const oos = Number(matchedVar?.stock ?? 1) <= 0;
                const active = selectedVariant?.attributes?.[key] === val;
                const valText =
                  typeof val === "object"
                    ? val?.name || val?.title || String(val)
                    : String(val);

                const varImg =
                  matchedVar?.image ||
                  matchedVar?.images?.[0] ||
                  (typeof matchedVar?.image === "object" ? matchedVar.image.url : null);

                const isColorKey = String(key).toLowerCase().includes("color");

                return (
                  <button
                    key={valText}
                    type="button"
                    className={`mdp-pill ${active ? "mdp-pill--active" : ""} ${oos ? "mdp-pill--oos" : ""}`}
                    onClick={() => handleSelect(key, val)}
                    disabled={oos}
                  >
                    {/* If it's a color variant and has an image thumbnail */}
                    {isColorKey && varImg && (
                      <img
                        src={typeof varImg === "string" ? varImg : varImg.url}
                        alt=""
                        className="mdp-pill__thumb"
                      />
                    )}
                    <span>{valText}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default memo(VariantSelector);