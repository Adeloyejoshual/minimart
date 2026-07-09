import { Link } from "react-router-dom";
import Icon from "./Icon.jsx";
import { timeAgo } from "./helpers.js";

export default function ReferralSpinsPanel({ referralSpins }) {
  if (!referralSpins?.length) return null;

  return (
    <div className="sw-ref-panel">
      <div className="sw-ref-panel-header">
        <Icon name="gift" size={22} className="sw-ref-panel-icon" />
        <div>
          <h3 className="sw-ref-panel-title">Bonus Spins from Referrals</h3>
          <p className="sw-ref-panel-sub">
            Earn 1 bonus spin each time someone signs up with your invite code
          </p>
        </div>
      </div>

      <div className="sw-ref-list" role="list">
        {referralSpins.map((ref) => (
          <div key={ref.id} className="sw-ref-item" role="listitem">
            {ref.avatar_url ? (
              <img
                src={ref.avatar_url}
                alt={ref.referred_name}
                className="sw-ref-avatar-img"
              />
            ) : (
              <div
                className="sw-ref-avatar"
                style={{ backgroundColor: ref.color || "#e8630a" }}
                aria-hidden="true"
              >
                {ref.initials}
              </div>
            )}

            <div className="sw-ref-info">
              <p className="sw-ref-name">{ref.referred_name}</p>
              <p className="sw-ref-time">
                Signed up {timeAgo(ref.created_at)}
              </p>
            </div>

            <div className="sw-ref-badge">
              <Icon name="spin" size={14} />
              <span>
                +{ref.spins_awarded} spin
                {ref.spins_awarded > 1 ? "s" : ""}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="sw-ref-tip">
        <Icon
          name="lightbulb"
          size={16}
          style={{ color: "#f59e0b", flexShrink: 0 }}
        />
        <span>
          Share your invite code on the{" "}
          <Link to="/invite" className="sw-ref-tip-link">
            Invite Friends
          </Link>{" "}
          page to earn more bonus spins!
        </span>
      </div>
    </div>
  );
}