/**
 * src/pages/ProductDetail/ContactStrip.jsx
 *
 * Chat · WhatsApp · Call contact buttons
 */

export default function ContactStrip({
  product,
  userId,
  isOwn,
  chatBusy,
  onChat,
  onWhatsApp,
  onCall,
}) {
  const waNumber =
    product?.whatsapp || product?.contact?.whatsapp;
  const waLink =
    product?.whatsapp_link || product?.contact?.whatsapp_link;
  const phone = product?.phone || product?.contact?.phone;
  const hasContact = !!(
    waNumber ||
    waLink ||
    phone ||
    product?.seller_id
  );

  if (!hasContact || isOwn) return null;

  return (
    <div className="pd-contact-strip">
      {/* Chat */}
      {product.seller_id && (
        <button
          className="pd-btn pd-btn--chat"
          onClick={onChat}
          disabled={chatBusy}
        >
          {chatBusy ? (
            <span className="pd-spinner" />
          ) : (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          )}
          {chatBusy ? "Opening…" : "Chat"}
        </button>
      )}

      {/* WhatsApp */}
      {(waNumber || waLink) && (
        <button
          className="pd-btn pd-btn--whatsapp"
          onClick={onWhatsApp}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.533 5.857L.057 23.571l5.89-1.548A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.028-1.378l-.36-.215-3.734.98 1.001-3.654-.235-.374A9.818 9.818 0 012.182 12C2.182 6.562 6.562 2.182 12 2.182S21.818 6.562 21.818 12 17.438 21.818 12 21.818z" />
          </svg>
          WhatsApp
        </button>
      )}

      {/* Call */}
      {phone && (
        <button
          className="pd-btn pd-btn--call"
          onClick={onCall}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          >
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.59 1.2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21.73 16z" />
          </svg>
          Call
        </button>
      )}
    </div>
  );
}