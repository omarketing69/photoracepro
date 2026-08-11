interface CacheEntry {
  data: Buffer;
  mimeType: string;
  size: number;
  timestamp: Date;
}

interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  evictions: number;
  lastCleanup: string;
}

interface DetailedCacheStats extends CacheStats {
  averageEntrySize: number;
  maxEntrySize: number;
  memoryUsage: number;
  cacheEfficiency: number;
}

class ThumbnailCache {
  private cache: Map<string, CacheEntry> = new Map();
  private hits: number = 0;
  private misses: number = 0;
  private evictions: number = 0;
  private lastCleanup: Date = new Date();
  private maxSize: number = 100 * 1024 * 1024; // 100MB total cache size
  private maxEntries: number = 1000; // Maximum 1000 entries

  constructor() {
    // Start periodic cleanup
    setInterval(() => this.cleanup(), 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Get thumbnail from cache
   */
  get(key: string): CacheEntry | undefined {
    const result = this.cache.get(key);
    if (result) {
      this.hits++;
      console.log(`🎯 Cache HIT: ${key}`);
      return result;
    } else {
      this.misses++;
      console.log(`❌ Cache MISS: ${key}`);
      return undefined;
    }
  }

  /**
   * Get current cache size
   */
  private getCurrentSize(): number {
    let totalSize = 0;
    for (const entry of this.cache.values()) {
      totalSize += entry.size;
    }
    return totalSize;
  }

  /**
   * Evict least recently used entries if cache is full
   */
  private evictIfNeeded(): void {
    const currentSize = this.getCurrentSize();
    
    // Evict by size
    if (currentSize > this.maxSize) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime());
      
      for (const [key, entry] of entries) {
        this.cache.delete(key);
        this.evictions++;
        console.log(`📦 Cache evicted by size: ${key} (${entry.size} bytes)`);
        
        if (this.getCurrentSize() <= this.maxSize * 0.8) {
          break;
        }
      }
    }
    
    // Evict by count
    if (this.cache.size > this.maxEntries) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime());
      
      const toRemove = this.cache.size - this.maxEntries;
      for (let i = 0; i < toRemove; i++) {
        const [key, entry] = entries[i];
        this.cache.delete(key);
        this.evictions++;
        console.log(`📦 Cache evicted by count: ${key} (${entry.size} bytes)`);
      }
    }
  }

  /**
   * Set thumbnail in cache
   */
  set(key: string, data: Buffer, mimeType: string): void {
    const entry: CacheEntry = {
      data,
      mimeType,
      size: data.length,
      timestamp: new Date()
    };

    this.cache.set(key, entry);
    this.evictIfNeeded();
    console.log(`💾 Cache SET: ${key} (${data.length} bytes)`);
  }

  /**
   * Delete entry from cache
   */
  delete(key: string): boolean {
    const result = this.cache.delete(key);
    if (result) {
      console.log(`🗑️ Cache DELETE: ${key}`);
    }
    return result;
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    this.lastCleanup = new Date();
    console.log('🧹 Cache CLEARED');
  }

  /**
   * Get basic cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.hits + this.misses;
    const totalSize = this.getCurrentSize();
    
    return {
      totalEntries: this.cache.size,
      totalSize,
      hitRate: totalRequests > 0 ? (this.hits / totalRequests) * 100 : 0,
      missRate: totalRequests > 0 ? (this.misses / totalRequests) * 100 : 0,
      evictions: this.evictions,
      lastCleanup: this.lastCleanup.toISOString()
    };
  }

  /**
   * Get detailed cache statistics
   */
  getDetailedStats(): DetailedCacheStats {
    const basicStats = this.getStats();
    const entries = Array.from(this.cache.values());
    
    const entrySizes = entries.map(entry => entry.size);
    const averageEntrySize = entrySizes.length > 0 ? entrySizes.reduce((a, b) => a + b, 0) / entrySizes.length : 0;
    const maxEntrySize = entrySizes.length > 0 ? Math.max(...entrySizes) : 0;
    const memoryUsage = process.memoryUsage().heapUsed / (1024 * 1024); // MB
    const cacheEfficiency = basicStats.totalEntries > 0 ? (basicStats.hitRate / 100) : 0;

    return {
      ...basicStats,
      averageEntrySize,
      maxEntrySize,
      memoryUsage,
      cacheEfficiency
    };
  }

  /**
   * Check if cache has key
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Get cache size info
   */
  getSizeInfo(): { current: number; max: number; percentage: number } {
    const current = this.getCurrentSize();
    const max = this.maxSize;
    const percentage = (current / max) * 100;
    
    return { current, max, percentage };
  }

  /**
   * Force cleanup of expired entries
   */
  cleanup(): void {
    const cutoffTime = new Date(Date.now() - (24 * 60 * 60 * 1000)); // 24 hours ago
    let cleaned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < cutoffTime) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    this.lastCleanup = new Date();
    console.log(`🧹 Cache cleanup: removed ${cleaned} expired entries`);
  }
}

// Export singleton instance
export const thumbnailCache = new ThumbnailCache();