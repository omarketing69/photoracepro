import fs from 'fs';
import path from 'path';
import { storage } from './storage';
import { GoogleVisionOCRProcessor } from './google-vision-ocr';
import { imageService } from './image-service';

export class BulkPhotoProcessor {
  
  async processPhotosFromDirectory(sourceDir: string, eventId: number = 1): Promise<void> {
    console.log(`🚀 PROCESAMIENTO MASIVO DESDE DIRECTORIO: ${sourceDir}`);
    console.log('═'.repeat(70));

    try {
      // Read all files from source directory
      const files = fs.readdirSync(sourceDir).filter(file => 
        /\.(jpg|jpeg|png|tiff)$/i.test(file)
      );

      console.log(`📊 Encontradas ${files.length} imágenes para procesar`);

      let processedCount = 0;
      let totalDorsalsFound = 0;
      let successfulPhotos = 0;

      for (const filename of files) {
        try {
          const sourcePath = path.join(sourceDir, filename);
          const destinationPath = path.join(process.cwd(), 'uploads', filename);

          console.log(`\n📸 Procesando ${processedCount + 1}/${files.length}: ${filename}`);

          // Copy file to uploads directory
          fs.copyFileSync(sourcePath, destinationPath);

          // Create photo record in database
          const photoData = {
            eventId,
            filename,
            originalPath: destinationPath,
            detectedDorsals: [],
            faces: [],
            processed: false,
            processingStatus: 'pending' as const
          };

          const photo = await storage.createPhoto(photoData);

          // Process with Google Vision OCR
          const googleVisionProcessor = new GoogleVisionOCRProcessor();
          const ocrResult = await googleVisionProcessor.processImage(destinationPath);

          if (ocrResult.dorsalNumbers.length > 0) {
            // Generate thumbnail
            const thumbnailPath = await imageService.generateThumbnail(destinationPath, filename);
            
            // Update photo with results
            await storage.updatePhoto(photo.id, {
              detectedDorsals: ocrResult.dorsalNumbers,
              thumbnailPath,
              processed: true,
              processingStatus: 'completed'
            });

            totalDorsalsFound += ocrResult.dorsalNumbers.length;
            successfulPhotos++;

            console.log(`✅ Detectados ${ocrResult.dorsalNumbers.length} dorsales: [${ocrResult.dorsalNumbers.join(', ')}]`);
          } else {
            // Mark as processed but no dorsals found
            await storage.updatePhoto(photo.id, {
              processed: true,
              processingStatus: 'no_dorsals_found'
            });

            console.log(`❌ Sin dorsales detectados`);
          }

          processedCount++;

          // Progress update
          if (processedCount % 10 === 0) {
            console.log(`\n📈 PROGRESO: ${processedCount}/${files.length} (${Math.round(processedCount/files.length*100)}%)`);
            console.log(`🎯 Dorsales encontrados: ${totalDorsalsFound}`);
          }

        } catch (error) {
          console.error(`❌ Error procesando ${filename}:`, error);
          processedCount++;
        }
      }

      // Final summary
      console.log('\n🎉 PROCESAMIENTO COMPLETADO');
      console.log('═'.repeat(50));
      console.log(`✅ Fotos procesadas: ${processedCount}/${files.length}`);
      console.log(`🏆 Fotos con dorsales: ${successfulPhotos}`);
      console.log(`🎯 Total dorsales detectados: ${totalDorsalsFound}`);
      console.log(`📊 Promedio dorsales/foto: ${(totalDorsalsFound/successfulPhotos || 0).toFixed(1)}`);
      console.log(`⚡ Tasa de éxito: ${Math.round(successfulPhotos/processedCount*100)}%`);

    } catch (error) {
      console.error('❌ Error en procesamiento masivo:', error);
    }
  }

  async processAttachedAssets(eventId: number = 1): Promise<void> {
    const attachedAssetsDir = path.join(process.cwd(), 'attached_assets');
    
    console.log('📁 Procesando archivos adjuntos...');
    
    if (!fs.existsSync(attachedAssetsDir)) {
      console.log('❌ Directorio attached_assets no encontrado');
      return;
    }

    await this.processPhotosFromDirectory(attachedAssetsDir, eventId);
  }

  async findSpecificDorsals(dorsalsToFind: number[], eventId: number = 1): Promise<void> {
    console.log(`🔍 BÚSQUEDA ESPECÍFICA DE DORSALES: [${dorsalsToFind.join(', ')}]`);
    console.log('═'.repeat(60));

    const found: { [key: number]: number[] } = {};
    dorsalsToFind.forEach(dorsal => { found[dorsal] = []; });

    try {
      // Get all photos in event
      const photos = await storage.getPhotos(eventId, 1000, 0);
      
      for (const photo of photos) {
        if (photo.detectedDorsals && photo.detectedDorsals.length > 0) {
          // Check if any target dorsals are in this photo
          const foundInThisPhoto = dorsalsToFind.filter(dorsal => 
            photo.detectedDorsals.includes(dorsal)
          );

          if (foundInThisPhoto.length > 0) {
            foundInThisPhoto.forEach(dorsal => {
              found[dorsal].push(photo.id);
            });
          }
        }
      }

      // Report results
      console.log('\n🎯 RESULTADOS DE BÚSQUEDA:');
      console.log('═'.repeat(40));
      
      for (const dorsal of dorsalsToFind) {
        const photoIds = found[dorsal];
        if (photoIds.length > 0) {
          console.log(`✅ Dorsal ${dorsal}: encontrado en ${photoIds.length} foto(s)`);
          console.log(`   📸 IDs de fotos: [${photoIds.join(', ')}]`);
        } else {
          console.log(`❌ Dorsal ${dorsal}: no encontrado`);
        }
      }

    } catch (error) {
      console.error('❌ Error en búsqueda:', error);
    }
  }

  async getProcessingStats(eventId: number = 1): Promise<any> {
    try {
      const photos = await storage.getPhotos(eventId, 1000, 0);
      
      const stats = {
        totalPhotos: photos.length,
        processedPhotos: photos.filter(p => p.processed).length,
        photosWithDorsals: photos.filter(p => p.detectedDorsals && p.detectedDorsals.length > 0).length,
        totalDorsals: photos.reduce((sum, p) => sum + (p.detectedDorsals?.length || 0), 0),
        uniqueDorsals: new Set(photos.flatMap(p => p.detectedDorsals || [])).size,
        averageDorsalsPerPhoto: 0
      };

      if (stats.photosWithDorsals > 0) {
        stats.averageDorsalsPerPhoto = stats.totalDorsals / stats.photosWithDorsals;
      }

      return stats;
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      return null;
    }
  }
}

export const bulkPhotoProcessor = new BulkPhotoProcessor();