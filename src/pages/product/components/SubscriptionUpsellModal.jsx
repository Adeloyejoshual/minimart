/**
 * src/pages/product/components/SubscriptionUpsellModal.jsx
 *
 * Shown when a VERIFIED seller has hit their 500-listing lifetime cap.
 * Pitches the paid subscription tier and redirects to
 * /seller/subscription/plans.
 *
 * v2 — All icons are transparent stroke-only SVGs (no fills,
 *      no backgrounds). Uses currentColor for full theme support.
 *
 * Sibling of VerificationUpsellModal — same visual language,
 * different messaging and destination.
 */
import { Link } from "react-router-dom";

import "./styles/SubscriptionUpsellModal.css";

/* Canonical subscription route (from your App router) */
const SUBSCRIPTION_PATH = "/seller/subscription/plans";

/* ═══════════════════════════════════════════════════════════════
   TRANSPARENT SVG ICONS
   • All use fill="none" + stroke="currentColor"
   • Sized via width/height props (default 20px)
   • aria-hidden — decorative only
═══════════════════════════════════════════════════════════════ */

const CrownIcon = ({ size = 32 }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24"
    fill="none" stroke="currentColor"
    strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 18h18" />
    <path d="M3 10l3.5 6L12 6l5.5 10L21 10l-1.5 8h-15L3 10z" />
    <circle cx="12" cy="4"  r="1" />
    <circle cx="3"  cy="10" r="1" />
    <circle cx="21" cy="10" r="1" />
  </svg>
);

const InfinityIcon = ({ size = 18 }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24"
    fill="none" stroke="currentColor"
    strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M18.178 8c-3.918 0-6.178 8-10.096 8-1.702 0-3.082-1.79-3.082-4 0-2.21 1.38-4 3.082-4 3.918 0 6.178 8 10.096 8 1.702 0 3.082-1.79 3.082-4 0-2.21-1.38-4-3.082-4z" />
  </svg>
);

const ClockIcon = ({ size = 18 }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24"
    fill="none" stroke="currentColor"
    strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" />
    <polyline points="12 7 12 12 15 14" />
  </svg>
);

const TrendingUpIcon = ({ size = 18 }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24"
    fill="none" stroke="currentColor"
    strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="3 17 9 11 13 15 21 7" />
    <polyline points="15 7 21 7 21 13" />
  </svg>
);

const BadgeIcon = ({ size = 18 }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24"
    fill="none" stroke="currentColor"
    strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 2l2.4 2.6L18 4l.6 3.6L21 10l-1.8 3L21 16l-3 0-0.6 3.6L14 19l-2 3-2-3-3.4 0.6L6 16l-3 0 1.8-3L3 10l2.4-1.8L6 4l3.6 0.6L12 2z" />
    <polyline points="9 12 11 14 15 10" />
  </svg>
);

const ChartIcon = ({ size = 18 }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24"
    fill="none" stroke="currentColor"
    strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="3"  y1="21" x2="21" y2="21" />
    <line x1="6"  y1="21" x2="6"  y2="12" />
    <line x1="12" y1="21" x2="12" y2="6" />
    <line x1="18" y1="21" x2="18" y2="15" />
  </svg>
);

const CloseIcon = ({ size = 16 }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24"
    fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="18" y1="6" x2="6"  y2="18" />
    <line x1="6"  y1="6" x2="18" y2="18" />
  </svg>
);

const ArrowRightIcon = ({ size = 16 }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24"
    fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

/* ═══════════════════════════════════════════════════════════════
   BENEFIT LIST — single source of truth
═══════════════════════════════════════════════════════════════ */
const BENEFITS = [
  { Icon: InfinityIcon,   text: "Unlimited listings — never hit a cap again"    },
  { Icon: ClockIcon,      text: "90-day active listings (vs 30 days free)"      },
  { Icon: TrendingUpIcon, text: "Priority placement in search results"          },
  { Icon: BadgeIcon,      text: "Verified Pro badge on your listings"           },
  { Icon: ChartIcon,      text: "Analytics dashboard — views & inquiries"       },
];

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function SubscriptionUpsellModal({
  onClose,
  lifetimeUsed = 500,
  lifetimeMax  = 500,
  upgradeUrl   = SUBSCRIPTION_PATH,
}) {
  /* Always fall back to canonical route if backend
     doesn't provide a specific override.                    */
  const targetUrl = upgradeUrl || SUBSCRIPTION_PATH;

  return (
    <div
      className="sub-upsell-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sub-upsell-title"
      onClick={onClose}
    >
      <div
        className="sub-upsell-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          type="button"
          className="sub-upsell-close"
          onClick={onClose}
          aria-label="Close subscription upsell"
        >
          <CloseIcon />
        </button>

        {/* Crown */}
        <div className="sub-upsell-icon" aria-hidden="true">
          <CrownIcon size={36} />
        </div>

        {/* Title */}
        <h2 id="sub-upsell-title" className="sub-upsell-title">
          You've reached your {lifetimeMax}-listing limit
        </h2>

        {/* Subtitle */}
        <p className="sub-upsell-subtitle">
          You've posted <strong>{lifetimeUsed}</strong> free listings —
          great work! Upgrade to <strong>Pro</strong> for unlimited
          posting and more perks.
        </p>

        {/* Benefits */}
        <ul className="sub-upsell-benefits" role="list">
          {BENEFITS.map(({ Icon, text }) => (
            <li key={text} className="sub-upsell-benefit">
              <span className="sub-upsell-benefit-icon" aria-hidden="true">
                <Icon size={16} />
              </span>
              <span className="sub-upsell-benefit-text">{text}</span>
            </li>
          ))}
        </ul>

        {/* CTA — routes to subscription plans page */}
        <Link
          to={targetUrl}
          className="sub-upsell-cta"
          onClick={onClose}
        >
          <span>View Subscription Plans</span>
          <ArrowRightIcon size={16} />
        </Link>

        {/* Footer */}
        <p className="sub-upsell-footer">
          Cancel anytime · Instant activation
        </p>
      </div>
    </div>
  );
}