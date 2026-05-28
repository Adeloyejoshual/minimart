// src/pages/TermsAndConditions.jsx
import { useTermsScroll }     from "../hooks/useTermsScroll";
import { useTermsAcceptance } from "../hooks/useTermsAcceptance";
import { getEnabledSections } from "../data/legal/termsSections";
import { logTermsViewed }     from "../services/legal/legalAuditService";
import { useEffect }          from "react";

import {
  TermsHeader,
  TermsFooter,
  ProgressBar,
}                             from "../components/terms";

import TermsLayout            from "../components/terms/layouts/TermsLayout";

import "../styles/terms/base.css";
import "../styles/terms/progress-bar.css";
import "../styles/terms/warning-card.css";
import "../styles/terms/sections.css";
import "../styles/terms/responsive.css";
import "../styles/terms/accessibility.css";

const ENABLED_SECTIONS = getEnabledSections();

export default function TermsAndConditions() {

  const {
    contentRef,
    scrollProgress,
    hasRead,
    setHasRead,
  } = useTermsScroll();

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

      <TermsLayout
        header={<TermsHeader />}

        progressBar={<ProgressBar progress={scrollProgress} />}

        notice={
          <div className="terms-notice" role="note">
            Please read carefully before clicking{" "}
            <strong>"Post Ad"</strong>
          </div>
        }

        content={
          <main
            id="terms-main"
            className="terms-content"
            ref={contentRef}
            aria-label="Terms and Conditions document"
          >
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
        }

        footer={
          <TermsFooter
            hasRead={hasRead}
            agreed={agreed}
            onAgreeChange={setAgreed}
            onAccept={handleAccept}
            isSubmitting={isSubmitting}
            submitError={submitError}
          />
        }
      />
    </>
  );
}