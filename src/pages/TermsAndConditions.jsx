// src/pages/TermsAndConditions.jsx
import { useNavigate } from "react-router-dom";
import "./TermsAndConditions.css";

export default function TermsAndConditions() {
  const navigate = useNavigate();

  return (
    <div className="terms-container">

      {/* ── Header ── */}
      <div className="terms-header">
        <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>
        <h2>Terms &amp; Conditions</h2>
      </div>

      {/* ── Content ── */}
      <div className="terms-content">

        <p className="terms-intro">
          Welcome to <strong>MiniMart</strong>. By using our platform — posting, browsing,
          or interacting with listings — you agree to the terms below.
        </p>

        <h3>1. Acceptance of Terms</h3>
        <p>
          By clicking <em>"Post Ad"</em> you accept these Terms of Use, confirm you will follow
          our Safety Tips, and declare that your listing does not include any prohibited items.
        </p>

        <h3>2. Posting Guidelines</h3>
        <ul>
          <li>No illegal, stolen, or counterfeit items.</li>
          <li>Provide accurate descriptions, pricing, and delivery information.</li>
          <li>Respect other users — no spam, misleading content, or duplicate listings.</li>
          <li>Images must represent the actual item being sold.</li>
        </ul>

        <h3>3. Safety Tips</h3>
        <ul>
          <li>Meet in public, well-lit places when exchanging items.</li>
          <li>Verify buyer or seller information before completing a transaction.</li>
          <li>Never share sensitive personal or financial information unnecessarily.</li>
          <li>MiniMart will never ask for your password or bank PIN.</li>
        </ul>

        <h3>4. Delivery &amp; Payment</h3>
        <p>
          Users are solely responsible for the accuracy of delivery details, fees, and estimated
          timelines. Payment disputes between users are not managed by MiniMart.
        </p>

        <h3>5. Prohibited Items</h3>
        <ul>
          <li>Weapons, ammunition, or dangerous materials.</li>
          <li>Drugs or prescription medicine without authorisation.</li>
          <li>Content that infringes intellectual property rights.</li>
          <li>Adult or explicit content.</li>
        </ul>

        <h3>6. Account &amp; Listing Suspension</h3>
        <p>
          MiniMart reserves the right to remove any listing or suspend any account that violates
          these terms, without prior notice.
        </p>

        <h3>7. Liability</h3>
        <p>
          MiniMart is a platform connecting buyers and sellers. We are not party to any
          transaction and are not liable for disputes, damages, or losses between users.
        </p>

        <h3>8. Changes to Terms</h3>
        <p>
          We may update these terms at any time. Continued use of the platform after an update
          constitutes acceptance of the revised terms.
        </p>

        <p className="terms-note">
          By posting an ad you confirm that you have read, understood, and agree to comply
          with these Terms &amp; Conditions.
        </p>

      </div>

      {/* ── Footer ── */}
      <div className="terms-footer">
        <button className="back-btn" onClick={() => navigate(-1)}>
          ← Back to Add Product
        </button>
      </div>

    </div>
  );
}
