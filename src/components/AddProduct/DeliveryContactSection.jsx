// src/components/AddProduct/DeliveryContactSection.jsx
import React from "react";

export default function DeliveryContactSection({
  form,
  handleChange,
  ui
}) {
  return (
    <section style={{ marginBottom: "2rem" }}>
      <h2>🚚 Delivery & Contact</h2>

      {/* DELIVERY OPTIONS */}
      <div>
        <label>Delivery Option *</label>
        <select
          value={form.delivery_option}
          onChange={(e) =>
            handleChange("delivery_option", e.target.value)
          }
        >
          <option value="">Select delivery option</option>
          <option value="pickup">Pickup</option>
          <option value="delivery">Delivery</option>
          <option value="both">Pickup & Delivery</option>
        </select>

        {ui.errors?.delivery_option && (
          <small style={{ color: "red" }}>
            {ui.errors.delivery_option}
          </small>
        )}
      </div>

      {/* DELIVERY FEE */}
      {form.delivery_option === "delivery" ||
      form.delivery_option === "both" ? (
        <div style={{ marginTop: "1rem" }}>
          <label>Delivery Fee</label>
          <input
            type="number"
            value={form.delivery_fee}
            onChange={(e) =>
              handleChange("delivery_fee", e.target.value)
            }
            placeholder="Enter delivery fee"
          />
        </div>
      ) : null}

      {/* LOCATION */}
      <div style={{ marginTop: "1rem" }}>
        <label>Location *</label>
        <input
          type="text"
          value={form.location}
          onChange={(e) =>
            handleChange("location", e.target.value)
          }
          placeholder="Enter your location"
        />

        {ui.errors?.location && (
          <small style={{ color: "red" }}>
            {ui.errors.location}
          </small>
        )}
      </div>

      {/* CONTACT PHONE */}
      <div style={{ marginTop: "1rem" }}>
        <label>Contact Phone *</label>
        <input
          type="tel"
          value={form.contact_phone}
          onChange={(e) =>
            handleChange("contact_phone", e.target.value)
          }
          placeholder="Enter contact number"
        />

        {ui.errors?.contact_phone && (
          <small style={{ color: "red" }}>
            {ui.errors.contact_phone}
          </small>
        )}
      </div>

      {/* WHATSAPP OPTION */}
      <div style={{ marginTop: "1rem" }}>
        <label>
          <input
            type="checkbox"
            checked={form.whatsapp_available}
            onChange={(e) =>
              handleChange(
                "whatsapp_available",
                e.target.checked
              )
            }
          />
          Available on WhatsApp
        </label>
      </div>
    </section>
  );
}