/**
 * src/product/shared/ContactSection.jsx
 * Email · Phone · WhatsApp · WhatsApp Link
 */
import { useCallback, useMemo, useState } from "react";
import { useAddProductContext } from "../../hooks/useAddProductContext.js";
import SectionDot from "../components/SectionDot.jsx";

export default function ContactSection({ innerRef }) {
  const {
    form, updateContact, onlyDigits,
  } = useAddProductContext();

  const [waLinkError, setWaLinkError] = useState("");

  const ALLOWED_WA_HOSTS = useMemo(() => [
    "wa.me", "web.whatsapp.com", "api.whatsapp.com",
    "chat.whatsapp.com", "business.whatsapp.com",
  ], []);

  const sanitizeWaLink = useCallback((val) => {
    const trimmed = val.trim();
    if (!trimmed) return "";
    try {
      const url = new URL(trimmed);
      if (url.protocol !== "https:") return "";
      const ok = ALLOWED_WA_HOSTS.some(
        (h) => url.hostname === h || url.hostname.endsWith(`.${h}`)
      );
      return ok ? trimmed : "";
    } catch { return ""; }
  }, [ALLOWED_WA_HOSTS]);

  const handleWaLinkChange = (e) => {
    setWaLinkError("");
    updateContact("whatsapp_link", sanitizeWaLink(e.target.value) || e.target.value);
  };

  const handleWaLinkBlur = (e) => {
    const val = e.target.value;
    const safe = sanitizeWaLink(val);
    if (val && !safe) {
      updateContact("whatsapp_link", "");
      setWaLinkError("Invalid link — must use https://wa.me/ or similar.");
    } else {
      setWaLinkError("");
    }
  };

  const contactFilled = !!(form.contact?.email && form.contact?.phone);

  return (
    <section ref={innerRef} className="section form-card">
      <h3 className="section-title">
        Contact Information <SectionDot filled={contactFilled} />
      </h3>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="ap-email">Email *</label>
          <input id="ap-email" type="email" autoComplete="email"
                 value={form.contact.email} placeholder="your@email.com"
                 onChange={(e) => updateContact("email", e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="ap-phone">Phone *</label>
          <input id="ap-phone" type="tel" autoComplete="tel" maxLength={15}
                 value={form.contact.phone} placeholder="08012345678"
                 onChange={(e) => updateContact("phone", onlyDigits(e.target.value))} />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="ap-wa">
            WhatsApp <span className="label-optional">(optional)</span>
          </label>
          <input id="ap-wa" type="tel" maxLength={15}
                 value={form.contact.whatsapp} placeholder="08012345678"
                 onChange={(e) => updateContact("whatsapp", onlyDigits(e.target.value))} />
        </div>
        <div className="form-group">
          <label htmlFor="ap-wa-link">
            WhatsApp Link <span className="label-optional">(optional)</span>
          </label>
          <input id="ap-wa-link" type="url"
                 value={form.contact.whatsapp_link}
                 placeholder="https://wa.me/2348012345678"
                 onChange={handleWaLinkChange}
                 onBlur={handleWaLinkBlur} />
          {waLinkError && (
            <small className="field-hint field-hint--error">{waLinkError}</small>
          )}
        </div>
      </div>
    </section>
  );
}