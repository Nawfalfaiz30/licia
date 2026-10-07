/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "Cross-Origin-Resource-Policy", value: "same-site" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "Origin-Agent-Cluster", value: "?1" },
];

const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || "";
const usesHttpsOrigin = /^https:\/\//i.test(configuredOrigin.trim());
if (process.env.NODE_ENV === "production" && usesHttpsOrigin) {
  securityHeaders.push({ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" });
}

const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || "";
const imageRemotePatterns = [];
for (const raw of [supabaseOrigin, siteOrigin]) {
  try {
    const url = new URL(raw);
    if (url.protocol === "https:") imageRemotePatterns.push({ protocol: "https", hostname: url.hostname });
  } catch {}
}

const securityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: blob:" +
    (imageRemotePatterns.length ? " " + imageRemotePatterns.map((p) => p.protocol + "://" + p.hostname).join(" ") : ""),
  "font-src 'self' data: https://fonts.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"}`,
  `connect-src 'self'${supabaseOrigin ? ` ${supabaseOrigin}` : ""}${siteOrigin ? ` ${siteOrigin}` : ""}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join("; ");
securityHeaders.push({ key: "Content-Security-Policy", value: securityPolicy });

const nextConfig = {
  poweredByHeader: false,
  compress: true,
  reactStrictMode: true,
  reactCompiler: false,
  images: {
    remotePatterns: imageRemotePatterns,
  },
  turbopack: {},
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};
module.exports = nextConfig;
