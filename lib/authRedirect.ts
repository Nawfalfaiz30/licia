export function getAuthCallbackUrl(): string {
  if (typeof window === "undefined") return "/auth/callback";

  const browserOrigin = window.location.origin;
  const hostname = window.location.hostname.toLowerCase();
  const isLoopback = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";

  // The URL the user is actually visiting is the most reliable origin for
  // auth callbacks. This prevents production auth from ever drifting back to
  // a stale localhost value while still keeping local development local.
  if (process.env.NODE_ENV !== "production" || isLoopback) {
    return `${browserOrigin}/auth/callback`;
  }

  return `${browserOrigin}/auth/callback`;
}
