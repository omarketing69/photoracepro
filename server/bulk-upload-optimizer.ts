import { CloudImageService } from './cloud-image-service';
import { uploadResumeSystem } from './upload-resume-system';
import { performanceMonitor } from './performance-monitor';

export class BulkUploadOptimizer {
  private cloudImageService = new CloudImageService();
  
  /**
   * Optimiza la carga masiva de fotos con procesamiento en lotes paralelos
   * Incluye sistema de reanudación y prevención de duplicados
   */
  async processBulkPhotos(
    eventId: number,
    photos: Express.Multer.File[],
    onProgress?: (progress: { completed: number, total: number, current: string }) => void,
    sessionId?: string,
    forceDuplicates: boolean = false
  ): Promise<{
    successful: any[];
    failed: any[];
    skipped: any[];
    duplicates: any[];
    totalTime: number;
    averageTimePerPhoto: number;
    throughput: number;
    sessionId: string;
  }> {
    const startTime = Date.now();
    const successful: any[] = [];
    const failed: any[] = [];
    const skipped: any[] = [];
    const duplicates: any[] = [];
    
    // Crear o continuar sesión de subida
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      const session = uploadResumeSystem.createSession(eventId, photos.map(p => p.originalname));
      currentSessionId = session.id;
      console.log(`🔄 Nueva sesión de subida creada: ${currentSessionId}`);
    } else {
      console.log(`📋 Continuando sesión existente: ${currentSessionId}`);
    }
    
    // Verificar duplicados antes de empezar (saltar si se fuerza)
    let toProcess: Express.Multer.File[];
    let duplicateFiles: Express.Multer.File[] = [];
    let duplicateDetails: any[] = [];
    
    if (forceDuplicates) {
      console.log(`⚡ FORZANDO SUBIDA - Ignorando verificación de duplicados`);
      toProcess = photos; // Procesar todas las fotos sin verificar duplicados
    } else {
      const result = await uploadResumeSystem.getFilesToProcess(eventId, photos);
      toProcess = result.toProcess;
      duplicateFiles = result.duplicates;
      duplicateDetails = result.duplicateDetails;
    }
    
    // Registrar duplicados encontrados
    for (const duplicate of duplicateFiles) {
      const duplicateDetail = duplicateDetails.find(d => d.filename === duplicate.originalname);
      duplicates.push({
        success: false,
        filename: duplicate.originalname,
        status: 'duplicate',
        inDatabase: duplicateDetail?.inDatabase || false,
        inCloud: duplicateDetail?.inCloud || false
      });
      
      uploadResumeSystem.updateSessionProgress(currentSessionId, duplicate.originalname, {
        filename: duplicate.originalname,
        status: 'duplicate'
      });
    }
    
    // Obtener archivos restantes para procesar (en caso de reanudación)
    const filesToProcess = sessionId ? 
      uploadResumeSystem.getRemainingFiles(currentSessionId, toProcess) : 
      toProcess;
    
    const totalPhotos = photos.length;
    const photosToProcess = filesToProcess.length;
    
    console.log(`🚀 Iniciando carga masiva optimizada:`);
    console.log(`   📊 Total de fotos: ${totalPhotos}`);
    console.log(`   🔄 Fotos a procesar: ${photosToProcess}`);
    console.log(`   ⚠️ Duplicados encontrados: ${duplicates.length}`);
    console.log(`   📋 Sesión ID: ${currentSessionId}`);
    
    // Registrar inicio de upload en métricas
    performanceMonitor.startUpload(photosToProcess);
    
    if (photosToProcess === 0) {
      console.log(`ℹ️ No hay fotos nuevas para procesar`);
      return {
        successful,
        failed,
        skipped,
        duplicates,
        totalTime: Date.now() - startTime,
        averageTimePerPhoto: 0,
        throughput: 0,
        sessionId: currentSessionId
      };
    }
    
