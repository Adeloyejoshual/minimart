import React, { useCallback, memo, useState, useEffect } from "react";
import { Icon }         from "./icons";
import { lastSeenText } from "./constants";

/* ════════════════════════════════════
   HEADER MENU
════════════════════════════════════ */
const HeaderMenu = memo(function HeaderMenu({
  otherUser, navigate, onClose,
  onMute, muted,
  onDeleteChat, onReport, isBuyer,
}) {
  /* close on Escape */
  useEffect(() => {
    const h = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const goProfile = useCallback(() => {
    onClose();
    /* ← navigates to /seller/:id — matches your route */
    if (otherUser?.id) navigate(`/seller/${otherUser.id}`);
  }, [onClose, navigate, otherUser?.id]);

  const handleMute = useCallback(() => {
    onClose(); onMute();
  }, [onClose, onMute]);

  const handleDelete = useCallback(() => {
    onClose(); onDeleteChat();
  }, [onClose, onDeleteChat]);

  const handleReport = useCallback(() => {
    onClose(); onReport();
  }, [onClose, onReport]);

  return (
    <>
      <div className="chat-menu-overlay" onClick={onClose}/>
      <div className="chat-menu" role="menu" aria-label="Chat options">

        {/* ── Delete Chat — always first, always red ── */}
        <button
          className="chat-menu-item chat-menu-danger"
          onClick={handleDelete}
          role="menuitem"
        >
          {Icon.trash}
          <span>Delete Chat</span>
        </button>

        {/* ── View Profile → /seller/:id ── */}
        {otherUser?.id && (
          <button
            className="chat-menu-item"
            onClick={goProfile}
            role="menuitem"
          >
            {Icon.user}
            <span>View Profile</span>
          </button>
        )}

        {/* ── Mute / Unmute ── */}
        <button
          className="chat-menu-item"
          onClick={handleMute}
          role="menuitem"
        >
          {muted ? Icon.unmute : Icon.mute}
          <span>{muted ? "Unmute" : "Mute"} Notifications</span>
        </button>

        {/* ── Report Seller — buyer only ── */}
        {isBuyer && (
          <button
            className="chat-menu-item chat-menu-danger"
            onClick={handleReport}
            role="menuitem"
          >
            {Icon.flag}
            <span>Report Seller</span>
          </button>
        )}
      </div>
    </>
  );
});

/* ════════════════════════════════════
   CONNECTION DOT
════════════════════════════════════ */
const ConnectionDot = memo(function ConnectionDot({ connected }) {
  return (
    <div
      className={`chat-sock-dot${connected ? " connected" : ""}`}
      title={connected ? "Connected" : "Reconnecting…"}
      role="status"
      aria-label={connected ? "Connected" : "Reconnecting"}
    />
  );
});

/* ════════════════════════════════════
   AVATAR
════════════════════════════════════ */
const Avatar = memo(function Avatar({ user: u }) {
  const [imgErr, setImgErr] = useState(false);
  useEffect(() => setImgErr(false), [u?.profile_image]);

  const src = !imgErr && u?.profile_image
    ? u.profile_image
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(
        u?.name || "U"
      )}&background=111&color=fff&size=80`;

  return (
    <div className="chat-avatar-wrap">
      <img
        className="chat-avatar"
        src={src}
        alt={u?.name || "User"}
        onError={() => setImgErr(true)}
        loading="lazy"
      />
      {u?.is_online && <span className="chat-online-dot" aria-label="Online"/>}
    </div>
  );
});

/* ════════════════════════════════════
   PRODUCT THUMB — clicks to /product/:slug
════════════════════════════════════ */
const ProductThumb = memo(function ProductThumb({ product, navigate }) {
  const [imgErr, setImgErr] = useState(false);
  useEffect(() => setImgErr(false), [product?.images]);

  const handleClick = useCallback(() => {
    if (!product) return;
    /*
     * Use slug if available, fall back to id.
     * Matches your route: <Route path="/product/:slug" …/>
     */
    const dest = product.slug || product.id;
    if (dest) navigate(`/product/${dest}`);
  }, [product, navigate]);

  if (!product?.images?.[0] || imgErr) return null;

  return (
    <img
      className="chat-product-thumb"
      src={product.images[0]}
      alt={product.title || "Product"}
      title={product.title}
      onClick={handleClick}
      onError={() => setImgErr(true)}
      loading="lazy"
    />
  );
});

/* ════════════════════════════════════
   STATUS LINE
════════════════════════════════════ */
const StatusLine = memo(function StatusLine({ otherUser, isTyping }) {
  if (isTyping)
    return (
      <div className="chat-header-status typing" aria-live="polite">
        typing…
      </div>
    );
  if (otherUser?.is_online)
    return <div className="chat-header-status online">Online</div>;
  return (
    <div className="chat-header-status offline">
      {lastSeenText(otherUser?.last_login)}
    </div>
  );
});

/* ════════════════════════════════════
   MAIN HEADER
════════════════════════════════════ */
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
  onDeleteChat,
  onReport,
  isBuyer,
}) {
  const goBack = useCallback(() => navigate(-1), [navigate]);

  /* tapping name/avatar → /seller/:id */
  const goProfile = useCallback(() => {
    if (otherUser?.id) navigate(`/seller/${otherUser.id}`);
  }, [otherUser?.id, navigate]);

  return (
    <>
      <header className="chat-header" role="banner">
        {/* Back */}
        <button className="chat-icon-btn" onClick={goBack} aria-label="Back">
          {Icon.back}
        </button>

        {/* Avatar — tap → seller profile */}
        <div onClick={goProfile} style={{ cursor:"pointer" }}>
          <Avatar user={otherUser}/>
        </div>

        {/* Name + status — tap → seller profile */}
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

        {/* Product thumb — tap → /product/:slug */}
        <ProductThumb product={product} navigate={navigate}/>

        {/* Connection dot */}
        <ConnectionDot connected={sockReady}/>

        {/* 3-dot menu */}
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

      {/* Dropdown */}
      {showMenu && (
        <HeaderMenu
          otherUser={otherUser}
          navigate={navigate}
          onClose={onMenuClose}
          onMute={onMute}
          muted={muted}
          onDeleteChat={onDeleteChat}
          onReport={onReport}
          isBuyer={isBuyer}
        />
      )}
    </>
  );
}

export default memo(ChatHeader);