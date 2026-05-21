import React, { useCallback, memo, useState, useEffect } from "react";
import { Icon } from "./icons";
import { lastSeenText } from "./constants";

/* ═══════════════════════════════════════════
   HEADER MENU (3-dot dropdown)
═══════════════════════════════════════════ */
const HeaderMenu = memo(function HeaderMenu({
  otherUser, navigate, onClose, onMute, muted,
}) {
  /* close on Escape */
  useEffect(() => {
    const handler = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const goProfile = useCallback(() => {
    onClose();
    if (otherUser?.id) navigate(`/seller/${otherUser.id}`);
  }, [onClose, navigate, otherUser?.id]);

  const handleMute = useCallback(() => {
    onClose();
    onMute();
  }, [onClose, onMute]);

  const handleReport = useCallback(() => {
    onClose();
    alert("Report submitted. We'll review this conversation.");
  }, [onClose]);

  const handleSpam = useCallback(() => {
    onClose();
    alert("Conversation flagged as spam.");
  }, [onClose]);

  return (
    <>
      <div className="chat-menu-overlay" onClick={onClose}/>
      <div className="chat-menu" role="menu" aria-label="Chat options">
        {otherUser?.id && (
          <button className="chat-menu-item" onClick={goProfile} role="menuitem">
            {Icon.user}
            <span>View Profile</span>
          </button>
        )}
        <button className="chat-menu-item" onClick={handleMute} role="menuitem">
          {muted ? Icon.unmute : Icon.mute}
          <span>{muted ? "Unmute" : "Mute"} Notifications</span>
        </button>
        <button className="chat-menu-item" onClick={handleReport} role="menuitem">
          {Icon.flag}
          <span>Report Seller</span>
        </button>
        <button
          className="chat-menu-item chat-menu-danger"
          onClick={handleSpam}
          role="menuitem"
        >
          {Icon.warn}
          <span>Mark as Spam</span>
        </button>
      </div>
    </>
  );
});

/* ═══════════════════════════════════════════
   CONNECTION STATUS BADGE
═══════════════════════════════════════════ */
const ConnectionDot = memo(function ConnectionDot({ connected }) {
  return (
    <div
      className={`chat-sock-dot ${connected ? "connected" : ""}`}
      title={connected ? "Connected" : "Reconnecting…"}
      role="status"
      aria-label={connected ? "Connected" : "Reconnecting"}
    />
  );
});

/* ═══════════════════════════════════════════
   AVATAR
═══════════════════════════════════════════ */
const FALLBACK_SIZE = 80;

const Avatar = memo(function Avatar({ user: u }) {
  const [imgError, setImgError] = useState(false);

  const src = !imgError && u?.profile_image
    ? u.profile_image
    : `https://ui-avatars.com/api/?name=${
        encodeURIComponent(u?.name || "U")
      }&background=111&color=fff&size=${FALLBACK_SIZE}`;

  const handleError = useCallback(() => setImgError(true), []);

  /* reset error flag when user changes */
  useEffect(() => setImgError(false), [u?.profile_image]);

  return (
    <div className="chat-avatar-wrap">
      <img
        className="chat-avatar"
        src={src}
        alt={u?.name || "User"}
        onError={handleError}
        loading="lazy"
      />
      {u?.is_online && <span className="chat-online-dot" aria-label="Online"/>}
    </div>
  );
});

/* ═══════════════════════════════════════════
   PRODUCT THUMB (clickable)
═══════════════════════════════════════════ */
const ProductThumb = memo(function ProductThumb({ product, navigate }) {
  const [imgError, setImgError] = useState(false);

  const handleError = useCallback(() => setImgError(true), []);

  const handleClick = useCallback(() => {
    if (product?.id) navigate(`/product/${product.id}`);
  }, [product?.id, navigate]);

  useEffect(() => setImgError(false), [product?.images]);

  if (!product?.images?.[0] || imgError) return null;

  return (
    <img
      className="chat-product-thumb"
      src={product.images[0]}
      alt={product.title || "Product"}
      title={product.title}
      onClick={handleClick}
      onError={handleError}
      loading="lazy"
    />
  );
});

/* ═══════════════════════════════════════════
   HEADER STATUS TEXT
═══════════════════════════════════════════ */
const StatusLine = memo(function StatusLine({ otherUser, isTyping }) {
  if (isTyping) {
    return (
      <div className="chat-header-status typing" aria-live="polite">
        typing…
      </div>
    );
  }

  if (otherUser?.is_online) {
    return (
      <div className="chat-header-status online">Online</div>
    );
  }

  return (
    <div className="chat-header-status offline">
      {lastSeenText(otherUser?.last_login)}
    </div>
  );
});

/* ═══════════════════════════════════════════
   MAIN HEADER
═══════════════════════════════════════════ */
function ChatHeader({
  otherUser,
  product,
  isTyping,
  sockReady,
  showMenu,
  onToggleMenu,
  onMenuClose,
  navigate,
  muted,
  onMute,
}) {
  const goBack = useCallback(() => navigate(-1), [navigate]);

  const goProfile = useCallback(() => {
    if (otherUser?.id) navigate(`/seller/${otherUser.id}`);
  }, [otherUser?.id, navigate]);

  return (
    <>
      <header className="chat-header" role="banner">
        {/* Back button */}
        <button
          className="chat-icon-btn"
          onClick={goBack}
          aria-label="Go back"
        >
          {Icon.back}
        </button>

        {/* Avatar */}
        <Avatar user={otherUser}/>

        {/* Name + Status — tappable to view profile */}
        <div
          className="chat-header-info"
          onClick={goProfile}
          role="button"
          tabIndex={0}
          aria-label={`View ${otherUser?.name || "user"}'s profile`}
          onKeyDown={e => { if (e.key === "Enter") goProfile(); }}
        >
          <div className="chat-header-name">
            {otherUser?.name || "…"}
            {otherUser?.store_name && (
              <span className="chat-header-store">
                {otherUser.store_name}
              </span>
            )}
          </div>
          <StatusLine otherUser={otherUser} isTyping={isTyping}/>
        </div>

        {/* Product thumbnail */}
        <ProductThumb product={product} navigate={navigate}/>

        {/* Connection status */}
        <ConnectionDot connected={sockReady}/>

        {/* 3-dot menu trigger */}
        <button
          className="chat-icon-btn"
          onClick={onToggleMenu}
          aria-label="Chat options"
          aria-haspopup="menu"
          aria-expanded={showMenu}
        >
          {Icon.more}
        </button>
      </header>

      {/* Dropdown menu */}
      {showMenu && (
        <HeaderMenu
          otherUser={otherUser}
          navigate={navigate}
          onClose={onMenuClose}
          onMute={onMute}
          muted={muted}
        />
      )}
    </>
  );
}

export default memo(ChatHeader);