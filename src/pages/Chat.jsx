import React, {
  useEffect, useState, useRef, useCallback, useMemo,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io }   from "socket.io-client";
import axios    from "axios";
import "../styles/Chat.css";

const BASE       = "https://minimart-ivrm.onrender.com";
const API        = `${BASE}/api`;
const SOCKET_URL = BASE;

/* ═══════════════════════════════════
   SVG ICONS (transparent, no fill)
═══════════════════════════════════ */
const Icon = {
  back: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 19l-7-7 7-7"/>
    </svg>
  ),
  more: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/>
      <circle cx="12" cy="19" r="1"/>
    </svg>
  ),
  send: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
    </svg>
  ),
  attach: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14"/>
    </svg>
  ),
  camera: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  ),
  gallery: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <path d="M21 15l-5-5L5 21"/>
    </svg>
  ),
  location: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  ),
  close: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
      <path d="M18 6L6 18M6 6l12 12"/>
    </svg>
  ),
  reply: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 14L4 9l5-5"/>
      <path d="M4 9h10.5a5.5 5.5 0 010 11H11"/>
    </svg>
  ),
  copy: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
    </svg>
  ),
  trash: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
    </svg>
  ),
  user: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  mute: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 01-3.46 0"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ),
  unmute: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 01-3.46 0"/>
    </svg>
  ),
  flag: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
      <line x1="4" y1="22" x2="4" y2="15"/>
    </svg>
  ),
  warn: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  tag: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
      <line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg>
  ),
  offer: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
    </svg>
  ),
  handshake: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 11h1a3 3 0 010 6h-1"/>
      <path d="M7 11H6a3 3 0 000 6h1"/>
      <path d="M7 11V7a5 5 0 0110 0v4"/>
    </svg>
  ),
  product: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <path d="M16 10a4 4 0 01-8 0"/>
    </svg>
  ),
  suggest: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="2" x2="12" y2="6"/>
      <line x1="12" y1="18" x2="12" y2="22"/>
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/>
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
      <line x1="2" y1="12" x2="6" y2="12"/>
      <line x1="18" y1="12" x2="22" y2="12"/>
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/>
      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
    </svg>
  ),
  pin: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  ),
};

/* ═══════════════════════════════════
   HELPERS
═══════════════════════════════════ */
function getToken() {
  return localStorage.getItem("token") || sessionStorage.getItem("token") || "";
}
function authH() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}
function formatTime(d) {
  return new Date(d).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
}
function formatDateLabel(d) {
  const date = new Date(d), now = new Date();
  const y = new Date(now); y.setDate(now.getDate()-1);
  if (date.toDateString() === now.toDateString()) return "Today";
  if (date.toDateString() === y.toDateString())   return "Yesterday";
  return date.toLocaleDateString([], { weekday:"short", month:"short", day:"numeric", year:"numeric" });
}
function lastSeenText(lastLogin, isOnline) {
  if (isOnline) return "Online";
  if (!lastLogin) return "Offline";
  const d = Math.floor((Date.now() - new Date(lastLogin))/1000);
  if (d<60)     return "last seen just now";
  if (d<3600)   return `last seen ${Math.floor(d/60)}m ago`;
  if (d<86400)  return `last seen ${Math.floor(d/3600)}h ago`;
  if (d<172800) return "last seen yesterday";
  return `last seen ${new Date(lastLogin).toLocaleDateString([], { month:"short", day:"numeric" })}`;
}
function groupByDate(msgs) {
  const out = []; let last = null;
  for (const m of msgs) {
    const l = formatDateLabel(m.created_at);
    if (l !== last) { out.push({ type:"date", label:l }); last = l; }
    out.push({ type:"msg", data:m });
  }
  return out;
}
function dedupe(arr) {
  const map = new Map();
  for (const m of arr) map.set(m.id, m);
  return [...map.values()].sort((a,b) => new Date(a.created_at)-new Date(b.created_at));
}
function truncate(str, n=55) { return str?.length > n ? str.slice(0,n)+"…" : str||""; }

/* ═══════════════════════════════════
   SUGGESTIONS
═══════════════════════════════════ */
const SUGGESTIONS = {
  greeting: [
    "Hi! Is this still available?",
    "Hello, I'm interested",
    "Is this item still for sale?",
    "Can you tell me more about this?",
    "Hi, just saw your listing",
    "Good day! Can I ask about this?",
  ],
  default: [
    "Can you do home delivery?",
    "What's the current condition?",
    "Any scratches or damages?",
    "Can I see more photos?",
    "Is the price negotiable?",
    "How old is this item?",
    "Does it come with warranty?",
    "Is it original / authentic?",
    "What's included in the package?",
    "Can I pick it up today?",
    "What's the lowest price?",
    "Do you accept bKash / Nagad?",
  ],
  after_offer: [
    "I can pay immediately",
    "Cash on delivery please",
    "Can we meet today?",
    "I'll take it!",
    "Deal!",
    "bKash / Nagad OK?",
    "I'm a serious buyer",
    "Can you hold it for me?",
  ],
  offer_accepted: [
    "Great! When can we meet?",
    "Awesome! I'll come today",
    "What's your address?",
    "Deal confirmed!",
    "Should I send advance?",
  ],
  negotiation: [
    "That's a bit high for me",
    "I'll pay cash right now",
    "Can you do any better?",
    "Meet me halfway?",
    "Last price please",
  ],
  closing: [
    "OK deal!",
    "Send me your location",
    "Payment sent! Please confirm",
    "Thank you!",
    "Let's finalize this",
  ],
};

