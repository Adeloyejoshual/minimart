// src/components/terms/TermsSection.jsx

/**
 * Generic section wrapper for all terms content blocks.
 * Provides consistent structure, accessibility attributes,
 * and heading hierarchy across all sections.
 *
 * @param {string}    id       - Unique section identifier for anchor + aria
 * @param {string}    title    - Section heading text
 * @param {ReactNode} children - Section body content
 */
export default function TermsSection({ id, title, children }) {
  return (
    <section
      className="terms-section"
      aria-labelledby={`section-${id}`}
    >
      <h3
        id={`section-${id}`}
        className="terms-section__heading"
      >
        {title}
      </h3>
      <div className="terms-section__body">
        {children}
      </div>
    </section>
  );
}