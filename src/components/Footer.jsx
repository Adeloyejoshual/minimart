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
      { label: "Cheap Deals",  path: "/deals" },
      { label: "New Arrivals", path: "/latest" },
      { label: "Near You",     path: "/nearby" },
    ],
  },
  {
    title: "Sellers",
    links: [
      { label: "Post a Listing",  path: "/minimart/add" },
      { label: "Seller Guide",    path: "/seller-guide" },
      { label: "Pricing",         path: "/pricing" },
      { label: "Promote Listing", path: "/promoted" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About Us",   path: "/about" },
      { label: "Careers",    path: "/careers" },
      { label: "Blog",       path: "/blog" },
      { label: "Press",      path: "/press" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Help Centre",     path: "/help" },
      { label: "Safety Tips",     path: "/safety" },
      { label: "Contact Us",      path: "/contact" },
      { label: "Report a Listing", path: "/report" },
    ],
  },
];

const LEGAL_LINKS = [
  { label: "Terms of Service", path: "/terms" },
  { label: "Privacy Policy",   path: "/privacy" },
  { label: "Cookie Policy",    path: "/cookies" },
];

const SOCIALS = [
  {
    label: "Twitter",
    url: "https://twitter.com/minimart",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    label: "Instagram",
    url: "https://instagram.com/minimart",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    ),
  },
  {
    label: "Facebook",
    url: "https://facebook.com/minimart",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
];

const Footer = memo(function Footer() {
  const navigate = useNavigate();

  return (
    <footer className="ft" role="contentinfo">
      <div className="ft-inner">
        {/* ── Top section ── */}
        <div className="ft-top">
          {/* Brand */}
          <div className="ft-brand">
            <div className="ft-logo">
              <span className="ft-logo-mark">M</span>
              <span className="ft-logo-name">Minimart</span>
            </div>
            <p className="ft-tagline">
              Nigeria's neighbourhood marketplace. Buy, sell and discover deals near you.
            </p>

            {/* Social — desktop */}
            <div className="ft-socials">
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ft-social-link"
                  aria-label={s.label}
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
                      <button onClick={() => navigate(link.path)}>
                        {link.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        {/* ── Newsletter — desktop only ── */}
        <div className="ft-newsletter">
          <div className="ft-newsletter-text">
            <h4>Stay in the loop</h4>
            <p>Get the latest deals and new listings delivered to your inbox.</p>
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
            />
            <button type="submit" className="ft-newsletter-btn">
              Subscribe
            </button>
          </form>
        </div>

        {/* ── Divider ── */}
        <div className="ft-rule" />

        {/* ── Bottom bar ── */}
        <div className="ft-bottom">
          <p className="ft-copy">
            &copy; {YEAR} Minimart Technologies Ltd. All rights reserved.
          </p>

          <div className="ft-legal">
            {LEGAL_LINKS.map((link, i) => (
              <React.Fragment key={link.path}>
                {i > 0 && (
                  <span className="ft-dot" aria-hidden="true">·</span>
                )}
                <button
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
                aria-label={s.label}
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