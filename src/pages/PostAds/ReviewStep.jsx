/**
 * src/pages/PostAds/ReviewStep.jsx
 *
 * Step 5 — Review & Submit
 * - Full listing preview
 * - Image thumbnails strip
 * - Variants, features, specs, box items
 * - Upload progress bar
 * - Prohibited content warning
 * - Edit shortcuts back to each step
 * - Last saved indicator
 */

import { memo, useCallback } from "react";

/* ══════════════════════════════════════════════════════════════
   SVG ICONS
══════════════════════════════════════════════════════════════ */
const IconPackage = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <line x1="16.5" y1="9.4"  x2="7.5"  y2="4.21" />
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8
             a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

const IconEdit = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const IconCheck = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconAlertTriangle = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94
             a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9"  x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const IconImage = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);

const IconTag = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
);

const IconLayers = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </svg>
);

const IconList = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <line x1="8"  y1="6"  x2="21" y2="6"  />
    <line x1="8"  y1="12" x2="21" y2="12" />
    <line x1="8"  y1="18" x2="21" y2="18" />
    <line x1="3"  y1="6"  x2="3.01" y2="6"  />
    <line x1="3"  y1="12" x2="3.01" y2="12" />
    <line x1="3"  y1="18" x2="3.01" y2="18" />
  </svg>
);

const IconBox = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8
             a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

const IconGrid = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <rect x="3"  y="3"  width="7" height="7" />
    <rect x="14" y="3"  width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3"  y="14" width="7" height="7" />
  </svg>
);

