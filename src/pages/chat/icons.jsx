export const Icon = {
  back: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 19l-7-7 7-7"/>
    </svg>
  ),
  more: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <circle cx="12" cy="5" r="1"/>
      <circle cx="12" cy="12" r="1"/>
      <circle cx="12" cy="19" r="1"/>
    </svg>
  ),
  send: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
    </svg>
  ),
  plus: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14"/>
    </svg>
  ),
  camera: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0
               012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  ),
  gallery: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <path d="M21 15l-5-5L5 21"/>
    </svg>
  ),
  location: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round">
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
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 14L4 9l5-5"/>
      <path d="M4 9h10.5a5.5 5.5 0 010 11H11"/>
    </svg>
  ),
  copy: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
    </svg>
  ),
  trash: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0
               01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
    </svg>
  ),
  user: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  mute: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 01-3.46 0"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ),
  unmute: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 01-3.46 0"/>
    </svg>
  ),
  flag: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
      <line x1="4" y1="22" x2="4" y2="15"/>
    </svg>
  ),
  warn: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0
               001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  tag: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83
               0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
      <line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg>
  ),
  offer: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
    </svg>
  ),
  product: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <path d="M16 10a4 4 0 01-8 0"/>
    </svg>
  ),
  suggest: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 8v4M12 16h.01"/>
    </svg>
  ),
  pin: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  ),
  tick: ({ status }) => {
    if (status === "sending") return null;
    const read = status === "read", del = status === "delivered";
    const c = read ? "#60a5fa" : del ? "rgba(255,255,255,.65)" : "rgba(255,255,255,.3)";
    return (
      <svg width="16" height="11" viewBox="0 0 16 11" fill="none">
        {(read || del) ? (
          <>
            <path d="M1 5.5l3 3L10.5 1" stroke={c} strokeWidth="1.6"
              strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M5.5 5.5l3 3L15 1" stroke={c} strokeWidth="1.6"
              strokeLinecap="round" strokeLinejoin="round"/>
          </>
        ) : (
          <path d="M1 5.5l3 3L10.5 1" stroke={c} strokeWidth="1.6"
            strokeLinecap="round" strokeLinejoin="round"/>
        )}
      </svg>
    );
  },
};