/**
 * src/desktop/components/ListingPreview.tsx
 * Live preview of the listing as buyers will see it.
 * Reads from useAddProductContext.
 */
import { useAddProductContext } from "../../hooks/useAddProductContext.js";
import { LocationPinIcon } from "../../product/components/icons/index.jsx";
import "./ListingPreview.css";

export default function ListingPreview() {
  const {
    form, images, existingImages,
    state, city,
    displayPrice, user,
  } = useAddProductContext();

  /* Merge existing + new images for preview */
  const previewImages = [
    ...(existingImages ?? []).map((img: any) => img.url),
    ...(images ?? []).map((img: any) => img.preview),
  ];

  const mainImage = previewImages[0];
  const hasImages = previewImages.length > 0;

  return (
    <div className="listing-preview">
      <div className="listing-preview-header">
        <h3 className="listing-preview-title">Live Preview</h3>
        <span className="listing-preview-badge">as buyers see it</span>
      </div>

      <div className="listing-preview-card">
        {/* Main image */}
        <div className="preview-image-wrap">
          {hasImages ? (
            <>
              <img
                src={mainImage}
                alt="Product preview"
                className="preview-main-image"
                loading="lazy"
              />
              {previewImages.length > 1 && (
                <div className="preview-thumbs">
                  {previewImages.slice(1, 5).map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      alt={`Thumbnail ${i + 2}`}
                      className="preview-thumb-img"
                      loading="lazy"
                    />
                  ))}
                  {previewImages.length > 5 && (
                    <div className="preview-thumb-more">
                      +{previewImages.length - 5}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="preview-image-placeholder">
              <span>📷</span>
              <p>Add images to see preview</p>
            </div>
          )}
        </div>

        {/* Title */}
        <div className="preview-title-row">
          {form.title ? (
            <h4 className="preview-title">{form.title}</h4>
          ) : (
            <h4 className="preview-title preview-empty">Your product title…</h4>
          )}
        </div>

        {/* Price */}
        <div className="preview-price-row">
          {form.price && Number(form.price) > 0 ? (
            <span className="preview-price">
              &#8358;{displayPrice(form.price)}
            </span>
          ) : (
            <span className="preview-price preview-empty">&#8358;0</span>
          )}
        </div>

        {/* Location */}
        {(state || city) && (
          <div className="preview-location">
            <LocationPinIcon />
            <span>
              {[city, state].filter(Boolean).join(", ") || "Location…"}
            </span>
          </div>
        )}

        {/* Description */}
        <div className="preview-description">
          {form.description ? (
            <p>{form.description}</p>
          ) : (
            <p className="preview-empty">Your description will appear here…</p>
          )}
        </div>

        {/* Seller info */}
        <div className="preview-seller">
          <div className="preview-seller-avatar">
            {(user?.store_name || user?.name || "S")[0].toUpperCase()}
          </div>
          <div className="preview-seller-info">
            <strong>{user?.store_name || user?.name || "Your Store"}</strong>
            <small>Seller</small>
          </div>
        </div>

        {/* Delivery */}
        {form.delivery?.available && (
          <div className="preview-delivery">
            <span className="preview-delivery-badge">
              🚚 Delivery available
              {form.delivery.fee && Number(form.delivery.fee) > 0 &&
                ` · ₦${displayPrice(form.delivery.fee)}`}
            </span>
            {form.delivery.duration?.from && form.delivery.duration?.to && (
              <small>
                {form.delivery.duration.from}–{form.delivery.duration.to} days
              </small>
            )}
          </div>
        )}
      </div>
    </div>
  );
}