function pickSuggestions(messages, userId) {
  if (!messages?.length) return SUGGESTIONS.greeting;
  const last = messages[messages.length - 1];
  const hasOffer = messages.some(m => m._offerMeta);
  const accepted = messages.some(m => m._offerMeta?.status === "accepted");
  const lastIsMine = last?.sender_id === userId;
  if (accepted)               return SUGGESTIONS.offer_accepted;
  if (hasOffer && lastIsMine) return SUGGESTIONS.after_offer;
  if (hasOffer)               return SUGGESTIONS.negotiation;
  if (!lastIsMine)            return SUGGESTIONS.default;
  return SUGGESTIONS.closing;
}

/* ═══════════════════════════════════
   TICK
═══════════════════════════════════ */
function Tick({ status }) {
  if (status === "sending") return null;
  const read = status === "read", del = status === "delivered";
  const c = read ? "#60a5fa" : del ? "rgba(255,255,255,.65)" : "rgba(255,255,255,.3)";
  return (
    <svg width="16" height="11" viewBox="0 0 16 11" fill="none">
      {(read||del) ? (
        <>
          <path d="M1 5.5l3 3L10.5 1" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M5.5 5.5l3 3L15 1" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </>
      ) : (
        <path d="M1 5.5l3 3L10.5 1" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      )}
    </svg>
  );
}

