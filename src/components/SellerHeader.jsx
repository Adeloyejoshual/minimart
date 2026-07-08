/**
 * src/components/SellerHeader.jsx
 *
 * Public seller header — buyer-facing only.
 * No edit functionality. All SVG icons. No emoji.
 *
 * Data shape matches GET /api/seller/:id response.
 */

import "../styles/SellerProfile.css";

/* ═══════════════════════════════════════════════════════════════
   SVG ICONS — transparent, consistent stroke style
═══════════════════════════════════════════════════════════════ */
const Icons = {
  verified: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
      stroke="#2d7a2d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  ),
  shield: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  star: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  starFull: (
    <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
      <polygon
        points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
        fill="#f59e0b" stroke="#f59e0b" strokeWidth="1"
      />
    </svg>
  ),
  starHalf: (
    <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id="sp-star-half">
          <stop offset="50%" stopColor="#f59e0b"/>
          <stop offset="50%" stopColor="#e5e7eb"/>
        </linearGradient>
      </defs>
      <polygon
        points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
        fill="url(#sp-star-half)" stroke="#f59e0b" strokeWidth="1"
      />
    </svg>
  ),
  starEmpty: (
    <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
      <polygon
        points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
        fill="none" stroke="#d1d5db" strokeWidth="1.5"
      />
    </svg>
  ),
  mapPin: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  ),
  calendar: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  package: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
      <line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  ),
  shoppingBag: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <path d="M16 10a4 4 0 0 1-8 0"/>
    </svg>
  ),
  messageCircle: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
    </svg>
  ),
  chatBubble: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  userPlus: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="8.5" cy="7" r="4"/>
      <line x1="20" y1="8" x2="20" y2="14"/>
      <line x1="23" y1="11" x2="17" y2="11"/>
    </svg>
  ),
  userCheck: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="8.5" cy="7" r="4"/>
      <polyline points="17 11 19 13 23 9"/>
    </svg>
  ),
  checkCircle: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  ),
};

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
export const fmtNum = (n) => {
  const v = Number(n || 0);
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "m";
  if (v >= 1_000)     return (v / 1_000).toFixed(1)     + "k";
  return v.toLocaleString();
};

export const fmtJoined = (dateStr) => {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toLocaleDateString("en-NG", {
      month: "short", year: "numeric",
    });
  } catch { return null; }
};

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/* ═══════════════════════════════════════════════════════════════
   STAR RATING (SVG)
═══════════════════════════════════════════════════════════════ */
export const StarRating = ({ rating }) => {
  const r     = clamp(Number(rating || 0), 0, 5);
  const full  = Math.floor(r);
  const half  = r - full >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <span className="sp-stars" aria-label={`Rating: ${r.toFixed(1)} out of 5`}>
      {Array.from({ length: full  }).map((_, i) => <span key={`f${i}`}>{Icons.starFull}</span>)}
      {half && <span>{Icons.starHalf}</span>}
      {Array.from({ length: empty }).map((_, i) => <span key={`e${i}`}>{Icons.starEmpty}</span>)}
      <span className="sp-stars-val">{r.toFixed(1)}</span>
    </span>
  );
};

