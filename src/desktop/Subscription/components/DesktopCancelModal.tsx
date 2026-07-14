import { useState } from "react";
import "./styles/desktop-cancel-modal.css";

interface Subscription {
  planBadge:  string;
  planName:   string;
  expiresAt:  string | null;
}

interface Props {
  subscription: Subscription | null;
  onConfirm:    () => void;
  onClose:      () => void;
  loading:      boolean;
}

const WILL_LOSE = [
  "Automatic listing renewal",
  "Search ranking boost",
  "Seller badge",
  "Analytics dashboard",
  "Featured listing slots",
  "Priority / dedicated support",
];

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-NG", {
        year: "numeric", month: "long", day: "numeric",
      })
    : "—";

const DesktopCancelModal = ({ subscription, onConfirm, onClose, loading }: Props) => {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div
      className="dcm-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="dcm-modal">

        <div className="dcm-header">
          <div className="dcm-header__left">
            <span className="dcm-header__warn-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </span>
            <h3 className="dcm-header__title">Cancel Subscription?</h3>
          </div>
          <button onClick={onClose} className="dcm-header__close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="dcm-body">
          <p className="dcm-body__intro">
            Your <strong>{subscription?.planBadge} {subscription?.planName}</strong> subscription
            will remain active until <strong>{fmt(subscription?.expiresAt ?? null)}</strong>,
            then your account reverts to the Free plan.
          </p>

          <div className="dcm-lose-box">
            <p className="dcm-lose-box__title">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              You will lose after expiry
            </p>
            <div className="dcm-lose-grid">
              {WILL_LOSE.map((item, i) => (
                <div key={i} className="dcm-lose-item">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        <label className="dcm-confirm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="dcm-confirm__checkbox"
          />
          <span className="dcm-confirm__text">
            I understand my subscription will be cancelled and I will lose
            premium features when it expires.
          </span>
        </label>

        <div className="dcm-actions">
          <button
            onClick={onConfirm}
            disabled={!confirmed || loading}
            className="dcm-btn dcm-btn--danger"
          >
            {loading ? (
              <><span className="dcm-spinner" /> Cancelling...</>
            ) : (
              "Yes, Cancel Subscription"
            )}
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="dcm-btn dcm-btn--ghost"
          >
            Keep Subscription
          </button>
        </div>
      </div>
    </div>
  );
};

export default DesktopCancelModal;