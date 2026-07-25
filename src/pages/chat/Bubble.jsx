import { useRef, useCallback, useState, memo } from "react";
import { MESSAGE_TYPES, CURRENCY, OFFER_STATUS } from "./constants";
import { Icon } from "./icons";

/* ═══════════════════════════════════════════════════════════════
   INLINE SVG ICONS  (transparent, no background)
═══════════════════════════════════════════════════════════════ */

const PlayIcon = ({ size = 28 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M8 5.14v13.72a1 1 0 0 0 1.53.85l10.86-6.86a1 1 0 0 0 0-1.7L9.53 4.29A1 1 0 0 0 8 5.14Z"
      fill="currentColor"
    />
  </svg>
);

const UploadSpinner = ({ size = 36 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 50 50"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className="mtile__svg-spinner"
  >
    <circle
      cx="25" cy="25" r="20"
      fill="none"
      stroke="currentColor"
      strokeOpacity="0.25"
      strokeWidth="4"
    />
    <circle
      cx="25" cy="25" r="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="4"
      strokeLinecap="round"
      strokeDasharray="90 150"
    />
  </svg>
);

const WarnIcon = ({ size = 24 }) => (
  <svg
    width={size} height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M12 3 2 21h20L12 3Zm0 6v5m0 3v.5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const TrashIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m-8 0v13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V7"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    />
  </svg>
);

const PinIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12 22s-7-6.5-7-12a7 7 0 1 1 14 0c0 5.5-7 12-7 12Z"
      stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"
    />
    <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);

const OfferIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M20.6 12.6 12.6 4.6A2 2 0 0 0 11.2 4H5a1 1 0 0 0-1 1v6.2a2 2 0 0 0 .6 1.4l8 8a2 2 0 0 0 2.8 0l5.2-5.2a2 2 0 0 0 0-2.8Z"
      stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"
    />
    <circle cx="8.5" cy="8.5" r="1.3" fill="currentColor" />
  </svg>
);

const VideoBadge = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3" y="6" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
    <path d="m17 10 4-2v8l-4-2v-4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
  </svg>
);

const PhotoBadge = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
    <circle cx="8.5" cy="9.5" r="1.5" fill="currentColor" />
    <path d="m4 18 5-5 4 4 3-3 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" fill="none" />
  </svg>
);

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
function isVideoUrl(url) {
  if (!url) return false;
  if (url.startsWith("blob:")) return false; // handled via forceVideo
  return /\.(mp4|webm|mov|3gp|mkv|m4v|avi|quicktime)(\?|$)/i.test(url);
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
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch {}
    return [raw];
  }
  return [];
}

/* ═══════════════════════════════════════════════════════════════
   SINGLE MEDIA TILE
═══════════════════════════════════════════════════════════════ */
const MediaTile = memo(function MediaTile({
  url,
  onClick,
  showMore,
  forceVideo = false,
  uploading  = false,
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const video = forceVideo || isVideoUrl(url);

  return (
    <div className="mtile" onClick={onClick}>
      {/* Loading shimmer while media buffers */}
      {(!loaded && !failed && !uploading) && (
        <div className="mtile__shimmer">
          <UploadSpinner size={28} />
        </div>
      )}

      {/* Upload-in-progress overlay */}
      {uploading && (
        <div className="mtile__uploading">
          <UploadSpinner size={40} />
          <div className="mtile__uploading-text">Uploading…</div>
        </div>
      )}

      {/* Error fallback */}
      {failed && (
        <div className="mtile__error">
          <WarnIcon size={26} />
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
          {loaded && !uploading && (
            <div className="mtile__play">
              <PlayIcon size={26} />
            </div>
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
   MEDIA GRID
═══════════════════════════════════════════════════════════════ */
const MediaGrid = memo(function MediaGrid({
  urls, msg, onOpen, isVideo, uploading,
}) {
  const count = urls.length;
  const shown = urls.slice(0, 4);
  const extra = count > 4 ? count - 4 : 0;

  const open = (i) => onOpen?.(urls, i, msg);
  const commonProps = { forceVideo: isVideo, uploading };

  if (count === 1) {
    return (
      <div className={`mgrid mgrid--1 ${isVideo ? "mgrid--video" : ""}`}>
        <MediaTile
          url={urls[0]}
          onClick={(e) => { e.stopPropagation(); open(0); }}
          {...commonProps}
        />
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
            {...commonProps}
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
          {...commonProps}
        />
        <div className="mgrid__col">
          {[1, 2].map((i) => (
            <MediaTile
              key={i}
              url={urls[i]}
              onClick={(e) => { e.stopPropagation(); open(i); }}
              {...commonProps}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mgrid mgrid--4">
      {shown.map((u, i) => (
        <MediaTile
          key={i}
          url={u}
          onClick={(e) => { e.stopPropagation(); open(i); }}
          showMore={i === 3 ? extra : null}
          {...commonProps}
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
          <TrashIcon size={14} /> <em>Message deleted</em>
        </div>
      </div>
    );
  }

  const isMedia = msg.message_type === MESSAGE_TYPES.MEDIA;
  const isVideo = msg.message_type === MESSAGE_TYPES.VIDEO;
  const isOffer = msg.message_type === MESSAGE_TYPES.OFFER;
  const isLoc   = msg.message_type === MESSAGE_TYPES.LOCATION;
  const isProd  = msg.message_type === MESSAGE_TYPES.PRODUCT;

  const mediaUrls = toMediaArray(msg.media_url);
  const hasMedia  = (isMedia || isVideo) && mediaUrls.length > 0;

  /* Show upload overlay while temp message is in flight */
  const uploading = !!msg._temp && hasMedia;

  const AUTO_PREVIEW = /^(\d+\s+)?(Photo|Video)s?$/i;
  const showText     = msg.message && !(hasMedia && AUTO_PREVIEW.test(msg.message.trim()));

  return (
    <div className={`chat-row ${mine ? "chat-row--me" : "chat-row--them"}`}>
      <div
        ref={bubbleRef}
        className={[
          "chat-bubble",
          mine ? "chat-bubble--me" : "chat-bubble--them",
          hasMedia     ? "chat-bubble--media"    : "",
          msg._failed  ? "chat-bubble--failed"   : "",
          msg._timedOut ? "chat-bubble--timedout" : "",
          msg._temp    ? "chat-bubble--sending"  : "",
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
                  const isVid = replyToMsg.message_type === MESSAGE_TYPES.VIDEO;
                  return (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      {isVid ? <VideoBadge /> : <PhotoBadge />}
                      {isVid
                        ? (rUrls.length > 1 ? `${rUrls.length} Videos` : "Video")
                        : (rUrls.length > 1 ? `${rUrls.length} Photos` : "Photo")}
                    </span>
                  );
                }
                return replyToMsg.message || "";
              })()}
            </div>
          </div>
        )}

        {/* ── MEDIA GRID ── */}
        {hasMedia && (
          <MediaGrid
            urls={mediaUrls}
            msg={msg}
            onOpen={onLightbox}
            isVideo={isVideo}
            uploading={uploading}
          />
        )}

        {/* ── OFFER ── */}
        {isOffer && msg._offerMeta && (
          <div className="chat-offer">
            <div className="chat-offer__label">
              <OfferIcon size={14} /> Offer
            </div>
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
            <div className="chat-location__pin">
              <PinIcon size={20} />
            </div>
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

        {/* ── TEXT ── */}
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