import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * This app does a lot of imperative work in module bodies (MapLibre layers,
 * map event handlers, Zustand stores). React Refresh and per-file
 * `import.meta.hot.accept` are reliable in some edits but silently miss
 * others (added hooks, new exports, store-shape changes, dropped WS after
 * a backgrounded tab). The result is "I edited X and nothing changed."
 *
 * To make `npm run dev` predictable, this plugin coerces every change in
 * `src/` into a full page reload. URL/localStorage state preserves the
 * year, layers, theme, projection, and pinned focus across the reload, so
 * it feels like normal HMR -- just dependable.
 */
function forceFullReload(): Plugin {
  return {
    name: "force-full-reload",
    enforce: "post",
    handleHotUpdate({ file, server }) {
      if (!/\.(ts|tsx|css)$/.test(file)) return;
      const rel = file.replace(server.config.root + "/", "");
      // Visible breadcrumb so it's obvious in the dev terminal that reloads
      // are firing -- and which file caused them.
      server.config.logger.info(`\x1b[36m[full-reload]\x1b[0m ${rel}`, { timestamp: true });
      server.ws.send({ type: "full-reload", path: "*" });
      // Returning an empty module list tells Vite "no further HMR work needed"
      // so it doesn't also try to swap individual modules in place.
      return [];
    },
  };
}

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/strata/" : "/",
  plugins: [react(), forceFullReload()],
  server: {
    port: 5173,
    open: true,
  },
});
