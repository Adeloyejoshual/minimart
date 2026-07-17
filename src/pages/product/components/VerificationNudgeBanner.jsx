/**
 * src/pages/product/components/VerificationNudgeBanner.jsx
 * Banner shown after product creation when verification is needed
 */
import { Link }       from "react-router-dom";
import { ShieldIcon } from "./icons/index.jsx";
import "./styles/VerificationNudgeBanner.css";

export default function VerificationNudgeBanner({ verificationData }) {
  if (!verificationData) return null;

  const { daysRemaining = 7, message } = verificationData;

  return (
    <div className="verification-nudge-banner" role="status">
      <div className="verification-nudge-icon">
        <ShieldIcon />
      </div>
      <div className="verification-nudge-content">
        <strong>
          Your listing is live for {daysRemaining} day{daysRemaining !== 1 ? "s" : ""}
        </strong>
        <p>
          {message ?? "Complete identity verification to make your listings permanent."}
        </p>
        <Link to="/verification" className="primary-btn verification-nudge-btn">
          Complete Verification
        </Link>
      </div>
    </div>
  );
}