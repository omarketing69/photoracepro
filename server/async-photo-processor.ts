import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';
import { performanceMonitor } from './performance-monitor';
import { thumbnailCache } from './thumbnail-cache';
import { getCloudStorage } from './cloud-storage';
import { GoogleVisionOCRProcessor, type FaceAnnotation } from './google-vision-ocr';

interface ProcessingJob {
  id: string;
  photoId: number;
  eventId: number;
  filename: string;
  originalPath: string;
  priority: 'high' | 'medium' | 'low';
  retries: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

interface ProcessingResult {
  photoId: number;
  success: boolean;
  detectedDorsals: number[];
  processingTime: number;
  error?: string;
}

interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  totalProcessed: number;
  averageProcessingTime: number;
  lastProcessedAt?: Date;
}

class AsyncPhotoProcessor extends EventEmitter {
  private processingQueue: ProcessingJob[] = [];
  private processingJobs: Map<string, ProcessingJob> = new Map();
  private completedJobs: ProcessingJob[] = [];
  private failedJobs: ProcessingJob[] = [];
  private maxConcurrentJobs = parseInt(process.env.ASYNC_PROCESSOR_CONCURRENCY || '16'); // Configurable para volumen alto
  private maxRetries = 3;
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private cloudStorage = getCloudStorage();
  private ocrProcessor: GoogleVisionOCRProcessor;

  constructor() {
    super();
    this.ocrProcessor = new GoogleVisionOCRProcessor(this.cloudStorage);
    this.startProcessingLoop();
  }

