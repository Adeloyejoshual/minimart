// socket.js
import { Server } from "socket.io";
import { sub } from "./config/redis.js";

export function initSocket(server) {
  const io = new Server(server, {
    cors: { origin: "*" },
  });

  io.on("connection", (socket) => {
    const userId = socket.handshake.auth.userId;

    if (userId) {
      socket.join(`user:${userId}`);
    }

    socket.on("join_thread", (threadId) => {
      socket.join(`thread:${threadId}`);
    });

    socket.on("mark_read", ({ threadId }) => {
      io.to(`thread:${threadId}`).emit("message:read", { threadId });
    });
  });

  // Redis subscriber → Socket broadcast
  sub.subscribe("chat_events");

  sub.on("message", (_, message) => {
    const event = JSON.parse(message);

    if (event.type === "NEW_MESSAGE") {
      io.to(`thread:${event.threadId}`).emit("message:new", event.payload);
    }

    if (event.type === "DELIVERED") {
      io.to(`thread:${event.threadId}`).emit("message:delivered", event.payload);
    }

    if (event.type === "READ") {
      io.to(`thread:${event.threadId}`).emit("message:read", event.payload);
    }
  });

  return io;
}