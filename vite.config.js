import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "build", // matches your Express code
    rollupOptions: {
      external: ["socket.io-client"], // optional; only if Vite still fails
    },
  },
});