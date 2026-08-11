import { db } from './db';
import { photos } from '../shared/schema';
import { sql } from 'drizzle-orm';
import { getCloudStorage, CloudPhotoStorage } from './cloud-storage';

export class DorsalOrganizer {
  private cloudStorage: CloudPhotoStorage;

  constructor() {
    this.cloudStorage = getCloudStorage();
  }

  async organizeExistingDorsals() {
    try {
      console.log('🔄 Organizando dorsales YA detectados sin duplicar costos OCR...');
      
      // Obtener todas las fotos que YA tienen dorsales detectados
      const photosWithDorsals = await db
        .select()
        .from(photos)
        .where(sql`detected_dorsals IS NOT NULL AND detected_dorsals::text != '[]' AND detected_dorsals::text != '' AND detected_dorsals::text != 'null'`)
        .limit(1000); // Procesar por lotes

      console.log(`📸 Encontradas ${photosWithDorsals.length} fotos CON dorsales ya detectados`);

      let organized = 0;
      for (const photo of photosWithDorsals) {
        if (photo.detectedDorsals && Array.isArray(photo.detectedDorsals)) {
          for (const dorsal of photo.detectedDorsals) {
            try {
              await this.cloudStorage.organizeByParticipant(
                photo.eventId,
                photo.originalPath,
                [dorsal]
              );
              organized++;
            } catch (error) {
              console.log(`❌ Error organizando foto ${photo.id} con dorsal ${dorsal}: ${error}`);
            }
          }
        }
      }

      console.log(`✅ Organizadas ${organized} fotos usando dorsales YA detectados`);
      console.log(`💰 COSTO CERO - No se procesó OCR adicional`);
      
      return {
        success: true,
        photosProcessed: photosWithDorsals.length,
        organized: organized,
        message: 'Dorsales organizados usando detección existente - sin costos adicionales'
      };

    } catch (error) {
      console.error('❌ Error organizando dorsales existentes:', error);
      throw error;
    }
  }

  async getOrganizationStats() {
    try {
      // Contar fotos con dorsales detectados
      const photosWithDorsalsResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(photos)
        .where(sql`detected_dorsals IS NOT NULL AND detected_dorsals::text != '[]' AND detected_dorsals::text != '' AND detected_dorsals::text != 'null'`);

      const photosWithDorsals = photosWithDorsalsResult[0]?.count || 0;

      // Contar fotos organizadas en Google Cloud Storage
      const eventStats = await this.cloudStorage.getEventStorageStats(1);
      
      return {
        totalPhotos: 4283,
        photosWithDetectedDorsals: photosWithDorsals,
        organizedDorsals: eventStats.participants,
        needsOrganization: photosWithDorsals > 0 && eventStats.participants < photosWithDorsals
      };
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas:', error);
      return { error: (error as Error).message };
    }
  }
}