// src/components/ProfileHeader.jsx

import { memo } from "react";
import { useNavigate } from "react-router-dom";

const Icon = {
  back: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
    </svg>
  ),
  edit: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  ),
  dots: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5"  r="2"/>
      <circle cx="12" cy="12" r="2"/>
      <circle cx="12" cy="19" r="2"/>
    </svg>
  ),
  notify: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  logout: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
  chevron: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  ),
};

/**
 * ProfileHeader
 *
 * Sticky header used by Profile.jsx and EditProfile.jsx.
 *
 * Props:
 *  title        string   — center title text
 *  onBack       fn       — back button handler (optional, defaults to navigate(-1))
 *  menuOpen     bool     — dropdown open state
 *  onMenuToggle fn       — toggle dropdown
 *  onMenuClose  fn       — close dropdown
 *  menuRef      ref      — forwarded ref for outside-click detection
 *  onEdit       fn       — called when "Edit Profile" is clicked
 *  onNotif      fn       — called when "Notifications" is clicked
 *  onLogout     fn       — called when "Log Out" is clicked
 *  rightAction  node     — optional custom right element (used by EditProfile)
 *  showMenu     bool     — whether to render the 3-dot menu (default true)
 */
const ProfileHeader = memo(function ProfileHeader({
  title       = "My Profile",
  onBack,
  menuOpen    = false,
  onMenuToggle,
  onMenuClose,
  menuRef,
  onEdit,
  onNotif,
  onLogout,
  rightAction,
  showMenu    = true,
}) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) onBack();
    else navigate(-1);
  };

  return (
    <header className="pf-header">
      <button
        className="pf-hdr-btn"
        onClick={handleBack}
        aria-label="Go back"
        type="button"
      >
        <Icon.back />
      </button>

      <span className="pf-hdr-title">{title}</span>

      <div className="pf-hdr-right">
        {/* Custom right action (e.g. Save button in EditProfile) */}
        {rightAction && rightAction}

        {/* Edit shortcut icon — only on Profile page */}
        {!rightAction && onEdit && (
          <button
            className="pf-hdr-btn"
            onClick={onEdit}
            aria-label="Edit profile"
            type="button"
          >
            <Icon.edit />
          </button>
        )}

        {/* 3-dot menu */}
        {showMenu && (
          <div className="pf-dots-wrap" ref={menuRef}>
            <button
              className="pf-hdr-btn"
              onClick={onMenuToggle}
              aria-label="More options"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              type="button"
            >
              <Icon.dots />
            </button>

            {menuOpen && (
              <div className="pf-dropdown" role="menu">
                {onEdit && (
                  <button
                    className="pf-dropdown-item"
                    role="menuitem"
                    onClick={() => { onMenuClose?.(); onEdit(); }}
                    type="button"
                  >
                    <Icon.edit /> Edit Profile
                  </button>
                )}
                {onNotif && (
                  <button
                    className="pf-dropdown-item"
                    role="menuitem"
                    onClick={() => { onMenuClose?.(); onNotif(); }}
                    type="button"
                  >
                    <Icon.notify /> Notifications
                  </button>
                )}
                <div className="pf-dropdown-divider" aria-hidden="true" />
                {onLogout && (
                  <button
                    className="pf-dropdown-item pf-dropdown-item--danger"
                    role="menuitem"
                    onClick={() => { onMenuClose?.(); onLogout(); }}
                    type="button"
                  >
                    <Icon.logout /> Log Out
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
});

export default ProfileHeader;