// src/components/Footer.jsx

import React, { memo } from "react";
import { Link } from "react-router-dom";
import "../styles/Footer.css";

const YEAR = new Date().getFullYear();

const SOCIALS = [
  {
    label: "Facebook",
    url: import.meta.env.VITE_LOEMART_FACEBOOK_URL,
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073C24 5.446 18.627.073 12 .073S0 5.446 0 12.073c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  {
    label: "Instagram",
    url: import.meta.env.VITE_LOEMART_INSTAGRAM_URL,
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    ),
  },
  {
    label: "TikTok",
    url: import.meta.env.VITE_LOEMART_TIKTOK_URL,
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.4v13.67a2.9 2.9 0 11-2.9-2.9c.3 0 .6.04.9.13V9.43a6.3 6.3 0 00-.9-.06 6.3 6.3 0 106.3 6.3V9.05a8.16 8.16 0 004.77 1.53V7.19a4.84 4.84 0 01-1-.5z" />
      </svg>
    ),
  },
];

const FOOTER_COLUMNS = [
  {
    title: "Shop",
    links: [
      { label: "Explore Market", path: "/loemart" },
      { label: "Trending Products", path: "/trending" },
      { label: "New Arrivals", path: "/latest" },
      { label: "Cheap Deals", path: "/deals" },
      { label: "Near You", path: "/nearby" },
      { label: "Shopping Cart", path: "/shop/cart" },
      { label: "My Orders", path: "/shop/orders" },
    ],
  },
  {
    title: "Sell on Loemart",
    links: [
      { label: "Start Selling", path: "/become-seller" },
      { label: "Post a Listing", path: "/minimart/add" },
      { label: "Seller Dashboard", path: "/seller/dashboard" },
      { label: "Seller Guide", path: "/help" },
      { label: "Promote Your Products", path: "/seller/subscription" },
    ],
  },
  {
    title: "About Loemart",
    links: [
      { label: "Our Community", path: "/community-guidelines" },
      { label: "Hall of Fame", path: "/hall-of-fame" },
      { label: "Terms of Service", path: "/terms" },
      { label: "Privacy Policy", path: "/privacy" },
    ],
  },
  {
    title: "Customer Service",
    links: [
      { label: "Help Centre", path: "/help" },
      { label: "Frequently Asked Questions", path: "/faq" },
      { label: "Contact Support", path: "/support/contact" },
      { label: "Report a Problem", path: "/support/report" },
      { label: "Submit Feedback", path: "/support/feedback" },
    ],
  },
];

const TrustItems = [
  {
    icon: "✓",
    title: "Verified Sellers",
    description: "Discover trusted sellers.",
  },
  {
    icon: "🔒",
    title: "Secure Checkout",
    description: "Protected payment experience.",
  },
  {
    icon: "🚚",
    title: "Managed Delivery",
    description: "Delivery support for Market orders.",
  },
  {
    icon: "♡",
    title: "Customer Support",
    description: "We're here to help.",
  },
];

const SocialLinks = memo(function SocialLinks() {
  const availableSocials = SOCIALS.filter(
    (social) => social.url
  );

  if (!availableSocials.length) return null;

  return (
    <div className="lm-footer-socials">
      {availableSocials.map((social) => (
        <a
          key={social.label}
          href={social.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={social.label}
          className="lm-footer-social"
        >
          {social.icon}
        </a>
      ))}
    </div>
  );
});

const Footer = memo(function Footer({
  variant = "default",
}) {
  if (variant === "checkout") {
    return (
      <footer className="lm-footer lm-footer-checkout">
        <div className="lm-footer-checkout-inner">

          <div className="lm-footer-checkout-brand">
            <Link to="/loemart" className="lm-footer-logo">
              <span className="lm-footer-logo-mark">L</span>
              <span>Loemart</span>
            </Link>

            <p>
              Shop confidently with Loemart.
            </p>
          </div>

          <div className="lm-footer-checkout-links">
            <Link to="/help">Help</Link>
            <Link to="/support/contact">Contact</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/privacy">Privacy</Link>
          </div>

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

        {/* SELLER PROMOTION */}

        <section className="lm-footer-seller-cta">

          <div className="lm-footer-seller-content">

            <span className="lm-footer-eyebrow">
              GROW WITH LOEMART
            </span>

            <h2>
              Have something to sell?
              <br />
              <span>Reach more customers.</span>
            </h2>

            <p>
              Join Loemart and showcase your products
              to customers across Nigeria.
              Start listing your products today.
            </p>

          </div>

          <Link
            to="/become-seller"
            className="lm-footer-seller-button"
          >
            Start Selling
            <span aria-hidden="true">→</span>
          </Link>

        </section>

        {/* TRUST SECTION */}

        <section
          className="lm-footer-trust"
          aria-label="Shopping benefits"
        >

          {TrustItems.map((item) => (
            <div
              className="lm-footer-trust-item"
              key={item.title}
            >
              <span className="lm-footer-trust-icon">
                {item.icon}
              </span>

              <div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
            </div>
          ))}

        </section>

        <div className="lm-footer-divider" />

        {/* MAIN FOOTER */}

        <div className="lm-footer-main">

          {/* BRAND */}

          <div className="lm-footer-brand">

            <Link to="/loemart" className="lm-footer-logo">

              <span className="lm-footer-logo-mark">
                L
              </span>

              <span>Loemart</span>

            </Link>

            <p className="lm-footer-description">
              Nigeria's Neighbourhood Marketplace.

              <br />

              Buy. Sell. Connect. Grow.
            </p>

            <div className="lm-footer-location">
              <span>🇳🇬</span>
              <span>Made for Nigeria</span>
            </div>

            <SocialLinks />

          </div>

          {/* NAVIGATION */}

          <nav
            className="lm-footer-navigation"
            aria-label="Footer navigation"
          >

            {FOOTER_COLUMNS.map((column) => (

              <div
                className="lm-footer-column"
                key={column.title}
              >

                <h3>{column.title}</h3>

                <ul>

                  {column.links.map((link) => (

                    <li key={link.path}>

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

        {/* SUPPORT / FEEDBACK BANNER */}

        <section className="lm-footer-feedback">

          <div className="lm-footer-feedback-icon">
            ✦
          </div>

          <div className="lm-footer-feedback-text">

            <h3>Your opinion matters.</h3>

            <p>
              Help us improve Loemart.
              Share your suggestions, report issues
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

        {/* BOTTOM */}

        <div className="lm-footer-bottom">

          <p className="lm-footer-copyright">
            © {YEAR} Loemart Technologies Ltd.
            All rights reserved.
          </p>

          <div className="lm-footer-bottom-links">

            <Link to="/terms">
              Terms
            </Link>

            <Link to="/privacy">
              Privacy
            </Link>

            <Link to="/community-guidelines">
              Community Guidelines
            </Link>

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