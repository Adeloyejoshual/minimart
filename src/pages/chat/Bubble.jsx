import { useRef, useCallback, useState, memo } from "react";
import { MESSAGE_TYPES, CURRENCY, OFFER_STATUS } from "./constants";
import { Icon } from "./icons";

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
function isVideoUrl(url) {
  return /\.(mp4|webm|mov|3gp|mkv)(\?|$)/i.test(url || "");
}

function formatTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

/** Normalise media_url to a real array */
function toMediaArray(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === "string") {
    /* Might be a JSON-encoded array from the DB */
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch {}
    return [raw];
  }
  return [];
}

/* ═══════════════════════════════════════════════════════════════
   SINGLE MEDIA TILE  (with loading shimmer + progressive load)
═══════════════════════════════════════════════════════════════ */
const MediaTile = memo(function MediaTile({ url, onClick, showMore }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const video = isVideoUrl(url);

  return (
    <div className="mtile" onClick={onClick}>
      {/* Loading shimmer overlay */}
      {!loaded && !failed && (
        <div className="mtile__shimmer">
          <div className="mtile__spinner" />
        </div>
      )}

      {/* Error fallback */}
      {failed && (
        <div className="mtile__error">
          <div>⚠️</div>
          <div>Failed to load</div>
        </div>
      )}

      {/* Actual media */}
      {video ? (
        <>
          <video
            src={url}
            preload="metadata"
            muted
            playsInline
            onLoadedData={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={loaded ? "mtile__media mtile__media--in" : "mtile__media"}
          />
          {loaded && (
            <div className="mtile__play">▶</div>
          )}
        </>
      ) : (
        <img
          src={url}
          alt=""
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={loaded ? "mtile__media mtile__media--in" : "mtile__media"}
          draggable={false}
        />
      )}

      {/* +N overlay on 4th tile */}
      {showMore != null && showMore > 0 && (
        <div className="mtile__more">+{showMore}</div>
      )}
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   MEDIA GRID  (WhatsApp-style layout)
═══════════════════════════════════════════════════════════════ */
const MediaGrid = memo(function MediaGrid({ urls, msg, onOpen }) {
  const count = urls.length;
  const shown = urls.slice(0, 4);
  const extra = count > 4 ? count - 4 : 0;

  const open = (i) => onOpen?.(urls, i, msg);

  if (count === 1) {
    return (
      <div className="mgrid mgrid--1">
        <MediaTile url={urls[0]} onClick={(e) => { e.stopPropagation(); open(0); }} />
      </div>
    );
  }

  if (count === 2) {
    return (
      <div className="mgrid mgrid--2">
        {shown.map((u, i) => (
          <MediaTile
            key={i}
            url={u}
            onClick={(e) => { e.stopPropagation(); open(i); }}
          />
        ))}
      </div>
    );
  }

  if (count === 3) {
    return (
      <div className="mgrid mgrid--3">
        <MediaTile
          url={urls[0]}
          onClick={(e) => { e.stopPropagation(); open(0); }}
        />
        <div className="mgrid__col">
          {[1, 2].map((i) => (
            <MediaTile
              key={i}
              url={urls[i]}
              onClick={(e) => { e.stopPropagation(); open(i); }}
            />
          ))}
        </div>
      </div>
    );
  }

  /* 4+ */
  return (
    <div className="mgrid mgrid--4">
      {shown.map((u, i) => (
        <MediaTile
          key={i}
          url={u}
          onClick={(e) => { e.stopPropagation(); open(i); }}
          showMore={i === 3 ? extra : null}
        />
      ))}
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   TYPING BUBBLE
═══════════════════════════════════════════════════════════════ */
export const TypingBubble = memo(function TypingBubble() {
  return (
    <div className="chat-row chat-row--them">
      <div className="chat-bubble chat-bubble--them chat-bubble--typing">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   DATE SEPARATOR
═══════════════════════════════════════════════════════════════ */
export const DateSep = memo(function DateSep({ label }) {
  return (
    <div className="chat-date-sep">
      <span>{label}</span>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   MAIN BUBBLE
═══════════════════════════════════════════════════════════════ */
function Bubble({
  msg,
  mine,
  onRetry,
  onOfferRespond,
  onCtx,
  onLightbox,
  replyToMsg,
}) {
  const bubbleRef = useRef(null);

  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    const rect = bubbleRef.current?.getBoundingClientRect();
    onCtx?.(msg, { x: e.clientX, y: e.clientY, rect });
  }, [msg, onCtx]);

  const pressTimer = useRef(null);
  const onTouchStart = useCallback((e) => {
    pressTimer.current = setTimeout(() => {
      const t = e.touches?.[0];
      const rect = bubbleRef.current?.getBoundingClientRect();
      onCtx?.(msg, {
        x: t?.clientX || rect?.left || 0,
        y: t?.clientY || rect?.top  || 0,
        rect,
      });
    }, 500);
  }, [msg, onCtx]);
  const onTouchEnd  = useCallback(() => clearTimeout(pressTimer.current), []);
  const onTouchMove = useCallback(() => clearTimeout(pressTimer.current), []);

  if (msg._deleted) {
    return (
      <div className={`chat-row ${mine ? "chat-row--me" : "chat-row--them"}`}>
        <div className="chat-bubble chat-bubble--deleted">
          <em>🗑 Message deleted</em>
        </div>
      </div>
    );
  }

  const isMedia = msg.message_type === MESSAGE_TYPES.MEDIA;
  const isVideo = msg.message_type === MESSAGE_TYPES.VIDEO;
  const isOffer = msg.message_type === MESSAGE_TYPES.OFFER;
  const isLoc   = msg.message_type === MESSAGE_TYPES.LOCATION;
  const isProd  = msg.message_type === MESSAGE_TYPES.PRODUCT;

  /* Normalise media_url */
  const mediaUrls = toMediaArray(msg.media_url);
  const hasMedia  = (isMedia || isVideo) && mediaUrls.length > 0;

  /* Hide auto-preview text ("Photo", "2 Photos", "Video", etc.)
     when we're rendering actual media */
  const AUTO_PREVIEW = /^(\d+\s+)?(Photo|Video)s?$/i;
  const showText     = msg.message && !(hasMedia && AUTO_PREVIEW.test(msg.message.trim()));

  return (
    <div className={`chat-row ${mine ? "chat-row--me" : "chat-row--them"}`}>
      <div
        ref={bubbleRef}
        className={[
          "chat-bubble",
          mine ? "chat-bubble--me" : "chat-bubble--them",
          hasMedia    ? "chat-bubble--media"    : "",
          msg._failed ? "chat-bubble--failed"   : "",
          msg._timedOut ? "chat-bubble--timedout" : "",
          msg._temp   ? "chat-bubble--sending"  : "",
        ].filter(Boolean).join(" ")}
        onContextMenu={handleContextMenu}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchMove={onTouchMove}
        onDoubleClick={() => onCtx?.(msg, null, "reply")}
      >
        {/* ── Reply preview ── */}
        {replyToMsg && (
          <div className="chat-reply-box">
            <div className="chat-reply-box__sender">
              {mine ? "You" : replyToMsg.sender_name || "User"}
            </div>
            <div className="chat-reply-box__msg">
              {(() => {
                const rUrls = toMediaArray(replyToMsg.media_url);
                if (rUrls.length) {
                  return replyToMsg.message_type === MESSAGE_TYPES.VIDEO
                    ? `🎥 ${rUrls.length > 1 ? `${rUrls.length} Videos` : "Video"}`
                    : `📷 ${rUrls.length > 1 ? `${rUrls.length} Photos` : "Photo"}`;
                }
                return replyToMsg.message || "";
              })()}
            </div>
          </div>
        )}

        {/* ── MEDIA GRID ── */}
        {hasMedia && (
          <MediaGrid urls={mediaUrls} msg={msg} onOpen={onLightbox} />
        )}

        {/* ── OFFER ── */}
        {isOffer && msg._offerMeta && (
          <div className="chat-offer">
            <div className="chat-offer__label">💰 Offer</div>
            <div className="chat-offer__amount">
              {CURRENCY}{Number(msg._offerMeta.amount).toLocaleString()}
            </div>
            {msg._offerMeta.product_title && (
              <div className="chat-offer__title">
                {msg._offerMeta.product_title}
              </div>
            )}
            {msg._offerMeta.original_price && (
              <div className="chat-offer__original">
                Original: {CURRENCY}
                {Number(msg._offerMeta.original_price).toLocaleString()}
              </div>
            )}
            {msg._offerMeta.note && (
              <div className="chat-offer__note">"{msg._offerMeta.note}"</div>
            )}

            {!mine && (msg._offerMeta.status || "pending") === "pending" && (
              <div className="chat-offer__actions">
                <button
                  className="chat-offer__btn chat-offer__btn--accept"
                  onClick={() => onOfferRespond?.(msg, OFFER_STATUS.ACCEPTED)}
                >Accept</button>
                <button
                  className="chat-offer__btn chat-offer__btn--counter"
                  onClick={() => onOfferRespond?.(msg, OFFER_STATUS.COUNTERED)}
                >Counter</button>
                <button
                  className="chat-offer__btn chat-offer__btn--decline"
                  onClick={() => onOfferRespond?.(msg, OFFER_STATUS.DECLINED)}
                >Decline</button>
              </div>
            )}

            {msg._offerMeta.status && msg._offerMeta.status !== "pending" && (
              <div className={`chat-offer__status chat-offer__status--${msg._offerMeta.status}`}>
                {msg._offerMeta.status.toUpperCase()}
              </div>
            )}
          </div>
        )}

        {/* ── LOCATION ── */}
        {isLoc && msg.location && (
          <a
            className="chat-location"
            href={`https://www.google.com/maps?q=${msg.location.lat},${msg.location.lng}`}
            target="_blank"
            rel="noreferrer"
          >
            <div className="chat-location__pin">📍</div>
            <div className="chat-location__text">
              {msg.location.address || "Shared location"}
            </div>
          </a>
        )}

        {/* ── SHARED PRODUCT ── */}
        {isProd && msg.shared_product && (
          <a
            className="chat-shared-product"
            href={`/product/${msg.shared_product.slug || msg.shared_product.id}`}
          >
            {msg.shared_product.image && (
              <img
                src={msg.shared_product.image}
                alt=""
                className="chat-shared-product__img"
              />
            )}
            <div className="chat-shared-product__info">
              <div className="chat-shared-product__title">
                {msg.shared_product.title}
              </div>
              {msg.shared_product.price != null && (
                <div className="chat-shared-product__price">
                  {CURRENCY}
                  {Number(msg.shared_product.price).toLocaleString()}
                </div>
              )}
            </div>
          </a>
        )}

        {/* ── TEXT (only when meaningful) ── */}
        {!isOffer && !isLoc && !isProd && showText && (
          <div className="chat-bubble__text">
            {msg.message}
          </div>
        )}

        {/* ── Meta row ── */}
        <div className="chat-bubble__meta">
          {msg.edited && <span className="chat-bubble__edited">edited</span>}
          <span className="chat-bubble__time">
            {formatTime(msg.created_at)}
          </span>
          {mine && (
            <span className={`chat-bubble__ticks ${msg.status === "read" ? "chat-bubble__ticks--read" : ""}`}>
              {msg.status === "read"      ? "✓✓"
                : msg.status === "delivered" ? "✓✓"
                : msg.status === "sent"      ? "✓"
                : "…"}
            </span>
          )}
        </div>

        {/* ── Failed / retry ── */}
        {(msg._failed || msg._timedOut) && (
          <button
            className="chat-bubble__retry"
            onClick={(e) => { e.stopPropagation(); onRetry?.(msg); }}
          >
            {msg._timedOut ? "Timed out — retry" : "Failed — retry"}
          </button>
        )}
      </div>
    </div>
  );
}

export default memo(Bubble);