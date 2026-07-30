// src/pages/Profile/EditProfileMobile.jsx

import { useState, useCallback } from "react";
import ProfileHeader from "../../components/ProfileHeader.jsx";
import "../../styles/EditProfile.css";

import { useEditProfile } from "./useEditProfile";
import {
  useToast, ToastStack, useSaveFlash,
  SkeletonPage, DiscardModal, RetryModal, CropModal,
  TabPersonal, TabStore, UnsavedBanner, Ic,
} from "./EditProfileShared.jsx";

const TABS = [
  { id: "personal", label: "Personal", emoji: "👤" },
  { id: "store",    label: "Store",    emoji: "🏪" },
];

export default function EditProfileMobile({ onProfileUpdate }) {
  const [tab, setTab] = useState("personal");
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
      <div className="ep-page">
        <ProfileHeader
          title="Edit Profile"
          onBack={() => ep.reqDiscard(() => ep.nav(-1))}
          showMenu={false}
          rightAction={
            <button
              className={`ep-hdr-save ${savedFlash?"ep-hdr-save--flash":""} ep-hdr-save--desktop-only`}
              onClick={ep.save} disabled={ep.saveDisabled} type="button"
              title="Save Changes (Ctrl+S)"
            >
              {ep.saving
                ? <span className="ep-spinner ep-spinner--sm ep-spinner--white"/>
                : savedFlash ? "✔ Saved" : "Save"}
            </button>
          }
        />

        <div className="ep-tabs" role="tablist">
          {TABS.map(t => (
            <button key={t.id} role="tab" aria-selected={tab===t.id}
                    className={`ep-tab${tab===t.id?" ep-tab--active":""}`}
                    onClick={() => setTab(t.id)} type="button">
              <span className="ep-tab-emoji">{t.emoji}</span>
              <span className="ep-tab-label">{t.label}</span>
            </button>
          ))}
        </div>

        {ep.hasDraft && (
          <div className="ep-draft-banner" role="status">
            <span>📝 Restored unsaved draft</span>
            <button className="ep-draft-dismiss" onClick={ep.dismissDraft}>Dismiss</button>
          </div>
        )}

        {ep.dirty && (
          <UnsavedBanner
            onSave={ep.save}
            onDiscard={() => ep.reqDiscard(null)}
            saving={ep.saving}
            uploading={ep.upl}
            flash={savedFlash}
            disabled={ep.saveDisabled}
          />
        )}

        {showBlockNotice && blockNoticeText && (
          <div className="ep-username-block-notice" role="alert">
            {blockNoticeText}
          </div>
        )}

        <div className="ep-body">
          <div role="tabpanel" hidden={tab!=="personal"}>
            <TabPersonal
              form={ep.form} errors={ep.errors} onChange={ep.onChange}
              profilePreview={ep.ppv} uploading={ep.upl}
              uploadProgress={ep.uplPct} uploadPhase={ep.uplPh}
              onPickPhoto={f => ep.pickImg(f, "profile")}
              onRemovePhoto={ep.rmProfile}
              onVerify={() => ep.nav("/verification")}
              origUN={ep.orig?.username || ""}
              cooldown={ep.cooldown}
              onUsernameStatus={ep.setUsernameStatus}
            />
          </div>
          <div role="tabpanel" hidden={tab!=="store"}>
            <TabStore
              form={ep.form} errors={ep.errors} onChange={ep.onChange}
              storePreview={ep.spv} uploading={ep.upl}
              uploadProgress={ep.uplPct} uploadPhase={ep.uplPh}
              onPickLogo={f => ep.pickImg(f, "store")}
              onRemoveLogo={ep.rmStore}
            />
          </div>
        </div>

        {ep.dirty && (
          <div className="ep-bottom-actions">
            <button
              className="ep-bottom-btn ep-bottom-btn--discard"
              onClick={() => ep.reqDiscard(null)}
              disabled={ep.saving || !!ep.upl} type="button"
            >
              Discard Changes
            </button>
            <button
              className={`ep-bottom-btn ep-bottom-btn--save ${savedFlash?"ep-bottom-btn--flash":""}`}
              onClick={ep.save} disabled={ep.saveDisabled} type="button"
            >
              {ep.saving
                ? <><span className="ep-spinner ep-spinner--sm ep-spinner--white"/> Saving…</>
                : savedFlash ? "✔ Saved" : "Save Changes"}
            </button>
          </div>
        )}

        <p className="ep-footer">Loemart Technologies Ltd · © {new Date().getFullYear()}</p>
      </div>

      {ep.cropSrc && (
        <CropModal src={ep.cropSrc} shape={ep.cropTgt==="profile"?"circle":"square"}
                   onConfirm={ep.onCropOk} onCancel={() => ep.setCropSrc(null)}/>
      )}
      {ep.showDiscard && <DiscardModal onConfirm={ep.doDiscard} onCancel={ep.cancelDiscard}/>}
      {ep.showRetry && (
        <RetryModal target={ep.failUp?.target} errorMsg={ep.failUp?.errorMsg}
                    previewUrl={ep.failUp?.previewUrl}
                    onRetry={ep.retryUp} onCancel={ep.cancelRetry}/>
      )}
      <ToastStack toasts={toasts} dismiss={dismiss}/>
    </>
  );
}