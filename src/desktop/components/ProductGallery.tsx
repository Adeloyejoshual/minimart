// src/desktop/components/ProductGallery.tsx

import { useState, useCallback, memo } from "react";
import type { Product } from "../../hooks/useProductDetail";

const PH = "https://placehold.co/800x600/f0ede8/b0a89e?text=Loemart";

const getImages = (product: Product): string[] => {
  if (Array.isArray(product.images) && product.images.length > 0) {
    return product.images.map((img) =>
      typeof img === "string" ? img : img?.url || img?.thumbnail_url || PH
    );
  }
  const main = product.main_image || product.image || product.thumbnail_url;
  return main ? [main] : [PH];
};

interface ProductGalleryProps {
  product: Product;
}

export const ProductGallery = memo(function ProductGallery({
  product,
}: ProductGalleryProps) {
  const images                  = getImages(product);
  const [active, setActive]     = useState(0);
  const [zoomed, setZoomed]     = useState(false);
  const [zoomPos, setZoomPos]   = useState({ x: 50, y: 50 });

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x    = ((e.clientX - rect.left) / rect.width)  * 100;
    const y    = ((e.clientY - rect.top)  / rect.height) * 100;
    setZoomPos({ x, y });
  }, []);

  const prev = useCallback(() =>
    setActive((a) => (a === 0 ? images.length - 1 : a - 1)),
  [images.length]);

  const next = useCallback(() =>
    setActive((a) => (a === images.length - 1 ? 0 : a + 1)),
  [images.length]);

  return (
    <div className="pdg-root">
      {/* Main image */}
      <div
        className={`pdg-main${zoomed ? " pdg-main--zoomed" : ""}`}
        onMouseEnter={() => setZoomed(true)}
        onMouseLeave={() => setZoomed(false)}
        onMouseMove={handleMouseMove}
        aria-label="Product image — hover to zoom"
      >
        <img
          src={images[active] || PH}
          alt={`${product.title} — image ${active + 1}`}
          className="pdg-main-img"
          onError={(e) => { e.currentTarget.src = PH; }}
          draggable={false}
          style={
            zoomed
              ? {
                  transformOrigin: `${zoomPos.x}% ${zoomPos.y}%`,
                  transform: "scale(2)",
                  cursor: "zoom-in",
                }
              : undefined
          }
        />

        {/* Nav arrows — only if multiple images */}
        {images.length > 1 && (
          <>
            <button
              className="pdg-arrow pdg-arrow--prev"
              onClick={prev}
              aria-label="Previous image"
            >
              ‹
            </button>
            <button
              className="pdg-arrow pdg-arrow--next"
              onClick={next}
              aria-label="Next image"
            >
              ›
            </button>
          </>
        )}

        {/* Badge */}
        {product.is_promoted && (
          <span className="pdg-badge" aria-label="Featured listing">
            Featured
          </span>
        )}

        {/* Counter */}
        {images.length > 1 && (
          <span className="pdg-counter" aria-label={`Image ${active + 1} of ${images.length}`}>
            {active + 1} / {images.length}
          </span>
        )}
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="pdg-thumbs" role="listbox" aria-label="Product images">
          {images.map((src, i) => (
            <button
              key={i}
              className={`pdg-thumb${i === active ? " pdg-thumb--active" : ""}`}
              onClick={() => setActive(i)}
              role="option"
              aria-selected={i === active}
              aria-label={`Image ${i + 1}`}
            >
              <img
                src={src}
                alt={`Thumbnail ${i + 1}`}
                onError={(e) => { e.currentTarget.src = PH; }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
});