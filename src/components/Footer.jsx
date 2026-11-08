import React, { memo } from "react";
import { Link } from "react-router-dom";
import "../styles/Footer.css";

const YEAR = new Date().getFullYear();

const SOCIALS = [
  {
    label: "Facebook",
    url: import.meta.env.VITE_LOEMART_FACEBOOK_URL,
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M24 12.073C24 5.446 18.627.073 12 .073S0 5.446 0 12.073c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  {
    label: "Instagram",
    url: import.meta.env.VITE_LOEMART_INSTAGRAM_URL,
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919C8.333.014 8.741 0 12 0zm0 3.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17zm0 2.338a6.162 6.162 0 110 12.324 6.162 6.162 0 010-12.324zm6.406-1.683a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    ),
  },
  {
    label: "TikTok",
    url: import.meta.env.VITE_LOEMART_TIKTOK_URL,
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.4v13.67a2.9 2.9 0 11-2.9-2.9c.3 0 .6.04.9.13V9.43a6.3 6.3 0 00-.9-.06 6.3 6.3 0 106.3 6.3V9.05a8.16 8.16 0 004.77 1.53V7.19a4.84 4.84 0 01-1-.5z" />
      </svg>
    ),
  },
];

const FOOTER_COLUMNS = [
  {
    title: "Marketplace",
    links: [
      { label: "Explore Market", path: "/loemart" },
      { label: "Trending", path: "/trending" },
      { label: "Cheap Deals", path: "/deals" },
      { label: "New Arrivals", path: "/latest" },
      { label: "Near You", path: "/nearby" },
      { label: "Shopping Cart", path: "/shop/cart" },
    ],
  },
  {
    title: "Sellers",
    links: [
      { label: "Post a Listing", path: "/minimart/add" },
      { label: "Seller Guide", path: "/help" },
      { label: "Pricing", path: "/help" },
      { label: "Promote Listing", path: "/help" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About Us", path: "/about" },
      { label: "Terms of Service", path: "/terms" },
      { label: "Privacy Policy", path: "/privacy" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Help Centre", path: "/help" },
      { label: "Contact Us", path: "/support/contact" },
      { label: "Report a Listing", path: "/support/report" },
      { label: "Give Feedback", path: "/support/feedback" },
    ],
  },
];

const SocialLinks = memo(function SocialLinks() {
  const availableSocials = SOCIALS.filter((item) => item.url);

  if (!availableSocials.length) return null;

  return (
    <div className="lm-footer-socials">
      {availableSocials.map((social) => (
        <a
          key={social.label}
          href={social.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Visit Loemart on ${social.label}`}
          className="lm-footer-social"
        >
          {social.icon}
        </a>
      ))}
    </div>
  );
});

const Footer = memo(function Footer({ variant = "default" }) {
  if (variant === "checkout") {
    return (
      <footer className="lm-footer lm-footer-checkout">
        <div className="lm-footer-checkout-inner">
          <Link to="/loemart" className="lm-footer-logo">
            <span className="lm-footer-logo-mark">L</span>
            <span>Loemart</span>
          </Link>

          <nav
            className="lm-footer-checkout-links"
            aria-label="Checkout footer navigation"
          >
            <Link to="/help">Help</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/privacy">Privacy</Link>
          </nav>

          <p className="lm-footer-copyright">
            © {YEAR} Loemart Technologies Ltd.
          </p>
        </div>
      </footer>
    );
  }

  return (
    <footer className="lm-footer">
      <div className="lm-footer-container">

        {/* BRAND AND NAVIGATION */}

        <div className="lm-footer-main">

          <div className="lm-footer-brand">
            <Link to="/loemart" className="lm-footer-logo">
              <span className="lm-footer-logo-mark">L</span>
              <span>Loemart</span>
            </Link>

            <p className="lm-footer-description">
              Nigeria's Neighbourhood Marketplace.
              <br />
              Buy. Sell. Connect. Grow.
            </p>

            <div className="lm-footer-location">
              <span aria-hidden="true">🇳🇬</span>
              <span>Made for Nigeria</span>
            </div>

            <SocialLinks />
          </div>

          <nav
            className="lm-footer-navigation"
            aria-label="Footer navigation"
          >
            {FOOTER_COLUMNS.map((column) => (
              <div className="lm-footer-column" key={column.title}>
                <h3>{column.title}</h3>

                <ul>
                  {column.links.map((link) => (
                    <li key={`${column.title}-${link.label}`}>
                      <Link to={link.path}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        {/* FEEDBACK */}

        <section
          className="lm-footer-feedback"
          aria-label="Customer feedback"
        >
          <div className="lm-footer-feedback-icon">
            ✦
          </div>

          <div className="lm-footer-feedback-text">
            <h3>Your opinion matters.</h3>
            <p>
              Help us improve Loemart. Share your suggestions
              or tell us about your experience.
            </p>
          </div>

          <Link
            to="/support/feedback"
            className="lm-footer-feedback-button"
          >
            Give Feedback
            <span aria-hidden="true">→</span>
          </Link>
        </section>

        {/* DIVIDER */}

        <div className="lm-footer-divider" />

        {/* COPYRIGHT */}

        <div className="lm-footer-bottom">
          <p className="lm-footer-copyright">
            © {YEAR} Loemart Technologies Ltd. All rights reserved.
          </p>

          <div className="lm-footer-bottom-links">
            <Link to="/terms">Terms of Service</Link>
            <Link to="/privacy">Privacy Policy</Link>
          </div>

          <span className="lm-footer-country">
            🇳🇬 Nigeria
          </span>
        </div>

      </div>
    </footer>
  );
});

export default Footer;