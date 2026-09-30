import "server-only";

type CacheEntry<T> = { value: T; expiresAt: number };

const stores = new Map<string, Map<string, CacheEntry<unknown>>>();
const MAX_ENTRIES = 128;

function getStore(name: string) {
  let store = stores.get(name);
  if (!store) {
    store = new Map();
    stores.set(name, store);
  }
  return store;
}

export async function memoizeUserData<T>(
  namespace: string,
  userId: string,
  loader: () => Promise<T>,
  ttlMs = 10_000,
): Promise<T> {
  const store = getStore(namespace);
  const key = userId;
  const now = Date.now();
  const hit = store.get(key) as CacheEntry<T> | undefined;
  if (hit && hit.expiresAt > now) return hit.value;
  if (hit) store.delete(key);

  const value = await loader();
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value as string | undefined;
    if (oldest) store.delete(oldest);
  }
  store.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

export function invalidateUserData(namespace: string, userId: string) {
  getStore(namespace).delete(userId);
}

export function clearUserDataCache(namespace?: string) {
  if (namespace) stores.delete(namespace);
  else stores.clear();
}
