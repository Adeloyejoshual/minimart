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
  useEffect(() => {
    const h = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const goProfile = useCallback(() => {
    onClose();
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

        <button
          className="chat-menu-item chat-menu-danger"
          onClick={handleDelete}
          role="menuitem"
        >
          {Icon.trash}
          <span>Delete Chat</span>
        </button>

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

        <button
          className="chat-menu-item"
          onClick={handleMute}
          role="menuitem"
        >
          {muted ? Icon.unmute : Icon.mute}
          <span>{muted ? "Unmute" : "Mute"} Notifications</span>
        </button>

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
      )}&background=FF5C00&color=fff&size=80`;

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
   PRODUCT THUMB
════════════════════════════════════ */
const ProductThumb = memo(function ProductThumb({ product, navigate }) {
  const [imgErr, setImgErr] = useState(false);
  useEffect(() => setImgErr(false), [product?.images]);

  const handleClick = useCallback(() => {
    if (!product) return;
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
   DESKTOP DETECTION HOOK
════════════════════════════════════ */
function useIsDesktop() {
  const [desktop, setDesktop] = useState(
    () => typeof window !== "undefined"
      ? window.matchMedia("(min-width: 1024px)").matches
      : false
  );

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const handler = (e) => setDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return desktop;
}

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
  /* NEW: optional callback from desktop parent to deselect thread */
  onDeselectThread,
}) {
  const isDesktop = useIsDesktop();

  /*
   * Back button behavior:
   *  - Desktop: deselect current thread (go back to "select a conversation")
   *             Falls back to /messages if no callback provided
   *  - Mobile:  navigate(-1) as before
   */
  const goBack = useCallback(() => {
    if (isDesktop) {
      if (onDeselectThread) {
        onDeselectThread();
      } else {
        navigate("/messages", { replace: true });
      }
    } else {
      navigate(-1);
    }
  }, [isDesktop, navigate, onDeselectThread]);

  const goProfile = useCallback(() => {
    if (otherUser?.id) navigate(`/seller/${otherUser.id}`);
  }, [otherUser?.id, navigate]);

  return (
    <>
      <header
        className={`chat-header${isDesktop ? " chat-header--desktop" : ""}`}
        role="banner"
      >
        {/* Back — hidden on desktop unless you want it */}
        {!isDesktop && (
          <button className="chat-icon-btn" onClick={goBack} aria-label="Back">
            {Icon.back}
          </button>
        )}

        {/* Avatar */}
        <div onClick={goProfile} style={{ cursor: "pointer" }}>
          <Avatar user={otherUser}/>
        </div>

        {/* Name + status */}
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

        {/* Product thumb */}
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