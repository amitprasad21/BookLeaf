import type { NextConfig } from "next";

// Security headers (.front/FRONTEND_ARCHITECTURE.md section 9). The browser
// talks only to this app, the BookLeaf API and Supabase Auth.
// 'unsafe-inline' scripts: the App Router's inline bootstrap scripts need it
// unless every page renders dynamically with a per-request nonce (hardening
// option, D-031). Styles: React writes style attributes for skeleton sizes.
function originOf(value: string | undefined): string {
  if (!value) return "";
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

const isDev = process.env.NODE_ENV !== "production";
const connectSources = [
  "'self'",
  originOf(process.env.NEXT_PUBLIC_API_BASE_URL),
  originOf(process.env.NEXT_PUBLIC_SUPABASE_URL),
  isDev ? "ws://localhost:*" : "", // dev server hot reload
].filter(Boolean);

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src ${connectSources.join(" ")}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
