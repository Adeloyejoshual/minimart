// components/ProductCardEnterprise.tsx
import React from "react";

interface ProductCardProps {
  product: any;
  onClick: () => void;
  variant?: "standard" | "trending";
}

const ProductCardEnterprise: React.FC<ProductCardProps> = React.memo(
  ({ product, onClick, variant = "standard" }) => {
    return (
      <article className={`enterprise-card ${variant}`} onClick={onClick}>
        <div className="card-image-container">
          {product.image ? (
            <img
              src={product.image}
              alt={product.title}
              className="card-image"
              loading="lazy"
            />
          ) : (
            <div className="image-placeholder">📷</div>
          )}
          {variant === "trending" && (
            <div className="trending-badge">TRENDING</div>
          )}
        </div>

        <div className="card-content">
          <h3 className="card-title">{product.title}</h3>
          {variant === "standard" && (
            <p className="card-description">{product.description}</p>
          )}
          <div className="card-footer">
            <span className="price">₦{product.price?.toLocaleString()}</span>
            {product.stock !== undefined && (
              <span className="stock">{product.stock} in stock</span>
            )}
            <button aria-label="Add to cart" className="add-to-cart-btn">
              🛒
            </button>
          </div>
        </div>
      </article>
    );
  }
);

export default ProductCardEnterprise;