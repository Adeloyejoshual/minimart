import { Server as SocketIOServer } from "socket.io";
import { pool }                     from "./config/db.js";

// Presence: userId → Set<socketId> (multi-tab safe)
const onlineUsers = new Map();

const userOnline = (userId, socketId) => {
  const s = onlineUsers.get(String(userId)) || new Set();
  s.add(socketId);
  onlineUsers.set(String(userId), s);
  if (s.size === 1) {
    pool.query(`UPDATE users SET is_online = true WHERE id = $1`, [userId]).catch(() => {});
  }
};

const userOffline = (userId, socketId) => {
  const s = onlineUsers.get(String(userId));
  if (!s) return;
  s.delete(socketId);
  if (s.size === 0) {
    onlineUsers.delete(String(userId));
    pool.query(`UPDATE users SET is_online = false WHERE id = $1`, [userId]).catch(() => {});
  }
};

export const getOnlineCount = () => onlineUsers.size;

export function initSocket(server, allowedOrigin = "*") {
  const io = new SocketIOServer(server, {
    cors: {
      origin:  allowedOrigin,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    },
  });

  io.on("connection", (socket) => {
    const userId = socket.handshake.query.userId || null;

    if (userId) {
      userOnline(userId, socket.id);
      console.log(`🔌 Connected: ${socket.id} | user: ${userId}`);
    } else {
      console.log(`🔌 Connected: ${socket.id} | guest`);
    }

    /* ── Join thread room ── */
    socket.on("joinThread", ({ threadId, userId: uid }) => {
      if (!threadId || !uid) return;
      socket.join(threadId);
      console.log(`📦 ${uid} joined thread: ${threadId}`);

      pool.query(
        `UPDATE chat_messages
         SET status = 'delivered'
         WHERE thread_id = $1
           AND sender_id != $2
           AND status = 'sent'
           AND deleted = false`,
        [threadId, uid]
      ).catch(() => {});
    });

    /* ── Relay saved message to other person ── */
    socket.on("sendMessage", (msg) => {
      if (!msg?.thread_id) return;
      socket.to(msg.thread_id).emit("receiveMessage", msg);
    });

    /* ── Typing ── */
    socket.on("typing", ({ threadId, userId: uid }) => {
      if (!threadId) return;
      socket.to(threadId).emit("userTyping", { userId: uid });
    });

    socket.on("stopTyping", ({ threadId, userId: uid }) => {
      if (!threadId) return;
      socket.to(threadId).emit("userStopTyping", { userId: uid });
    });

    /* ── Read receipts ── */
    socket.on("markRead", ({ threadId, userId: uid }) => {
      if (!threadId || !uid) return;

      pool.query(
        `UPDATE chat_messages
         SET status = 'read'
         WHERE thread_id = $1
           AND sender_id != $2
           AND status != 'read'
           AND deleted = false`,
        [threadId, uid]
      ).then(() => {
        pool.query(
          `UPDATE chat_threads
           SET
             unread_buyer  = CASE WHEN buyer_id  = $2 THEN 0 ELSE unread_buyer  END,
             unread_seller = CASE WHEN seller_id = $2 THEN 0 ELSE unread_seller END
           WHERE id = $1`,
          [threadId, uid]
        ).catch(() => {});
      }).catch(() => {});

      socket.to(threadId).emit("messagesRead", { threadId, userId: uid });
    });

    /* ── Disconnect ── */
    socket.on("disconnect", () => {
      if (userId) {
        userOffline(userId, socket.id);
        console.log(`❌ Disconnected: ${socket.id} | user: ${userId}`);
      } else {
        console.log(`❌ Disconnected: ${socket.id} | guest`);
      }
    });
  });

  return io;
}