  /**
   * Agregar trabajo de procesamiento a la cola
   */
  addJob(photoId: number, eventId: number, filename: string, originalPath: string, priority: 'high' | 'medium' | 'low' = 'medium'): string {
    const jobId = `job_${photoId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const job: ProcessingJob = {
      id: jobId,
      photoId,
      eventId,
      filename,
      originalPath,
      priority,
      retries: 0,
      createdAt: new Date()
    };

    // Insertar según prioridad
    if (priority === 'high') {
      this.processingQueue.unshift(job);
    } else {
      this.processingQueue.push(job);
    }

    console.log(`📝 Trabajo agregado a cola: ${jobId} (foto ${photoId}, prioridad: ${priority})`);
    this.emit('jobAdded', job);
    
    return jobId;
  }

  /**
   * Procesar trabajos en lotes
   */
  addBatchJobs(photos: Array<{photoId: number, eventId: number, filename: string, originalPath: string}>): string[] {
    const jobIds: string[] = [];
    
    console.log(`📦 Agregando lote de ${photos.length} fotos para procesamiento`);
    
    photos.forEach((photo, index) => {
      // Prioridad alta para las primeras 10 fotos
      const priority = index < 10 ? 'high' : 'medium';
      const jobId = this.addJob(photo.photoId, photo.eventId, photo.filename, photo.originalPath, priority);
      jobIds.push(jobId);
    });

    return jobIds;
  }

  /**
   * Obtener estado de un trabajo
   */
  getJobStatus(jobId: string): ProcessingJob | null {
    // Buscar en trabajos en procesamiento
    if (this.processingJobs.has(jobId)) {
      return this.processingJobs.get(jobId)!;
    }

    // Buscar en cola
    const queuedJob = this.processingQueue.find(job => job.id === jobId);
    if (queuedJob) {
      return queuedJob;
    }

    // Buscar en completados
    const completedJob = this.completedJobs.find(job => job.id === jobId);
    if (completedJob) {
      return completedJob;
    }

    // Buscar en fallidos
    const failedJob = this.failedJobs.find(job => job.id === jobId);
    if (failedJob) {
      return failedJob;
    }

    return null;
  }

  /**
   * Obtener estadísticas de la cola
   */
  getQueueStats(): QueueStats {
    const totalProcessed = this.completedJobs.length + this.failedJobs.length;
    const averageTime = this.completedJobs.length > 0 
      ? this.completedJobs.reduce((sum, job) => sum + (job.completedAt!.getTime() - job.startedAt!.getTime()), 0) / this.completedJobs.length
      : 0;

    return {
      pending: this.processingQueue.length,
      processing: this.processingJobs.size,
      completed: this.completedJobs.length,
      failed: this.failedJobs.length,
      totalProcessed,
      averageProcessingTime: Math.round(averageTime),
      lastProcessedAt: this.completedJobs.length > 0 ? this.completedJobs[this.completedJobs.length - 1].completedAt : undefined
    };
  }

  /**
   * Iniciar bucle de procesamiento
   */
  private startProcessingLoop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    this.processingInterval = setInterval(() => {
      this.processNextJobs();
    }, 1000); // Revisar cada segundo

    console.log('🔄 Procesador asíncrono iniciado');
  }

  /**
   * Procesar siguientes trabajos
   */
  private async processNextJobs(): Promise<void> {
    if (this.processingJobs.size >= this.maxConcurrentJobs) {
      return;
    }

    const availableSlots = this.maxConcurrentJobs - this.processingJobs.size;
    const jobsToProcess = this.processingQueue.splice(0, availableSlots);

    for (const job of jobsToProcess) {
      this.processJob(job);
    }
  }

  /**
   * Procesar trabajo individual
   */
  private async processJob(job: ProcessingJob): Promise<void> {
    const operationId = performanceMonitor.startOperation(`async_process_photo_${job.photoId}`);
    
    job.startedAt = new Date();
    this.processingJobs.set(job.id, job);
    
    console.log(`🔄 Procesando foto ${job.photoId} (intento ${job.retries + 1})`);
    this.emit('jobStarted', job);

    try {
      // Obtener foto desde Google Cloud Storage
      const signedUrl = await this.cloudStorage.generateSignedUrl(job.originalPath, 60);
      const response = await fetch(signedUrl);
      
      if (!response.ok) {
        throw new Error(`No se pudo obtener la foto desde GCS: ${response.status}`);
      }

      const imageBuffer = Buffer.from(await response.arrayBuffer());
      
      // Procesar OCR y detección facial en paralelo
      const ocrStartTime = Date.now();
      const [ocrResult, detectedFaces] = await Promise.all([
        this.ocrProcessor.processImageBuffer(imageBuffer),
        this.ocrProcessor.detectFacesFromBuffer(imageBuffer).catch(() => [] as FaceAnnotation[])
      ]);
      const ocrTime = Date.now() - ocrStartTime;

      // ocrResult is GoogleVisionResult { dorsalNumbers: number[] }
      const detectedDorsals: number[] = ocrResult.dorsalNumbers;

      console.log(`👤 [FACE] Photo ${job.photoId}: detected ${detectedFaces.length} face(s)`);

      // Generar thumbnail y cachear
      const thumbnailStartTime = Date.now();
      await thumbnailCache.getThumbnail(job.photoId);
      const thumbnailTime = Date.now() - thumbnailStartTime;

      // Actualizar base de datos con dorsales Y caras
      await this.updatePhotoInDatabase(job.photoId, detectedDorsals, detectedFaces);

      job.completedAt = new Date();
      const totalTime = performanceMonitor.endOperation(operationId);
      
      // Mover a completados
      this.processingJobs.delete(job.id);
      this.completedJobs.push(job);

      // Mantener solo los últimos 1000 trabajos completados
      if (this.completedJobs.length > 1000) {
        this.completedJobs.shift();
      }

      // Registrar métricas
      performanceMonitor.recordPhotoProcessing({
        uploadTime: 0,
        ocrTime,
        thumbnailTime,
        totalTime,
        photosProcessed: 1,
        errorsCount: 0
      });

      console.log(`✅ Foto ${job.photoId} procesada exitosamente (${detectedDorsals.length} dorsales, ${totalTime.toFixed(1)}ms)`);
      
      const result: ProcessingResult = {
        photoId: job.photoId,
        success: true,
        detectedDorsals,
        processingTime: totalTime,
      };

      this.emit('jobCompleted', job, result);

    } catch (error) {
      const duration = performanceMonitor.endOperation(operationId);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      
      console.error(`❌ Error procesando foto ${job.photoId}:`, errorMessage);
      
      job.error = errorMessage;
      job.retries++;

      // Reintentar si no se alcanzó el máximo
      if (job.retries < this.maxRetries) {
        console.log(`🔄 Reintentando foto ${job.photoId} (intento ${job.retries + 1}/${this.maxRetries})`);
        this.processingJobs.delete(job.id);
        this.processingQueue.unshift(job); // Prioridad alta para reintentos
      } else {
        console.log(`❌ Foto ${job.photoId} falló después de ${this.maxRetries} intentos`);
        job.completedAt = new Date();
        this.processingJobs.delete(job.id);
        this.failedJobs.push(job);

        // Mantener solo los últimos 100 trabajos fallidos
        if (this.failedJobs.length > 100) {
          this.failedJobs.shift();
        }
      }

      // Registrar métricas de error
      performanceMonitor.recordPhotoProcessing({
        uploadTime: 0,
        ocrTime: 0,
        thumbnailTime: 0,
        totalTime: duration,
        photosProcessed: 0,
        errorsCount: 1
      });

      const result: ProcessingResult = {
        photoId: job.photoId,
        success: false,
        detectedDorsals: [],
        processingTime: duration,
        error: errorMessage
      };

      this.emit('jobFailed', job, result);
    }
  }

  /**
   * Actualizar foto en base de datos con dorsales y datos faciales
   */
  private async updatePhotoInDatabase(photoId: number, detectedDorsals: number[], faces: FaceAnnotation[] = []): Promise<void> {
    try {
      const { storage } = await import('./storage');
      
      await storage.updatePhoto(photoId, {
        detectedDorsals,
        faces,
        processed: true,
        processingStatus: 'completed'
      });
      
      console.log(`📝 Foto ${photoId} actualizada con ${detectedDorsals.length} dorsales y ${faces.length} caras`);
    } catch (error) {
      console.error(`❌ Error actualizando foto ${photoId}:`, error);
      throw error;
    }
  }

  /**
   * Pausar procesamiento
   */
  pause(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    console.log('⏸️ Procesador pausado');
  }

  /**
   * Reanudar procesamiento
   */
  resume(): void {
    if (!this.processingInterval) {
      this.startProcessingLoop();
      console.log('▶️ Procesador reanudado');
    }
  }

  /**
   * Detener procesador
   */
  stop(): void {
    this.pause();
    this.processingJobs.clear();
    this.processingQueue = [];
    console.log('🛑 Procesador detenido');
  }

  /**
   * Limpiar trabajos completados/fallidos
   */
  cleanup(): void {
    this.completedJobs = [];
    this.failedJobs = [];
    console.log('🧹 Trabajos completados/fallidos limpiados');
  }
}

// Singleton instance
export const asyncPhotoProcessor = new AsyncPhotoProcessor();

// Graceful shutdown
process.on('SIGTERM', () => {
  asyncPhotoProcessor.stop();
});

process.on('SIGINT', () => {
  asyncPhotoProcessor.stop();
});