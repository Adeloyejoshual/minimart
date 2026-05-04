/**
 * Footer.jsx — Minimart
 * Professional footer with legal links and brand identity
 */

import React, { memo } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Footer.css";

const YEAR = new Date().getFullYear();

const Footer = memo(function Footer() {
  const navigate = useNavigate();

  return (
    <footer className="footer">
      {/* ── Brand ── */}
      <div className="footer-brand">
        <div className="footer-logo">
          <span className="footer-logo-mark">M</span>
          <span className="footer-logo-name">Minimart</span>
        </div>
        <p className="footer-tagline">
          Nigeria's neighbourhood marketplace. Buy, sell and discover deals near you.
        </p>
      </div>

      {/* ── Links ── */}
      <nav className="footer-nav" aria-label="Footer navigation">
        <div className="footer-col">
          <h4 className="footer-col-title">Marketplace</h4>
          <ul className="footer-links">
            <li><button onClick={() => navigate("/trending")}>Trending</button></li>
            <li><button onClick={() => navigate("/deals")}>Cheap Deals</button></li>
            <li><button onClick={() => navigate("/latest")}>New Arrivals</button></li>
            <li><button onClick={() => navigate("/nearby")}>Near You</button></li>
          </ul>
        </div>

        <div className="footer-col">
          <h4 className="footer-col-title">Sellers</h4>
          <ul className="footer-links">
            <li><button onClick={() => navigate("/minimart/add")}>Post a Listing</button></li>
            <li><button onClick={() => navigate("/seller-guide")}>Seller Guide</button></li>
            <li><button onClick={() => navigate("/pricing")}>Pricing</button></li>
            <li><button onClick={() => navigate("/promoted")}>Promote Listing</button></li>
          </ul>
        </div>

        <div className="footer-col">
          <h4 className="footer-col-title">Support</h4>
          <ul className="footer-links">
            <li><button onClick={() => navigate("/help")}>Help Centre</button></li>
            <li><button onClick={() => navigate("/safety")}>Safety Tips</button></li>
            <li><button onClick={() => navigate("/contact")}>Contact Us</button></li>
            <li><button onClick={() => navigate("/report")}>Report a Listing</button></li>
          </ul>
        </div>
      </nav>

      {/* ── Divider ── */}
      <div className="footer-rule" />

      {/* ── Bottom bar ── */}
      <div className="footer-bottom">
        <p className="footer-copy">
          &copy; {YEAR} Minimart Technologies Ltd. All rights reserved.
        </p>

        <div className="footer-legal">
          <button
            className="footer-legal-link"
            onClick={() => navigate("/terms")}
          >
            Terms of Service
          </button>
          <span className="footer-dot" aria-hidden="true">·</span>
          <button
            className="footer-legal-link"
            onClick={() => navigate("/privacy")}
          >
            Privacy Policy
          </button>
          <span className="footer-dot" aria-hidden="true">·</span>
          <button
            className="footer-legal-link"
            onClick={() => navigate("/cookies")}
          >
            Cookie Policy
          </button>
        </div>
      </div>
    </footer>
  );
});

export default Footer;
