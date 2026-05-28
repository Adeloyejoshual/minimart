// src/components/terms/sections/LiabilitySection.jsx
import TermsSection from "../TermsSection";

export default function LiabilitySection() {
  return (
    <TermsSection id="liability" title="12. Limitation of Liability">
      <p>
        To the maximum extent permitted by applicable law,{" "}
        <strong>MiniMart, its directors, employees, and agents</strong>{" "}
        shall not be liable for:
      </p>
      <ul>
        <li>Financial losses resulting from transactions between users.</li>
        <li>Physical harm during meetups or exchanges.</li>
        <li>Fraud, theft, or criminal activity by other users.</li>
        <li>Loss of data or technical failures on the platform.</li>
        <li>
          Any indirect, incidental, or consequential damages arising
          from use of this platform.
        </li>
      </ul>
    </TermsSection>
  );
}