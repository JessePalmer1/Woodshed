import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Bind all interfaces so a phone on the same network can reach the dev
    // server. Note that mic capture still needs a secure context — over a LAN
    // IP you get the feed and demo session, but not recording (see
    // SessionRecorder.start). Tunnel it for real on-device capture.
    host: true,
    port: 5173,
    open: true,
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
