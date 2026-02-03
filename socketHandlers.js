module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("🔌 Client connected:", socket.id);

    socket.on("joinRoom", (userId) => socket.join(userId));

    socket.on("cartUpdated", ({ userId, items }) => {
      io.to(userId).emit("cartUpdated", { userId, items });
    });

    socket.on("kycStatusUpdated", ({ userId, status }) => {
      io.to(userId).emit("kycStatusUpdated", { userId, status });
    });

    socket.on("disconnect", () => console.log("❌ Client disconnected:", socket.id));
  });
};