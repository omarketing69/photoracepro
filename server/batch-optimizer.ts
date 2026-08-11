/**
 * BATCH PROCESSING OPTIMIZER
 * Optimizes photo processing throughput for commercial SLA compliance
 * 
 * Features:
 * - Intelligent batch sizing based on system resources
 * - Dynamic load balancing across workers
 * - Adaptive processing rates
 * - Memory-efficient batch streaming
 * - Cloud storage optimization
 */

import { commercialPipeline } from './commercial-pipeline';
import { performanceMonitor } from './performance-monitor';
import { getCloudStorage } from './cloud-storage';
import os from 'os';

interface BatchConfig {
  maxBatchSize: number;
  minBatchSize: number;
  targetProcessingTime: number; // milliseconds
  memoryThreshold: number; // MB
  concurrencyFactor: number;
}

interface BatchMetrics {
  batchId: string;
  size: number;
  startTime: Date;
  endTime?: Date;
  throughput: number; // photos per minute
  memoryUsage: number;
  errors: number;
  successRate: number;
}

interface AdaptiveSettings {
  currentBatchSize: number;
  targetThroughput: number; // photos per minute for 2-hour SLA
  actualThroughput: number;
  adaptationFactor: number;
  lastAdjustment: Date;
}

class BatchProcessingOptimizer {
  private batchConfig: BatchConfig;
  private batchMetrics: BatchMetrics[] = [];
  private adaptiveSettings: AdaptiveSettings;
  private cloudStorage = getCloudStorage();
  
  constructor() {
    this.batchConfig = this.calculateOptimalBatchConfig();
    this.adaptiveSettings = {
      currentBatchSize: this.batchConfig.maxBatchSize,
      targetThroughput: 8.33, // 1000 photos in 2 hours = 8.33 photos/minute
      actualThroughput: 0,
      adaptationFactor: 1.0,
      lastAdjustment: new Date()
    };
    
    console.log(`🚀 [BATCH OPTIMIZER] Initialized with optimal batch size: ${this.batchConfig.maxBatchSize}`);
    console.log(`🎯 [TARGET] Processing target: ${this.adaptiveSettings.targetThroughput} photos/minute for 2-hour SLA`);
  }

  /**
   * Calculate optimal batch configuration based on system resources
   */
  private calculateOptimalBatchConfig(): BatchConfig {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const cpuCores = os.cpus().length;
    
    // Conservative memory allocation (20% of free memory for batching)
    const availableMemory = Math.floor(freeMemory * 0.2 / (1024 * 1024)); // MB
    const memoryPerPhoto = 15; // 15MB per photo during processing
    
    const memoryBasedBatchSize = Math.floor(availableMemory / memoryPerPhoto);
    const cpuBasedBatchSize = cpuCores * 8; // 8 photos per CPU core
    
    const maxBatchSize = Math.min(
      Math.max(memoryBasedBatchSize, 20), // Minimum 20 photos
      Math.max(cpuBasedBatchSize, 50),    // Scale with CPU
      200  // Maximum 200 photos per batch
    );
    
    console.log(`💡 [BATCH CONFIG] Memory: ${Math.round(totalMemory/1024/1024)}MB total, ${Math.round(freeMemory/1024/1024)}MB free`);
    console.log(`💡 [BATCH CONFIG] CPU cores: ${cpuCores}, Memory batch limit: ${memoryBasedBatchSize}, CPU batch limit: ${cpuBasedBatchSize}`);
    console.log(`💡 [BATCH CONFIG] Optimal batch size: ${maxBatchSize} photos`);
    
    return {
      maxBatchSize,
      minBatchSize: Math.max(10, Math.floor(maxBatchSize / 4)), // 25% of max
      targetProcessingTime: 300000, // 5 minutes per batch
      memoryThreshold: Math.floor(totalMemory * 0.7 / (1024 * 1024)), // 70% memory threshold
      concurrencyFactor: Math.max(1, Math.floor(cpuCores / 2)) // Half CPU cores for concurrency
    };
  }

