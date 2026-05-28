// src/pages/TermsAndConditions.jsx
import { useEffect }          from "react";
import { useTermsScroll }     from "../hooks/useTermsScroll";
import { useTermsAcceptance } from "../hooks/useTermsAcceptance";
import { getEnabledSections } from "../data/legal/termsSections";
import { logTermsViewed }     from "../services/legal/legalAuditService";

import {
  TermsHeader,
  TermsFooter,
  ProgressBar,
} from "../components/terms";

import "../styles/terms/base.css";
import "../styles/terms/progress-bar.css";
import "../styles/terms/warning-card.css";
import "../styles/terms/sections.css";
import "../styles/terms/responsive.css";
import "../styles/terms/accessibility.css";

// ── Resolve enabled sections once outside the component ──
// Prevents recomputing on every render
const ENABLED_SECTIONS = getEnabledSections();

/**
 * Terms and Conditions page.
 *
 * Responsibilities:
 *   - Compose layout and section components
 *   - Wire scroll tracking and acceptance hooks
 *   - Pass props downward — no business logic here
 *   - Log page view for legal audit trail
 */
export default function TermsAndConditions() {

  // ── Scroll tracking ──
  const {
    contentRef,
    scrollProgress,
    hasRead,
    setHasRead,
  } = useTermsScroll();

  // ── Acceptance state and submission ──
  const {
    agreed,
    setAgreed,
    isSubmitting,
    submitError,
    handleAccept,
  } = useTermsAcceptance({ setHasRead, userId: null });

  // ── Audit: log page view on mount ──
  useEffect(() => {
    logTermsViewed(null);
  }, []);

  return (
    <>
      {/* Skip navigation for keyboard and screen reader users */}
      <a className="skip-to-content" href="#terms-main">
        Skip to content
      </a>

      <div className="terms-container">

        {/* Sticky header */}
        <TermsHeader />

        {/* Scroll progress indicator */}
        <ProgressBar progress={scrollProgress} />

        {/* Sticky read reminder */}
        <div className="terms-notice" role="note">
          Please read carefully before clicking{" "}
          <strong>"Post Ad"</strong>
        </div>

        {/* Scrollable content region */}
        <main
          id="terms-main"
          className="terms-content"
          ref={contentRef}
          aria-label="Terms and Conditions document"
        >

          {/* Introduction */}
          <p className="terms-intro">
            Welcome to <strong>MiniMart</strong> — a free online
            classifieds platform connecting buyers and sellers worldwide.
            We do <strong>not own, inspect, or guarantee</strong> any
            items listed on this platform. All transactions are strictly
            between the <strong>Buyer</strong> and the{" "}
            <strong>Seller</strong>.
          </p>

          {/* Data-driven section rendering */}
          {ENABLED_SECTIONS.map(({ id, component: Section }) => (
            <Section key={id} />
          ))}

        </main>

        {/* Sticky acceptance footer */}
        <TermsFooter
          hasRead={hasRead}
          agreed={agreed}
          onAgreeChange={setAgreed}
          onAccept={handleAccept}
          isSubmitting={isSubmitting}
          submitError={submitError}
        />

      </div>
    </>
  );
}