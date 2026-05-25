import React from "react";
import {
  FiTrash2,
  FiPlus,
  FiCopy,
} from "react-icons/fi";

export default function VariantEditor({
  variants = [],
  onUpdate,
  onUpdateAttribute,
  onAdd,
  onRemove,
  onDuplicate,
}) {

  const formatPrice = (value) => {
    if (!value) return "";
    return Number(value).toLocaleString();
  };

  const addAttribute = (variantIndex) => {
    const updated = [...variants];

    updated[variantIndex].attributes.push({
      id: crypto.randomUUID(),
      key: "",
      value: "",
    });

    onUpdate(variantIndex, "attributes", updated[variantIndex].attributes);
  };

  const removeAttribute = (variantIndex, attrIndex) => {
    const updated = [...variants];

    updated[variantIndex].attributes.splice(attrIndex, 1);

    onUpdate(variantIndex, "attributes", updated[variantIndex].attributes);
  };

  return (
    <>
      <div className="pa-section-head">
        <p className="pa-section-title">
          Product Variants
        </p>

        <p className="pa-section-sub">
          Create flexible variants for any product type:
          colour, size, storage, material, RAM, voltage, etc.
        </p>
      </div>

      {variants.map((variant, variantIndex) => {
        const stock =
          parseInt(variant.inventory?.quantity, 10) || 0;

        return (
          <div
            className="pa-variant-card"
            key={variant.id || variantIndex}
          >

            {/* HEADER */}
            <div className="pa-variant-header">

              <div>
                <p className="pa-variant-title">
                  Variant {variantIndex + 1}
                </p>

                <span className="pa-variant-sku">
                  {variant.sku || "No SKU"}
                </span>
              </div>

              <div className="pa-variant-actions">

                {onDuplicate && (
                  <button
                    type="button"
                    className="pa-variant-icon-btn"
                    onClick={() => onDuplicate(variantIndex)}
                  >
                    <FiCopy size={14} />
                  </button>
                )}

                <button
                  type="button"
                  className="pa-variant-icon-btn pa-variant-delete"
                  onClick={() => onRemove(variantIndex)}
                  disabled={variants.length === 1}
                >
                  <FiTrash2 size={14} />
                </button>

              </div>
            </div>

            {/* CORE FIELDS */}
            <div className="pa-variant-grid">

              <div className="pa-variant-field pa-span-2">
                <label>Variant Name *</label>

                <input
                  placeholder='e.g. "Black 256GB"'
                  value={variant.name || ""}
                  onChange={(e) =>
                    onUpdate(
                      variantIndex,
                      "name",
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="pa-variant-field">
                <label>SKU *</label>

                <input
                  placeholder='e.g. "IPH15-BLK-256"'
                  value={variant.sku || ""}
                  onChange={(e) =>
                    onUpdate(
                      variantIndex,
                      "sku",
                      e.target.value.toUpperCase()
                    )
                  }
                />
              </div>

              <div className="pa-variant-field">
                <label>Price (₦) *</label>

                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={formatPrice(variant.pricing?.price)}
                  onChange={(e) =>
                    onUpdate(
                      variantIndex,
                      "pricing",
                      {
                        ...variant.pricing,
                        price: e.target.value.replace(/\D/g, ""),
                      }
                    )
                  }
                />
              </div>

              <div className="pa-variant-field">
                <label>Stock Quantity</label>

                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={variant.inventory?.quantity || ""}
                  onChange={(e) =>
                    onUpdate(
                      variantIndex,
                      "inventory",
                      {
                        ...variant.inventory,
                        quantity: e.target.value,
                      }
                    )
                  }
                />

                <span
                  className={`pa-stock-badge ${
                    stock === 0
                      ? "pa-stock-badge--zero"
                      : stock <= 3
                      ? "pa-stock-badge--low"
                      : "pa-stock-badge--ok"
                  }`}
                >
                  {stock === 0
                    ? "Out of stock"
                    : stock <= 3
                    ? `Only ${stock} left`
                    : `${stock} in stock`}
                </span>
              </div>

            </div>

            {/* ATTRIBUTES */}
            <div className="pa-variant-attributes">

              <div className="pa-variant-attributes-head">

                <p className="pa-variant-attributes-title">
                  Dynamic Attributes
                </p>

                <button
                  type="button"
                  className="pa-add-attribute-btn"
                  onClick={() => addAttribute(variantIndex)}
                >
                  <FiPlus size={13} />
                  Add Attribute
                </button>

              </div>

              {variant.attributes?.length > 0 ? (
                variant.attributes.map((attr, attrIndex) => (
                  <div
                    className="pa-attribute-row"
                    key={attr.id || attrIndex}
                  >

                    <input
                      className="pa-attribute-input"
                      placeholder="Attribute"
                      value={attr.key}
                      onChange={(e) =>
                        onUpdateAttribute(
                          variantIndex,
                          attrIndex,
                          "key",
                          e.target.value
                        )
                      }
                    />

                    <input
                      className="pa-attribute-input"
                      placeholder="Value"
                      value={attr.value}
                      onChange={(e) =>
                        onUpdateAttribute(
                          variantIndex,
                          attrIndex,
                          "value",
                          e.target.value
                        )
                      }
                    />

                    <button
                      type="button"
                      className="pa-remove-attribute-btn"
                      onClick={() =>
                        removeAttribute(
                          variantIndex,
                          attrIndex
                        )
                      }
                    >
                      <FiTrash2 size={13} />
                    </button>

                  </div>
                ))
              ) : (
                <div className="pa-empty-attributes">
                  No attributes added yet
                </div>
              )}

            </div>

          </div>
        );
      })}

      {variants.length < 50 && (
        <button
          type="button"
          className="pa-add-btn"
          onClick={onAdd}
        >
          <FiPlus size={15} />
          Add Another Variant
        </button>
      )}
    </>
  );
}