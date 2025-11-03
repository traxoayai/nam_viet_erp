// vite.config.ts
import path from "path"; // <-- MỚI: Import thư viện 'path'

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // --- THÊM CẤU HÌNH ALIAS TẠI ĐÂY ---
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // -------------------------------------
});
