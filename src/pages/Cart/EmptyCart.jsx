import React, { memo } from "react";
import { useNavigate } from "react-router-dom";

const EmptyCart = memo(function EmptyCart({
  savedItems,
  onMoveToCart,
  onRemoveSaved,
}) {
  const navigate = useNavigate();

  return (
    <div className="ct-empty">
      <div className="ct-empty-icon">🛒</div>
      <h2 className="ct-empty-title">Your cart is empty</h2>
      <p className="ct-empty-sub">
        Looks like you haven't added anything yet.
        Browse our marketplace and find something you love.
      </p>

      <button
        className="ct-empty-shop-btn"
        onClick={() => navigate("/minimart")}
      >
        Browse Minimart
      </button>

      <button
        className="ct-empty-home-btn"
        onClick={() => navigate("/")}
      >
        Go to Homepage
      </button>

      {/* Saved items */}
      {savedItems.length > 0 && (
        <div className="ct-empty-saved">
          <h3>Saved for Later ({savedItems.length})</h3>
          <div className="ct-saved-list">
            {savedItems.map((item) => (
              <div key={item.id} className="ct-saved-item">
                <div className="ct-saved-img-wrap">
                  {item.image ? (
                    <img src={item.image} alt={item.name} loading="lazy" />
                  ) : (
                    <span>📦</span>
                  )}
                </div>
                <div className="ct-saved-info">
                  <p className="ct-saved-name">{item.name}</p>
                  {item.variant && (
                    <p className="ct-saved-variant">{item.variant.name}</p>
                  )}
                  <p className="ct-saved-price">
                    ₦{Number(item.price).toLocaleString("en-NG")}
                  </p>
                </div>
                <div className="ct-saved-actions">
                  <button
                    className="ct-saved-move"
                    onClick={() => onMoveToCart(item.id)}
                  >
                    Move to Cart
                  </button>
                  <button
                    className="ct-saved-remove"
                    onClick={() => onRemoveSaved(item.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

export default EmptyCart;