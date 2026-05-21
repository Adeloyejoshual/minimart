import React, { useCallback, memo } from "react";
import { Icon }        from "./icons";
import { lastSeenText } from "./constants";

/* ── dropdown menu ───────────────────────── */
const HeaderMenu = memo(function HeaderMenu({
  otherUser, navigate, onClose, onMute, muted,
}) {
  const goProfile = useCallback(() => {
    onClose();
    navigate(`/seller/${otherUser.id}`);
  }, [onClose, navigate, otherUser?.id]);

  const handleMute = useCallback(() => {
    onClose(); onMute();
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
      <div className="chat-menu">
        {otherUser?.id && (
          <button className="chat-menu-item" onClick={goProfile}>
            {Icon.user} View Profile
          </button>
        )}
        <button className="chat-menu-item" onClick={handleMute}>
          {muted ? Icon.unmute : Icon.mute}
          {muted ? "Unmute" : "Mute"} Notifications
        </button>
        <button className="chat-menu-item" onClick={handleReport}>
          {Icon.flag} Report Seller
        </button>
        <button className="chat-menu-item chat-menu-danger" onClick={handleSpam}>
          {Icon.warn} Mark as Spam
        </button>
      </div>
    </>
  );
});

/* ── header ──────────────────────────────── */
function ChatHeader({
  otherUser, product, isTyping, sockReady,
  showMenu, onToggleMenu, onMenuClose,
  navigate, muted, onMute,
}) {
  const goProfile = useCallback(() => {
    if (otherUser?.id) navigate(`/seller/${otherUser.id}`);
  }, [otherUser?.id, navigate]);

  const statusClass = isTyping ? "typing"
    : otherUser?.is_online ? "online" : "offline";

  const statusText = isTyping
    ? "typing…"
    : otherUser?.is_online
      ? "Online"
      : lastSeenText(otherUser?.last_login);

  return (
    <>
      <header className="chat-header">
        {/* Back */}
        <button className="chat-icon-btn" onClick={() => navigate(-1)}
          aria-label="Back">
          {Icon.back}
        </button>

        {/* Avatar */}
        <div className="chat-avatar-wrap">
          <img
            className="chat-avatar"
            src={
              otherUser?.profile_image ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(
                otherUser?.name || "U"
              )}&background=111&color=fff&size=80`
            }
            alt={otherUser?.name || "User"}
          />
          {otherUser?.is_online && <span className="chat-online-dot"/>}
        </div>

        {/* Name + status */}
        <div className="chat-header-info" onClick={goProfile}>
          <div className="chat-header-name">{otherUser?.name || "…"}</div>
          <div className={`chat-header-status ${statusClass}`}>
            {statusText}
          </div>
        </div>

        {/* Product thumb */}
        {product?.images?.[0] && (
          <img
            className="chat-product-thumb"
            src={product.images[0]}
            alt={product.title}
            title={product.title}
          />
        )}

        {/* Connection dot */}
        <div
          className="chat-sock-dot"
          title={sockReady ? "Connected" : "Connecting…"}
          style={{ background: sockReady ? "#22c55e" : "#f59e0b" }}
        />

        {/* 3-dot */}
        <button className="chat-icon-btn" onClick={onToggleMenu}
          aria-label="Menu">
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
        />
      )}
    </>
  );
}

export default memo(ChatHeader);