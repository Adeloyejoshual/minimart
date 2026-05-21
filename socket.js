import { Server } from "socket.io";

/* ── In-memory presence map ── */
const onlineUsers = new Map(); // userId → Set<socketId>

/* ═══════════════════════════════════════════════════════
   EXPORT: getOnlineCount
   Called by /api/health in server.js
═══════════════════════════════════════════════════════ */
export function getOnlineCount() {
  return onlineUsers.size;
}

/* ═══════════════════════════════════════════════════════
   EXPORT: initSocket
═══════════════════════════════════════════════════════ */
export function initSocket(httpServer, allowedOrigin = "*") {
  const io = new Server(httpServer, {
    cors: {
      origin:      allowedOrigin,
      methods:     ["GET", "POST"],
      credentials: false,
    },
    transports:   ["websocket", "polling"],
    pingTimeout:  20_000,
    pingInterval: 10_000,
  });

  /* ── Presence helpers ── */
  function addSocket(userId, socketId) {
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socketId);
  }

  function removeSocket(userId, socketId) {
    const sockets = onlineUsers.get(userId);
    if (!sockets) return;
    sockets.delete(socketId);
    if (sockets.size === 0) onlineUsers.delete(userId);
  }

  function isOnline(userId) {
    return (onlineUsers.get(userId)?.size ?? 0) > 0;
  }

  /* ── Debounced DB presence update ── */
  const presenceTimers = new Map();

  function debouncedPresence(userId, online, pool) {
    clearTimeout(presenceTimers.get(userId));
    presenceTimers.set(
      userId,
      setTimeout(async () => {
        try {
          await pool.query(
            `UPDATE public.users
             SET    is_online  = $1,
                    last_login = CASE
                                   WHEN $1 = false THEN now()
                                   ELSE last_login
                                 END
             WHERE  id = $2`,
            [online, userId]
          );
        } catch (e) {
          console.error("Presence DB update failed:", e.message);
        }
      }, 2_000)
    );
  }

  /* ════════════════════════════════════════
     CONNECTION
  ════════════════════════════════════════ */
  io.on("connection", (socket) => {
    const userId = socket.handshake.query.userId;

    if (!userId) {
      socket.disconnect(true);
      return;
    }

    /* Lazy-import pool to avoid circular dependency */
    let pool;
    import("./server.js")
      .then((mod) => {
        pool = mod.pool;

        /* ── Register presence ── */
        addSocket(userId, socket.id);
        debouncedPresence(userId, true, pool);
        socket.broadcast.emit("userOnline", { userId });
      })
      .catch((e) => console.error("Pool import failed:", e.message));

    /* ── Join thread room ── */
    socket.on("joinThread", ({ threadId }) => {
      if (!threadId) return;
      socket.join(threadId);
      console.log(`🔗 User ${userId} joined thread ${threadId}`);
    });

    /* ── Leave thread room ── */
    socket.on("leaveThread", ({ threadId }) => {
      if (!threadId) return;
      socket.leave(threadId);
    });

    /* ── Relay saved message to room ── */
    socket.on("sendMessage", (message) => {
      if (!message?.thread_id || !message?.id) return;
      socket.to(message.thread_id).emit("receiveMessage", message);
    });

    /* ── Blue ticks ── */
    socket.on("markRead", ({ threadId, userId: uid }) => {
      if (!threadId || !uid) return;
      socket.to(threadId).emit("messagesRead", { userId: uid, threadId });
    });

    /* ── Typing indicators ── */
    socket.on("typing", ({ threadId, userId: uid }) => {
      if (!threadId || !uid) return;
      socket.to(threadId).emit("userTyping", { userId: uid });
    });

    socket.on("stopTyping", ({ threadId, userId: uid }) => {
      if (!threadId || !uid) return;
      socket.to(threadId).emit("userStopTyping", { userId: uid });
    });

    /* ── Edit / delete propagation ── */
    socket.on("messageEdited", ({ threadId, messageId, message }) => {
      if (!threadId || !messageId) return;
      socket.to(threadId).emit("messageEdited", { messageId, message });
    });

    socket.on("messageDeleted", ({ threadId, messageId }) => {
      if (!threadId || !messageId) return;
      socket.to(threadId).emit("messageDeleted", { messageId });
    });

    /* ── Disconnect ── */
    socket.on("disconnect", () => {
      removeSocket(userId, socket.id);

      if (!isOnline(userId) && pool) {
        debouncedPresence(userId, false, pool);
        socket.broadcast.emit("userOffline", { userId });
      }
    });
  });

  return io;
}