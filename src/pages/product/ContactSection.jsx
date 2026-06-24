/**
 * src/pages/product/ContactSection.jsx
 */
import { useCallback } from "react";
import { SectionDot } from "./atoms.jsx";

export default function ContactSection({
  form,
  updateContact,
  onlyDigits,
}) {
  const contactFilled = !!(form.contact?.email && form.contact?.phone);

  /* WhatsApp link sanitiser */
  const sanitizeWhatsAppLink = useCallback((val) => {
    const trimmed = val.trim();
    if (!trimmed) return "";
    try {
      const url = new URL(trimmed);
      const allowed = [
        "wa.me", "web.whatsapp.com", "api.whatsapp.com",
        "chat.whatsapp.com", "business.whatsapp.com",
      ];
      if (url.protocol !== "https:") return "";
      if (!allowed.some((h) => url.hostname.endsWith(h))) return "";
      return trimmed;
    } catch { return ""; }
  }, []);

  const handleWaLinkChange = useCallback((e) => {
    const raw  = e.target.value;
    const safe = sanitizeWhatsAppLink(raw);
    updateContact("whatsapp_link", safe || raw);
    /* Clear any previous error — will be re-set on blur if still invalid */
  }, [sanitizeWhatsAppLink, updateContact]);

  const handleWaLinkBlur = useCallback((e) => {
    const val  = e.target.value;
    const safe = sanitizeWhatsAppLink(val);
    if (val && !safe) updateContact("whatsapp_link", "");
  }, [sanitizeWhatsAppLink, updateContact]);

  return (
    <section className="section form-card">
      <h3 className="section-title">
        Contact Information <SectionDot filled={contactFilled} />
      </h3>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="ap-email">Email *</label>
          <input
            id="ap-email"
            type="email"
            value={form.contact.email}
            placeholder="your@email.com"
            onChange={(e) => updateContact("email", e.target.value)}
            autoComplete="email"
          />
        </div>

        <div className="form-group">
          <label htmlFor="ap-phone">Phone *</label>
          <input
            id="ap-phone"
            type="tel"
            value={form.contact.phone}
            placeholder="08012345678"
            onChange={(e) => updateContact("phone", onlyDigits(e.target.value))}
            maxLength={15}
            autoComplete="tel"
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="ap-wa">
            WhatsApp <span className="label-optional">(optional)</span>
          </label>
          <input
            id="ap-wa"
            type="tel"
            value={form.contact.whatsapp}
            placeholder="08012345678"
            onChange={(e) => updateContact("whatsapp", onlyDigits(e.target.value))}
            maxLength={15}
          />
        </div>

        <div className="form-group">
          <label htmlFor="ap-wa-link">
            WhatsApp Link <span className="label-optional">(optional)</span>
          </label>
          <input
            id="ap-wa-link"
            type="url"
            value={form.contact.whatsapp_link}
            placeholder="https://wa.me/2348012345678"
            onChange={handleWaLinkChange}
            onBlur={handleWaLinkBlur}
          />
        </div>
      </div>
    </section>
  );
}