import React, { memo } from "react";
import { formatPrice } from "../../config/marketplace";

const VariantSelector = memo(function VariantSelector({
  variants, selected, onSelect,
}) {
  const hasColors   = variants.some((v) => v.attributes?.color);
  const hasSizes    = variants.some((v) => v.attributes?.size);
  const hasStorages = variants.some((v) => v.attributes?.storage);

  const uniqueAttr = (key) =>
    [...new Set(variants.map((v) => v.attributes?.[key]).filter(Boolean))];

  const findVariant = (key, val) =>
    variants.find((v) => v.attributes?.[key] === val) ?? null;

  const stock = Number(selected?.stock ?? 0);

  const stockClass =
    stock === 0 ? "md-stock--zero" :
    stock <= 5  ? "md-stock--low"  :
                  "md-stock--ok";

  const stockLabel =
    stock === 0 ? "Out of stock" :
    stock <= 5  ? `Only ${stock} left!` :
                  `${stock} in stock`;

  return (
    <div className="md-variants">

      {/* Colors */}
      {hasColors && (
        <div className="md-var-group">
          <p className="md-var-label">
            Color
            {selected?.attributes?.color && (
              <span className="md-var-selected">: {selected.attributes.color}</span>
            )}
          </p>
          <div className="md-var-opts">
            {uniqueAttr("color").map((c) => {
              const v   = findVariant("color", c);
              const oos = Number(v?.stock ?? 0) === 0;
              const active = selected?.attributes?.color === c;
              return (
                <button
                  key={c}
                  className={`md-color-btn ${active ? "md-color-btn--active" : ""} ${oos ? "md-color-btn--oos" : ""}`}
                  onClick={() => v && onSelect(v)}
                  aria-pressed={active}
                  title={oos ? `${c} — Out of stock` : c}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Sizes */}
      {hasSizes && (
        <div className="md-var-group">
          <p className="md-var-label">
            Size
            {selected?.attributes?.size && (
              <span className="md-var-selected">: {selected.attributes.size}</span>
            )}
          </p>
          <div className="md-var-opts">
            {uniqueAttr("size").map((s) => {
              const v   = findVariant("size", s);
              const oos = Number(v?.stock ?? 0) === 0;
              const active = selected?.attributes?.size === s;
              return (
                <button
                  key={s}
                  className={`md-size-btn ${active ? "md-size-btn--active" : ""} ${oos ? "md-size-btn--oos" : ""}`}
                  onClick={() => v && onSelect(v)}
                  aria-pressed={active}
                >
                  {s}
                  {oos && <span className="md-oos-slash" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Storages */}
      {hasStorages && (
        <div className="md-var-group">
          <p className="md-var-label">Storage</p>
          <div className="md-var-opts">
            {uniqueAttr("storage").map((s) => {
              const v = findVariant("storage", s);
              const active = selected?.attributes?.storage === s;
              return (
                <button
                  key={s}
                  className={`md-storage-btn ${active ? "md-storage-btn--active" : ""}`}
                  onClick={() => v && onSelect(v)}
                  aria-pressed={active}
                >
                  <span>{s}</span>
                  {v?.price && (
                    <span className="md-storage-price">{formatPrice(v.price)}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected variant info */}
      {selected && (
        <div className="md-var-info">
          <div className="md-var-info-row">
            <span>SKU</span>
            <code className="md-sku">{selected.sku}</code>
          </div>
          <div className="md-var-info-row">
            <span>Stock</span>
            <span className={`md-stock-label ${stockClass}`}>{stockLabel}</span>
          </div>
        </div>
      )}
    </div>
  );
});

export default VariantSelector;