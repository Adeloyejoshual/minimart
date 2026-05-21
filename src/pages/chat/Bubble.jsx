import React, { useRef, useCallback, memo } from "react";
import OfferCard     from "./OfferCard";
import ContextMenu   from "./ContextMenu";
import { Icon }      from "./icons";
import { formatTime, truncate } from "./constants";

/* ── tiny sub-components ─────────────────── */
const Tick = memo(function Tick({ status }) {
  return <Icon.tick status={status}/>;
});

const TypingBubble = memo(function TypingBubble() {
  return (
    <div className="chat-typing-wrap">
      <div className="chat-typing-bubble">
        {[0,1,2].map(n => (
          <span key={n} className="chat-typing-dot"
            style={{ animationDelay: `${n * .18}s` }}/>
        ))}
      </div>
    </div>
  );
});

const DateSep = memo(function DateSep({ label }) {
  return <div className="chat-date-sep"><span>{label}</span></div>;
});

/* ── main Bubble ─────────────────────────── */
function Bubble({
  msg, mine,
  onRetry, onOfferRespond,
  onCtx, onLightbox,
  replyToMsg,
  ctxMsgId,
  onCtxClose, onCtxReply, onCtxCopy, onCtxDelete,
}) {
  const failed   = !!msg._failed;
  const sending  = !!msg._temp;
  const timedOut = !!msg._timedOut;
  const isOffer  = !!msg._offerMeta;
  const showCtx  = ctxMsgId === msg.id;

  const holdRef  = useRef(null);
  const rowRef   = useRef(null);
  const swipeX   = useRef(null);

  /* Long press */
  const startHold = useCallback(e => {
    const rect = rowRef.current?.getBoundingClientRect() || {};
    holdRef.current = setTimeout(() => {
      const touch = e.touches?.[0];
      const cx = Math.min(
        touch?.clientX ?? e.clientX ?? rect.left,
        window.innerWidth - 200
      );
      const cy = Math.max((touch?.clientY ?? e.clientY ?? rect.top) - 130, 60);
      onCtx(msg, { x: cx, y: cy });
    }, 500);
  }, [msg, onCtx]);

  const cancelHold = useCallback(() => clearTimeout(holdRef.current), []);

  /* Swipe to reply */
  const onTS = useCallback(e => {
    swipeX.current = e.touches[0].clientX;
    startHold(e);
  }, [startHold]);

  const onTM = useCallback(e => {
    cancelHold();
    if (swipeX.current === null) return;
    const dx = e.touches[0].clientX - swipeX.current;
    const el = rowRef.current;
    if (!el) return;
    const valid = mine ? dx < -10 : dx > 10;
    if (valid) {
      el.classList.add("swiping");
      const cl = mine ? Math.max(dx, -60) : Math.min(dx, 60);
      const bubble = el.querySelector(".chat-bubble");
      if (bubble) bubble.style.transform = `translateX(${cl}px)`;
    }
  }, [mine, cancelHold]);

  const onTE = useCallback(e => {
    cancelHold();
    const el = rowRef.current;
    if (!el) return;
    const dx = e.changedTouches[0].clientX - (swipeX.current || 0);
    el.classList.remove("swiping");
    const bubble = el.querySelector(".chat-bubble");
    if (bubble) bubble.style.transform = "";
    swipeX.current = null;
    if (mine ? dx < -40 : dx > 40) onCtx(msg, null, "reply");
  }, [mine, cancelHold, msg, onCtx]);

  const handleRetry = useCallback(() => {
    if (failed || timedOut) onRetry(msg);
  }, [failed, timedOut, msg, onRetry]);

  const handleLightbox = useCallback(e => {
    e.stopPropagation();
    onLightbox(msg.media_url);
  }, [msg.media_url, onLightbox]);

  const handleProductClick = useCallback(e => {
    e.stopPropagation();
    if (msg.shared_product?.id)
      window.open(`/product/${msg.shared_product.id}`, "_blank");
  }, [msg.shared_product]);

  const handleLocationClick = useCallback(e => {
    e.stopPropagation();
  }, []);

  return (
    <div
      ref={rowRef}
      className={`chat-bubble-row ${mine ? "mine" : "theirs"}`}
      onClick={handleRetry}
    >
      <span className="reply-hint-icon">{Icon.reply}</span>

      <div
        className={[
          "chat-bubble",
          mine    ? "mine"         : "theirs",
          failed  ? "failed"       : "",
          sending ? "sending"      : "",
          isOffer ? "offer-bubble" : "",
        ].filter(Boolean).join(" ")}
        onMouseDown={startHold}
        onMouseUp={cancelHold}
        onMouseLeave={cancelHold}
        onTouchStart={onTS}
        onTouchMove={onTM}
        onTouchEnd={onTE}
      >
        {/* Reply strip */}
        {replyToMsg && !isOffer && (
          <div className={`bubble-reply-strip ${mine ? "" : "theirs"}`}>
            <div className="bubble-reply-sender">
              {replyToMsg.sender_id === msg.sender_id ? "You" : "Them"}
            </div>
            {replyToMsg.media_url ? (
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <img src={replyToMsg.media_url} alt=""
                  className="bubble-reply-img"/>
                <span className="bubble-reply-text">Photo</span>
              </div>
            ) : (
              <div className="bubble-reply-text">
                {truncate(replyToMsg.message)}
              </div>
            )}
          </div>
        )}

        {/* Offer card */}
        {isOffer && (
          <OfferCard msg={msg} mine={mine} onRespond={onOfferRespond}/>
        )}

        {/* Text */}
        {!isOffer && !msg._deleted && msg.message && (
          <div className="chat-bubble-text">{msg.message}</div>
        )}
        {msg._deleted && (
          <div className="chat-bubble-deleted">This message was deleted</div>
        )}

        {/* Image */}
        {msg.media_url && !msg._deleted && (
          <img
            src={msg.media_url}
            alt="media"
            className="chat-bubble-media"
            onClick={handleLightbox}
          />
        )}

        {/* Location */}
        {msg.location && !msg._deleted && (
          <a
            href={`https://maps.google.com/?q=${msg.location.lat},${msg.location.lng}`}
            target="_blank"
            rel="noreferrer"
            className="chat-location-bubble"
            onClick={handleLocationClick}
          >
            <img
              className="chat-location-map"
              alt="Location"
              src={`https://staticmap.openstreetmap.de/staticmap.php?center=${msg.location.lat},${msg.location.lng}&zoom=15&size=400x160&markers=${msg.location.lat},${msg.location.lng},red`}
              onError={e => { e.target.style.display = "none"; }}
            />
            <div className="chat-location-label">
              {Icon.pin}&nbsp;
              {msg.location.address ||
                `${msg.location.lat.toFixed(4)}, ${msg.location.lng.toFixed(4)}`}
            </div>
          </a>
        )}

        {/* Product card */}
        {msg.shared_product && !msg._deleted && (
          <div className="chat-product-card" onClick={handleProductClick}>
            {msg.shared_product.image && (
              <img src={msg.shared_product.image} alt=""
                className="chat-product-card-img"/>
            )}
            <div className="chat-product-card-body">
              <div className="chat-product-card-title">
                {msg.shared_product.title}
              </div>
              <div className="chat-product-card-price">
                ৳{Number(msg.shared_product.price).toLocaleString()}
              </div>
              <div className="chat-product-card-cta">Tap to view</div>
            </div>
          </div>
        )}

        {/* Meta */}
        <div className={`chat-bubble-meta ${mine ? "mine" : "theirs"}`}>
          {failed ? (
            <span className="chat-bubble-failed">
              {Icon.close} Not sent · Tap to retry
            </span>
          ) : timedOut ? (
            <span className="chat-bubble-failed">
              Timed out · Tap to retry
            </span>
          ) : sending ? (
            <span className="chat-bubble-sending">
              <span className="chat-sending-spinner"/>Sending
            </span>
          ) : (
            <>
              {formatTime(msg.created_at)}
              {mine && <Tick status={msg.status}/>}
            </>
          )}
        </div>
      </div>

      {/* Context menu (rendered inside the row so it stays near the bubble) */}
      {showCtx && (
        <ContextMenu
          msg={msg}
          mine={mine}
          pos={{ x: 20, y: -140 }}
          onClose={onCtxClose}
          onReply={onCtxReply}
          onCopy={onCtxCopy}
          onDelete={onCtxDelete}
        />
      )}
    </div>
  );
}

export { TypingBubble, DateSep };
export default memo(Bubble);