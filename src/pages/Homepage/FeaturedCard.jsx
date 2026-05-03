/**
 * pages/Homepage/FeaturedCard.jsx
 * Sponsored / featured product card shown at the top of the Homepage feed.
 * Used only by pages/Homepage.jsx.
 */

import React, { memo } from "react";
import { getImageUrl, locLabel, naira, PH } from "../../utils/productHelpers";

const FeaturedCard = memo(({ product, onClick }) => {
  const imgUrl = getImageUrl(product);
  const loc    = locLabel(product.location);

  return (
    <div
      className="feat"
      role="button"
      tabIndex={0}
      onClick={() => onClick(product)}
      onKeyDown={(e) => e.key === "Enter" && onClick(product)}
    >
      <img
        className="feat-img"
        src={imgUrl}
        alt={product.title}
        loading="eager"
        decoding="async"
        fetchPriority="high"
        onError={(e) => { e.currentTarget.src = PH; }}
      />
      <div className="feat-body">
        <div>
          <div className="feat-tag">Sponsored</div>
          <div className="feat-name">{product.title}</div>
        </div>
        <div>
          <div className="feat-price">{naira(product.price)}</div>
          <div className="feat-loc">
            <span className="loc-pip" /> {loc}
          </div>
        </div>
      </div>
    </div>
  );
});

FeaturedCard.displayName = "FeaturedCard";
export default FeaturedCard;
