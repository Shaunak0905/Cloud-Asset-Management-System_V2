import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.ts"],
    // Component tests opt into jsdom with a `@vitest-environment jsdom` comment.
    setupFiles: ["tests/setup/dom.ts"],
    // Database tests boot an in-process Postgres (PGlite) per file.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
