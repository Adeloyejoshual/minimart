import { useState, useEffect, useCallback, FC } from "react";
import { useNavigate, useParams } from "react-router-dom";

import ConversationsSidebar from "../components/messaging/ConversationsSidebar";
import ChatPanel from "../components/messaging/ChatPanel";
import { User, Thread } from "../components/messaging/types";

import "../styles/messaging-desktop.css";

/* ─────────────────────────────────────────
   NoChatSelected placeholder
───────────────────────────────────────── */
const NoChatSelected: FC = () => (
  <div className="msg-empty-pane">
    <svg
      width="72"
      height="72"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03
           8-9 8a9.77 9.77 0 01-4-.85L3 20l1.09-3.27C3.4
           15.56 3 13.82 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
    <p className="msg-empty-pane__title">Select a conversation</p>
    <p className="msg-empty-pane__sub">
      Choose from your conversations on the left to start chatting.
    </p>
  </div>
);

/* ─────────────────────────────────────────
   Props
───────────────────────────────────────── */
interface MessagingDesktopProps {
  user: User;
}

/* ─────────────────────────────────────────
   Component
───────────────────────────────────────── */
const MessagingDesktop: FC<MessagingDesktopProps> = ({ user }) => {
  const navigate = useNavigate();
  const { threadId: urlThread } = useParams<{ threadId?: string }>();

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(
    urlThread ?? null
  );

  /* Sync URL → selected */
  useEffect(() => {
    if (urlThread) setSelectedThreadId(urlThread);
  }, [urlThread]);

  const handleSelectThread = useCallback(
    (tid: string, _thread: Thread) => {
      setSelectedThreadId(tid);
      navigate(`/messages/${tid}`, { replace: true });
    },
    [navigate]
  );

  /* ── Not logged in ── */
  if (!user?.id) {
    return (
      <div className="msg-login-wall">
        <svg
          width="56"
          height="56"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03
               8-9 8a9.77 9.77 0 01-4-.85L3 20l1.09-3.27C3.4
               15.56 3 13.82 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        <p className="msg-login-wall__title">Log in to see your messages</p>
        <p className="msg-login-wall__subtitle">
          Once you're logged in, all your conversations will appear here.
        </p>
        <button
          className="msg-login-wall__btn"
          onClick={() => navigate("/auth")}
        >
          Log in
        </button>
      </div>
    );
  }

  /* ── Main Layout ── */
  return (
    <div className="msg-desktop">
      {/* Left: Conversations Sidebar */}
      <ConversationsSidebar
        user={user}
        selectedThreadId={selectedThreadId}
        onSelectThread={handleSelectThread}
      />

      {/* Right: Chat panel or placeholder */}
      {selectedThreadId ? (
        <ChatPanel
          key={selectedThreadId}
          threadId={selectedThreadId}
          user={user}
        />
      ) : (
        <NoChatSelected />
      )}
    </div>
  );
};

export default MessagingDesktop;