  /**
   * Process photos in optimized batches for commercial events
   */
  async processCommercialEvent(
    eventId: number,
    photos: Array<{ photoId: number; filename: string; originalPath: string }>,
    slaHours: number = 2
  ): Promise<string> {
    const startTime = new Date();
    const totalPhotos = photos.length;
    
    console.log(`🚀 [COMMERCIAL BATCH] Starting optimized processing for Event ${eventId}`);
    console.log(`📊 [STATS] ${totalPhotos} photos, ${slaHours}h SLA, target: ${this.adaptiveSettings.targetThroughput} photos/min`);
    
    // Pre-flight checks
    await this.performPreflightChecks(totalPhotos);
    
    // Calculate optimal batch strategy
    const batchStrategy = this.calculateBatchStrategy(totalPhotos, slaHours);
    console.log(`📈 [STRATEGY] ${batchStrategy.batches.length} batches, sizes: ${batchStrategy.batches.join(', ')}`);
    
    // Start processing with commercial pipeline
    const batchId = commercialPipeline.addCommercialEvent(eventId, photos, slaHours);
    
    // Process photos in optimized batches
    const batchResults = await this.processBatchesOptimized(eventId, photos, batchStrategy);
    
    // Record batch metrics
    const endTime = new Date();
    const totalTime = endTime.getTime() - startTime.getTime();
    const throughput = (totalPhotos / (totalTime / 60000)); // photos per minute
    
    const batchMetric: BatchMetrics = {
      batchId,
      size: totalPhotos,
      startTime,
      endTime,
      throughput,
      memoryUsage: this.getCurrentMemoryUsage(),
      errors: batchResults.errors,
      successRate: ((totalPhotos - batchResults.errors) / totalPhotos) * 100
    };
    
    this.batchMetrics.push(batchMetric);
    this.adaptBatchSize(batchMetric);
    
    console.log(`✅ [COMMERCIAL BATCH] Event ${eventId} processed in ${(totalTime/1000/60).toFixed(1)} minutes`);
    console.log(`📊 [PERFORMANCE] Throughput: ${throughput.toFixed(2)} photos/min, Success rate: ${batchMetric.successRate.toFixed(1)}%`);
    
    return batchId;
  }

  /**
   * Perform pre-flight checks before processing
   */
  private async performPreflightChecks(totalPhotos: number): Promise<void> {
    const memoryUsage = this.getCurrentMemoryUsage();
    const estimatedMemoryNeeded = totalPhotos * 15; // 15MB per photo
    
    console.log(`🔍 [PREFLIGHT] Memory check: ${memoryUsage}MB used, ~${estimatedMemoryNeeded}MB needed`);
    
    if (memoryUsage > this.batchConfig.memoryThreshold) {
      console.log(`⚠️ [PREFLIGHT] High memory usage detected, triggering cleanup`);
      if (global.gc) {
        global.gc();
        console.log(`🧹 [PREFLIGHT] Garbage collection completed`);
      }
    }
    
    // Check cloud storage connectivity
    try {
      await this.cloudStorage.testConnection();
      console.log(`✅ [PREFLIGHT] Cloud storage connectivity verified`);
    } catch (error) {
      throw new Error(`❌ [PREFLIGHT] Cloud storage connectivity failed: ${error}`);
    }
    
    console.log(`✅ [PREFLIGHT] All systems ready for processing`);
  }

  /**
   * Calculate optimal batch strategy
   */
  private calculateBatchStrategy(totalPhotos: number, slaHours: number): {
    batches: number[];
    totalBatches: number;
    estimatedTime: number;
  } {
    const targetThroughput = totalPhotos / (slaHours * 60); // photos per minute needed
    const currentBatchSize = this.adaptiveSettings.currentBatchSize;
    
    // Adjust batch size based on SLA pressure
    const slaPressureFactor = Math.max(0.5, targetThroughput / this.adaptiveSettings.targetThroughput);
    const adjustedBatchSize = Math.floor(currentBatchSize * slaPressureFactor);
    
    const optimalBatchSize = Math.min(
      Math.max(adjustedBatchSize, this.batchConfig.minBatchSize),
      this.batchConfig.maxBatchSize
    );
    
    console.log(`📊 [STRATEGY] SLA pressure factor: ${slaPressureFactor.toFixed(2)}, optimal batch size: ${optimalBatchSize}`);
    
    // Calculate batch distribution
    const fullBatches = Math.floor(totalPhotos / optimalBatchSize);
    const remainder = totalPhotos % optimalBatchSize;
    
    const batches: number[] = Array(fullBatches).fill(optimalBatchSize);
    if (remainder > 0) {
      batches.push(remainder);
    }
    
    // Estimate processing time
    const avgProcessingTimePerPhoto = 7; // seconds
    const estimatedTime = (totalPhotos * avgProcessingTimePerPhoto) / this.batchConfig.concurrencyFactor;
    
    return {
      batches,
      totalBatches: batches.length,
      estimatedTime: estimatedTime / 60 // minutes
    };
  }

