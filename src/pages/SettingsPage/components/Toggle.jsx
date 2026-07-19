/**
 * Accessible toggle switch used in NotificationsSection.
 */
export default function Toggle({ checked, onChange, label, id }) {
  return (
    <label
      className={`settings-toggle ${checked ? "settings-toggle--on" : ""}`}
      htmlFor={id}
      aria-label={label}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="settings-toggle__input"
        aria-checked={checked}
      />
      <span className="settings-toggle__track">
        <span className="settings-toggle__thumb" />
      </span>
    </label>
  );
}