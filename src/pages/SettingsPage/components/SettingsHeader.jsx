import { useNavigate } from "react-router-dom";

export default function SettingsHeader() {
  const navigate = useNavigate();

  return (
    <header className="settings-header">
      <button
        className="settings-header__back"
        onClick={() => navigate(-1)}
        aria-label="Go back"
        type="button"
      >
        <svg width="20" height="20" viewBox="0 0 24 24"
          fill="none" stroke="currentColor"
          strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      <h1 className="settings-header__title">Settings</h1>

      {/* Spacer keeps title centred */}
      <div className="settings-header__spacer" aria-hidden="true" />
    </header>
  );
}