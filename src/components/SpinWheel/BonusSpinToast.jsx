import { useEffect } from "react";
import Icon from "./Icon.jsx";

export default function BonusSpinToast({ bonus, onClose }) {
  useEffect(() => {
    if (!bonus) return;
    const t = setTimeout(onClose, 4_000);
    return () => clearTimeout(t);
  }, [bonus, onClose]);

  if (!bonus) return null;

  return (
    <div className="sw-bonus-toast" role="alert" aria-live="assertive">
      <Icon name="gift" size={22} className="sw-bonus-toast-icon" />
      <div>
        <p className="sw-bonus-toast-title">
          +{bonus.spins_awarded} Bonus Spin
          {bonus.spins_awarded > 1 ? "s" : ""} Earned!
        </p>
        <p className="sw-bonus-toast-msg">{bonus.referred_user}</p>
      </div>
      <button
        className="sw-bonus-toast-close"
        onClick={onClose}
        aria-label="Dismiss notification"
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}