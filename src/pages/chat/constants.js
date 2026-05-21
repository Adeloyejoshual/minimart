export const MESSAGE_TYPES = {
  TEXT:     "text",
  MEDIA:    "media",
  OFFER:    "offer",
  LOCATION: "location",
  PRODUCT:  "product",
};

export const OFFER_STATUS = {
  PENDING:   "pending",
  ACCEPTED:  "accepted",
  DECLINED:  "declined",
  COUNTERED: "countered",
};

export const SUGGESTIONS = {
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
    "Last price please?",
    "Can we negotiate?",
  ],
  after_offer: [
    "I can pay immediately",
    "Cash on delivery please",
    "Can we meet today?",
    "I'll take it!",
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
    "What's the last price?",
  ],
  closing: [
    "OK deal!",
    "Send me your location",
    "Payment sent! Please confirm",
    "Thank you!",
    "Let's finalize this",
  ],
};

export function pickSuggestions(messages, userId) {
  if (!messages?.length) return SUGGESTIONS.greeting;
  const last       = messages[messages.length - 1];
  const hasOffer   = messages.some(m => m._offerMeta);
  const accepted   = messages.some(m => m._offerMeta?.status === OFFER_STATUS.ACCEPTED);
  const lastIsMine = last?.sender_id === userId;
  if (accepted)               return SUGGESTIONS.offer_accepted;
  if (hasOffer && lastIsMine) return SUGGESTIONS.after_offer;
  if (hasOffer)               return SUGGESTIONS.negotiation;
  if (!lastIsMine)            return SUGGESTIONS.default;
  return SUGGESTIONS.closing;
}

export function getToken() {
  return localStorage.getItem("token") || sessionStorage.getItem("token") || "";
}
export function authH() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}
export function formatTime(d) {
  return new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
export function formatDateLabel(d) {
  const date = new Date(d), now = new Date();
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (date.toDateString() === now.toDateString()) return "Today";
  if (date.toDateString() === y.toDateString())   return "Yesterday";
  return date.toLocaleDateString([], {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}
export function lastSeenText(lastLogin) {
  if (!lastLogin) return "Offline";
  const d = Math.floor((Date.now() - new Date(lastLogin)) / 1000);
  if (d < 60)     return "last seen just now";
  if (d < 3600)   return `last seen ${Math.floor(d / 60)}m ago`;
  if (d < 86400)  return `last seen ${Math.floor(d / 3600)}h ago`;
  if (d < 172800) return "last seen yesterday";
  return `last seen ${new Date(lastLogin).toLocaleDateString([], {
    month: "short", day: "numeric",
  })}`;
}
export function groupByDate(msgs) {
  const out = []; let last = null;
  for (const m of msgs) {
    const l = formatDateLabel(m.created_at);
    if (l !== last) { out.push({ type: "date", label: l }); last = l; }
    out.push({ type: "msg", data: m });
  }
  return out;
}
export function dedupe(arr) {
  const map = new Map();
  for (const m of arr) map.set(m.id, m);
  return [...map.values()].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  );
}
export function truncate(str, n = 55) {
  return str?.length > n ? str.slice(0, n) + "…" : str || "";
}