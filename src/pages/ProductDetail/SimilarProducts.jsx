/**
 * src/pages/ProductDetail/SimilarProducts.jsx
 *
 * Uses MasonryCard for full uncropped images.
 */

import MasonryCard from "../../components/MasonryCard";

export default function SimilarProducts({ products, onProductClick }) {
  if (!products || products.length === 0) return null;

  return (
    <div className="pd-section">
      <h3 className="pd-section-h">You may also like</h3>
      <div className="pd-similar-masonry">
        {products.map((p) => (
          <MasonryCard
            key={p.id}
            product={p}
            onClick={onProductClick}
          />
        ))}
      </div>
    </div>
  );
}