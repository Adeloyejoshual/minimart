import { useState } from "react";
import "../../styles/subscription/index.css";

const WILL_LOSE = [
  "Automatic listing renewal",
  "Search ranking boost",
  "Seller badge",
  "Analytics dashboard",
  "Featured listing slots",
  "Priority / dedicated support",
];

const CancelModal = ({ subscription, onConfirm, onClose, loading }) => {
  const [confirmed, setConfirmed] = useState(false);

  const fmt = (d) =>
    d ? new Date(d).toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric" }) : "—";

  return (
    <div className="sub-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sub-modal">

        <div className="sub-modal__header">
          <div className="sub-modal__header-left">
            <span className="sub-modal__warning-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </span>
            <h3 className="sub-modal__title">Cancel Subscription?</h3>
          </div>
          <button onClick={onClose} className="sub-modal__close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="sub-modal__body">
          <p>
            Your <strong>{subscription?.planBadge} {subscription?.planName}</strong> subscription
            stays active until <strong>{fmt(subscription?.expiresAt)}</strong>,
            then you move to the Free plan.
          </p>

          <div className="sub-modal__lose-box">
            <p className="sub-modal__lose-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              You will lose after expiry
            </p>
            <ul>
              {WILL_LOSE.map((item, i) => (
                <li key={i}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <label className="sub-modal__confirm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="sub-modal__checkbox"
          />
          <span>
            I understand my subscription will be cancelled and I will lose
            premium features when it expires.
          </span>
        </label>

        <div className="sub-modal__actions">
          <button
            onClick={onConfirm}
            disabled={!confirmed || loading}
            className="sub-btn sub-btn--danger sub-btn--flex"
          >
            {loading ? (
              <><span className="sub-btn__spinner" /> Cancelling...</>
            ) : "Yes, Cancel Subscription"}
          </button>

          <button
            onClick={onClose}
            disabled={loading}
            className="sub-btn sub-btn--ghost sub-btn--flex"
          >
            Keep Subscription
          </button>
        </div>
      </div>
    </div>
  );
};

export default CancelModal;