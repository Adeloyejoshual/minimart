// src/desktop/components/StickyContactPanel.tsx

import { memo } from "react";
import type { Product, Seller } from "../../hooks/useProductDetail";

const formatNaira = (n: number | undefined): string =>
  "₦" + Number(n || 0).toLocaleString("en-NG");

interface StickyContactPanelProps {
  product:    Product;
  seller:     Seller | null;
  fav:        boolean;
  isOwn:      boolean;
  chatBusy:   boolean;
  onToggleFav:  () => void;
  onChat:       () => void;
  onWhatsApp:   () => void;
  onCall:       () => void;
  onEditListing?: () => void;
}

export const StickyContactPanel = memo(function StickyContactPanel({
  product,
  seller,
  fav,
  isOwn,
  chatBusy,
  onToggleFav,
  onChat,
  onWhatsApp,
  onCall,
  onEditListing,
}: StickyContactPanelProps) {
  const waNumber  = product.whatsapp || product.contact?.whatsapp;
  const waLink    = product.whatsapp_link || product.contact?.whatsapp_link;
  const phone     = product.phone || product.contact?.phone;
  const hasWA     = !!(waNumber || waLink);
  const hasPhone  = !!phone;

  return (
    <aside className="pdd-sticky-panel" aria-label="Purchase panel">

      {/* Price */}
      <div className="pdd-panel-price" aria-label={`Price: ${formatNaira(product.price)}`}>
        {formatNaira(product.price)}
      </div>

      {/* Condition + Location */}
      <div className="pdd-panel-meta">
        {product.condition && (
          <span className="pdd-meta-chip">{product.condition}</span>
        )}
        {(product.location_city || product.location?.city) && (
          <span className="pdd-meta-chip pdd-meta-chip--loc">
            📍 {product.location_city || product.location?.city}
          </span>
        )}
      </div>

      {/* Seller mini-summary */}
      {seller && (
        <div className="pdd-panel-seller">
          <div className="pdd-panel-seller-avatar" aria-hidden="true">
            {seller.profile_image || seller.store_logo ? (
              <img
                src={seller.profile_image || seller.store_logo}
                alt={seller.store_name || seller.name}
              />
            ) : (
              <span>{(seller.store_name || seller.name || "S").charAt(0).toUpperCase()}</span>
            )}
            {seller.is_online && <span className="pdd-online-dot" aria-label="Seller is online" />}
          </div>
          <div>
            <p className="pdd-panel-seller-name">
              {seller.store_name || seller.name || "Seller"}
            </p>
            {seller.verified && (
              <p className="pdd-panel-seller-verified" aria-label="Verified seller">
                ✔ Verified Seller
              </p>
            )}
          </div>
        </div>
      )}

      {/* Divider */}
      <hr className="pdd-panel-divider" />

      {/* Action buttons */}
      {isOwn ? (
        <button
          className="pdd-btn pdd-btn--edit"
          onClick={onEditListing}
          aria-label="Edit this listing"
        >
          ✏️ Edit Listing
        </button>
      ) : (
        <div className="pdd-panel-actions" role="group" aria-label="Contact seller">

          {/* Chat */}
          {product.seller_id && (
            <button
              className="pdd-btn pdd-btn--chat"
              onClick={onChat}
              disabled={chatBusy}
              aria-busy={chatBusy}
              aria-label={chatBusy ? "Opening chat…" : "Chat with seller"}
            >
              {chatBusy ? (
                <span className="pdd-spinner" aria-hidden="true" />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              )}
              {chatBusy ? "Opening…" : "Chat with Seller"}
            </button>
          )}

          {/* WhatsApp */}
          {hasWA && (
            <button
              className="pdd-btn pdd-btn--whatsapp"
              onClick={onWhatsApp}
              aria-label="Contact seller on WhatsApp"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.533 5.857L.057 23.571l5.89-1.548A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.028-1.378l-.36-.215-3.734.98 1.001-3.654-.235-.374A9.818 9.818 0 012.182 12C2.182 6.562 6.562 2.182 12 2.182S21.818 6.562 21.818 12 17.438 21.818 12 21.818z" />
              </svg>
              WhatsApp
            </button>
          )}

          {/* Call */}
          {hasPhone && (
            <button
              className="pdd-btn pdd-btn--call"
              onClick={onCall}
              aria-label={`Call seller at ${phone}`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.59 1.2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21.73 16z" />
              </svg>
              Call Seller
            </button>
          )}
        </div>
      )}

      {/* Favourite */}
      <button
        className={`pdd-fav-btn${fav ? " pdd-fav-btn--active" : ""}`}
        onClick={onToggleFav}
        aria-label={fav ? "Remove from favourites" : "Add to favourites"}
        aria-pressed={fav}
      >
        <svg width="18" height="18" viewBox="0 0 24 24"
          fill={fav ? "currentColor" : "none"}
          stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
        {fav ? "Saved" : "Save Listing"}
      </button>

      {/* Safety notice */}
      <p className="pdd-panel-safety">
        🛡️ Always meet in a public place and inspect before paying.
      </p>
    </aside>
  );
});