/**
 * src/product/shared/ContactSection.jsx
 * Phone · WhatsApp · WhatsApp Link
 *
 * v3 — Inline field errors (from v8 useAddProduct)
 * v2 — Email removed (v5 spec)
 *      Email auto-set from user.email at registration
 *      Backend reads email from users table — never from form
 */
import { useCallback, useMemo, useState } from "react";
import { useAddProductContext } from "../../hooks/useAddProductContext.jsx";
import SectionDot from "../../pages/product/components/SectionDot.jsx";
import { WarningIcon } from "../../pages/product/components/icons/index.jsx";

export default function ContactSection({ innerRef }) {
  const {
    form,
    updateContact,
    onlyDigits,
    fieldError,   /* ✅ v8: inline field errors */
  } = useAddProductContext();

  const [waLinkError, setWaLinkError] = useState("");

  const ALLOWED_WA_HOSTS = useMemo(
    () => [
      "wa.me",
      "web.whatsapp.com",
      "api.whatsapp.com",
      "chat.whatsapp.com",
      "business.whatsapp.com",
    ],
    []
  );

  const sanitizeWaLink = useCallback(
    (val) => {
      const trimmed = val.trim();
      if (!trimmed) return "";
      try {
        const url = new URL(trimmed);
        if (url.protocol !== "https:") return "";
        const ok = ALLOWED_WA_HOSTS.some(
          (h) =>
            url.hostname === h ||
            url.hostname.endsWith(`.${h}`)
        );
        return ok ? trimmed : "";
      } catch {
        return "";
      }
    },
    [ALLOWED_WA_HOSTS]
  );

  const handleWaLinkChange = (e) => {
    setWaLinkError("");
    updateContact(
      "whatsapp_link",
      sanitizeWaLink(e.target.value) || e.target.value
    );
  };

  const handleWaLinkBlur = (e) => {
    const val  = e.target.value;
    const safe = sanitizeWaLink(val);
    if (val && !safe) {
      updateContact("whatsapp_link", "");
      setWaLinkError(
        "Invalid link — must use https://wa.me/ or similar."
      );
    } else {
      setWaLinkError("");
    }
  };

  /* ✅ v5: Only phone required — email no longer in form */
  const contactFilled = !!form.contact?.phone;

  /* Helper — checks if a specific field has an error right now */
  const hasError = (field) => fieldError?.field === field;

  return (
    <section ref={innerRef} className="section form-card">
      <h3 className="section-title">
        Contact Information <SectionDot filled={contactFilled} />
      </h3>

      {/*
        ✅ v5: Email field REMOVED
        Auto-set from user.email on registration.
        Backend reads email from users table — never appended here.
      */}

      {/* ── Phone + WhatsApp ── */}
      <div className="form-row">
        {/* PHONE */}
        <div className={`form-group ${hasError("phone") ? "has-error" : ""}`}>
          <label htmlFor="ap-phone">Phone *</label>
          <input
            id="ap-phone"
            type="tel"
            autoComplete="tel"
            maxLength={15}
            value={form.contact.phone}
            placeholder="08012345678"
            onChange={(e) =>
              updateContact("phone", onlyDigits(e.target.value))
            }
            aria-invalid={hasError("phone") || undefined}
            aria-describedby={hasError("phone") ? "ap-phone-error" : undefined}
          />
          {hasError("phone") && (
            <div id="ap-phone-error" className="field-error" role="alert">
              <WarningIcon />
              <span>{fieldError.message}</span>
            </div>
          )}
        </div>

        {/* WHATSAPP */}
        <div className={`form-group ${hasError("whatsapp") ? "has-error" : ""}`}>
          <label htmlFor="ap-wa">
            WhatsApp{" "}
            <span className="label-optional">(optional)</span>
          </label>
          <input
            id="ap-wa"
            type="tel"
            maxLength={15}
            value={form.contact.whatsapp}
            placeholder="08012345678"
            onChange={(e) =>
              updateContact("whatsapp", onlyDigits(e.target.value))
            }
            aria-invalid={hasError("whatsapp") || undefined}
            aria-describedby={hasError("whatsapp") ? "ap-wa-error" : undefined}
          />
          {hasError("whatsapp") && (
            <div id="ap-wa-error" className="field-error" role="alert">
              <WarningIcon />
              <span>{fieldError.message}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── WhatsApp link — full width ── */}
      <div className="form-group">
        <label htmlFor="ap-wa-link">
          WhatsApp Link{" "}
          <span className="label-optional">(optional)</span>
        </label>
        <input
          id="ap-wa-link"
          type="url"
          value={form.contact.whatsapp_link}
          placeholder="https://wa.me/2348012345678"
          onChange={handleWaLinkChange}
          onBlur={handleWaLinkBlur}
          aria-invalid={!!waLinkError || undefined}
        />
        {waLinkError && (
          <div className="field-error" role="alert">
            <WarningIcon />
            <span>{waLinkError}</span>
          </div>
        )}
      </div>
    </section>
  );
}