    // Configuración optimizada para el procesamiento - reducido para evitar timeouts
    const batchSize = Math.min(this.getBatchSize(photosToProcess), 5); // Máximo 5 fotos por lote
    console.log(`   📦 Tamaño de lote: ${batchSize}`);
    console.log(`   🎯 Estimado: ${Math.ceil(photosToProcess / batchSize)} lotes`);
    
    try {
      for (let i = 0; i < filesToProcess.length; i += batchSize) {
        const batch = filesToProcess.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(filesToProcess.length / batchSize);
        
        console.log(`📦 Procesando lote ${batchNumber}/${totalBatches} (${batch.length} fotos)`);
        
        const batchStartTime = Date.now();
        
        // Limpiar archivos temporales antes de procesar nuevo lote
        await this.cleanupTempFiles();
        
        // Procesar lote en paralelo
        const batchPromises = batch.map(async (photo, index) => {
          const photoIndex = i + index + 1;
          
          try {
            // Callback de progreso
            if (onProgress) {
              onProgress({
                completed: successful.length + failed.length + skipped.length,
                total: totalPhotos,
                current: photo.originalname
              });
            }
            
            console.log(`   ☁️ [${photoIndex}/${photosToProcess}] Procesando: ${photo.originalname}`);
            
            const result = await this.cloudImageService.processAndUploadPhoto(eventId, photo);
            
            // 🔧 CRÍTICO: Agregar a procesamiento asíncrono automáticamente (especial para HEIC)
            if (result.photoId) {
              try {
                const { asyncPhotoProcessor } = await import('./async-photo-processor');
                const jobId = asyncPhotoProcessor.addJob(
                  result.photoId, 
                  eventId, 
                  photo.originalname, 
                  result.originalUrl || '', 
                  'medium'
                );
                console.log(`   🔄 Agregado a procesamiento asíncrono: ${photo.originalname} (job: ${jobId})`);
              } catch (asyncError) {
                console.warn(`   ⚠️ No se pudo agregar a procesamiento asíncrono: ${photo.originalname}`, asyncError);
                // No fallar la subida por esto
              }
            }
            
            console.log(`   ✅ [${photoIndex}/${photosToProcess}] Completado: ${photo.originalname}`);
            
            const successResult = {
              success: true,
              photoId: result.photoId,
              filename: photo.originalname,
              originalUrl: result.originalUrl,
              webUrl: result.webUrl,
              thumbnailUrl: result.thumbnailUrl,
            };
            
            // Actualizar progreso de sesión
            uploadResumeSystem.updateSessionProgress(currentSessionId, photo.originalname, {
              filename: photo.originalname,
              status: 'success',
              photoId: result.photoId,
              dorsalsDetected: (result as any).dorsalsDetected || 0
            });
            
            return successResult;
            
          } catch (error) {
            console.error(`   ❌ [${photoIndex}/${photosToProcess}] Error en ${photo.originalname}:`, error);
            
            const errorResult = {
              success: false,
              filename: photo.originalname,
              error: (error as Error).message,
            };
            
            // Actualizar progreso de sesión
            uploadResumeSystem.updateSessionProgress(currentSessionId, photo.originalname, {
              filename: photo.originalname,
              status: 'error',
              error: (error as Error).message
            });
            
            return errorResult;
          }
        });
        
        // Esperar a que se complete el lote
        const batchResults = await Promise.allSettled(batchPromises);
        
        // Procesar resultados del lote
        batchResults.forEach((result) => {
          if (result.status === 'fulfilled') {
            if (result.value.success) {
              successful.push(result.value);
            } else {
              failed.push(result.value);
            }
          } else {
            const errorResult = {
              success: false,
              filename: 'unknown',
              error: result.reason?.message || 'Unknown error',
            };
            failed.push(errorResult);
          }
        });
        
        const batchTime = Date.now() - batchStartTime;
        const batchThroughput = (batch.length / batchTime) * 1000;
        
        console.log(`   📊 Lote ${batchNumber} completado en ${(batchTime / 1000).toFixed(1)}s (${batchThroughput.toFixed(2)} fotos/s)`);
        
        // Pequeña pausa entre lotes para evitar sobrecarga
        if (i + batchSize < filesToProcess.length) {
          console.log(`⏳ Esperando 3 segundos antes del siguiente lote...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
      
    } catch (error) {
      console.error('Error crítico en carga masiva:', error);
      uploadResumeSystem.markSessionFailed(currentSessionId);
      throw error;
    }
    
    const totalTime = Date.now() - startTime;
    const averageTimePerPhoto = photosToProcess > 0 ? totalTime / photosToProcess : 0;
    const throughput = photosToProcess > 0 ? (photosToProcess / totalTime) * 1000 : 0;
    
    console.log(`🎯 RESUMEN FINAL:`);
    console.log(`   ✅ Exitosas: ${successful.length}`);
    console.log(`   ❌ Fallidas: ${failed.length}`);
    console.log(`   ⚠️ Duplicados: ${duplicates.length}`);
    console.log(`   ⏱️ Tiempo total: ${(totalTime / 1000).toFixed(1)}s`);
    console.log(`   📈 Promedio por foto: ${averageTimePerPhoto.toFixed(0)}ms`);
    console.log(`   🚀 Throughput: ${throughput.toFixed(2)} fotos/segundo`);
    
    // Finalizar métricas de upload
    performanceMonitor.endUpload();
    
    return {
      successful,
      failed,
      skipped,
      duplicates,
      totalTime,
      averageTimePerPhoto,
      throughput,
      sessionId: currentSessionId
    };
  }
  
  /**
   * Calcula el tamaño de lote óptimo basado en el número total de fotos
   */
  private getBatchSize(totalPhotos: number): number {
    if (totalPhotos <= 20) return 5;   // Lotes pequeños para pocas fotos
    if (totalPhotos <= 50) return 8;   // Lotes medianos
    if (totalPhotos <= 100) return 10; // Lotes estándar
    if (totalPhotos <= 200) return 12; // Lotes grandes para cargas masivas
    return 15; // Lotes muy grandes para más de 200 fotos
  }
  
  /**
   * Estima el tiempo de carga basado en el histórico
   */
  estimateUploadTime(photoCount: number): {
    estimatedMinutes: number;
    estimatedSeconds: number;
    recommendedBatchSize: number;
  } {
    // Basado en pruebas: ~6 segundos por foto con OCR incluido
    const averageTimePerPhoto = 6000; // milliseconds
    const batchSize = this.getBatchSize(photoCount);
    
    // Ajustar por procesamiento en paralelo
    const parallelEfficiency = 0.7; // 70% de eficiencia en paralelo
    const estimatedTotalTime = (photoCount * averageTimePerPhoto * parallelEfficiency) / batchSize;
    
    return {
      estimatedMinutes: Math.ceil(estimatedTotalTime / 60000),
      estimatedSeconds: Math.ceil(estimatedTotalTime / 1000),
      recommendedBatchSize: batchSize,
    };
  }

  /**
   * Limpiar archivos temporales del sistema
   */
  private async cleanupTempFiles(): Promise<void> {
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      const tempDir = '/tmp';
      const files = fs.readdirSync(tempDir);
      
      let cleanedCount = 0;
      for (const file of files) {
        const filePath = path.join(tempDir, file);
        const stats = fs.statSync(filePath);
        
        // Limpiar archivos temporales de imágenes más viejos de 5 minutos
        if (stats.isFile() && 
            (file.includes('.jpg') || file.includes('.jpeg') || file.includes('.png')) &&
            (Date.now() - stats.mtime.getTime()) > 300000) { // 5 minutos
          
          fs.unlinkSync(filePath);
          cleanedCount++;
        }
      }
      
      if (cleanedCount > 0) {
        console.log(`🗑️ Limpiados ${cleanedCount} archivos temporales`);
      }
    } catch (error) {
      console.error('⚠️ Error limpiando archivos temporales:', error);
    }
  }


}

export const bulkUploadOptimizer = new BulkUploadOptimizer();