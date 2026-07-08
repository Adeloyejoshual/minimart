// src/desktop/components/ProductTabs.tsx

import { useState, memo } from "react";
import type { Product, Review, ReviewStats } from "../../hooks/useProductDetail";
import ReviewSection from "../../pages/ProductDetail/Review";

type Tab = "description" | "specifications" | "reviews";

interface ProductTabsProps {
  product:      Product;
  slug:         string;
  userId:       string | null;
  reviews:      Review[];
  reviewStats:  ReviewStats | null;
  reviewTotal:  number;
  reviewPage:   number;
  onLoadMore:   () => void;
  onReviewDone: () => void;
}

export const ProductTabs = memo(function ProductTabs({
  product,
  slug,
  userId,
  reviews,
  reviewStats,
  reviewTotal,
  reviewPage,
  onLoadMore,
  onReviewDone,
}: ProductTabsProps) {
  const [active, setActive] = useState<Tab>("description");

  const hasSpecs = product.specifications &&
    Object.keys(product.specifications).length > 0;

  const tabs: { id: Tab; label: string }[] = [
    { id: "description",    label: "Description"    },
    ...(hasSpecs ? [{ id: "specifications" as Tab, label: "Specifications" }] : []),
    {
      id:    "reviews",
      label: `Reviews${reviewStats?.total ? ` (${reviewStats.total})` : ""}`,
    },
  ];

  return (
    <div className="pdd-tabs" role="region" aria-label="Product details tabs">

      {/* Tab bar */}
      <div className="pdd-tab-bar" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={active === t.id}
            aria-controls={`pdd-tab-panel-${t.id}`}
            id={`pdd-tab-${t.id}`}
            className={`pdd-tab${active === t.id ? " pdd-tab--active" : ""}`}
            onClick={() => setActive(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Panels */}
      <div
        id={`pdd-tab-panel-description`}
        role="tabpanel"
        aria-labelledby="pdd-tab-description"
        hidden={active !== "description"}
        className="pdd-tab-panel"
      >
        {product.description ? (
          <div
            className="pdd-description"
            dangerouslySetInnerHTML={{ __html: product.description }}
          />
        ) : (
          <p className="pdd-empty">No description provided.</p>
        )}
      </div>

      {hasSpecs && (
        <div
          id="pdd-tab-panel-specifications"
          role="tabpanel"
          aria-labelledby="pdd-tab-specifications"
          hidden={active !== "specifications"}
          className="pdd-tab-panel"
        >
          <table className="pdd-spec-table" aria-label="Product specifications">
            <tbody>
              {Object.entries(product.specifications!).map(([key, val]) => (
                <tr key={key}>
                  <th scope="row" className="pdd-spec-key">{key}</th>
                  <td className="pdd-spec-val">{val}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div
        id="pdd-tab-panel-reviews"
        role="tabpanel"
        aria-labelledby="pdd-tab-reviews"
        hidden={active !== "reviews"}
        className="pdd-tab-panel"
      >
        {/* Reuse the existing mobile ReviewSection — identical logic */}
        <ReviewSection
          slug={slug}
          userId={userId}
          reviews={reviews}
          reviewStats={reviewStats}
          reviewTotal={reviewTotal}
          reviewPage={reviewPage}
          onLoadMore={onLoadMore}
          onReviewDone={onReviewDone}
        />
      </div>
    </div>
  );
});