// socket.js
import { Server } from "socket.io";
import { sub } from "./config/redis.js";

const onlineUsers = new Set();

export function initSocket(server) {
  const io = new Server(server, {
    cors: { origin: "*" },
  });

  io.on("connection", (socket) => {
    const userId = socket.handshake.auth?.userId;

    if (userId) {
      onlineUsers.add(userId);

      socket.join(`user:${userId}`);

      io.emit("presence:update", {
        userId,
        online: true,
      });
    }

    socket.on("disconnect", () => {
      if (userId) {
        onlineUsers.delete(userId);

        io.emit("presence:update", {
          userId,
          online: false,
        });
      }
    });

    socket.on("join_thread", (threadId) => {
      socket.join(`thread:${threadId}`);
    });

    socket.on("mark_read", ({ threadId }) => {
      io.to(`thread:${threadId}`).emit("message:read", { threadId });
    });
  });

  // Redis → Socket bridge
  sub.subscribe("chat_events");

  sub.on("message", (_, message) => {
    const event = JSON.parse(message);

    if (event.type === "NEW_MESSAGE") {
      io.to(`thread:${event.threadId}`).emit("message:new", event.payload);
    }

    if (event.type === "DELIVERED") {
      io.to(`thread:${event.threadId}`).emit("message:delivered", event.payload);
    }
  });

  return io;
}

// ✅ THIS is what your server is trying to import
export function getOnlineCount() {
  return onlineUsers.size;
}