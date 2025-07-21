import { ICacheService, CacheEntry, CacheStats, CacheConfig } from './interfaces';
import { EventBus } from '../../src/core/EventBus';

export class MemoryCacheService implements ICacheService {
    private cache: Map<string, CacheEntry<any>> = new Map();
    private cleanupInterval?: NodeJS.Timeout;
    private stats: CacheStats = {
        size: 0,
        hits: 0,
        misses: 0,
        hitRatio: 0
    };

    constructor(
        private eventBus: EventBus,
        private config: CacheConfig = {}
    ) {
        this.setupCleanupInterval();
    }

    private setupCleanupInterval(): void {
        if (this.config.checkPeriod) {
            this.cleanupInterval = setInterval(() => {
                this.removeExpiredEntries();
            }, this.config.checkPeriod);
        }
    }

    private removeExpiredEntries(): void {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (entry.expiry && entry.expiry <= now) {
                this.cache.delete(key);
                this.eventBus.publish({
                    id: crypto.randomUUID(),
                    type: 'cache.expired',
                    payload: { key, value: entry.value },
                    timestamp: new Date(),
                    source: 'MemoryCacheService'
                });
            }
        }
    }

    private updateStats(hit: boolean): void {
        if (hit) {
            this.stats.hits++;
        } else {
            this.stats.misses++;
        }
        this.stats.hitRatio = this.stats.hits / (this.stats.hits + this.stats.misses);
    }

    async set<T>(key: string, value: T, ttl?: number): Promise<void> {
        const now = Date.now();
        const entry: CacheEntry<T> = {
            value,
            expiry: ttl ? now + ttl : (this.config.defaultTTL ? now + this.config.defaultTTL : undefined),
            createdAt: now,
            lastAccessed: now
        };

        if (this.config.maxEntries && this.cache.size >= this.config.maxEntries) {
            // Eliminar la entrada más antigua
            let oldestKey: string | undefined;
            let oldestAccess = Infinity;

            for (const [k, e] of this.cache.entries()) {
                if (e.lastAccessed < oldestAccess) {
                    oldestAccess = e.lastAccessed;
                    oldestKey = k;
                }
            }

            if (oldestKey) {
                this.cache.delete(oldestKey);
            }
        }

        this.cache.set(key, entry);
        this.stats.size = this.cache.size;

        await this.eventBus.publish({
            id: crypto.randomUUID(),
            type: 'cache.set',
            payload: { key, value, ttl },
            timestamp: new Date(),
            source: 'MemoryCacheService'
        });
    }

    async get<T>(key: string): Promise<T | null> {
        const entry = this.cache.get(key) as CacheEntry<T>;

        if (!entry) {
            this.updateStats(false);
            await this.eventBus.publish({
                id: crypto.randomUUID(),
                type: 'cache.miss',
                payload: { key },
                timestamp: new Date(),
                source: 'MemoryCacheService'
            });
            return null;
        }

        if (entry.expiry && Date.now() > entry.expiry) {
            this.cache.delete(key);
            this.updateStats(false);
            await this.eventBus.publish({
                id: crypto.randomUUID(),
                type: 'cache.expired',
                payload: { key, value: entry.value },
                timestamp: new Date(),
                source: 'MemoryCacheService'
            });
            return null;
        }

        entry.lastAccessed = Date.now();
        this.updateStats(true);
        await this.eventBus.publish({
            id: crypto.randomUUID(),
            type: 'cache.hit',
            payload: { key, value: entry.value },
            timestamp: new Date(),
            source: 'MemoryCacheService'
        });
        return entry.value;
    }

    async delete(key: string): Promise<boolean> {
        const entry = this.cache.get(key);
        const deleted = this.cache.delete(key);

        if (deleted && entry) {
            this.stats.size = this.cache.size;
            await this.eventBus.publish({
                id: crypto.randomUUID(),
                type: 'cache.delete',
                payload: { key, value: entry.value },
                timestamp: new Date(),
                source: 'MemoryCacheService'
            });
        }

        return deleted;
    }

    async clear(): Promise<void> {
        const size = this.cache.size;
        this.cache.clear();
        this.stats.size = 0;

        await this.eventBus.publish({
            id: crypto.randomUUID(),
            type: 'cache.clear',
            payload: { entriesCleared: size },
            timestamp: new Date(),
            source: 'MemoryCacheService'
        });
    }

    async has(key: string): Promise<boolean> {
        const entry = this.cache.get(key);
        if (!entry) return false;

        if (entry.expiry && Date.now() > entry.expiry) {
            this.cache.delete(key);
            return false;
        }

        return true;
    }

    async getStats(): Promise<CacheStats> {
        return { ...this.stats };
    }

    dispose(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }
}
