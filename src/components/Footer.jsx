// src/components/Footer.jsx
import React, { memo } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Footer.css";

const YEAR = new Date().getFullYear();

const FOOTER_COLS = [
  {
    title: "Marketplace",
    links: [
      { label: "Trending",     path: "/trending" },
      { label: "Cheap Deals",  path: "/deals"    },
      { label: "New Arrivals", path: "/latest"   },
      { label: "Near You",     path: "/nearby"   },
    ],
  },
  {
    title: "Sellers",
    links: [
      { label: "Post a Listing",  path: "/minimart/post-ad" },
      { label: "Seller Dashboard",path: "/seller/dashboard" },
      { label: "Subscription",    path: "/seller/subscription" },
      { label: "Become a Seller", path: "/become-seller"    },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About Us",   path: "/about"        },
      { label: "Careers",    path: "/careers"      },
      { label: "Hall of Fame", path: "/hall-of-fame" },
      { label: "Blog",       path: "/blog"         },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Help Centre",     path: "/help"            },
      { label: "FAQ",             path: "/faq"             },
      { label: "Contact Support", path: "/support/contact" },
      { label: "Report Issue",    path: "/support/report"  },
    ],
  },
];

const LEGAL_LINKS = [
  { label: "Terms of Service",     path: "/terms"                 },
  { label: "Privacy Policy",       path: "/privacy"               },
  { label: "Community Guidelines", path: "/community-guidelines"  },
];

const SOCIALS = [
  {
    label: "Twitter",
    url  : "https://twitter.com/loemart",
    icon : (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    label: "Instagram",
    url  : "https://instagram.com/loemart",
    icon : (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    ),
  },
  {
    label: "Facebook",
    url  : "https://facebook.com/loemart",
    icon : (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  {
    label: "TikTok",
    url  : "https://tiktok.com/@loemart",
    icon : (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.84-.1z"/>
      </svg>
    ),
  },
  {
    label: "WhatsApp",
    url  : "https://wa.me/2340000000000",
    icon : (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
      </svg>
    ),
  },
];

const APP_LINKS = [
  {
    label : "Get it on Google Play",
    url   : "https://play.google.com/store/apps/details?id=com.loemart",
    icon  : "📱",
  },
  {
    label : "Download on App Store",
    url   : "https://apps.apple.com/app/loemart",
    icon  : "🍎",
  },
];

const Footer = memo(function Footer() {
  const navigate = useNavigate();

  return (
    <footer className="ft" role="contentinfo">
      <div className="ft-inner">

        {/* ═════════════════════════════════════════
            TOP SECTION — brand + nav
        ═════════════════════════════════════════ */}
        <div className="ft-top">

          {/* Brand */}
          <div className="ft-brand">
            <div className="ft-logo">
              <span className="ft-logo-mark">🛍️</span>
              <span className="ft-logo-name">Loemart</span>
            </div>
            <p className="ft-tagline">
              Nigeria's trusted marketplace. Buy, sell &amp; discover great deals near you.
            </p>

            {/* Trust badges — mini */}
            <div className="ft-badges">
              <span className="ft-badge">🔒 Secure</span>
              <span className="ft-badge">✅ Verified</span>
              <span className="ft-badge">🚚 Delivery</span>
            </div>

            {/* Social — desktop */}
            <div className="ft-socials">
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ft-social-link"
                  aria-label={`Follow us on ${s.label}`}
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Nav columns */}
          <nav className="ft-nav" aria-label="Footer navigation">
            {FOOTER_COLS.map((col) => (
              <div key={col.title} className="ft-col">
                <h4 className="ft-col-title">{col.title}</h4>
                <ul className="ft-links">
                  {col.links.map((link) => (
                    <li key={link.path}>
                      <button
                        type="button"
                        onClick={() => navigate(link.path)}
                      >
                        {link.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        {/* ═════════════════════════════════════════
            NEWSLETTER
        ═════════════════════════════════════════ */}
        <div className="ft-newsletter">
          <div className="ft-newsletter-text">
            <h4>📬 Stay in the loop</h4>
            <p>Get the latest deals and new listings delivered to your inbox weekly.</p>
          </div>
          <form
            className="ft-newsletter-form"
            onSubmit={(e) => e.preventDefault()}
          >
            <input
              type="email"
              placeholder="Enter your email"
              className="ft-newsletter-input"
              aria-label="Email for newsletter"
              required
            />
            <button type="submit" className="ft-newsletter-btn">
              Subscribe
            </button>
          </form>
        </div>

        {/* ═════════════════════════════════════════
            APP DOWNLOAD BANNER
        ═════════════════════════════════════════ */}
        <div className="ft-apps">
          <p className="ft-apps-title">📲 Get the Loemart app</p>
          <div className="ft-apps-links">
            {APP_LINKS.map((app) => (
              <a
                key={app.label}
                href={app.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ft-app-link"
              >
                <span className="ft-app-icon" aria-hidden="true">{app.icon}</span>
                <span>{app.label}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="ft-rule" />

        {/* ═════════════════════════════════════════
            BOTTOM BAR
        ═════════════════════════════════════════ */}
        <div className="ft-bottom">
          <p className="ft-copy">
            &copy; {YEAR} Loemart Technologies Ltd. All rights reserved.
          </p>

          <div className="ft-legal">
            {LEGAL_LINKS.map((link, i) => (
              <React.Fragment key={link.path}>
                {i > 0 && (
                  <span className="ft-dot" aria-hidden="true">·</span>
                )}
                <button
                  type="button"
                  className="ft-legal-link"
                  onClick={() => navigate(link.path)}
                >
                  {link.label}
                </button>
              </React.Fragment>
            ))}
          </div>

          {/* Social — mobile only */}
          <div className="ft-socials-mobile">
            {SOCIALS.map((s) => (
              <a
                key={s.label}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ft-social-link"
                aria-label={`Follow us on ${s.label}`}
              >
                {s.icon}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
});

export default Footer;