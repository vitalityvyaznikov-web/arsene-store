import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // относительные пути к файлам: сайт заработает в любой папке хостинга
  base: "./",
  build: {
    outDir: "dist",
    assetsDir: "assets",
  },
});
