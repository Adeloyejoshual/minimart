/**
 * src/pages/product/LocationSection.jsx
 */
import { useCallback } from "react";
import DropdownModal from "../../components/DropdownModal.jsx";
import { SectionDot, SpinnerIcon, LocationPinIcon, WarningIcon } from "./atoms.jsx";
import { CharCounter } from "./atoms.jsx";

export default function LocationSection({
  form,
  state,
  city,
  states        = [],
  cities        = [],
  detectedCoords,
  detectingLocation,
  detectLocation,
  setState,
  setCity,
  updateDelivery,
  updateDeliveryDuration,
  onlyNumbers,
  displayPrice,
  /* delivery range error — owned here, reported to parent */
  deliveryRangeError,
  onDeliveryRangeError,
}) {
  const locationFilled = !!(state && city);

  const clampDay = useCallback((val) => {
    const n = parseInt(String(val).replace(/[^0-9]/g, ""), 10);
    if (Number.isNaN(n) || n < 1) return "";
    if (n > 30) return "30";
    return String(n);
  }, []);

  const handleDuration = useCallback((key, val) => {
    updateDeliveryDuration(key, val);
    const from = Number(key === "from" ? val : form.delivery.duration.from);
    const to   = Number(key === "to"   ? val : form.delivery.duration.to);
    if (from && to && to < from) {
      onDeliveryRangeError("End day must be equal to or after start day.");
    } else {
      onDeliveryRangeError("");
    }
  }, [updateDeliveryDuration, form.delivery.duration, onDeliveryRangeError]);

  return (
    <section className="section form-card">
      <h3 className="section-title">
        Location &amp; Delivery <SectionDot filled={locationFilled} />
      </h3>

      {/* GPS detect button — no static hint */}
      {detectLocation && (
        <div className="detect-location-row">
          <button
            type="button"
            className="detect-location-btn"
            onClick={detectLocation}
            disabled={detectingLocation}
          >
            {detectingLocation ? (
              <><SpinnerIcon /> Detecting location&#8230;</>
            ) : (
              <><LocationPinIcon />
                {detectedCoords ? "Location detected ✓" : "Detect my location"}
              </>
            )}
          </button>
        </div>
      )}

      {/* State / City */}
      <div className="form-row">
        <div className="form-group">
          <label>State *</label>
          <DropdownModal
            value={state}
            onChange={setState}
            options={states.map((s) => ({ id: s, name: s }))}
            placeholder="Select state"
          />
        </div>
        {state && (
          <div className="form-group">
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

      {/* Delivery toggle */}
      <div className="form-group">
        <label htmlFor="ap-delivery-toggle">Delivery Available</label>
        <label className="toggle-switch">
          <input
            id="ap-delivery-toggle"
            type="checkbox"
            checked={form.delivery.available}
            onChange={(e) => updateDelivery("available", e.target.checked)}
          />
          <span className="slider" />
          <span className={`toggle-status${form.delivery.available ? " toggle-status--on" : ""}`}>
            {form.delivery.available ? "Yes — delivery available" : "No delivery"}
          </span>
        </label>
      </div>

      {/* Delivery details */}
      {form.delivery.available && (
        <div className="delivery-grid">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="ap-del-from">From Day *</label>
              <input
                id="ap-del-from"
                type="number" min="1" max="30"
                value={form.delivery.duration.from}
                onChange={(e) => handleDuration("from", clampDay(e.target.value))}
              />
            </div>
            <div className="form-group">
              <label htmlFor="ap-del-to">To Day *</label>
              <input
                id="ap-del-to"
                type="number" min="1" max="30"
                value={form.delivery.duration.to}
                onChange={(e) => handleDuration("to", clampDay(e.target.value))}
              />
            </div>
          </div>

          {deliveryRangeError && (
            <div className="form-error" role="alert" style={{ marginBottom: 10 }}>
              <WarningIcon /> {deliveryRangeError}
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="ap-del-fee">Fee (&#8358;) *</label>
              <input
                id="ap-del-fee"
                type="text" inputMode="numeric"
                value={displayPrice(form.delivery.fee)}
                onChange={(e) => updateDelivery("fee", onlyNumbers(e.target.value))}
              />
              {form.delivery.fee && Number(form.delivery.fee) > 0 && (
                <small className="field-hint field-hint--price">
                  &#8358;{displayPrice(form.delivery.fee)} NGN
                </small>
              )}
            </div>
            <div className="form-group">
              <label htmlFor="ap-del-note">
                Delivery Note <span className="label-optional">(optional)</span>
              </label>
              <textarea
                id="ap-del-note"
                rows={2}
                value={form.delivery.note}
                onChange={(e) => updateDelivery("note", e.target.value)}
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