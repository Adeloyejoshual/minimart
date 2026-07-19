/**
 * Generic section wrapper.
 * Renders a labelled card that groups related SettingsItems.
 */
export default function SettingsSection({ title, children, className = "" }) {
  return (
    <section className={`settings-section ${className}`}>
      {title && (
        <h2 className="settings-section__title">{title}</h2>
      )}
      <div className="settings-section__card">
        {children}
      </div>
    </section>
  );
}