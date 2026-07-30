// src/desktop/EditProfileDesktop.tsx

import { useState } from "react";
import { Link } from "react-router-dom";
import "../styles/EditProfile.css";
import "./EditProfileDesktop.css";

import { useEditProfile } from "../pages/Profile/useEditProfile";
import {
  useToast, ToastStack, useSaveFlash,
  SkeletonPage, DiscardModal, RetryModal, CropModal,
  TabPersonal, TabStore, Ic,
} from "../pages/Profile/EditProfileShared.jsx";

interface Props {
  onProfileUpdate?: (data: any) => void;
}

const NAV_ITEMS = [
  { id: "personal", label: "Personal Information", desc: "Name, contact, location", emoji: "👤" },
  { id: "store",    label: "Store Details",         desc: "Branding & business hours", emoji: "🏪" },
];

export default function EditProfileDesktop({ onProfileUpdate }: Props) {
  const [section, setSection] = useState<"personal" | "store">("personal");
  const { toasts, push, dismiss } = useToast();
  const { f: savedFlash, flash: flashSaved } = useSaveFlash();

  const ep = useEditProfile({ onProfileUpdate, push, flashSaved });

  if (ep.loading) return <SkeletonPage />;

  // Block notice text
  const showBlockNotice = ep.unBlocking && ep.dirty;
  let blockNoticeText = "";
  if (showBlockNotice) {
    if ((ep.cooldown && !ep.cooldown.can_change) || ep.usernameStatus === "locked") {
      const dl = ep.cooldown?.days_left ?? 0;
      blockNoticeText = `🔒 Username locked for ${dl} more day${dl !== 1 ? "s" : ""}`;
    } else if (ep.usernameStatus === "taken") {
      blockNoticeText = `✗ "${ep.form.username}" is already taken`;
    } else if (ep.usernameStatus === "checking") {
      blockNoticeText = "⏳ Checking username…";
    }
  }

  return (
    <>
      <div className="epd-page">
        {/* ── Top Bar ── */}
        <header className="epd-topbar">
          <div className="epd-topbar-left">
            <button
              className="epd-back-btn"
              onClick={() => ep.reqDiscard(() => ep.nav(-1))}
              aria-label="Back"
            >
              <Ic.back /> Back
            </button>
            <div className="epd-topbar-title-wrap">
              <h1 className="epd-topbar-title">Edit Profile</h1>
              <p className="epd-topbar-sub">
                Manage your personal information and store details
              </p>
            </div>
          </div>

          <div className="epd-topbar-right">
            {ep.dirty && (
              <span className="epd-unsaved-chip">
                <span className="epd-unsaved-dot"/>
                Unsaved changes
              </span>
            )}

            {ep.form.username && (
              <Link
                to={`/seller/${ep.form.username}`}
                className="epd-view-store-btn"
                title="View your public store"
              >
                <Ic.store /> View Store
              </Link>
            )}

            <button
              className="epd-discard-btn"
              onClick={() => ep.reqDiscard(null)}
              disabled={!ep.dirty || ep.saving || !!ep.upl}
              type="button"
            >
              Discard
            </button>

            <button
              className={`epd-save-btn ${savedFlash?"epd-save-btn--flash":""}`}
              onClick={ep.save}
              disabled={ep.saveDisabled}
              type="button"
              title="Save Changes (Ctrl+S)"
            >
              {ep.saving
                ? <><span className="ep-spinner ep-spinner--sm ep-spinner--white"/> Saving…</>
                : savedFlash ? "✔ Saved" : "Save Changes"}
            </button>
          </div>
        </header>

        {/* ── Draft / Block banners ── */}
        {ep.hasDraft && (
          <div className="epd-banner epd-banner--draft" role="status">
            <span>📝 Your unsaved draft was restored</span>
            <button onClick={ep.dismissDraft}>Dismiss</button>
          </div>
        )}

        {showBlockNotice && blockNoticeText && (
          <div className="epd-banner epd-banner--warn" role="alert">
            {blockNoticeText}
          </div>
        )}

        {/* ── Main Layout: Sidebar + Content ── */}
        <div className="epd-layout">
          {/* Sidebar Navigation */}
          <aside className="epd-sidebar" aria-label="Profile sections">
            <nav className="epd-nav">
              {NAV_ITEMS.map(item => (
                <button
                  key={item.id}
                  className={`epd-nav-item${
                    section === item.id ? " epd-nav-item--active" : ""
                  }`}
                  onClick={() => setSection(item.id as "personal" | "store")}
                  type="button"
                >
                  <span className="epd-nav-emoji" aria-hidden="true">{item.emoji}</span>
                  <div className="epd-nav-text">
                    <span className="epd-nav-label">{item.label}</span>
                    <span className="epd-nav-desc">{item.desc}</span>
                  </div>
                </button>
              ))}
            </nav>

            {/* Sidebar footer — quick info */}
            <div className="epd-sidebar-footer">
              <div className="epd-sidebar-tip">
                <Ic.info />
                <p>
                  Changes save automatically as a draft. Your profile isn't
                  updated until you click <strong>Save Changes</strong>.
                </p>
              </div>
            </div>
          </aside>

          {/* Content Area */}
          <main className="epd-content">
            <div className="epd-content-inner">
              {section === "personal" && (
                <div className="epd-tabpanel" role="tabpanel">
                  <TabPersonal
                    form={ep.form}
                    errors={ep.errors}
                    onChange={ep.onChange}
                    profilePreview={ep.ppv}
                    uploading={ep.upl}
                    uploadProgress={ep.uplPct}
                    uploadPhase={ep.uplPh}
                    onPickPhoto={f => ep.pickImg(f, "profile")}
                    onRemovePhoto={ep.rmProfile}
                    onVerify={() => ep.nav("/verification")}
                    origUN={ep.orig?.username || ""}
                    cooldown={ep.cooldown}
                    onUsernameStatus={ep.setUsernameStatus}
                  />
                </div>
              )}

              {section === "store" && (
                <div className="epd-tabpanel" role="tabpanel">
                  <TabStore
                    form={ep.form}
                    errors={ep.errors}
                    onChange={ep.onChange}
                    storePreview={ep.spv}
                    uploading={ep.upl}
                    uploadProgress={ep.uplPct}
                    uploadPhase={ep.uplPh}
                    onPickLogo={f => ep.pickImg(f, "store")}
                    onRemoveLogo={ep.rmStore}
                  />
                </div>
              )}
            </div>

            <footer className="epd-footer">
              <span>© {new Date().getFullYear()} Loemart Technologies</span>
              <div className="epd-footer-links">
                <Link to="/terms">Terms</Link>
                <Link to="/privacy">Privacy</Link>
                <Link to="/help">Help</Link>
              </div>
            </footer>
          </main>
        </div>
      </div>

      {/* Modals */}
      {ep.cropSrc && (
        <CropModal
          src={ep.cropSrc}
          shape={ep.cropTgt==="profile" ? "circle" : "square"}
          onConfirm={ep.onCropOk}
          onCancel={() => ep.setCropSrc(null)}
        />
      )}
      {ep.showDiscard && (
        <DiscardModal onConfirm={ep.doDiscard} onCancel={ep.cancelDiscard} />
      )}
      {ep.showRetry && (
        <RetryModal
          target={ep.failUp?.target}
          errorMsg={ep.failUp?.errorMsg}
          previewUrl={ep.failUp?.previewUrl}
          onRetry={ep.retryUp}
          onCancel={ep.cancelRetry}
        />
      )}
      <ToastStack toasts={toasts} dismiss={dismiss} />
    </>
  );
}