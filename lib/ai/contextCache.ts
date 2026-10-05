import { invalidateUserData } from "@/lib/performance/userCache";

type CacheEntry<T> = { value: T; expiresAt: number };

const cache = new Map<string, CacheEntry<unknown>>();
const DEFAULT_TTL_MS = Math.max(500, Math.min(15000, Number(process.env.LICIA_CONTEXT_CACHE_TTL_MS || 2500) || 2500));
const MAX_ENTRIES = 96;

function now() { return Date.now(); }

export async function memoizeUserContext<T>(key: string, loader: () => Promise<T>, ttlMs = DEFAULT_TTL_MS): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now()) return hit.value as T;
  if (hit) cache.delete(key);
  const value = await loader();
  cache.set(key, { value, expiresAt: now() + ttlMs });
  if (cache.size > MAX_ENTRIES) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  return value;
}

export function invalidateUserContext(userId: string) {
  const prefix = `${userId}:`;
  for (const key of cache.keys()) if (key.startsWith(prefix)) cache.delete(key);
  invalidateUserData("dashboard", userId);
}

export function clearUserContextCache() { cache.clear(); }