  /**
   * Process batches with optimization
   */
  private async processBatchesOptimized(
    eventId: number,
    photos: Array<{ photoId: number; filename: string; originalPath: string }>,
    strategy: { batches: number[]; totalBatches: number; estimatedTime: number }
  ): Promise<{ processed: number; errors: number }> {
    let processed = 0;
    let errors = 0;
    let photoIndex = 0;
    
    console.log(`🔄 [BATCH PROCESSING] Starting ${strategy.totalBatches} batches for event ${eventId}`);
    
    for (let i = 0; i < strategy.batches.length; i++) {
      const batchSize = strategy.batches[i];
      const batchPhotos = photos.slice(photoIndex, photoIndex + batchSize);
      photoIndex += batchSize;
      
      console.log(`📦 [BATCH ${i + 1}/${strategy.totalBatches}] Processing ${batchSize} photos`);
      
      try {
        // Process batch with memory monitoring
        const batchStart = performance.now();
        const beforeMemory = this.getCurrentMemoryUsage();
        
        // Add photos to commercial pipeline (it handles the parallel processing)
        const jobIds = batchPhotos.map(photo => 
          commercialPipeline.addJob(photo.photoId, eventId, photo.filename, photo.originalPath, 'critical')
        );
        
        // Wait for batch completion with timeout
        await this.waitForBatchCompletion(jobIds, 600000); // 10 minute timeout per batch
        
        const batchTime = performance.now() - batchStart;
        const afterMemory = this.getCurrentMemoryUsage();
        const throughput = (batchSize / (batchTime / 60000)); // photos per minute
        
        processed += batchSize;
        
        console.log(`✅ [BATCH ${i + 1}] Completed in ${(batchTime/1000).toFixed(1)}s, throughput: ${throughput.toFixed(1)} p/min`);
        console.log(`📊 [MEMORY] Before: ${beforeMemory}MB, After: ${afterMemory}MB, Delta: ${(afterMemory - beforeMemory).toFixed(1)}MB`);
        
        // Adaptive delay between batches to manage resources
        if (afterMemory > this.batchConfig.memoryThreshold * 0.8) {
          const delay = Math.min(5000, (afterMemory - beforeMemory) * 10); // Max 5 second delay
          console.log(`⏳ [THROTTLE] Memory pressure detected, waiting ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
      } catch (error) {
        console.error(`❌ [BATCH ${i + 1}] Error processing batch:`, error);
        errors += batchSize;
      }
      
      // Progress reporting
      const progressPercent = ((i + 1) / strategy.totalBatches * 100).toFixed(1);
      console.log(`📈 [PROGRESS] Event ${eventId}: ${progressPercent}% complete (${processed}/${photos.length} photos)`);
    }
    
    return { processed, errors };
  }

  /**
   * Wait for batch completion with monitoring
   */
  private async waitForBatchCompletion(jobIds: string[], timeoutMs: number): Promise<void> {
    const startTime = Date.now();
    const checkInterval = 1000; // Check every second
    
    while (Date.now() - startTime < timeoutMs) {
      const incompleteJobs = jobIds.filter(jobId => {
        const status = commercialPipeline.getJobStatus(jobId);
        return status && !status.completedAt;
      });
      
      if (incompleteJobs.length === 0) {
        return; // All jobs completed
      }
      
      // Progress logging every 10 seconds
      if ((Date.now() - startTime) % 10000 < checkInterval) {
        const completed = jobIds.length - incompleteJobs.length;
        console.log(`⏳ [BATCH WAIT] ${completed}/${jobIds.length} jobs completed`);
      }
      
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
    
    throw new Error(`Batch completion timeout after ${timeoutMs}ms`);
  }

  /**
   * Get current memory usage
   */
  private getCurrentMemoryUsage(): number {
    const memUsage = process.memoryUsage();
    return Math.round(memUsage.heapUsed / 1024 / 1024); // MB
  }

  /**
   * Adapt batch size based on performance metrics
   */
  private adaptBatchSize(metric: BatchMetrics): void {
    const timeSinceLastAdjustment = Date.now() - this.adaptiveSettings.lastAdjustment.getTime();
    
    // Only adjust every 5 minutes to avoid oscillation
    if (timeSinceLastAdjustment < 300000) return;
    
    this.adaptiveSettings.actualThroughput = metric.throughput;
    const throughputRatio = this.adaptiveSettings.actualThroughput / this.adaptiveSettings.targetThroughput;
    
    let newBatchSize = this.adaptiveSettings.currentBatchSize;
    
    if (throughputRatio < 0.8) {
      // Too slow, increase batch size (if memory allows)
      if (metric.memoryUsage < this.batchConfig.memoryThreshold * 0.7) {
        newBatchSize = Math.min(
          Math.floor(this.adaptiveSettings.currentBatchSize * 1.2),
          this.batchConfig.maxBatchSize
        );
        console.log(`📈 [ADAPTATION] Increasing batch size to ${newBatchSize} (low throughput)`);
      }
    } else if (throughputRatio > 1.2 && metric.memoryUsage > this.batchConfig.memoryThreshold * 0.8) {
      // Too fast but high memory usage, decrease batch size
      newBatchSize = Math.max(
        Math.floor(this.adaptiveSettings.currentBatchSize * 0.8),
        this.batchConfig.minBatchSize
      );
      console.log(`📉 [ADAPTATION] Decreasing batch size to ${newBatchSize} (high memory)`);
    }
    
    if (newBatchSize !== this.adaptiveSettings.currentBatchSize) {
      this.adaptiveSettings.currentBatchSize = newBatchSize;
      this.adaptiveSettings.lastAdjustment = new Date();
      
      console.log(`🔄 [ADAPTATION] Batch size adjusted to ${newBatchSize} (throughput: ${metric.throughput.toFixed(2)} p/min)`);
    }
  }

  /**
   * Get batch processing statistics
   */
  getBatchStats() {
    if (this.batchMetrics.length === 0) {
      return {
        totalBatches: 0,
        averageThroughput: 0,
        averageSuccessRate: 0,
        currentBatchSize: this.adaptiveSettings.currentBatchSize,
        adaptiveSettings: this.adaptiveSettings
      };
    }
    
    const totalBatches = this.batchMetrics.length;
    const averageThroughput = this.batchMetrics.reduce((sum, m) => sum + m.throughput, 0) / totalBatches;
    const averageSuccessRate = this.batchMetrics.reduce((sum, m) => sum + m.successRate, 0) / totalBatches;
    
    return {
      totalBatches,
      averageThroughput: Math.round(averageThroughput * 100) / 100,
      averageSuccessRate: Math.round(averageSuccessRate * 100) / 100,
      currentBatchSize: this.adaptiveSettings.currentBatchSize,
      adaptiveSettings: this.adaptiveSettings,
      recentMetrics: this.batchMetrics.slice(-5) // Last 5 batches
    };
  }

  /**
   * Reset adaptive settings (for testing or recalibration)
   */
  resetAdaptiveSettings(): void {
    this.adaptiveSettings.currentBatchSize = this.batchConfig.maxBatchSize;
    this.adaptiveSettings.adaptationFactor = 1.0;
    this.adaptiveSettings.lastAdjustment = new Date();
    
    console.log(`🔄 [RESET] Adaptive settings reset to defaults`);
  }

  /**
   * Get recommended batch size for event
   */
  getRecommendedBatchSize(eventType: 'commercial' | 'free', photoCount: number): number {
    const baseSize = this.adaptiveSettings.currentBatchSize;
    
    if (eventType === 'commercial') {
      // Commercial events get larger batches for faster processing
      return Math.min(baseSize, Math.max(50, Math.floor(photoCount / 10)));
    } else {
      // Free events get smaller batches to not impact commercial processing
      return Math.min(Math.floor(baseSize * 0.6), 30);
    }
  }
}

// Export singleton instance
export const batchOptimizer = new BatchProcessingOptimizer();
export type { BatchConfig, BatchMetrics, AdaptiveSettings };