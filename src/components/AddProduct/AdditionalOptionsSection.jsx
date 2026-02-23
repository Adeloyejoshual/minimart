// src/components/AddProduct/AdditionalOptionsSection.jsx
import React from "react";

export default function AdditionalOptionsSection({
  form,
  handleChange,
  ui
}) {
  return (
    <section style={{ marginBottom: "2rem" }}>
      <h2>⚙️ Additional Options</h2>

      {/* CONDITION */}
      <div>
        <label>Condition *</label>
        <select
          value={form.condition}
          onChange={(e) =>
            handleChange("condition", e.target.value)
          }
        >
          <option value="">Select condition</option>
          <option value="new">Brand New</option>
          <option value="used">Used</option>
          <option value="refurbished">Refurbished</option>
        </select>

        {ui.errors?.condition && (
          <small style={{ color: "red" }}>
            {ui.errors.condition}
          </small>
        )}
      </div>

      {/* WARRANTY */}
      <div style={{ marginTop: "1rem" }}>
        <label>
          <input
            type="checkbox"
            checked={form.has_warranty}
            onChange={(e) =>
              handleChange("has_warranty", e.target.checked)
            }
          />
          Has Warranty
        </label>
      </div>

      {form.has_warranty && (
        <div style={{ marginTop: "0.5rem" }}>
          <label>Warranty Duration</label>
          <input
            type="text"
            value={form.warranty_duration}
            onChange={(e) =>
              handleChange(
                "warranty_duration",
                e.target.value
              )
            }
            placeholder="e.g. 6 months"
          />
        </div>
      )}

      {/* RETURN POLICY */}
      <div style={{ marginTop: "1rem" }}>
        <label>
          <input
            type="checkbox"
            checked={form.return_policy}
            onChange={(e) =>
              handleChange("return_policy", e.target.checked)
            }
          />
          Return Accepted
        </label>
      </div>

      {/* FEATURED PRODUCT */}
      <div style={{ marginTop: "1rem" }}>
        <label>
          <input
            type="checkbox"
            checked={form.featured}
            onChange={(e) =>
              handleChange("featured", e.target.checked)
            }
          />
          Mark as Featured
        </label>
      </div>

      {/* STOCK QUANTITY */}
      <div style={{ marginTop: "1rem" }}>
        <label>Stock Quantity</label>
        <input
          type="number"
          value={form.stock_quantity}
          onChange={(e) =>
            handleChange("stock_quantity", e.target.value)
          }
          placeholder="Enter quantity"
        />
      </div>
    </section>
  );
}