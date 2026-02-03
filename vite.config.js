import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return defineConfig({
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    server: {
      port: env.VITE_DEV_PORT ? parseInt(env.VITE_DEV_PORT) : 5173,
      open: true,
      cors: true,
    },
    build: {
      outDir: "build",
      sourcemap: true,
      rollupOptions: {
        input: path.resolve(__dirname, "public/index.html"),
      },
    },
    define: {
      "process.env": env,
    },
  });
};