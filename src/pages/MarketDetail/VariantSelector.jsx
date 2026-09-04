/**
 * src/pages/MarketDetail/VariantSelector.jsx
 * Modern Temu-style option chips
 */

import React, { memo, useMemo } from "react";
import { formatPrice } from "../../config/marketplace";

const VariantSelector = memo(function VariantSelector({
  variants = [],
  selected,
  onSelect,
}) {
  const hasColors = useMemo(
    () => variants.some((v) => v.attributes?.color),
    [variants]
  );
  const hasSizes = useMemo(
    () => variants.some((v) => v.attributes?.size),
    [variants]
  );
  const hasStorages = useMemo(
    () => variants.some((v) => v.attributes?.storage),
    [variants]
  );

  const uniqueAttr = (key) =>
    [...new Set(variants.map((v) => v.attributes?.[key]).filter(Boolean))];

  const findVariant = (key, val) =>
    variants.find((v) => v.attributes?.[key] === val) ?? null;

  if (!variants.length) return null;

  return (
    <div className="mdp-v2">
      {/* Color */}
      {hasColors && (
        <div className="mdp-v2__group">
          <div className="mdp-v2__head">
            <span className="mdp-v2__label">Color</span>
            {selected?.attributes?.color && (
              <span className="mdp-v2__picked">{selected.attributes.color}</span>
            )}
          </div>
          <div className="mdp-v2__row">
            {uniqueAttr("color").map((c) => {
              const v = findVariant("color", c);
              const oos = Number(v?.stock ?? 0) === 0;
              const active = selected?.attributes?.color === c;
              const thumb = v?.image || v?.images?.[0];

              return (
                <button
                  key={c}
                  type="button"
                  className={[
                    "mdp-v2__chip",
                    thumb ? "mdp-v2__chip--img" : "",
                    active ? "is-active" : "",
                    oos ? "is-oos" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => v && !oos && onSelect(v)}
                  disabled={oos}
                  aria-pressed={active}
                  title={oos ? `${c} — Out of stock` : c}
                >
                  {thumb ? (
                    <>
                      <img src={thumb} alt="" className="mdp-v2__thumb" />
                      <span className="mdp-v2__chip-text">{c}</span>
                    </>
                  ) : (
                    <span className="mdp-v2__chip-text">{c}</span>
                  )}
                  {oos && <span className="mdp-v2__slash" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Size */}
      {hasSizes && (
        <div className="mdp-v2__group">
          <div className="mdp-v2__head">
            <span className="mdp-v2__label">Size</span>
            {selected?.attributes?.size && (
              <span className="mdp-v2__picked">{selected.attributes.size}</span>
            )}
          </div>
          <div className="mdp-v2__row">
            {uniqueAttr("size").map((s) => {
              const v = findVariant("size", s);
              const oos = Number(v?.stock ?? 0) === 0;
              const active = selected?.attributes?.size === s;

              return (
                <button
                  key={s}
                  type="button"
                  className={[
                    "mdp-v2__chip",
                    "mdp-v2__chip--size",
                    active ? "is-active" : "",
                    oos ? "is-oos" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => v && !oos && onSelect(v)}
                  disabled={oos}
                  aria-pressed={active}
                >
                  <span className="mdp-v2__chip-text">{s}</span>
                  {oos && <span className="mdp-v2__slash" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Storage */}
      {hasStorages && (
        <div className="mdp-v2__group">
          <div className="mdp-v2__head">
            <span className="mdp-v2__label">Storage</span>
            {selected?.attributes?.storage && (
              <span className="mdp-v2__picked">{selected.attributes.storage}</span>
            )}
          </div>
          <div className="mdp-v2__row">
            {uniqueAttr("storage").map((s) => {
              const v = findVariant("storage", s);
              const oos = Number(v?.stock ?? 0) === 0;
              const active = selected?.attributes?.storage === s;

              return (
                <button
                  key={s}
                  type="button"
                  className={[
                    "mdp-v2__chip",
                    "mdp-v2__chip--storage",
                    active ? "is-active" : "",
                    oos ? "is-oos" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => v && !oos && onSelect(v)}
                  disabled={oos}
                  aria-pressed={active}
                >
                  <span className="mdp-v2__chip-text">{s}</span>
                  {v?.price != null && (
                    <span className="mdp-v2__price">{formatPrice(v.price)}</span>
                  )}
                  {oos && <span className="mdp-v2__slash" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

export default VariantSelector;