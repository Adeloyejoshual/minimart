// src/components/Cart/RemoveModal.jsx
import React, { useEffect, useCallback } from "react";
import { truncateText } from "../../features/cart/utils/cartHelpers";
import "../../styles/cart/removeModal.css";

export default function RemoveModal({
  productName,
  onConfirm,
  onSave,
  onCancel,
}) {
  // Close on Escape key
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  // Lock body scroll while open
  useEffect(() => {
    const original            = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  // Click outside to close
  const onOverlayClick = useCallback(
    (e) => { if (e.target === e.currentTarget) onCancel(); },
    [onCancel]
  );

  return (
    <div
      className="modal-overlay"
      onClick={onOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="remove-modal-title"
      aria-describedby="remove-modal-desc"
    >
      <div className="modal">

        {/* Close X */}
        <button
          className="modal__close"
          onClick={onCancel}
          aria-label="Close dialog"
        >
          ✕
        </button>

        <span className="modal__icon" aria-hidden="true">🛒</span>

        <h2 className="modal__title" id="remove-modal-title">
          Remove item?
        </h2>

        <p className="modal__desc" id="remove-modal-desc">
          Remove{" "}
          <span className="modal__product-name">
            "{truncateText(productName, 40)}"
          </span>{" "}
          from your cart?
        </p>

        <div className="modal__actions">

          <button
            className="modal__btn modal__btn--remove"
            onClick={onConfirm}
            autoFocus
          >
            🗑 Yes, remove it
          </button>

          {onSave && (
            <button
              className="modal__btn modal__btn--save"
              onClick={onSave}
            >
              🤍 Save for later instead
            </button>
          )}

          <button
            className="modal__btn modal__btn--cancel"
            onClick={onCancel}
          >
            No, keep it
          </button>

        </div>
      </div>
    </div>
  );
}