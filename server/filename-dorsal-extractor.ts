import { db } from './db';
import { photos } from '../shared/schema';
import { eq, sql, and } from 'drizzle-orm';
import { getCloudStorage } from './cloud-storage';

export class FilenameDorsalExtractor {
  private cloudStorage = getCloudStorage();

  extractDorsalFromFilename(filename: string): number | null {
    // Patrones para extraer dorsales de nombres de archivo:
    // anderson-1234.jpg -> 1234
    // sebas-567.jpg -> 567  
    // mario-8901.JPG -> 8901
    // josue-1512.jpg -> 1512
    
    const patterns = [
      /(?:anderson|sebas|mario|josue|juliana|jorge|cohen|antrid)-(\d{3,4})/i,
      /(\d{3,4})(?=\.[a-z]+$)/i, // Dorsal al final del filename
      /-(\d{3,4})-/g, // Dorsal entre guiones
    ];

    for (const pattern of patterns) {
      const match = filename.match(pattern);
      if (match && match[1]) {
        const dorsal = parseInt(match[1]);
        if (dorsal >= 100 && dorsal <= 9999) { // Dorsales válidos de maratón
          return dorsal;
        }
      }
    }

    return null;
  }

  async processPhotosFromFilenames() {
    try {
      console.log('🔄 Extrayendo dorsales de nombres de archivo - SIN costos OCR...');
      
      // Obtener fotos sin dorsales detectados
      const photosWithoutDorsals = await db
        .select()
        .from(photos)
        .where(sql`detected_dorsals IS NULL OR detected_dorsals::text = '[]' OR detected_dorsals::text = '' OR detected_dorsals::text = 'null'`)
        .limit(1000);

      console.log(`📸 Encontradas ${photosWithoutDorsals.length} fotos SIN dorsales para procesar`);

      let processed = 0;
      let organized = 0;
      
      for (const photo of photosWithoutDorsals) {
        const dorsalFromFilename = this.extractDorsalFromFilename(photo.filename);
        
        if (dorsalFromFilename) {
          try {
            // Actualizar foto en base de datos con dorsal extraído
            await db
              .update(photos)
              .set({
                detectedDorsals: [dorsalFromFilename],
                processed: true,
                processingStatus: 'completed',
                processedAt: new Date()
              })
              .where(eq(photos.id, photo.id));

            // Organizar en Google Cloud Storage
            await this.cloudStorage.organizeByParticipant(
              photo.eventId,
              photo.originalPath,
              [dorsalFromFilename]
            );

            processed++;
            organized++;
            
            if (processed % 100 === 0) {
              console.log(`📈 Procesadas ${processed} fotos con dorsales de filename...`);
            }
            
          } catch (error) {
            console.log(`❌ Error procesando foto ${photo.id}: ${error}`);
          }
        }
      }

      console.log(`✅ COMPLETADO - Extracción de filenames:`);
      console.log(`   📸 Fotos procesadas: ${processed}`);
      console.log(`   📂 Dorsales organizados: ${organized}`);
      console.log(`   💰 Costo OCR: $0 (solo filenames)`);
      
      return {
        success: true,
        photosProcessed: processed,
        organized: organized,
        method: 'filename-extraction',
        cost: '$0'
      };

    } catch (error) {
      console.error('❌ Error extrayendo dorsales de filenames:', error);
      throw error;
    }
  }

  async getExtractionPotential() {
    try {
      // Obtener muestra de fotos sin dorsales
      const samplePhotos = await db
        .select()
        .from(photos)
        .where(sql`detected_dorsals IS NULL OR detected_dorsals::text = '[]' OR detected_dorsals::text = '' OR detected_dorsals::text = 'null'`)
        .limit(50);

      let extractableCount = 0;
      const sampleDorsals: number[] = [];

      for (const photo of samplePhotos) {
        const dorsal = this.extractDorsalFromFilename(photo.filename);
        if (dorsal) {
          extractableCount++;
          sampleDorsals.push(dorsal);
        }
      }

      const extractionRate = (extractableCount / samplePhotos.length) * 100;
      const totalWithoutDorsals = 4243; // From status check
      const estimatedExtractable = Math.round((extractionRate / 100) * totalWithoutDorsals);

      return {
        sampleSize: samplePhotos.length,
        extractableFromSample: extractableCount,
        extractionRate: extractionRate.toFixed(1),
        estimatedTotalExtractable: estimatedExtractable,
        sampleDorsals: sampleDorsals.slice(0, 10),
        method: 'filename-pattern-matching'
      };

    } catch (error) {
      console.error('❌ Error calculando potencial de extracción:', error);
      throw error;
    }
  }
}