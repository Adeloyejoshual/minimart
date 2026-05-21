import React, { useState, useCallback } from "react";
import { Icon } from "./icons";

function CounterOfferModal({ originalMsg, onSend, onClose }) {
  const o = originalMsg?._offerMeta;
  const [amt,  setAmt]  = useState(
    o?.original_price
      ? Math.round(o.original_price * 0.9)
      : o?.amount ? Math.round(o.amount * 1.15) : ""
  );
  const [note, setNote] = useState("");
  const [err,  setErr]  = useState("");

  const handleSend = useCallback(() => {
    if (!amt || isNaN(amt) || Number(amt) <= 0)
      return setErr("Enter a valid amount");
    onSend({
      amount:         Number(amt),
      original_price: o?.original_price,
      product_title:  o?.product_title,
      note:           note.trim(),
      status:         "pending",
      counter_to:     originalMsg.id,
      is_counter:     true,
    });
    onClose();
  }, [amt, note, o, originalMsg?.id, onSend, onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-handle"/>
        <div className="modal-header">
          <div className="modal-title-group">
            <div>
              <div className="modal-title">Counter Offer</div>
              <div className="modal-subtitle">
                Their offer: ৳{Number(o?.amount || 0).toLocaleString()}
              </div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>{Icon.close}</button>
        </div>

        <div className="modal-field">
          <label className="modal-label">Your Counter Price</label>
          <div className="modal-input-wrap">
            <span className="modal-currency">৳</span>
            <input className="modal-input" type="number" placeholder="0"
              value={amt} autoFocus
              onChange={e => { setAmt(e.target.value); setErr(""); }}/>
          </div>
          {err && <div className="modal-err">{err}</div>}
        </div>

        <div className="modal-field">
          <label className="modal-label">
            Note <span className="modal-optional">(optional)</span>
          </label>
          <textarea className="modal-textarea" rows={2} maxLength={200}
            placeholder="Explain your counter…"
            value={note}
            onChange={e => setNote(e.target.value)}/>
        </div>

        <div className="modal-actions">
          <button className="modal-cancel" onClick={onClose}>Cancel</button>
          <button className="modal-send"   onClick={handleSend}>Send Counter</button>
        </div>
      </div>
    </div>
  );
}

export default React.memo(CounterOfferModal);