/* ═══════════════════════════════════════════════════════════════
   TRUST BADGES
═══════════════════════════════════════════════════════════════ */
const TrustBadges = ({ seller }) => {
  const badges = [];

  if (seller.store_verified || seller.verified)
    badges.push({
      key: "verified", icon: Icons.verified,
      label: "Verified Seller", tip: "Identity verified by Loemart",
    });

  if (seller.is_trusted || seller.trust_score >= 80)
    badges.push({
      key: "trusted", icon: Icons.shield,
      label: "Trusted Seller", tip: "Consistently high ratings",
    });

  if (seller.is_top_seller || seller.total_sales >= 100)
    badges.push({
      key: "top", icon: Icons.star,
      label: "Top Seller", tip: "100+ completed sales",
    });

  if (!badges.length) return null;

  return (
    <div className="sp-badges" role="list" aria-label="Seller badges">
      {badges.map((b) => (
        <span
          key={b.key}
          className={`sp-badge sp-badge--${b.key}`}
          role="listitem"
          title={b.tip}
        >
          {b.icon}
          {b.label}
        </span>
      ))}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   QUICK STATS
   Maps to: stats.total_products, seller.total_sales,
            seller.rating, seller.response_rate (future)
═══════════════════════════════════════════════════════════════ */
const QuickStats = ({ seller, stats }) => {
  const items = [
    {
      key: "listings",
      val: fmtNum(stats?.total_products ?? seller.products_count ?? 0),
      label: "Listings",
      icon: Icons.shoppingBag,
    },
    {
      key: "sold",
      val: fmtNum(seller.total_sales ?? 0),
      label: "Sold",
      icon: Icons.package,
    },
    {
      key: "rating",
      val: seller.rating ? Number(seller.rating).toFixed(1) : "—",
      label: "Rating",
      icon: Icons.star,
    },
  ];

  return (
    <div className="sp-quick-stats" role="list" aria-label="Seller stats">
      {items.map((item) => (
        <div key={item.key} className="sp-qstat" role="listitem">
          <span className="sp-qstat-icon" aria-hidden="true">{item.icon}</span>
          <span className="sp-qstat-val">{item.val}</span>
          <span className="sp-qstat-label">{item.label}</span>
        </div>
      ))}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   MAIN HEADER COMPONENT

   Props:
     seller         — from GET /api/seller/:id
     stats          — from same endpoint
     following      — boolean
     followBusy     — boolean
     toggleFollow   — fn
     chatBusy       — boolean
     messageSeller  — fn (opens quick message modal)
═══════════════════════════════════════════════════════════════ */
export default function SellerHeader({
  seller,
  stats,
  following,
  followBusy,
  toggleFollow,
  chatBusy,
  messageSeller,
}) {
  const avatarImg = seller?.store_logo || seller?.profile_image || null;

  return (
    <div className="sp-header">

      {/* ── Banner ── */}
      <div className="sp-banner">
        <div className="sp-banner-placeholder" aria-hidden="true" />
      </div>

      {/* ── Avatar + info row ── */}
      <div className="sp-profile-row sp-profile-row--offset">

        {/* Avatar */}
        <div className="sp-avatar">
          {avatarImg ? (
            <img
              src={avatarImg}
              alt={seller.store_name || seller.name}
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          ) : (
            <span className="sp-avatar-letter">
              {(seller.store_name || seller.name || "S").charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        {/* Info column */}
        <div className="sp-info">

          {/* Name + verified */}
          <div className="sp-name-row">
            <h1 className="sp-name">{seller.store_name || seller.name}</h1>
            {(seller.store_verified || seller.verified) && (
              <span className="sp-verified" title="Verified by Loemart">
                {Icons.verified}
                Verified
              </span>
            )}
          </div>

          {/* Rating */}
          {seller.rating > 0 && (
            <div className="sp-rating-row">
              <StarRating rating={seller.rating} />
            </div>
          )}

          {/* Store description */}
          {seller.store_description && (
            <p className="sp-desc">{seller.store_description}</p>
          )}

          {/* Location + joined */}
          <div className="sp-meta-row">
            {(seller.location_city || seller.location_state) && (
              <span className="sp-meta-item">
                {Icons.mapPin}
                {seller.location_city || seller.location_state}
              </span>
            )}
            {fmtJoined(seller.created_at) && (
              <span className="sp-meta-item">
                {Icons.calendar}
                Since {fmtJoined(seller.created_at)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Trust badges ── */}
      <TrustBadges seller={seller} />

      {/* ── Quick stats ── */}
      <QuickStats seller={seller} stats={stats} />

      {/* ── Action buttons ── */}
      <div className="sp-actions">
        <button
          className="sp-btn sp-btn--primary"
          onClick={messageSeller}
          disabled={chatBusy}
          aria-busy={chatBusy}
        >
          {chatBusy
            ? <span className="sp-spinner" aria-hidden="true" />
            : Icons.chatBubble
          }
          {chatBusy ? "Opening…" : "Message Seller"}
        </button>

        <button
          className={`sp-btn sp-btn--outline${following ? " sp-btn--following" : ""}`}
          onClick={toggleFollow}
          disabled={followBusy}
          aria-pressed={following}
          aria-busy={followBusy}
        >
          {followBusy ? (
            <span className="sp-spinner sp-spinner--dark" aria-hidden="true" />
          ) : following ? (
            <>{Icons.userCheck} Following</>
          ) : (
            <>{Icons.userPlus} Follow</>
          )}
        </button>
      </div>
    </div>
  );
}