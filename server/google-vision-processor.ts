import { GoogleVisionOCRProcessor } from './google-vision-ocr';
import { storage } from './storage';
import { imageService } from './image-service';
import { canonicalEventId } from './utils/canonical-event-id';
import path from 'path';
import fs from 'fs';

export class GoogleVisionBatchProcessor {
  private isProcessing = false;
  private processedCount = 0;
  private totalToProcess = 0;

  async processAllUnprocessedPhotos(eventId: number = 1): Promise<void> {
    if (this.isProcessing) {
      console.log('⚠️ Ya hay un procesamiento en curso');
      return;
    }

    this.isProcessing = true;
    console.log('🚀 INICIANDO PROCESAMIENTO MASIVO CON GOOGLE VISION OCR');
    console.log('═'.repeat(70));

    try {
      // Apply canonicalization and get photos from all related events (alias-aware)
      const canonicalId = canonicalEventId(eventId);
      console.log(`🔄 [BATCH-PROCESSOR] Event ${eventId} canonicalized to ${canonicalId}`);
      
      // Get event aliases to process UFPS photos from their actual locations (events 6, 10)
      const eventIdsToSearch = canonicalId === 8 ? [6, 8, 10] : [canonicalId]; // UFPS alias-aware
      console.log(`📋 [BATCH-ALIAS] Searching photos in events: ${eventIdsToSearch.join(', ')}`);
      
      // Collect photos from all related events
      let allPhotos: any[] = [];
      for (const searchEventId of eventIdsToSearch) {
        const eventPhotos = await storage.getPhotos(searchEventId, 1000, 0);
        allPhotos.push(...eventPhotos);
        console.log(`📋 [BATCH-DEBUG] Event ${searchEventId}: ${eventPhotos.length} photos`);
      }
      
      const unprocessedPhotos = allPhotos.filter(photo => 
        !photo.detectedDorsals || photo.detectedDorsals.length === 0 // Focus on missing dorsals only
      );
      
      console.log(`📋 [BATCH-DEBUG] Total photos across all events: ${allPhotos.length}`);
      console.log(`📋 [BATCH-DEBUG] Photos without dorsals: ${unprocessedPhotos.length}`);

      this.totalToProcess = unprocessedPhotos.length;
      this.processedCount = 0;

      console.log(`📊 Fotos a procesar: ${this.totalToProcess}`);
      console.log(`🎯 Evento ID: ${eventId} (canonical: ${canonicalId})`);

      let totalDorsalsFound = 0;
      let successfulProcessing = 0;

      for (const photo of unprocessedPhotos) {
        try {
          console.log(`\n📸 Procesando ${this.processedCount + 1}/${this.totalToProcess}: ${photo.filename}`);
          console.log(`☁️ [GCS-PATH] Procesando desde: ${photo.originalPath}`);
          
          // Process with Google Vision (supports both local and GCS)
          // Removed fs.existsSync guard to enable GCS OCR fallback
          const googleVisionProcessor = new GoogleVisionOCRProcessor();
          const result = await googleVisionProcessor.processImage(photo.originalPath);
          
          if (result.dorsalNumbers.length > 0) {
            // Update photo in database
            await storage.updatePhoto(photo.id, {
              detectedDorsals: result.dorsalNumbers,
              processed: true,
              processingStatus: 'completed'
            });

            // Generate thumbnail if not exists - DISABLED for Google Cloud Storage photos
            if (!photo.thumbnailPath && !photo.originalPath.startsWith('eventos/')) {
              // Only generate local thumbnails for legacy local photos
              const thumbnailPath = await imageService.generateThumbnail(
                photo.originalPath, 
                photo.filename
              );
              await storage.updatePhoto(photo.id, { thumbnailPath });
            }

            totalDorsalsFound += result.dorsalNumbers.length;
            successfulProcessing++;

            console.log(`✅ Detectados ${result.dorsalNumbers.length} dorsales: [${result.dorsalNumbers.join(', ')}]`);
          } else {
            console.log(`❌ Sin dorsales detectados`);
            
            // Mark as processed but with no dorsals
            await storage.updatePhoto(photo.id, {
              processed: true,
              processingStatus: 'no_dorsals_found'
            });
          }

          this.processedCount++;

          // Progress update every 10 photos
          if (this.processedCount % 10 === 0) {
            console.log(`\n📈 PROGRESO: ${this.processedCount}/${this.totalToProcess} (${Math.round(this.processedCount/this.totalToProcess*100)}%)`);
            console.log(`🎯 Dorsales encontrados hasta ahora: ${totalDorsalsFound}`);
          }

        } catch (error) {
          console.error(`❌ Error procesando ${photo.filename}:`, error);
          
          // Mark as failed
          await storage.updatePhoto(photo.id, {
            processed: true,
            processingStatus: 'error'
          });
        }
      }

      // Final summary
      console.log('\n🎉 PROCESAMIENTO COMPLETADO');
      console.log('═'.repeat(50));
      console.log(`✅ Fotos procesadas exitosamente: ${successfulProcessing}/${this.totalToProcess}`);
      console.log(`🎯 Total de dorsales detectados: ${totalDorsalsFound}`);
      console.log(`📊 Promedio de dorsales por foto: ${(totalDorsalsFound / successfulProcessing || 0).toFixed(1)}`);
      console.log(`⚡ Eficiencia de detección: ${Math.round(successfulProcessing/this.totalToProcess*100)}%`);

    } catch (error) {
      console.error('❌ Error en procesamiento masivo:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  async processSpecificPhotos(photoIds: number[]): Promise<void> {
    console.log(`🎯 PROCESANDO FOTOS ESPECÍFICAS CON GOOGLE VISION`);
    console.log(`📊 Total de fotos: ${photoIds.length}`);
    console.log('─'.repeat(50));

    let successCount = 0;
    let totalDorsals = 0;

    for (const photoId of photoIds) {
      try {
        const photo = await storage.getPhoto(photoId);
        if (!photo) {
          console.log(`❌ Foto ${photoId} no encontrada`);
          continue;
        }

        console.log(`\n📸 Procesando foto ${photoId}: ${photo.filename}`);

        const googleVisionProcessor = new GoogleVisionOCRProcessor();
        const result = await googleVisionProcessor.processImage(photo.originalPath);
        
        if (result.dorsalNumbers.length > 0) {
          await storage.updatePhoto(photoId, {
            detectedDorsals: result.dorsalNumbers,
            processed: true,
            processingStatus: 'completed'
          });

          successCount++;
          totalDorsals += result.dorsalNumbers.length;

          console.log(`✅ Detectados ${result.dorsalNumbers.length} dorsals: [${result.dorsalNumbers.join(', ')}]`);
        } else {
          console.log(`❌ Sin dorsales detectados`);
        }

      } catch (error) {
        console.error(`❌ Error procesando foto ${photoId}:`, error);
      }
    }

    console.log(`\n📈 RESUMEN:`);
    console.log(`✅ Fotos exitosas: ${successCount}/${photoIds.length}`);
    console.log(`🎯 Total dorsales: ${totalDorsals}`);
  }

  async findMissingDorsals(missingDorsals: number[], eventId: number = 1): Promise<void> {
    console.log(`🔍 BÚSQUEDA ESPECÍFICA DE DORSALES FALTANTES`);
    console.log(`🎯 Dorsales buscados: [${missingDorsals.join(', ')}]`);
    console.log('═'.repeat(60));

    const photos = await storage.getPhotos(eventId, 1000, 0);
    const found: { [key: number]: number[] } = {};

    for (const dorsal of missingDorsals) {
      found[dorsal] = [];
    }

    let processedPhotos = 0;

    for (const photo of photos) {
      try {
        console.log(`📸 Analizando ${++processedPhotos}/${photos.length}: ${photo.filename}`);

        // Skip if we already processed this photo and found no dorsals
        if (photo.processed && photo.detectedDorsals && photo.detectedDorsals.length === 0) {
          continue;
        }

        const googleVisionProcessor = new GoogleVisionOCRProcessor();
        const result = await googleVisionProcessor.processImage(photo.originalPath);
        
        // Check if any missing dorsals were found
        const foundInThisPhoto = missingDorsals.filter(dorsal => 
          result.dorsalNumbers.includes(dorsal)
        );

        if (foundInThisPhoto.length > 0) {
          console.log(`🎉 ENCONTRADOS en ${photo.filename}: [${foundInThisPhoto.join(', ')}]`);
          
          // Update photo with all detected dorsals
          await storage.updatePhoto(photo.id, {
            detectedDorsals: result.dorsalNumbers,
            processed: true,
            processingStatus: 'completed'
          });

          // Record findings
          foundInThisPhoto.forEach(dorsal => {
            found[dorsal].push(photo.id);
          });
        }

        // Progress every 50 photos
        if (processedPhotos % 50 === 0) {
          console.log(`📈 Progreso: ${processedPhotos}/${photos.length} fotos analizadas`);
        }

      } catch (error) {
        console.error(`❌ Error analizando ${photo.filename}:`, error);
      }
    }

    // Final report
    console.log('\n🎯 RESULTADO DE BÚSQUEDA:');
    console.log('═'.repeat(40));
    
    for (const dorsal of missingDorsals) {
      const photoIds = found[dorsal];
      if (photoIds.length > 0) {
        console.log(`✅ Dorsal ${dorsal}: encontrado en ${photoIds.length} foto(s) - IDs: [${photoIds.join(', ')}]`);
      } else {
        console.log(`❌ Dorsal ${dorsal}: no encontrado`);
      }
    }
  }

  getProcessingStatus() {
    return {
      isProcessing: this.isProcessing,
      processedCount: this.processedCount,
      totalToProcess: this.totalToProcess,
      progress: this.totalToProcess > 0 ? (this.processedCount / this.totalToProcess) * 100 : 0
    };
  }
}

export const googleVisionBatchProcessor = new GoogleVisionBatchProcessor();