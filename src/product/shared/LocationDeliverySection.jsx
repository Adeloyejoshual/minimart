/**
 * src/product/shared/LocationDeliverySection.jsx
 * State · City · GPS · Delivery
 *
 * v2 — Fixed dropdown z-index for desktop 2-column layout
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useAddProductContext } from "../../hooks/useAddProductContext.jsx";
import DropdownModal from "../../components/DropdownModal.jsx";
import SectionDot from "../../pages/product/components/SectionDot.jsx";
import CharCounter from "../../pages/product/components/CharCounter.jsx";
import {
  WarningIcon,
  SpinnerIcon,
  LocationPinIcon,
} from "../../pages/product/components/icons/index.jsx";

export default function LocationDeliverySection({ innerRef }) {
  const {
    form,
    updateDelivery,
    updateDeliveryDuration,
    state,
    setState,
    city,
    setCity,
    states,
    cities,
    detectLocation,
    detectingLocation,
    detectedCoords,
    displayPrice,
    onlyNumbers,
  } = useAddProductContext();

  const [deliveryRangeError, setDeliveryRangeError] = useState("");
  const deliveryDurationRef = useRef(
    form.delivery?.duration ?? { from: "", to: "" }
  );

  useEffect(() => {
    deliveryDurationRef.current =
      form.delivery?.duration ?? { from: "", to: "" };
  }, [form.delivery?.duration]);

  const clampDay = useCallback((val) => {
    const n = parseInt(String(val).replace(/[^0-9]/g, ""), 10);
    if (Number.isNaN(n) || n < 1) return "";
    return String(Math.min(n, 30));
  }, []);

  const handleDeliveryDuration = (key, val) => {
    updateDeliveryDuration(key, val);
    const current = deliveryDurationRef.current;
    const from = Number(key === "from" ? val : current.from);
    const to = Number(key === "to" ? val : current.to);
    setDeliveryRangeError(
      from && to && to < from
        ? "End day must be equal to or after start day."
        : ""
    );
  };

  const locationFilled = !!(state && city);

  return (
    <section ref={innerRef} className="section form-card">
      <h3 className="section-title">
        Location &amp; Delivery{" "}
        <SectionDot filled={locationFilled} />
      </h3>

      {detectLocation && (
        <div className="detect-location-row">
          <button
            type="button"
            className="detect-location-btn"
            onClick={detectLocation}
            disabled={detectingLocation}
          >
            {detectingLocation ? (
              <>
                <SpinnerIcon /> Detecting location&#8230;
              </>
            ) : (
              <>
                <LocationPinIcon />
                {detectedCoords
                  ? "Location detected ✓"
                  : "Detect my location"}
              </>
            )}
          </button>
        </div>
      )}

      {/* ✅ Wrapper with high z-index so dropdowns aren't
          blocked by the desktop sticky right panel */}
      <div className="form-row ap-location-row">
        <div className="form-group ap-dropdown-container">
          <label>State *</label>
          <DropdownModal
            value={state}
            onChange={(val) => {
              setState(val);
              /* Reset city when state changes */
              if (val !== state) setCity("");
            }}
            options={states.map((s) => ({ id: s, name: s }))}
            placeholder="Select state"
          />
        </div>
        {state && (
          <div className="form-group ap-dropdown-container">
            <label>City *</label>
            <DropdownModal
              value={city}
              onChange={setCity}
              options={cities.map((c) => ({ id: c, name: c }))}
              placeholder="Select city"
            />
          </div>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="ap-delivery-toggle">
          Delivery Available
        </label>
        <label className="toggle-switch">
          <input
            id="ap-delivery-toggle"
            type="checkbox"
            checked={form.delivery.available}
            onChange={(e) =>
              updateDelivery("available", e.target.checked)
            }
          />
          <span className="slider" />
          <span
            className={`toggle-status${
              form.delivery.available ? " toggle-status--on" : ""
            }`}
          >
            {form.delivery.available
              ? "Yes — delivery available"
              : "No delivery"}
          </span>
        </label>
      </div>

      {form.delivery.available && (
        <div className="delivery-grid">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="ap-del-from">From Day *</label>
              <input
                id="ap-del-from"
                type="number"
                min="1"
                max="30"
                value={form.delivery.duration.from}
                onChange={(e) =>
                  handleDeliveryDuration(
                    "from",
                    clampDay(e.target.value)
                  )
                }
              />
            </div>
            <div className="form-group">
              <label htmlFor="ap-del-to">To Day *</label>
              <input
                id="ap-del-to"
                type="number"
                min="1"
                max="30"
                value={form.delivery.duration.to}
                onChange={(e) =>
                  handleDeliveryDuration(
                    "to",
                    clampDay(e.target.value)
                  )
                }
              />
            </div>
          </div>

          {deliveryRangeError && (
            <div
              className="form-error"
              role="alert"
              style={{ marginBottom: 10 }}
            >
              <WarningIcon /> {deliveryRangeError}
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="ap-del-fee">Fee (&#8358;) *</label>
              <input
                id="ap-del-fee"
                type="text"
                inputMode="numeric"
                value={displayPrice(form.delivery.fee)}
                onChange={(e) =>
                  updateDelivery("fee", onlyNumbers(e.target.value))
                }
              />
            </div>
            <div className="form-group">
              <label htmlFor="ap-del-note">
                Delivery Note{" "}
                <span className="label-optional">(optional)</span>
              </label>
              <textarea
                id="ap-del-note"
                rows={2}
                value={form.delivery.note}
                onChange={(e) =>
                  updateDelivery("note", e.target.value)
                }
                maxLength={200}
              />
              <div className="field-footer">
                <span />
                <CharCounter value={form.delivery.note} max={200} />
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}