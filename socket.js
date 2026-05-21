const { Server }   = require("socket.io");
const { pool }     = require("./db");

/**
 * Map of userId → Set<socketId>
 * One user can have multiple tabs/devices open
 */
const onlineUsers = new Map();

function getSocketsForUser(userId) {
  return onlineUsers.get(userId) ?? new Set();
}

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

/* ── Persist online flag to DB (debounced) ── */
const presenceTimers = new Map();
function debouncedPresence(userId, online) {
  clearTimeout(presenceTimers.get(userId));
  presenceTimers.set(
    userId,
    setTimeout(async () => {
      try {
        await pool.query(
          `UPDATE public.users
           SET is_online = $1,
               last_login = CASE WHEN $1 = false THEN now() ELSE last_login END
           WHERE id = $2`,
          [online, userId]
        );
      } catch (e) {
        console.error("Presence DB update failed:", e.message);
      }
    }, 2_000) // 2 s debounce — avoids hammering DB on rapid connects
  );
}

/* ══════════════════════════════════════════════
   Main export — call once after httpServer ready
══════════════════════════════════════════════ */
module.exports = function attachSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin:      process.env.CLIENT_URL ?? "*",
      methods:     ["GET", "POST"],
      credentials: false,
    },
    transports:       ["websocket", "polling"],
    pingTimeout:      20_000,
    pingInterval:     10_000,
  });

  io.on("connection", (socket) => {
    const userId = socket.handshake.query.userId;

    if (!userId) {
      socket.disconnect(true);
      return;
    }

    /* ── Register presence ── */
    addSocket(userId, socket.id);
    debouncedPresence(userId, true);

    /* Broadcast online status to everyone in the user's threads */
    socket.broadcast.emit("userOnline", { userId });

    /* ── Join a thread room ── */
    socket.on("joinThread", ({ threadId }) => {
      if (!threadId) return;
      socket.join(threadId);
    });

    /* ── Leave a thread room ── */
    socket.on("leaveThread", ({ threadId }) => {
      if (!threadId) return;
      socket.leave(threadId);
    });

    /* ─────────────────────────────────────────
       sendMessage
       Relays the already-saved message to the
       other participant(s) in the thread room
    ───────────────────────────────────────── */
    socket.on("sendMessage", (message) => {
      if (!message?.thread_id || !message?.id) return;

      /* Emit to everyone in the room EXCEPT the sender socket */
      socket.to(message.thread_id).emit("receiveMessage", message);
    });

    /* ─────────────────────────────────────────
       markRead
       Tells the other side to flip ticks blue
    ───────────────────────────────────────── */
    socket.on("markRead", ({ threadId, userId: uid }) => {
      if (!threadId || !uid) return;
      socket.to(threadId).emit("messagesRead", { userId: uid, threadId });
    });

    /* ─────────────────────────────────────────
       Typing indicators
    ───────────────────────────────────────── */
    socket.on("typing", ({ threadId, userId: uid }) => {
      if (!threadId || !uid) return;
      socket.to(threadId).emit("userTyping", { userId: uid });
    });

    socket.on("stopTyping", ({ threadId, userId: uid }) => {
      if (!threadId || !uid) return;
      socket.to(threadId).emit("userStopTyping", { userId: uid });
    });

    /* ─────────────────────────────────────────
       messageEdited / messageDeleted
       Real-time propagation for edit & delete
    ───────────────────────────────────────── */
    socket.on("messageEdited", ({ threadId, messageId, message }) => {
      socket.to(threadId).emit("messageEdited", { messageId, message });
    });

    socket.on("messageDeleted", ({ threadId, messageId }) => {
      socket.to(threadId).emit("messageDeleted", { messageId });
    });

    /* ─────────────────────────────────────────
       Disconnect
    ───────────────────────────────────────── */
    socket.on("disconnect", () => {
      removeSocket(userId, socket.id);

      if (!isOnline(userId)) {
        debouncedPresence(userId, false);
        socket.broadcast.emit("userOffline", { userId });
      }
    });
  });

  return io;
};