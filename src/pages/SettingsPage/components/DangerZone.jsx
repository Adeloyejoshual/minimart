import SettingsSection from "./SettingsSection.jsx";
import SettingsItem    from "./SettingsItem.jsx";

export default function DangerZone({ settings }) {
  const {
    handleLogout,
    deleteStep,
    deleteInput,
    setDeleteInput,
    requestDeleteAccount,
    cancelDeleteAccount,
    confirmDeleteAccount,
  } = settings;

  return (
    <SettingsSection title="Account Actions" className="settings-section--danger">

      {/* Log out */}
      <SettingsItem
        icon="🚪"
        label="Log Out"
        onClick={handleLogout}
      />

      {/* Delete account — idle state */}
      {deleteStep === 0 && (
        <SettingsItem
          icon="🗑️"
          label="Delete Account"
          sublabel="Permanently remove your account and all data"
          danger
          last
          onClick={requestDeleteAccount}
        />
      )}

      {/* Delete account — confirmation step */}
      {deleteStep >= 1 && (
        <div className="settings-delete-confirm">
          <p className="settings-delete-confirm__warning">
            ⚠️ This action is <strong>permanent</strong> and cannot be undone.
            All your listings, messages, and account data will be deleted.
          </p>

          <label
            htmlFor="delete-confirm-input"
            className="settings-delete-confirm__label"
          >
            Type <strong>DELETE</strong> to confirm
          </label>

          <input
            id="delete-confirm-input"
            type="text"
            className="settings-delete-confirm__input"
            placeholder="DELETE"
            value={deleteInput}
            onChange={(e) => setDeleteInput(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            disabled={deleteStep === 2}
          />

          <div className="settings-delete-confirm__actions">
            <button
              type="button"
              className="settings-delete-confirm__cancel"
              onClick={cancelDeleteAccount}
              disabled={deleteStep === 2}
            >
              Cancel
            </button>

            <button
              type="button"
              className="settings-delete-confirm__submit"
              onClick={confirmDeleteAccount}
              disabled={
                deleteStep === 2 ||
                deleteInput.trim().toLowerCase() !== "delete"
              }
            >
              {deleteStep === 2 ? (
                <>
                  <span className="settings-spinner" aria-hidden="true" />
                  Deleting…
                </>
              ) : (
                "Delete My Account"
              )}
            </button>
          </div>
        </div>
      )}

    </SettingsSection>
  );
}