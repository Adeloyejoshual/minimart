// src/components/terms/layouts/TermsLayout.jsx

/**
 * TermsLayout
 *
 * Structural shell for the Terms and Conditions page.
 * Responsibilities:
 *   - Page-level max-width and centering
 *   - Flex column layout for sticky header/footer
 *   - Scroll region containment
 *   - Shared animation wrapper (extend later)
 *   - Isolates layout concerns from content concerns
 *
 * The main page component passes composed children —
 * this component only controls structure.
 */
export default function TermsLayout({
  header,
  progressBar,
  notice,
  content,
  footer,
}) {
  return (
    <div className="terms-layout">

      {/* Fixed top block — header + progress + notice */}
      <div className="terms-layout__top">
        {header}
        {progressBar}
        {notice}
      </div>

      {/* Scrollable region */}
      <div className="terms-layout__body">
        {content}
      </div>

      {/* Sticky acceptance footer */}
      <div className="terms-layout__footer">
        {footer}
      </div>

    </div>
  );
}