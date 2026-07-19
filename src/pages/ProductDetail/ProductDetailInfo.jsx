import { memo, useMemo } from "react";
import "./ProductDetailInfo.css";

const fmt = (n) =>
  Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 0 });

const compactNum = (n) => {
  const num = Number(n) || 0;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return String(num);
};

const timeAgo = (d) => {
  if (!d) return null;
  const diff = Math.max(0, Date.now() - new Date(d).getTime());
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  const w = Math.floor(days / 7);
  const mo = Math.floor(days / 30);

  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (days < 7) return `${days}d ago`;
  if (w < 5) return `${w}w ago`;
  return `${mo}mo ago`;
};

const IconChevronRight = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <path d="M9 18l6-6-6-6" />
  </svg>
);

const IconEye = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconHeart = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

const IconStar = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const IconClock = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </svg>
);

const IconTag = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
);

const IconAward = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="8" r="7" />
    <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
  </svg>
);

const IconSmartphone = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
    <line x1="12" y1="18" x2="12.01" y2="18" />
  </svg>
);

const IconMapPin = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const IconFolder = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

function ProductDetailInfo({ product }) {
  if (!product) return null;

  const symbol = (product.currency || "NGN") === "NGN" ? "₦" : product.currency;
  const posted = timeAgo(product.created_at);

  const metaItems = useMemo(
    () =>
      [
        product.condition && {
          label: "Condition",
          value: product.condition,
          Icon: IconTag,
        },
        product.brand && {
          label: "Brand",
          value: product.brand,
          Icon: IconAward,
        },
        product.model && {
          label: "Model",
          value: product.model,
          Icon: IconSmartphone,
        },
        (product.location_city || product.location_state) && {
          label: "Location",
          value: [product.location_city, product.location_state]
            .filter(Boolean)
            .join(", "),
          Icon: IconMapPin,
        },
        product.category_name && {
          label: "Category",
          value: product.subcategory_name
            ? `${product.category_name} › ${product.subcategory_name}`
            : product.category_name,
          Icon: IconFolder,
        },
      ].filter(Boolean),
    [product]
  );

  const hasEngagement =
    product.views > 0 ||
    product.favorites_count > 0 ||
    product.average_rating > 0 ||
    !!posted;

  return (
    <div className="pdi">
      {product.category_name && (
        <nav className="pdi-breadcrumb" aria-label="Category">
          <span className="pdi-crumb">{product.category_name}</span>
          {product.subcategory_name && (
            <>
              <span className="pdi-crumb-sep"><IconChevronRight /></span>
              <span className="pdi-crumb pdi-crumb--active">
                {product.subcategory_name}
              </span>
            </>
          )}
        </nav>
      )}

      <h1 className="pdi-title">{product.title}</h1>

      {hasEngagement && (
        <div className="pdi-engagement" aria-label="Listing stats">
          {product.views > 0 && (
            <span className="pdi-eng-item" aria-label={`${product.views} views`}>
              <IconEye /><span>{compactNum(product.views)}</span>
            </span>
          )}
          {product.favorites_count > 0 && (
            <span className="pdi-eng-item" aria-label={`${product.favorites_count} saves`}>
              <IconHeart /><span>{compactNum(product.favorites_count)}</span>
            </span>
          )}
          {product.average_rating > 0 && (
            <span className="pdi-eng-item">
              <IconStar />
              <span>
                {Number(product.average_rating).toFixed(1)}
                {product.reviews_count > 0 && (
                  <span className="pdi-eng-sub">&nbsp;({product.reviews_count})</span>
                )}
              </span>
            </span>
          )}
          {posted && (
            <span className="pdi-eng-item pdi-eng-item--time" aria-label={`Posted ${posted}`}>
              <IconClock /><span>{posted}</span>
            </span>
          )}
        </div>
      )}

      {/* Price — no negotiable badge */}
      <div className="pdi-price-row">
        <span className="pdi-price" aria-label={`Price: ${symbol}${fmt(product.price)}`}>
          {symbol}{fmt(product.price)}
        </span>

        {product.original_price != null && product.original_price > product.price && (
          <>
            <span className="pdi-price-old">{symbol}{fmt(product.original_price)}</span>
            {product.discount_percent > 0 && (
              <span className="pdi-price-off">-{product.discount_percent}%</span>
            )}
          </>
        )}
      </div>

      {metaItems.length > 0 && (
        <div className="pdi-meta" aria-label="Product details">
          {metaItems.map(({ label, value, Icon }) => (
            <div key={label} className="pdi-meta-badge">
              <span className="pdi-meta-icon"><Icon /></span>
              <div className="pdi-meta-text">
                <span className="pdi-meta-label">{label}</span>
                <span className="pdi-meta-value">{value}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default memo(ProductDetailInfo);