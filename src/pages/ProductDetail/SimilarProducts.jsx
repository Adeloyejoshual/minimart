// SimilarProducts.jsx — add memo + section semantics
import { memo } from "react";
import MasonryCard from "../../components/MasonryCard";

export default memo(function SimilarProducts({ products, onProductClick }) {
  if (!products?.length) return null;

  return (
    <section className="pd-section" aria-label="Similar products">
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
    </section>
  );
});