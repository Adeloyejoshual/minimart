import React, { useState, useCallback } from "react";
import { Icon } from "./icons";

const QUICK_PCTS = [0.95, 0.90, 0.80, 0.70, 0.60];

function MakeOfferModal({ product, onSend, onClose }) {
  const [amt,  setAmt]  = useState(
    product?.price ? Math.round(product.price * 0.8) : ""
  );
  const [note, setNote] = useState("");
  const [err,  setErr]  = useState("");

  const op   = product?.price;
  const disc = amt && op
    ? Math.round((1 - Number(amt) / op) * 100)
    : null;

  const validate = useCallback(() => {
    if (!amt || isNaN(amt) || Number(amt) <= 0)
      return setErr("Enter a valid amount"), false;
    if (op && Number(amt) >= op)
      return setErr("Must be less than listed price"), false;
    if (op && Number(amt) < op * 0.3)
      return setErr("Too low (below 30%)"), false;
    setErr(""); return true;
  }, [amt, op]);

  const handleSend = useCallback(() => {
    if (!validate()) return;
    onSend({
      amount:         Number(amt),
      original_price: op,
      product_title:  product?.title,
      note:           note.trim(),
      status:         "pending",
    });
    onClose();
  }, [validate, amt, op, note, product?.title, onSend, onClose]);

  const handleAmtChange = useCallback(e => {
    setAmt(e.target.value); setErr("");
  }, []);

  const handleNoteChange = useCallback(e => setNote(e.target.value), []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-handle"/>

        <div className="modal-header">
          <div className="modal-title-group">
            <div>
              <div className="modal-title">Make an Offer</div>
              <div className="modal-subtitle">
                Propose a price you'd like to pay
              </div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            {Icon.close}
          </button>
        </div>

        {product?.title && (
          <div className="modal-product-chip">
            <span className="modal-product-name">{product.title}</span>
            {op && (
              <span className="modal-product-price">
                ৳{Number(op).toLocaleString()}
              </span>
            )}
          </div>
        )}

        <div className="modal-field">
          <label className="modal-label">Your Offer Price</label>
          <div className="modal-input-wrap">
            <span className="modal-currency">৳</span>
            <input
              className="modal-input"
              type="number"
              placeholder="0"
              value={amt}
              min={1}
              autoFocus
              onChange={handleAmtChange}
            />
            {disc > 0 && disc < 100 && (
              <span className="modal-discount-badge">{disc}% off</span>
            )}
          </div>
          {err && <div className="modal-err">{err}</div>}
        </div>

        {op && (
          <>
            <div className="modal-section-label">Quick select</div>
            <div className="modal-quick-btns">
              {QUICK_PCTS.map(p => (
                <button key={p} className="modal-quick-btn"
                  onClick={() => { setAmt(Math.round(op * p)); setErr(""); }}>
                  {Math.round(p * 100)}%
                  <span>৳{Math.round(op * p).toLocaleString()}</span>
                </button>
              ))}
            </div>
          </>
        )}

        <div className="modal-field">
          <label className="modal-label">
            Note <span className="modal-optional">(optional)</span>
          </label>
          <textarea
            className="modal-textarea"
            rows={2}
            maxLength={200}
            placeholder="e.g. I'll pay cash immediately…"
            value={note}
            onChange={handleNoteChange}
          />
        </div>

        <div className="modal-actions">
          <button className="modal-cancel" onClick={onClose}>Cancel</button>
          <button className="modal-send"   onClick={handleSend}>
            Send Offer
          </button>
        </div>
      </div>
    </div>
  );
}

export default React.memo(MakeOfferModal);