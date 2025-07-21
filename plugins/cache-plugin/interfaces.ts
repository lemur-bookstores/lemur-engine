export interface CacheConfig {
    defaultTTL?: number;
    maxEntries?: number;
    checkPeriod?: number;
}

export interface CacheEntry<T> {
    value: T;
    expiry?: number;
    createdAt: number;
    lastAccessed: number;
}

export interface CacheEvents {
    'cache.hit': { key: string; value: any };
    'cache.miss': { key: string };
    'cache.set': { key: string; value: any; ttl?: number };
    'cache.delete': { key: string; value: any };
    'cache.clear': { entriesCleared: number };
    'cache.expired': { key: string; value: any };
}

export interface ICacheService {
    set<T>(key: string, value: T, ttl?: number): Promise<void>;
    get<T>(key: string): Promise<T | null>;
    delete(key: string): Promise<boolean>;
    clear(): Promise<void>;
    has(key: string): Promise<boolean>;
    getStats(): Promise<CacheStats>
}

export interface CacheStats {
    size: number;
    hits: number;
    misses: number;
    hitRatio: number;
}
