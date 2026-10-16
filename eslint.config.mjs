// Root ESLint flat config for every workspace. All TypeScript gets
// typescript-eslint; the two Next.js apps and the UI package also get Next's
// rules (React, hooks, jsx-a11y, import, @next).
import js from "@eslint/js";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

const reactFiles = [
  "author-frontend/**/*.{ts,tsx}",
  "admin-frontend/**/*.{ts,tsx}",
  "packages/ui/**/*.{ts,tsx}",
];

export default defineConfig([
  globalIgnores(["**/node_modules/", "**/dist/", "**/.next/", "**/next-env.d.ts", "docs/", "coverage/"]),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ["backend/**/*.ts", "packages/shared/**/*.ts", "**/next.config.ts", "**/*.{js,mjs,cjs}"],
    languageOptions: { globals: globals.node },
  },
  {
    files: reactFiles,
    extends: [nextVitals, nextTypescript],
    settings: { next: { rootDir: ["author-frontend/", "admin-frontend/"] } },
    rules: {
      // Ticket text and AI drafts are rendered as plain text only (.agent/THREAT_MODEL.md T-17).
      "react/no-danger": "error",
    },
  },
]);
