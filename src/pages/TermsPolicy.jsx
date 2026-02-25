// src/pages/TermsPolicy.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import './TermsPolicy.css';

const TermsPolicy = () => {
  const navigate = useNavigate();

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="terms-container">
      <div className="terms-header">
        <button className="back-btn" onClick={() => navigate(-1)}>
          ← Back to Marketplace
        </button>
        <div className="header-content">
          <h1>Terms & Conditions</h1>
          <p>Last updated: February 25, 2026</p>
        </div>
      </div>

      <div className="terms-content">
        <section className="terms-section">
          <h2>1. Introduction</h2>
          <p>
            Welcome to <strong>MarketHub</strong>, a peer-to-peer marketplace connecting buyers and sellers 
            across Nigeria. By using our platform, you agree to these Terms & Conditions.
          </p>
        </section>

        <section className="terms-section">
          <h2>2. User Eligibility</h2>
          <ul>
            <li>You must be 18+ years old or have parental consent</li>
            <li>Valid phone number and identification required for sellers</li>
            <li>No multiple accounts per individual</li>
          </ul>
        </section>

        <section className="terms-section">
          <h2>3. Listings & Products</h2>
          <ul>
            <li>All listings must be accurate and truthful</li>
            <li>Prohibited items: Illegal goods, weapons, drugs, counterfeit products</li>
            <li>Maximum 12 images per listing (10MB each)</li>
            <li>Minimum 30 characters description required</li>
            <li>Price must be clearly stated in Naira (₦)</li>
          </ul>
        </section>

        <section className="terms-section">
          <h2>4. Payments & Transactions</h2>
          <p>
            MarketHub acts as a platform only. We do not hold, transfer, or guarantee payments. 
            All transactions occur directly between buyers and sellers.
          </p>
          <ul>
            <li>Use secure payment methods (bank transfer, Paystack)</li>
            <li>Verify seller before payment</li>
            <li>No escrow service provided</li>
          </ul>
        </section>

        <section className="terms-section">
          <h2>5. Promotions & Features</h2>
          <ul>
            <li>Promotion plans auto-renew monthly</li>
            <li>Featured listings appear higher in search results</li>
            <li>Full refund within 24 hours of purchase</li>
          </ul>
        </section>

        <section className="terms-section">
          <h2>6. User Responsibilities</h2>
          <ul>
            <li>Provide accurate contact information</li>
            <li>Respond to messages within 24 hours</li>
            <li>Honor listed prices and conditions</li>
            <li>Report suspicious activity immediately</li>
          </ul>
        </section>

        <section className="terms-section">
          <h2>7. Prohibited Activities</h2>
          <ul>
            <li>Scams, fraud, or phishing</li>
            <li>Harassment or abusive behavior</li>
            <li>Posting fake listings or reviews</li>
            <li>Automated scraping or bots</li>
            <li>Copyright infringement</li>
          </ul>
        </section>

        <section className="terms-section">
          <h2>8. Account Termination</h2>
          <p>
            We reserve the right to suspend or terminate accounts for violations without notice.
            Repeated offenders will be permanently banned.
          </p>
        </section>

        <section className="terms-section">
          <h2>9. Limitation of Liability</h2>
          <p>
            MarketHub is not responsible for:
          </p>
          <ul>
            <li>Transaction disputes between users</li>
            <li>Product quality or delivery</li>
            <li>Loss of data or account access</li>
            <li>Third-party service failures</li>
          </ul>
        </section>

        <section className="terms-section">
          <h2>10. Governing Law</h2>
          <p>
            These terms are governed by the laws of the <strong>Federal Republic of Nigeria**.
            Disputes will be resolved in Lagos courts.
          </p>
        </section>

        <section className="terms-section terms-actions">
          <div className="accept-section">
            <h3>Do you accept these terms?</h3>
            <div className="action-buttons">
              <button 
                className="btn btn-secondary"
                onClick={() => navigate(-1)}
              >
                ✕ I Decline
              </button>
              <button 
                className="btn btn-primary"
                onClick={() => {
                  localStorage.setItem('termsAccepted', 'true');
                  navigate(-1);
                }}
              >
                ✓ I Accept
              </button>
            </div>
          </div>
        </section>
      </div>

      <button className="scroll-top-btn" onClick={scrollToTop}>
        ↑
      </button>
    </div>
  );
};

export default TermsPolicy;