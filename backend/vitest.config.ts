import { defineConfig } from "vitest/config";

// Offline unit/API tests only. Live-database tests live in test-integration/
// and run with `npm run test:rls` (vitest.integration.config.ts).
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
  },
});
