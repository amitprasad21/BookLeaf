import { defineConfig } from "vitest/config";

// Live Supabase tests (npm run test:rls). Credentials come from backend/.env
// when present; values are never printed.
try {
  process.loadEnvFile(".env");
} catch {
  // No .env file: rely on variables already set in the shell.
}

export default defineConfig({
  test: {
    include: ["test-integration/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
