/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || "";
const usesHttpsOrigin = /^https:\/\//i.test(configuredOrigin.trim());
if (process.env.NODE_ENV === "production" && usesHttpsOrigin) {
  securityHeaders.push({ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" });
}

const nextConfig = {
  poweredByHeader: false,
  compress: true,
  reactStrictMode: true,
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};
module.exports = nextConfig;
