// src/pages/TermsAndConditions.jsx
import { useNavigate } from "react-router-dom";
import "./TermsAndConditions.css";

export default function TermsAndConditions() {
  const navigate = useNavigate();

  return (
    <div className="terms-container">
      {/* HEADER */}
      <div className="terms-header">
        <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>
        <h2>Terms and Conditions</h2>
      </div>

      {/* CONTENT */}
      <div className="terms-content">
        <p>Welcome to MiniMart. By using our platform, posting, or interacting with products, you agree to the following:</p>

        <h3>1. Acceptance of Terms</h3>
        <p>By clicking Post Ad, you accept these Terms of Use, agree to abide by the Safety Tips, and confirm that your listing does not include prohibited items.</p>

        <h3>2. Posting Guidelines</h3>
        <ul>
          <li>No illegal, stolen, or counterfeit items.</li>
          <li>Ensure accurate descriptions, pricing, and delivery information.</li>
          <li>Respect other users and avoid spam or misleading content.</li>
        </ul>

        <h3>3. Safety Tips</h3>
        <ul>
          <li>Meet in public places when exchanging items.</li>
          <li>Verify buyer or seller information before transactions.</li>
          <li>Never share sensitive personal information unnecessarily.</li>
        </ul>

        <h3>4. Delivery & Payment</h3>
        <p>Users are responsible for delivery details they provide. Any delivery fees or estimated days must be accurate.</p>

        <h3>5. Liability</h3>
        <p>MiniMart is not responsible for any disputes, damages, or losses between users. All listings are made by the users themselves.</p>

        <h3>6. Changes to Terms</h3>
        <p>We may update these terms at any time. Continued use of the platform constitutes acceptance of updated terms.</p>

        <p className="note">By posting an ad, you confirm that you have read and understood these terms and agree to comply.</p>
      </div>
    </div>
  );
}