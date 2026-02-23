// src/components/AddProduct/ProductDetailsSection.jsx
import React from "react";

export default function ProductDetailsSection({
  form,
  ui,
  computed,
  handleChange
}) {
  const {
    visibleFields,
    availableBrands,
    availableModels,
    categoryFeatures,
    availableCities
  } = computed;

  return (
    <section style={{ marginBottom: "2rem" }}>
      <h2>📦 Product Details</h2>

      {/* TITLE */}
      <div>
        <label>Title *</label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => handleChange("title", e.target.value)}
        />
        {ui.errors?.title && (
          <small style={{ color: "red" }}>{ui.errors.title}</small>
        )}
      </div>

      {/* CATEGORY */}
      <div>
        <label>Category *</label>
        <select
          value={form.category}
          onChange={(e) => handleChange("category", e.target.value)}
        >
          <option value="">Select Category</option>
          {Object.keys(computed.availableBrands).length > 0 &&
            Object.keys(computed.availableBrands).map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
        </select>
      </div>

      {/* BRAND */}
      {availableBrands.length > 0 && (
        <div>
          <label>Brand</label>
          <select
            value={form.brand}
            onChange={(e) => handleChange("brand", e.target.value)}
          >
            <option value="">Select Brand</option>
            {availableBrands.map((brand) => (
              <option key={brand} value={brand}>
                {brand}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* MODEL */}
      {availableModels.length > 0 && (
        <div>
          <label>Model</label>
          <select
            value={form.model}
            onChange={(e) => handleChange("model", e.target.value)}
          >
            <option value="">Select Model</option>
            {availableModels.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* CONDITION */}
      {visibleFields.includes("condition") && (
        <div>
          <label>Condition</label>
          <select
            value={form.condition}
            onChange={(e) => handleChange("condition", e.target.value)}
          >
            <option value="">Select Condition</option>
            <option value="New">New</option>
            <option value="Used">Used</option>
          </select>
        </div>
      )}

      {/* USED DETAIL */}
      {visibleFields.includes("used_detail") &&
        form.condition === "Used" && (
          <div>
            <label>Used Detail</label>
            <input
              type="text"
              value={form.used_detail}
              onChange={(e) =>
                handleChange("used_detail", e.target.value)
              }
            />
          </div>
        )}

      {/* RAM */}
      {visibleFields.includes("ram") && (
        <div>
          <label>RAM</label>
          <input
            type="text"
            value={form.ram}
            onChange={(e) => handleChange("ram", e.target.value)}
          />
        </div>
      )}

      {/* STORAGE */}
      {visibleFields.includes("storage") && (
        <div>
          <label>Storage</label>
          <input
            type="text"
            value={form.storage}
            onChange={(e) => handleChange("storage", e.target.value)}
          />
        </div>
      )}

      {/* COLOR */}
      {visibleFields.includes("color") && (
        <div>
          <label>Color</label>
          <input
            type="text"
            value={form.color}
            onChange={(e) => handleChange("color", e.target.value)}
          />
        </div>
      )}

      {/* YEAR */}
      {visibleFields.includes("year") && (
        <div>
          <label>Year</label>
          <input
            type="text"
            value={form.year}
            onChange={(e) => handleChange("year", e.target.value)}
          />
        </div>
      )}

      {/* FUEL TYPE */}
      {visibleFields.includes("fuel_type") && (
        <div>
          <label>Fuel Type</label>
          <input
            type="text"
            value={form.fuel_type}
            onChange={(e) =>
              handleChange("fuel_type", e.target.value)
            }
          />
        </div>
      )}

      {/* FEATURES */}
      {categoryFeatures.length > 0 && (
        <div>
          <label>Features</label>
          <div>
            {categoryFeatures.map((feature) => (
              <label key={feature} style={{ display: "block" }}>
                <input
                  type="checkbox"
                  checked={form.features.includes(feature)}
                  onChange={(e) => {
                    const updated = e.target.checked
                      ? [...form.features, feature]
                      : form.features.filter((f) => f !== feature);

                    handleChange("features", updated);
                  }}
                />
                {feature}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* STATE */}
      <div>
        <label>State *</label>
        <input
          type="text"
          value={form.state}
          onChange={(e) => handleChange("state", e.target.value)}
        />
      </div>

      {/* CITY */}
      {availableCities.length > 0 && (
        <div>
          <label>City</label>
          <select
            value={form.city}
            onChange={(e) => handleChange("city", e.target.value)}
          >
            <option value="">Select City</option>
            {availableCities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>
      )}
    </section>
  );
}