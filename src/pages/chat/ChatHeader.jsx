import React, { useCallback, memo, useState, useEffect } from "react";
import { Icon }         from "./icons";
import { lastSeenText } from "./constants";

/* ── Dropdown menu ── */
const HeaderMenu = memo(function HeaderMenu({
  otherUser, navigate, onClose, onMute, muted,
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
      <div className="chat-menu" role="menu">

        {/* Delete Chat — always first, for everyone */}
        <button className="chat-menu-item chat-menu-danger"
          onClick={handleDelete} role="menuitem">
          {Icon.trash}
          <span>Delete Chat</span>
        </button>

        {otherUser?.id && (
          <button className="chat-menu-item" onClick={goProfile}
            role="menuitem">
            {Icon.user}
            <span>View Profile</span>
          </button>
        )}

        <button className="chat-menu-item" onClick={handleMute}
          role="menuitem">
          {muted ? Icon.unmute : Icon.mute}
          <span>{muted ? "Unmute" : "Mute"} Notifications</span>
        </button>

        {/* Report — buyer only */}
        {isBuyer && (
          <button className="chat-menu-item chat-menu-danger"
            onClick={handleReport} role="menuitem">
            {Icon.flag}
            <span>Report Seller</span>
          </button>
        )}
      </div>
    </>
  );
});

/* ── Sub-components ── */
const ConnectionDot = memo(function ConnectionDot({ connected }) {
  return (
    <div
      className={`chat-sock-dot${connected ? " connected" : ""}`}
      title={connected ? "Connected" : "Reconnecting…"}
    />
  );
});

const Avatar = memo(function Avatar({ user: u }) {
  const [err, setErr] = useState(false);
  useEffect(() => setErr(false), [u?.profile_image]);
  const src = !err && u?.profile_image
    ? u.profile_image
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(
        u?.name || "U"
      )}&background=111&color=fff&size=80`;
  return (
    <div className="chat-avatar-wrap">
      <img className="chat-avatar" src={src}
        alt={u?.name || "User"} onError={() => setErr(true)} loading="lazy"/>
      {u?.is_online && <span className="chat-online-dot"/>}
    </div>
  );
});

const ProductThumb = memo(function ProductThumb({ product, navigate }) {
  const [err, setErr] = useState(false);
  useEffect(() => setErr(false), [product?.images]);
  if (!product?.images?.[0] || err) return null;
  return (
    <img
      className="chat-product-thumb"
      src={product.images[0]}
      alt={product.title}
      title={product.title}
      onClick={() => product?.id && navigate(`/product/${product.id}`)}
      onError={() => setErr(true)}
      loading="lazy"
    />
  );
});

const StatusLine = memo(function StatusLine({ otherUser, isTyping }) {
  if (isTyping)
    return <div className="chat-header-status typing" aria-live="polite">typing…</div>;
  if (otherUser?.is_online)
    return <div className="chat-header-status online">Online</div>;
  return (
    <div className="chat-header-status offline">
      {lastSeenText(otherUser?.last_login)}
    </div>
  );
});

/* ── Main header ── */
function ChatHeader({
  otherUser, product, isTyping, sockReady,
  showMenu, onToggleMenu, onMenuClose,
  navigate, muted, onMute,
  onDeleteChat, onReport, isBuyer,
}) {
  const goBack    = useCallback(() => navigate(-1), [navigate]);
  const goProfile = useCallback(() => {
    if (otherUser?.id) navigate(`/seller/${otherUser.id}`);
  }, [otherUser?.id, navigate]);

  return (
    <>
      <header className="chat-header">
        <button className="chat-icon-btn" onClick={goBack} aria-label="Back">
          {Icon.back}
        </button>

        <Avatar user={otherUser}/>

        <div className="chat-header-info" onClick={goProfile}
          role="button" tabIndex={0}
          onKeyDown={e => e.key === "Enter" && goProfile()}>
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

        <ProductThumb product={product} navigate={navigate}/>
        <ConnectionDot connected={sockReady}/>

        <button className="chat-icon-btn" onClick={onToggleMenu}
          aria-label="Menu" aria-haspopup="menu" aria-expanded={showMenu}>
          {Icon.more}
        </button>
      </header>

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