/* ═══════════════════════════════════
   TYPING BUBBLE
═══════════════════════════════════ */
function TypingBubble() {
  return (
    <div className="chat-typing-wrap">
      <div className="chat-typing-bubble">
        {[0,1,2].map(n => <span key={n} className="chat-typing-dot" style={{ animationDelay:`${n*.18}s` }}/>)}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════
   OFFER CARD
═══════════════════════════════════ */
function OfferCard({ msg, mine, onRespond }) {
  const o = msg._offerMeta;
  if (!o) return null;
  const map = {
    pending:  { bg:"#fefce8", bd:"#fde68a", badge:"#f59e0b", text:"Pending" },
    accepted: { bg:"#f0fdf4", bd:"#bbf7d0", badge:"#22c55e", text:"Accepted" },
    declined: { bg:"#fef2f2", bd:"#fecaca", badge:"#ef4444", text:"Declined" },
    countered:{ bg:"#eff6ff", bd:"#bfdbfe", badge:"#3b82f6", text:"Counter" },
  };
  const s = map[o.status] || { bg:"#f9fafb", bd:"#e5e7eb", badge:"#6b7280", text:o.status };
  return (
    <div className="offer-card" style={{ background:s.bg, border:`1.5px solid ${s.bd}` }}>
      <div className="offer-card-header">
        {Icon.tag}
        <span className="offer-label">{o.type==="last_price"?"Last Price Request":"Offer"}</span>
        <span className="offer-badge" style={{ background:s.badge }}>{s.text}</span>
      </div>
      {o.product_title && <div className="offer-product">{o.product_title}</div>}
      <div className="offer-price-row">
        {o.original_price && <span className="offer-original">৳{Number(o.original_price).toLocaleString()}</span>}
        <span className="offer-amount">৳{Number(o.amount).toLocaleString()}</span>
        {o.original_price && <span className="offer-discount">{Math.round((1-o.amount/o.original_price)*100)}% off</span>}
      </div>
      {o.note && <div className="offer-note">"{o.note}"</div>}
      {!mine && o.status==="pending" && onRespond && (
        <div className="offer-actions">
          <button className="offer-btn accept" onClick={() => onRespond(msg,"accepted")}>Accept</button>
          <button className="offer-btn counter" onClick={() => onRespond(msg,"countered")}>Counter</button>
          <button className="offer-btn decline" onClick={() => onRespond(msg,"declined")}>Decline</button>
        </div>
      )}
      {mine && o.status==="countered" && onRespond && (
        <div className="offer-actions">
          <button className="offer-btn accept" onClick={() => onRespond(msg,"accepted")}>Accept</button>
          <button className="offer-btn decline" onClick={() => onRespond(msg,"declined")}>Decline</button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════
   CONTEXT MENU
═══════════════════════════════════ */
function ContextMenu({ msg, mine, pos, onClose, onReply, onCopy, onDelete }) {
  const items = [
    { icon:Icon.reply, label:"Reply",  fn:onReply },
    { icon:Icon.copy,  label:"Copy",   fn:onCopy,   hide:!!msg._offerMeta||!!msg._deleted },
    { icon:Icon.trash, label:"Delete", fn:onDelete, danger:true, hide:!mine||!!msg._deleted },
  ].filter(i => !i.hide);

  return (
    <>
      <div className="ctx-backdrop" onClick={onClose}/>
      <div className="ctx-wrap" style={{ top:pos.y, left:pos.x }}>
        <div className="ctx-menu">
          {items.map(i => (
            <button key={i.label}
              className={`ctx-item ${i.danger?"danger":""}`}
              onClick={() => { i.fn(); onClose(); }}>
              {i.icon}
              {i.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════
   BUBBLE
═══════════════════════════════════ */
function Bubble({ msg, mine, onRetry, onOfferRespond, onCtx, onLightbox, replyToMsg }) {
  const failed = !!msg._failed, sending = !!msg._temp,
        timedOut = !!msg._timedOut, isOffer = !!msg._offerMeta;
  const holdRef = useRef(null), rowRef = useRef(null), swipeX = useRef(null);

  function startHold(e) {
    const rect = rowRef.current?.getBoundingClientRect()||{};
    holdRef.current = setTimeout(() => {
      const t = e.touches?.[0];
      const cx = Math.min(t?.clientX??e.clientX??rect.left, window.innerWidth-200);
      const cy = (t?.clientY??e.clientY??rect.top)-120;
      onCtx(msg, { x:cx, y:Math.max(cy,60) });
    }, 500);
  }
  function cancelHold() { clearTimeout(holdRef.current); }

  function onTS(e) { swipeX.current = e.touches[0].clientX; startHold(e); }
  function onTM(e) {
    cancelHold();
    if (swipeX.current===null) return;
    const dx = e.touches[0].clientX - swipeX.current;
    const el = rowRef.current;
    if (!el) return;
    const ok = mine ? dx<-10 : dx>10;
    if (ok) {
      el.classList.add("swiping");
      const cl = mine ? Math.max(dx,-60) : Math.min(dx,60);
      el.querySelector(".chat-bubble").style.transform = `translateX(${cl}px)`;
    }
  }
  function onTE(e) {
    cancelHold();
    const el = rowRef.current;
    if (!el) return;
    const dx = e.changedTouches[0].clientX - (swipeX.current||0);
    el.classList.remove("swiping");
    el.querySelector(".chat-bubble").style.transform = "";
    swipeX.current = null;
    if (mine ? dx<-40 : dx>40) onCtx(msg, null, "reply");
  }

  return (
    <div ref={rowRef}
      className={`chat-bubble-row ${mine?"mine":"theirs"}`}
      onClick={() => (failed||timedOut) && onRetry(msg)}>
      <span className="reply-hint-icon">{Icon.reply}</span>
      <div
        className={["chat-bubble", mine?"mine":"theirs", failed?"failed":"",
          sending?"sending":"", isOffer?"offer-bubble":""].filter(Boolean).join(" ")}
        onMouseDown={startHold} onMouseUp={cancelHold} onMouseLeave={cancelHold}
        onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}>

        {replyToMsg && !isOffer && (
          <div className={`bubble-reply-strip ${mine?"":"theirs"}`}>
            <div className="bubble-reply-sender">{replyToMsg.sender_id===msg.sender_id?"You":"Them"}</div>
            {replyToMsg.media_url ? (
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <img src={replyToMsg.media_url} alt="" className="bubble-reply-img"/>
                <span className="bubble-reply-text">Photo</span>
              </div>
            ) : (
              <div className="bubble-reply-text">{truncate(replyToMsg.message)}</div>
            )}
          </div>
        )}

        {isOffer && <OfferCard msg={msg} mine={mine} onRespond={onOfferRespond}/>}
        {!isOffer && !msg._deleted && msg.message && <div className="chat-bubble-text">{msg.message}</div>}
        {msg._deleted && <div className="chat-bubble-deleted">This message was deleted</div>}

        {msg.media_url && !msg._deleted && (
          <img src={msg.media_url} alt="media" className="chat-bubble-media"
            onClick={e => { e.stopPropagation(); onLightbox(msg.media_url); }}/>
        )}

        {msg.location && !msg._deleted && (
          <a href={`https://maps.google.com/?q=${msg.location.lat},${msg.location.lng}`}
            target="_blank" rel="noreferrer" className="chat-location-bubble"
            onClick={e => e.stopPropagation()}>
            <img className="chat-location-map" alt="Location"
              src={`https://staticmap.openstreetmap.de/staticmap.php?center=${msg.location.lat},${msg.location.lng}&zoom=15&size=400x160&markers=${msg.location.lat},${msg.location.lng},red`}
              onError={e => { e.target.style.display="none"; }}/>
            <div className="chat-location-label">
              {Icon.pin} {msg.location.address || `${msg.location.lat.toFixed(4)}, ${msg.location.lng.toFixed(4)}`}
            </div>
          </a>
        )}

        {msg.shared_product && !msg._deleted && (
          <div className="chat-product-card"
            onClick={e => { e.stopPropagation(); window.open(`/product/${msg.shared_product.id}`,"_blank"); }}>
            {msg.shared_product.image && <img src={msg.shared_product.image} alt="" className="chat-product-card-img"/>}
            <div className="chat-product-card-body">
              <div className="chat-product-card-title">{msg.shared_product.title}</div>
              <div className="chat-product-card-price">৳{Number(msg.shared_product.price).toLocaleString()}</div>
              <div className="chat-product-card-cta">Tap to view</div>
            </div>
          </div>
        )}

        <div className={`chat-bubble-meta ${mine?"mine":"theirs"}`}>
          {failed ? (
            <span className="chat-bubble-failed">
              {Icon.close} Not sent · Tap to retry
            </span>
          ) : timedOut ? (
            <span className="chat-bubble-failed">Timed out · Tap to retry</span>
          ) : sending ? (
            <span className="chat-bubble-sending"><span className="chat-sending-spinner"/>Sending</span>
          ) : (
            <>{formatTime(msg.created_at)}{mine && <Tick status={msg.status}/>}</>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════
   DATE SEPARATOR
═══════════════════════════════════ */
function DateSep({ label }) {
  return <div className="chat-date-sep"><span>{label}</span></div>;
}

/* ═══════════════════════════════════
   MAKE OFFER MODAL
═══════════════════════════════════ */
function MakeOfferModal({ product, type, onSend, onClose }) {
  const [amt, setAmt] = useState(product?.price ? Math.round(product.price*.8) : "");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const op = product?.price;
  const disc = amt&&op ? Math.round((1-Number(amt)/op)*100) : null;
  function validate() {
    if (!amt||isNaN(amt)||Number(amt)<=0) return setErr("Enter a valid amount"),false;
    if (op&&Number(amt)>=op)  return setErr("Must be less than listed price"),false;
    if (op&&Number(amt)<op*.3) return setErr("Too low (below 30%)"),false;
    setErr(""); return true;
  }
  function go() { if(!validate()) return; onSend({ type, amount:Number(amt), original_price:op, product_title:product?.title, note:note.trim(), status:"pending" }); onClose(); }
  const pcts = [.95,.90,.80,.70,.60];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e=>e.stopPropagation()}>
        <div className="modal-handle"/>
        <div className="modal-header">
          <div className="modal-title-group">
            <div>
              <div className="modal-title">{type==="last_price"?"Ask Last Price":"Make an Offer"}</div>
              <div className="modal-subtitle">{type==="last_price"?"Ask for the best final price":"Propose a price you'd like to pay"}</div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>{Icon.close}</button>
        </div>
        {product?.title && (
          <div className="modal-product-chip">
            <span className="modal-product-name">{product.title}</span>
            {op && <span className="modal-product-price">৳{Number(op).toLocaleString()}</span>}
          </div>
        )}
        <div className="modal-field">
          <label className="modal-label">Your Offer Price</label>
          <div className="modal-input-wrap">
            <span className="modal-currency">৳</span>
            <input className="modal-input" type="number" placeholder="0" value={amt} min={1} autoFocus
              onChange={e => { setAmt(e.target.value); setErr(""); }}/>
            {disc>0&&disc<100 && <span className="modal-discount-badge">{disc}% off</span>}
          </div>
          {err && <div className="modal-err">{err}</div>}
        </div>
        {op && <>
          <div className="modal-section-label">Quick select</div>
          <div className="modal-quick-btns">
            {pcts.map(p => (
              <button key={p} className="modal-quick-btn"
                onClick={() => { setAmt(Math.round(op*p)); setErr(""); }}>
                {Math.round(p*100)}%
                <span>৳{Math.round(op*p).toLocaleString()}</span>
              </button>
            ))}
          </div>
        </>}
        <div className="modal-field">
          <label className="modal-label">Note <span className="modal-optional">(optional)</span></label>
          <textarea className="modal-textarea" rows={2} maxLength={200}
            placeholder="e.g. I'll pay cash immediately…"
            value={note} onChange={e => setNote(e.target.value)}/>
        </div>
        <div className="modal-actions">
          <button className="modal-cancel" onClick={onClose}>Cancel</button>
          <button className="modal-send" onClick={go}>{type==="last_price"?"Send Request":"Send Offer"}</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════
   COUNTER OFFER MODAL
═══════════════════════════════════ */
function CounterOfferModal({ originalMsg, onSend, onClose }) {
  const o = originalMsg?._offerMeta;
  const [amt, setAmt] = useState(o?.original_price ? Math.round(o.original_price*.9) : o?.amount ? Math.round(o.amount*1.15) : "");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  function go() {
    if (!amt||isNaN(amt)||Number(amt)<=0) return setErr("Enter a valid amount");
    onSend({ type:"counter", amount:Number(amt), original_price:o?.original_price, product_title:o?.product_title, note:note.trim(), status:"pending", counter_to:originalMsg.id });
    onClose();
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e=>e.stopPropagation()}>
        <div className="modal-handle"/>
        <div className="modal-header">
          <div className="modal-title-group">
            <div>
              <div className="modal-title">Counter Offer</div>
              <div className="modal-subtitle">Their offer: ৳{Number(o?.amount||0).toLocaleString()}</div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>{Icon.close}</button>
        </div>
        <div className="modal-field">
          <label className="modal-label">Your Counter Price</label>
          <div className="modal-input-wrap">
            <span className="modal-currency">৳</span>
            <input className="modal-input" type="number" placeholder="0" value={amt} autoFocus
              onChange={e => { setAmt(e.target.value); setErr(""); }}/>
          </div>
          {err && <div className="modal-err">{err}</div>}
        </div>
        <div className="modal-field">
          <label className="modal-label">Note <span className="modal-optional">(optional)</span></label>
          <textarea className="modal-textarea" rows={2} maxLength={200}
            placeholder="Explain your counter…" value={note} onChange={e => setNote(e.target.value)}/>
        </div>
        <div className="modal-actions">
          <button className="modal-cancel" onClick={onClose}>Cancel</button>
          <button className="modal-send" onClick={go}>Send Counter</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════
   LOCATION MODAL
═══════════════════════════════════ */
function LocationModal({ onSend, onClose }) {
  const [st, setSt] = useState("idle");
  const [coords, setCoords] = useState(null);
  const [addr, setAddr] = useState("");

  useEffect(() => {
    if (!navigator.geolocation) { setSt("error"); return; }
    setSt("detecting");
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude:lat, longitude:lng } = pos.coords;
        setCoords({ lat, lng }); setSt("ready");
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
          .then(r=>r.json()).then(d => setAddr(d.display_name||"")).catch(()=>{});
      },
      () => setSt("error"),
      { timeout:10000, enableHighAccuracy:true }
    );
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e=>e.stopPropagation()}>
        <div className="modal-handle"/>
        <div className="modal-header">
          <div className="modal-title-group">
            <div>
              <div className="modal-title">Share Location</div>
              <div className="modal-subtitle">Send your current location</div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>{Icon.close}</button>
        </div>
        {st==="detecting" && (
          <div className="location-detecting">
            <div className="mini-spinner"/>
            Detecting location…
          </div>
        )}
        {st==="ready"&&coords && (
          <>
            <div className="location-map-preview">
              <img alt="Map"
                src={`https://staticmap.openstreetmap.de/staticmap.php?center=${coords.lat},${coords.lng}&zoom=15&size=400x200&markers=${coords.lat},${coords.lng},red`}
                onError={e => { e.target.style.display="none"; }}/>
            </div>
            <div className="location-coords">
              {addr ? truncate(addr,80) : `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`}
            </div>
          </>
        )}
        {st==="error" && (
          <div style={{ textAlign:"center", padding:"30px 20px", color:"#999", fontSize:14 }}>
            Could not get your location. Please allow location access.
          </div>
        )}
        <div className="modal-actions">
          <button className="modal-cancel" onClick={onClose}>Cancel</button>
          <button className="modal-send" onClick={() => { if (coords) { onSend(coords,addr); onClose(); } }}
            disabled={st!=="ready"}>Send Location</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════
   SUGGESTIONS BAR
═══════════════════════════════════ */
function SuggestionsBar({ suggestions, onSelect, onDismiss }) {
  if (!suggestions?.length) return null;
  return (
    <div className="suggestions-wrap">
      <div className="suggestions-row">
        {suggestions.map((s,i) => (
          <button key={i} className="suggestion-chip" onClick={() => onSelect(s)}>{s}</button>
        ))}
      </div>
      <button className="suggestions-dismiss" onClick={onDismiss} title="Dismiss">{Icon.close}</button>
    </div>
  );
}

/* ═══════════════════════════════════
   HEADER MENU
═══════════════════════════════════ */
function HeaderMenu({ otherUser, navigate, onClose, onMute, muted }) {
  return (
    <>
      <div className="chat-menu-overlay" onClick={onClose}/>
      <div className="chat-menu">
        {otherUser?.id && (
          <button className="chat-menu-item" onClick={() => { onClose(); navigate(`/seller/${otherUser.id}`); }}>
            {Icon.user} View Profile
          </button>
        )}
        <button className="chat-menu-item" onClick={() => { onClose(); onMute(); }}>
          {muted ? Icon.unmute : Icon.mute} {muted ? "Unmute" : "Mute"} Notifications
        </button>
        <button className="chat-menu-item" onClick={() => { onClose(); alert("Report submitted."); }}>
          {Icon.flag} Report Seller
        </button>
        <button className="chat-menu-item chat-menu-danger" onClick={() => { onClose(); alert("Marked as spam."); }}>
          {Icon.warn} Mark as Spam
        </button>
      </div>
    </>
  );
}

/* ═══════════════════════════════════
   MAIN
═══════════════════════════════════ */
export default function Chat({ user }) {
  const { threadId } = useParams();
  const navigate = useNavigate();

  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const [otherUser, setOtherUser] = useState(null);
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [sockReady, setSockReady] = useState(false);
  const [error, setError] = useState(null);

  const [showMenu, setShowMenu] = useState(false);
  const [muted, setMuted] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showAttach, setShowAttach] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [ctxMenu, setCtxMenu] = useState(null);

  const [offerModal, setOfferModal] = useState(null);
  const [counterModal, setCounterModal] = useState(null);
  const [locationModal, setLocationModal] = useState(false);

  const fileRef = useRef(null);
  const cameraRef = useRef(null);
  const socketRef = useRef(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimer = useRef(null);
  const historyLoaded = useRef(false);
  const pendingMsgs = useRef([]);
  const mounted = useRef(true);
  const sendTimers = useRef(new Map());

  useEffect(() => { mounted.current=true; return()=>{mounted.current=false;}; },[]);
  const safe = useCallback(fn => { if(mounted.current) fn(); },[]);
  const suggestions = useMemo(() => pickSuggestions(messages,user?.id),[messages,user?.id]);
  const msgMap = useMemo(() => { const m = new Map(); messages.forEach(msg => m.set(msg.id,msg)); return m; },[messages]);

  /* Thread meta */
  useEffect(() => {
    if (!threadId||!user?.id) return;
    const ctrl = new AbortController();
    axios.get(`${API}/conversations/${threadId}`, { headers:authH(), signal:ctrl.signal, timeout:8000 })
    .then(({ data }) => {
      const oid = data.other_user_id||(data.buyer_id===user.id ? data.seller_id : data.buyer_id);
      safe(() => setOtherUser({ id:oid, name:data.other_user_name||"User", profile_image:data.other_user_image, is_online:data.other_user_online||false, store_name:data.other_user_store||"", last_login:data.last_login }));
      if (data.product_title) safe(() => setProduct({ title:data.product_title, images:data.product_image?[data.product_image]:[], price:data.product_price, id:data.product_id }));
      if (oid) axios.get(`${API}/users/${oid}`,{headers:authH()}).then(({data:u})=>safe(()=>setOtherUser(u))).catch(()=>{});
    }).catch(()=>{});
    return () => ctrl.abort();
  },[threadId,user?.id]); // eslint-disable-line

  /* Socket */
  useEffect(() => {
    if (!user?.id||!threadId) return;
    const sock = io(SOCKET_URL,{ transports:["websocket","polling"], withCredentials:false, query:{userId:user.id}, reconnection:true, reconnectionAttempts:8, reconnectionDelay:1500 });
    socketRef.current = sock;
    sock.on("connect",()=>{ sock.emit("joinThread",{threadId,userId:user.id}); safe(()=>setSockReady(true)); });
    sock.on("disconnect",()=>safe(()=>setSockReady(false)));
    sock.on("receiveMessage",msg=>{
      if(!msg?.id||msg.sender_id===user.id) return;
      if(!historyLoaded.current){pendingMsgs.current.push(msg);return;}
      safe(()=>setMessages(p=>{if(p.some(m=>m.id===msg.id))return p;return dedupe([...p,msg]);}));
      sock.emit("markRead",{threadId,userId:user.id});
      axios.patch(`${API}/conversations/${threadId}/read`,{userId:user.id},{headers:authH()}).catch(()=>{});
    });
    sock.on("messagesRead",({userId:uid})=>{if(uid===user.id)return;safe(()=>setMessages(p=>p.map(m=>m.sender_id===user.id&&m.status!=="read"?{...m,status:"read"}:m)));});
    sock.on("userTyping",()=>safe(()=>setIsTyping(true)));
    sock.on("userStopTyping",()=>safe(()=>setIsTyping(false)));
    sock.on("messageDeleted",({messageId})=>safe(()=>setMessages(p=>p.map(m=>m.id===messageId?{...m,_deleted:true}:m))));
    sock.on("offerUpdated",({messageId,status})=>safe(()=>setMessages(p=>p.map(m=>m.id===messageId&&m._offerMeta?{...m,_offerMeta:{...m._offerMeta,status}}:m))));
    sock.on("userOnline",({userId:uid})=>{if(uid!==user.id)safe(()=>setOtherUser(p=>p?{...p,is_online:true}:p));});
    sock.on("userOffline",({userId:uid})=>{if(uid!==user.id)safe(()=>setOtherUser(p=>p?{...p,is_online:false}:p));});
    return () => { sock.disconnect(); socketRef.current=null; };
  },[user?.id,threadId]); // eslint-disable-line

  /* Load history */
  const loadHistory = useCallback(async()=>{
    if(!user?.id||!threadId) return;
    historyLoaded.current=false; pendingMsgs.current=[];
    safe(()=>{setLoading(true);setError(null);});
    try {
      const{data}=await axios.get(`${API}/messages`,{params:{threadId,userId:user.id},headers:authH(),timeout:12000});
      const all=dedupe([...(Array.isArray(data)?data:[]),...pendingMsgs.current]);
      pendingMsgs.current=[]; historyLoaded.current=true;
      safe(()=>setMessages(all));
      socketRef.current?.emit("markRead",{threadId,userId:user.id});
      axios.patch(`${API}/conversations/${threadId}/read`,{userId:user.id},{headers:authH()}).catch(()=>{});
    }catch(err){safe(()=>setError(`${err.response?.status??"Network"} — ${err.response?.data?.message??err.message}`));}
    finally{safe(()=>setLoading(false));}
  },[user?.id,threadId,safe]);
  useEffect(()=>{loadHistory();},[loadHistory]);

  /* Auto-scroll */
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[messages,isTyping]);

  /* Typing */
  const handleTyping = useCallback(()=>{
    socketRef.current?.emit("typing",{threadId,userId:user?.id});
    clearTimeout(typingTimer.current);
    typingTimer.current=setTimeout(()=>{socketRef.current?.emit("stopTyping",{threadId,userId:user?.id});},1500);
  },[threadId,user?.id]);
  useEffect(()=>()=>clearTimeout(typingTimer.current),[]);

  /* Send */
  const SEND_TIMEOUT=15000;
  const sendMessage = useCallback(async(overrideText,extras={})=>{
    const text=(overrideText??newMsg).trim();
    if(!text||sending) return;
    const cid=`${user.id}_${Date.now()}`,tid=`temp_${cid}`;
    const rr=replyTo?{reply_to_id:replyTo.id}:{};
    const temp={id:tid,thread_id:threadId,sender_id:user.id,message:text,
      message_type:extras.offerMeta?"offer":extras.location?"location":extras.shared_product?"product":"text",
      created_at:new Date().toISOString(),status:"sending",_temp:true,_failed:false,_timedOut:false,...rr,
      ...(extras.offerMeta?{_offerMeta:extras.offerMeta}:{}),
      ...(extras.location?{location:extras.location}:{}),
      ...(extras.shared_product?{shared_product:extras.shared_product}:{}),
    };
    safe(()=>{setMessages(p=>[...p,temp]);if(!overrideText)setNewMsg("");setSending(true);setShowSuggestions(false);setReplyTo(null);});
    clearTimeout(typingTimer.current);
    socketRef.current?.emit("stopTyping",{threadId,userId:user.id});
    const timer=setTimeout(()=>{safe(()=>{setMessages(p=>p.map(m=>m.id===tid&&m._temp?{...m,_temp:false,_timedOut:true}:m));setSending(false);});},SEND_TIMEOUT);
    sendTimers.current.set(tid,timer);
    try{
      const{data:saved}=await axios.post(`${API}/messages`,{threadId,senderId:user.id,message:text,messageType:temp.message_type,clientMessageId:cid,...rr,...(extras.offerMeta?{offerMeta:extras.offerMeta}:{}),...(extras.location?{location:extras.location}:{}),...(extras.shared_product?{sharedProduct:extras.shared_product}:{})},{headers:authH(),timeout:SEND_TIMEOUT});
      clearTimeout(sendTimers.current.get(tid));sendTimers.current.delete(tid);
      const fin={...saved,...extras};if(extras.offerMeta)fin._offerMeta=extras.offerMeta;
      safe(()=>setMessages(p=>p.map(m=>m.id===tid?fin:m)));
      socketRef.current?.emit("sendMessage",fin);
    }catch{
      clearTimeout(sendTimers.current.get(tid));sendTimers.current.delete(tid);
      safe(()=>{setMessages(p=>p.map(m=>m.id===tid?{...m,_temp:false,_failed:true,_timedOut:false}:m));if(!overrideText)setNewMsg(text);});
    }finally{safe(()=>setSending(false));inputRef.current?.focus();}
  },[newMsg,sending,threadId,user?.id,safe,replyTo]); // eslint-disable-line

  const handleSendOffer = useCallback(om=>{
    sendMessage(om.type==="last_price"?`Last Price Request: ৳${om.amount.toLocaleString()}`:`Offer: ৳${om.amount.toLocaleString()}`,{offerMeta:om});
  },[sendMessage]);

  const handleOfferRespond = useCallback((orig,action)=>{
    if(action==="countered"){setCounterModal(orig);return;}
    safe(()=>setMessages(p=>p.map(m=>m.id===orig.id&&m._offerMeta?{...m,_offerMeta:{...m._offerMeta,status:action}}:m)));
    sendMessage(action==="accepted"?`Accepted! ৳${orig._offerMeta.amount.toLocaleString()}`:"Offer declined.",{});
    socketRef.current?.emit("offerResponse",{threadId,messageId:orig.id,status:action,userId:user.id});
    axios.patch(`${API}/messages/${orig.id}/offer`,{status:action,userId:user.id},{headers:authH()}).catch(()=>{});
  },[threadId,user?.id,safe,sendMessage]); // eslint-disable-line

  const handleDelete = useCallback(msg=>{
    if(!window.confirm("Delete this message?")) return;
    safe(()=>setMessages(p=>p.map(m=>m.id===msg.id?{...m,_deleted:true}:m)));
    socketRef.current?.emit("deleteMessage",{threadId,messageId:msg.id});
    axios.delete(`${API}/messages/${msg.id}`,{data:{userId:user.id},headers:authH()}).catch(()=>{});
  },[threadId,user?.id,safe]);

  const handleCopy = useCallback(msg=>{ navigator.clipboard?.writeText(msg.message).catch(()=>{}); },[]);

  /* Image upload */
  const handleImageChange = useCallback(async e=>{
    const file=e.target.files?.[0]; if(!file)return; e.target.value=""; setShowAttach(false);
    if(!file.type.startsWith("image/")){alert("Only images allowed.");return;}
    if(file.size>10*1024*1024){alert("Image too large. Max 10 MB.");return;}
    const cid=`${user.id}_${Date.now()}`,tid=`temp_${cid}`,url=URL.createObjectURL(file);
    const temp={id:tid,thread_id:threadId,sender_id:user.id,message:"Photo",message_type:"media",media_url:url,created_at:new Date().toISOString(),status:"sending",_temp:true,_failed:false,_timedOut:false};
    safe(()=>setMessages(p=>[...p,temp]));
    try{
      const form=new FormData();form.append("file",file);form.append("threadId",threadId);form.append("senderId",user.id);form.append("messageType","media");form.append("clientMessageId",cid);if(replyTo)form.append("reply_to_id",replyTo.id);
      const{data:saved}=await axios.post(`${API}/messages/upload`,form,{headers:{...authH(),"Content-Type":"multipart/form-data"},timeout:30000});
      URL.revokeObjectURL(url);
      safe(()=>setMessages(p=>p.map(m=>m.id===tid?saved:m)));
      socketRef.current?.emit("sendMessage",saved);safe(()=>setReplyTo(null));
    }catch{URL.revokeObjectURL(url);safe(()=>setMessages(p=>p.map(m=>m.id===tid?{...m,_temp:false,_failed:true,_timedOut:false}:m)));}
  },[threadId,user?.id,safe,replyTo]);

  const handleSendLocation = useCallback((coords,addr)=>{
    sendMessage(addr?truncate(addr,50):"My Location",{location:{...coords,address:addr}});
  },[sendMessage]);

  const handleShareProduct = useCallback(()=>{
    if(!product) return;
    sendMessage(`${product.title} — ৳${Number(product.price).toLocaleString()}`,{
      shared_product:{id:product.id||"",title:product.title,price:product.price,image:product.images?.[0]||""},
    });
  },[product,sendMessage]);

  const handleCtx = useCallback((msg,pos,shortcut)=>{
    if(shortcut==="reply"){setReplyTo(msg);inputRef.current?.focus();return;}
    setCtxMenu({msg,pos});
  },[]);

  const retryMessage = useCallback(fm=>{setMessages(p=>p.filter(m=>m.id!==fm.id));setNewMsg(fm.message);inputRef.current?.focus();},[]);
  const handleKeyDown = useCallback(e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();}if(e.key==="Escape")setReplyTo(null);},[sendMessage]);
  const isMine = useCallback(m=>m.sender_id===user?.id,[user?.id]);
  const grouped = useMemo(()=>groupByDate(messages),[messages]);
  const canSend = newMsg.trim().length>0&&!sending;
  useEffect(()=>()=>{sendTimers.current.forEach(t=>clearTimeout(t));},[]);

  /* ═══ RENDER ═══ */
  return (
    <div className="chat-wrap">

      {/* HEADER */}
      <header className="chat-header">
        <button className="chat-icon-btn" onClick={() => navigate(-1)} aria-label="Back">{Icon.back}</button>
        <div className="chat-avatar-wrap">
          <img className="chat-avatar" src={otherUser?.profile_image||`https://ui-avatars.com/api/?name=${encodeURIComponent(otherUser?.name||"U")}&background=111&color=fff&size=80`} alt={otherUser?.name||"User"}/>
          {otherUser?.is_online && <span className="chat-online-dot"/>}
        </div>
        <div className="chat-header-info" onClick={()=>otherUser?.id&&navigate(`/seller/${otherUser.id}`)}>
          <div className="chat-header-name">{otherUser?.name||"…"}</div>
          <div className={`chat-header-status ${isTyping?"typing":otherUser?.is_online?"online":"offline"}`}>
            {isTyping?"typing…":otherUser?.is_online?"Online":lastSeenText(otherUser?.last_login,false)}
          </div>
        </div>
        {product?.images?.[0] && <img className="chat-product-thumb" src={product.images[0]} alt={product.title} title={product.title}/>}
        <div className="chat-sock-dot" title={sockReady?"Connected":"Connecting…"} style={{background:sockReady?"#22c55e":"#f59e0b"}}/>
        <button className="chat-icon-btn" onClick={()=>setShowMenu(v=>!v)} aria-label="Menu">{Icon.more}</button>
      </header>

      {muted && <div className="mute-banner">Notifications muted <button onClick={()=>setMuted(false)}>Unmute</button></div>}
      {showMenu && <HeaderMenu otherUser={otherUser} navigate={navigate} onClose={()=>setShowMenu(false)} onMute={()=>setMuted(v=>!v)} muted={muted}/>}

      {/* BODY */}
      <main className="chat-body" onClick={()=>{setCtxMenu(null);setShowAttach(false);}}>
        {loading && <div className="chat-center"><div className="chat-spinner"/></div>}
        {!loading&&error && (
          <div className="chat-center">
            <p className="chat-empty-title">Failed to load messages</p>
            <p className="chat-err-code">{error}</p>
            <button onClick={loadHistory} style={{padding:"9px 28px",borderRadius:20,border:"none",background:"#111",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>Retry</button>
          </div>
        )}
        {!loading&&!error&&messages.length===0 && (
          <div className="chat-center">
            <p className="chat-empty-title">No messages yet</p>
            <p className="chat-empty-sub">Say hello or make an offer to start!</p>
          </div>
        )}
        {!loading&&!error&&messages.length>0 && (
          <>
            {grouped.map((item,i) => item.type==="date" ? (
              <DateSep key={`d${i}`} label={item.label}/>
            ) : (
              <Bubble key={item.data.id} msg={item.data} mine={isMine(item.data)}
                onRetry={retryMessage} onOfferRespond={handleOfferRespond}
                onCtx={handleCtx} onLightbox={setLightboxUrl}
                replyToMsg={item.data.reply_to_id?msgMap.get(item.data.reply_to_id):null}/>
            ))}
            {isTyping && <TypingBubble/>}
          </>
        )}
        <div ref={bottomRef}/>
      </main>

      {/* Context menu */}
      {ctxMenu && <ContextMenu msg={ctxMenu.msg} mine={isMine(ctxMenu.msg)} pos={ctxMenu.pos}
        onClose={()=>setCtxMenu(null)}
        onReply={()=>{setReplyTo(ctxMenu.msg);inputRef.current?.focus();}}
        onCopy={()=>handleCopy(ctxMenu.msg)}
        onDelete={()=>handleDelete(ctxMenu.msg)}/>}

      {/* TOOLBAR */}
      <div className="chat-toolbar">
        <button className="toolbar-btn offer" onClick={()=>setOfferModal("offer")}>{Icon.offer} Make Offer</button>
        <button className="toolbar-btn last-price" onClick={()=>setOfferModal("last_price")}>{Icon.handshake} Last Price</button>
        {product && <button className="toolbar-btn share-product" onClick={handleShareProduct}>{Icon.product} Share Product</button>}
        {!showSuggestions && <button className="toolbar-btn" onClick={()=>setShowSuggestions(true)}>{Icon.suggest} Suggestions</button>}
      </div>

      {/* SUGGESTIONS */}
      {showSuggestions && <SuggestionsBar suggestions={suggestions}
        onSelect={s=>{setNewMsg(s);setShowSuggestions(false);inputRef.current?.focus();}}
        onDismiss={()=>setShowSuggestions(false)}/>}

      {/* REPLY PREVIEW */}
      {replyTo && (
        <div className="footer-reply-preview">
          {Icon.reply}
          <div className="footer-reply-text">
            <div className="footer-reply-sender">{replyTo.sender_id===user?.id?"You":otherUser?.name}</div>
            {replyTo.media_url ? (
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <img src={replyTo.media_url} alt="" className="footer-reply-thumb"/>
                <span className="footer-reply-msg">Photo</span>
              </div>
            ) : <div className="footer-reply-msg">{truncate(replyTo.message)}</div>}
          </div>
          <button className="footer-reply-close" onClick={()=>setReplyTo(null)}>{Icon.close}</button>
        </div>
      )}

      {/* FOOTER */}
      <footer className="chat-footer">
        {/* Attach popover */}
        {showAttach && (
          <div className="attach-popover">
            <button className="attach-option" onClick={()=>cameraRef.current?.click()}>
              {Icon.camera}<span>Camera</span>
            </button>
            <button className="attach-option" onClick={()=>fileRef.current?.click()}>
              {Icon.gallery}<span>Gallery</span>
            </button>
            <button className="attach-option" onClick={()=>{setShowAttach(false);setLocationModal(true);}}>
              {Icon.location}<span>Location</span>
            </button>
          </div>
        )}

        <input ref={fileRef} type="file" accept="image/*" className="hidden-input" onChange={handleImageChange}/>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden-input" onChange={handleImageChange}/>

        <button className="chat-icon-btn" onClick={e=>{e.stopPropagation();setShowAttach(v=>!v);}} aria-label="Attach">{Icon.attach}</button>

        <input ref={inputRef} className="chat-input" type="text" value={newMsg}
          onChange={e=>{setNewMsg(e.target.value);handleTyping();}}
          onKeyDown={handleKeyDown}
          placeholder={replyTo?"Write a reply…":"Type a message…"}
          aria-label="Message" maxLength={5000}/>

        <button className="chat-send-btn" onClick={()=>sendMessage()} disabled={!canSend} aria-label="Send"
          style={{background:canSend?"#111":"#e5e5e5",color:canSend?"#fff":"#aaa"}}>
          {sending?<div className="chat-btn-spinner"/>:Icon.send}
        </button>
      </footer>

      {/* LIGHTBOX */}
      {lightboxUrl && (
        <div className="lightbox-overlay" onClick={()=>setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="Full" className="lightbox-img" onClick={e=>e.stopPropagation()}/>
          <button className="lightbox-close" onClick={()=>setLightboxUrl(null)}>{Icon.close}</button>
        </div>
      )}

      {/* MODALS */}
      {offerModal && <MakeOfferModal product={product} type={offerModal} onSend={handleSendOffer} onClose={()=>setOfferModal(null)}/>}
      {counterModal && <CounterOfferModal originalMsg={counterModal} onSend={handleSendOffer} onClose={()=>setCounterModal(null)}/>}
      {locationModal && <LocationModal onSend={handleSendLocation} onClose={()=>setLocationModal(false)}/>}
    </div>
  );
}