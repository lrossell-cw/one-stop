import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // `--host` (set in package.json's dev script) binds Vite to 0.0.0.0
  // instead of just localhost, so it's reachable from other devices on
  // the same network (e.g. testing from an iPhone against your laptop).
});