const IconSend = ({ size = 17 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <line x1="22" y1="2"  x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const IconClock = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const IconShield = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */
const fmt = (n) => Number(n || 0).toLocaleString("en-NG");

function timeAgo(ts) {
  if (!ts) return null;
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 10)  return "just now";
  if (diff < 60)  return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

/* ══════════════════════════════════════════════════════════════
   SECTION HEADER with edit button
══════════════════════════════════════════════════════════════ */
const SectionHead = memo(({ icon: Icon, label, step }) => {
  const handleEdit = useCallback(() => {
    window.dispatchEvent(new CustomEvent("pa-edit-step", { detail: step }));
  }, [step]);

  return (
    <div className="rv-section-head">
      <span className="rv-section-icon">
        <Icon size={13} />
      </span>
      <h3 className="rv-section-title">{label}</h3>
      <button
        type="button"
        className="rv-edit-btn"
        onClick={handleEdit}
        aria-label={`Edit ${label}`}
      >
        <IconEdit size={13} />
        <span>Edit</span>
      </button>
    </div>
  );
});

SectionHead.displayName = "SectionHead";

/* ══════════════════════════════════════════════════════════════
   REVIEW STEP
══════════════════════════════════════════════════════════════ */
export default function ReviewStep({
  filledImages,
  title,
  brand,
  tags,
  basePrice,
  originalPrice,
  discountPct,
  description,
  category,
  activeCategory,
  variants,
  keyFeatures,
  specifications,
  whatsInBox,
  posting,
  uploadPct,
  onSubmit,
  lastSaved,
  prohibitedResult,
  scanDone,
}) {
  const base      = Number(basePrice)     || 0;
  const original  = Number(originalPrice) || 0;
  const hasFilled = (arr) => arr?.some?.((x) =>
    typeof x === "string" ? x.trim() : x?.key?.trim()
  );

  const validVariants = variants?.filter((v) => v.sku?.trim() && v.name?.trim()) ?? [];

  /* ── Prohibited warning ── */
  const showProhibited =
    scanDone &&
    prohibitedResult?.blocked?.length > 0;

  return (
    <div className="rv-wrap">

      {/* ── Prohibited warning ── */}
      {showProhibited && (
        <div className="rv-prohibited" role="alert" aria-live="assertive">
          <IconAlertTriangle size={16} />
          <div className="rv-prohibited-body">
            <strong>Prohibited content detected.</strong>
            {" "}Go back to Details and remove the flagged terms before submitting.
          </div>
        </div>
      )}

      {/* ── Cover image + title card ── */}
      <div className="rv-hero">
        <div className="rv-cover">
          {filledImages[0] ? (
            <img
              src={filledImages[0].preview}
              alt="Cover photo"
              className="rv-cover-img"
            />
          ) : (
            <div className="rv-cover-placeholder" aria-label="No cover photo">
              <IconImage size={32} />
            </div>
          )}
          {/* Photo count badge */}
          {filledImages.length > 1 && (
            <span className="rv-photo-count" aria-label={`${filledImages.length} photos`}>
              +{filledImages.length - 1}
            </span>
          )}
        </div>

        <div className="rv-hero-body">
          <h2 className="rv-title">{title || "—"}</h2>

          {brand && (
            <p className="rv-brand">{brand}</p>
          )}

          {/* Price row */}
          <div className="rv-price-row">
            <span className="rv-price">
              ₦{fmt(base)}
            </span>
            {original > 0 && original > base && (
              <span className="rv-price-original" aria-label="Original price">
                ₦{fmt(original)}
              </span>
            )}
            {discountPct > 0 && (
              <span className="rv-discount-badge" aria-label={`${discountPct} percent off`}>
                -{discountPct}%
              </span>
            )}
          </div>

          {/* Category + tags row */}
          <div className="rv-pills">
            {activeCategory && (
              <span className="rv-pill rv-pill--cat">
                {activeCategory.name}
              </span>
            )}
            {tags?.map((t) => (
              <span key={t} className="rv-pill">
                <IconTag size={11} />
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Thumbnail strip ── */}
      {filledImages.length > 1 && (
        <div className="rv-thumbs" role="list" aria-label="All photos">
          {filledImages.map((img, i) => (
            <div key={i} className="rv-thumb" role="listitem">
              <img
                src={img.preview}
                alt={`Photo ${i + 1}`}
                className="rv-thumb-img"
              />
              {i === 0 && (
                <span className="rv-thumb-cover" aria-label="Cover photo">
                  Cover
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Description ── */}
      {description && (
        <div className="rv-section">
          <SectionHead icon={IconList} label="Description" step={2} />
          <p className="rv-description">
            {description.slice(0, 200)}
            {description.length > 200 && (
              <span className="rv-description-more"> …</span>
            )}
          </p>
        </div>
      )}

      {/* ── Variants ── */}
      {validVariants.length > 0 && (
        <div className="rv-section">
          <SectionHead icon={IconLayers} label="Variants" step={3} />
          <div className="rv-variant-list" role="list">
            {validVariants.map((v) => (
              <div key={v.id} className="rv-variant-row" role="listitem">
                <div className="rv-variant-left">
                  <span className="rv-variant-name">{v.name}</span>
                  <span className="rv-variant-sku">{v.sku}</span>
                </div>
                <div className="rv-variant-right">
                  <span className="rv-variant-price">
                    ₦{fmt(v.price)}
                  </span>
                  <span className="rv-variant-stock">
                    {v.stock} in stock
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Key Features ── */}
      {hasFilled(keyFeatures) && (
        <div className="rv-section">
          <SectionHead icon={IconCheck} label="Key Features" step={2} />
          <ul className="rv-list" role="list">
            {keyFeatures
              .filter((f) => f.trim())
              .map((f, i) => (
                <li key={i} className="rv-list-item">
                  <span className="rv-list-bullet" aria-hidden="true">
                    <IconCheck size={11} />
                  </span>
                  {f}
                </li>
              ))}
          </ul>
        </div>
      )}

      {/* ── Specifications ── */}
      {specifications?.some((r) => r.key?.trim() && r.value?.trim()) && (
        <div className="rv-section">
          <SectionHead icon={IconGrid} label="Specifications" step={2} />
          <table className="rv-spec-table" aria-label="Product specifications">
            <tbody>
              {specifications
                .filter((r) => r.key?.trim() && r.value?.trim())
                .map((r, i) => (
                  <tr key={i}>
                    <td className="rv-spec-key">{r.key}</td>
                    <td className="rv-spec-val">{r.value}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── What's in the Box ── */}
      {hasFilled(whatsInBox) && (
        <div className="rv-section">
          <SectionHead icon={IconBox} label="What's in the Box" step={2} />
          <ul className="rv-list" role="list">
            {whatsInBox
              .filter((f) => f.trim())
              .map((f, i) => (
                <li key={i} className="rv-list-item">
                  <span className="rv-list-bullet" aria-hidden="true">
                    <IconCheck size={11} />
                  </span>
                  {f}
                </li>
              ))}
          </ul>
        </div>
      )}

      {/* ── Trust note ── */}
      <div className="rv-trust" role="note">
        <IconShield size={15} />
        <span>
          Your listing will be reviewed before going live.
          You will be notified once it is approved.
        </span>
      </div>

      {/* ── Last saved ── */}
      {lastSaved && (
        <p className="rv-last-saved" aria-live="polite">
          <IconClock size={12} />
          <span>Draft saved {timeAgo(lastSaved)}</span>
        </p>
      )}

      {/* ── Upload progress ── */}
      {posting && uploadPct > 0 && uploadPct < 100 && (
        <div className="rv-progress" role="progressbar"
          aria-valuenow={uploadPct} aria-valuemin={0} aria-valuemax={100}
          aria-label={`Uploading — ${uploadPct}%`}>
          <div className="rv-progress-track">
            <div
              className="rv-progress-fill"
              style={{ width: `${uploadPct}%` }}
            />
          </div>
          <span className="rv-progress-label">{uploadPct}%</span>
        </div>
      )}

      {/* ── Submit button ── */}
      <button
        type="button"
        className={`rv-submit${posting ? " rv-submit--posting" : ""}${showProhibited ? " rv-submit--blocked" : ""}`}
        disabled={posting || showProhibited}
        onClick={onSubmit}
        aria-label={posting ? `Uploading — ${uploadPct}%` : "Submit listing for review"}
        aria-busy={posting}
      >
        {posting ? (
          <>
            <span className="rv-submit-spinner" aria-hidden="true" />
            <span>
              {uploadPct > 0 && uploadPct < 100
                ? `Uploading — ${uploadPct}%`
                : "Submitting..."}
            </span>
          </>
        ) : (
          <>
            <IconSend size={17} />
            <span>Submit Listing</span>
          </>
        )}
      </button>

    </div>
  );
}