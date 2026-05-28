// src/pages/TermsAndConditions.jsx
import { useNavigate } from "react-router-dom";
import "./TermsAndConditions.css";

export default function TermsAndConditions() {
  const navigate = useNavigate();

  return (
    <div className="terms-container">
      <div className="terms-header">
        <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>
        <h2>Terms of Use & Posting Rules</h2>
        <p className="location-badge">Applicable in Nigeria</p>
      </div>

      <div className="terms-content">
        <p className="terms-intro">
          MiniMart is an online classifieds platform. We do not own, inspect, or 
          guarantee any items listed. <strong>Transactions are strictly between 
          the Buyer and the Seller.</strong>
        </p>

        {/* 1. NIGERIAN LAW COMPLIANCE */}
        <h3>1. Legal Compliance</h3>
        <p>
          By using MiniMart, you agree to comply with the <strong>Cybercrimes Act 
          of 2015</strong> and the <strong>Federal Competition and Consumer 
          Protection Act (FCCPA)</strong>. You shall not use this platform for 
          "Yahoo-Yahoo" (internet fraud), money laundering, or obtaining money 
          under false pretenses (419).
        </p>

        {/* 2. NO PAYMENT ON PLATFORM */}
        <h3 className="warning-text">2. Payment & Transactions</h3>
        <ul>
          <li><strong>MiniMart is NOT a payment platform.</strong> We do not 
              collect money for items.</li>
          <li>We strongly advise: <strong>DO NOT PAY IN ADVANCE</strong> (no 
              "commitment fee" or "delivery fee") before seeing the item.</li>
          <li>Payments should be made via bank transfer or cash <strong>ONLY 
              AFTER</strong> physical inspection and verification of the item.</li>
        </ul>

        {/* 3. PROHIBITED ITEMS (NIGERIA CUSTOMS & POLICE) */}
        <h3>3. Prohibited Items (Nigeria)</h3>
        <p>The following items are strictly banned on MiniMart Nigeria:</p>
        <ul>
          <li><strong>Customs Contraband:</strong> Foreign parboiled rice, 
              used clothing (Okrika) in bulk, or any item on the Nigeria 
              Customs Service prohibition list.</li>
          <li><strong>Regulated Meds:</strong> Tramadol, Codeine, or 
              unregistered NAFDAC products.</li>
          <li><strong>Documents:</strong> Fake NIN, Passports, Drivers Licenses, 
              or University Certificates.</li>
          <li><strong>Weapons:</strong> Firearms, locally made pistols, 
              or military/police uniforms and gear.</li>
          <li><strong>Land/Property:</strong> Listings without proof of 
              ownership (C of O or Governor's Consent) are subject to removal.</li>
        </ul>

        {/* 4. SAFETY & MEETUPS */}
        <h3>4. Physical Safety Guidelines</h3>
        <ul>
          <li>Always meet in <strong>busy public places</strong> (e.g., Shoprite, 
              Fuel Stations, or Fast Food restaurants).</li>
          <li><strong>Inspect before you pay:</strong> Ensure the phone, 
              laptop, or car is in the condition described.</li>
          <li>If a deal seems too cheap to be true (e.g., iPhone 15 for 
              ₦150,000), it is likely a scam.</li>
        </ul>

        {/* 5. DATA PRIVACY (NDPR) */}
        <h3>5. Privacy & Data</h3>
        <p>
          In line with the <strong>Nigeria Data Protection Regulation (NDPR)</strong>, 
          by posting an ad, you consent to your phone number being visible to 
          potential buyers. We will not sell your data to 3rd party advertisers.
        </p>

        {/* 6. LIMITATION OF LIABILITY */}
        <h3>6. Disclaimer of Liability</h3>
        <p>
          MiniMart, its directors, and employees are <strong>NOT LIABLE</strong> 
          for any financial loss, physical harm, or fraud arising from 
          interactions on this platform. You use this service at your own risk.
        </p>

        <h3>7. Reporting Fraud</h3>
        <p>
          If you encounter a scammer, report the ad immediately. We cooperate 
          with the <strong>EFCC</strong> and <strong>Nigeria Police Force</strong> 
          to provide logs of fraudulent users.
        </p>

        <p className="terms-note">
          By clicking "Post Ad", you agree to these terms under the jurisdiction 
          of the High Courts of the Federal Republic of Nigeria.
        </p>
      </div>

      <div className="terms-footer">
        <button className="back-btn" onClick={() => navigate(-1)}>
          Confirm & Go Back
        </button>
      </div>
    </div>
  );
}