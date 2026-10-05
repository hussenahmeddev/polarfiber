import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    tanstackStart({
      srcDirectory: ".",
      // Tell TanStack Start where all entry points are
      router: {
        entry: "frontend/router",
        routesDirectory: "./frontend/routes",
        generatedRouteTree: "./frontend/routeTree.gen.ts",
      },
      server: { 
        entry: "backend/server",
      },
      start: {
        entry: "backend/start",
      },
    }),
    react(),
  ],
});
