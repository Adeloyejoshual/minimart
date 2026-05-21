import React, { useCallback } from "react";
import { Icon } from "./icons";
import { OFFER_STATUS, CURRENCY } from "./constants";

const STATUS_MAP = {
  [OFFER_STATUS.PENDING]:   { bg: "#fefce8", bd: "#fde68a", badge: "#f59e0b", text: "Pending"  },
  [OFFER_STATUS.ACCEPTED]:  { bg: "#f0fdf4", bd: "#bbf7d0", badge: "#22c55e", text: "Accepted" },
  [OFFER_STATUS.DECLINED]:  { bg: "#fef2f2", bd: "#fecaca", badge: "#ef4444", text: "Declined" },
  [OFFER_STATUS.COUNTERED]: { bg: "#eff6ff", bd: "#bfdbfe", badge: "#3b82f6", text: "Counter"  },
};

function OfferCard({ msg, mine, onRespond }) {
  const o = msg._offerMeta;
  if (!o) return null;

  const s = STATUS_MAP[o.status] ||
    { bg: "#f9fafb", bd: "#e5e7eb", badge: "#6b7280", text: o.status };

  const handleAccept  = useCallback(() => onRespond(msg, OFFER_STATUS.ACCEPTED),  [msg, onRespond]);
  const handleDecline = useCallback(() => onRespond(msg, OFFER_STATUS.DECLINED),  [msg, onRespond]);
  const handleCounter = useCallback(() => onRespond(msg, OFFER_STATUS.COUNTERED), [msg, onRespond]);

  return (
    <div
      className="offer-card"
      style={{ background: s.bg, border: `1.5px solid ${s.bd}` }}
    >
      <div className="offer-card-header">
        {Icon.tag}
        <span className="offer-label">Offer</span>
        <span className="offer-badge" style={{ background: s.badge }}>
          {s.text}
        </span>
      </div>

      {o.product_title && (
        <div className="offer-product">{o.product_title}</div>
      )}

      <div className="offer-price-row">
        {o.original_price && (
          <span className="offer-original">
            {CURRENCY}{Number(o.original_price).toLocaleString()}
          </span>
        )}
        <span className="offer-amount">
          {CURRENCY}{Number(o.amount).toLocaleString()}
        </span>
        {o.original_price && (
          <span className="offer-discount">
            {Math.round((1 - o.amount / o.original_price) * 100)}% off
          </span>
        )}
      </div>

      {o.note && <div className="offer-note">"{o.note}"</div>}

      {!mine && o.status === OFFER_STATUS.PENDING && onRespond && (
        <div className="offer-actions">
          <button className="offer-btn accept"  onClick={handleAccept}>Accept</button>
          <button className="offer-btn counter" onClick={handleCounter}>Counter</button>
          <button className="offer-btn decline" onClick={handleDecline}>Decline</button>
        </div>
      )}

      {mine && o.status === OFFER_STATUS.COUNTERED && onRespond && (
        <div className="offer-actions">
          <button className="offer-btn accept"  onClick={handleAccept}>Accept</button>
          <button className="offer-btn decline" onClick={handleDecline}>Decline</button>
        </div>
      )}
    </div>
  );
}

export default React.memo(OfferCard);