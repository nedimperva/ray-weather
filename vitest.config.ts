import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@raycast/api": fileURLToPath(
        new URL("./test/raycast-api-stub.ts", import.meta.url),
      ),
    },
  },
});
