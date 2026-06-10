import type { FinalMenuDay } from './finalMenu';

const CACHE_PREFIX = 'messmate_generated_menu:';

type CacheStore = Map<string, FinalMenuDay>;

const memoryCache: CacheStore = new Map();

function getCacheKey(dateKey: string) {
  return `${CACHE_PREFIX}${dateKey}`;
}

export function cacheGeneratedMenuDay(menu: FinalMenuDay) {
  memoryCache.set(menu.dateKey, menu);

  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(getCacheKey(menu.dateKey), JSON.stringify(menu));
  } catch {
    // Ignore storage quota or privacy errors.
  }
}

export function readCachedGeneratedMenuDay(dateKey: string): FinalMenuDay | null {
  const memoryValue = memoryCache.get(dateKey);
  if (memoryValue) {
    return memoryValue;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(getCacheKey(dateKey));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as FinalMenuDay;
    memoryCache.set(dateKey, parsed);
    return parsed;
  } catch {
    return null;
  }
}
