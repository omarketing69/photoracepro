import sharp from 'sharp';
import { getCloudStorage } from './cloud-storage';
import { storage } from './storage';
import { GoogleVisionOCRProcessor } from './google-vision-ocr';
import { performanceMonitor } from './performance-monitor';
import { HeicConverter } from './heic-converter';

export class CloudImageService {
  private cloudStorage = getCloudStorage();

  /**
   * Procesar foto completa: subir original, generar versiones y almacenar en nube
   */
  async processAndUploadPhoto(
    eventId: number, 
    photoFile: Express.Multer.File, 
    detectedDorsals: number[] = []
  ): Promise<{
    photoId: number;
    originalUrl: string;
    webUrl: string;
    thumbnailUrl: string;
  }> {
    console.log(`🔍 [CloudImageService] Iniciando procesamiento para: ${photoFile.originalname}`);
    console.log(`🔍 [CloudImageService] Tamaño archivo: ${photoFile.buffer.length} bytes`);
    console.log(`🔍 [CloudImageService] Tipo MIME: ${photoFile.mimetype}`);
    
    try {
      // 🔧 CRITICAL FIX: Convert HEIC/HEIF to JPEG before Sharp processing
      let processBuffer = photoFile.buffer;
      let processMimetype = photoFile.mimetype;
      
      if (HeicConverter.isHeicFile(photoFile)) {
        console.log(`📱 [HEIC] Detectado archivo iPhone HEIC/HEIF: ${photoFile.originalname}`);
        processBuffer = await HeicConverter.convertToJpeg(photoFile.buffer);
        processMimetype = 'image/jpeg';
        console.log(`✅ [HEIC] Conversión completada para Sharp processing`);
      }
      
      // 1. Subir foto original a la nube
      const originalCloudPath = await this.cloudStorage.uploadOriginalPhoto(eventId, photoFile);
      
      // 2. Generar versión web optimizada (usando buffer convertido)
      const webBuffer = await sharp(processBuffer)
        .resize(1200, 800, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85, progressive: true })
        .toBuffer();
      
      const webCloudPath = await this.cloudStorage.uploadWebVersion(eventId, originalCloudPath, webBuffer);
      
      // 3. Generar miniatura sin watermark (usando buffer convertido)
      const thumbnailBuffer = await sharp(processBuffer)
        .resize(200, 200, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toBuffer();
      
      const thumbnailCloudPath = await this.cloudStorage.uploadThumbnail(eventId, originalCloudPath, thumbnailBuffer);
      
      // 4. Procesar OCR con Google Vision si no hay dorsales detectados
      if (detectedDorsals.length === 0) {
        let tempFilePath: string | null = null;
        try {
          console.log(`🔍 Procesando OCR para: ${photoFile.originalname}`);
          // Crear un archivo temporal para procesar con Google Vision
          const fs = await import('fs');
          tempFilePath = `/tmp/${Date.now()}-${photoFile.originalname}`;
          fs.writeFileSync(tempFilePath, photoFile.buffer);
          
          const { GoogleVisionOCRProcessor } = await import('./google-vision-ocr');
          const googleVisionProcessor = new GoogleVisionOCRProcessor(this.cloudStorage);
          const ocrStart = Date.now();
          const ocrResult = await googleVisionProcessor.processImage(tempFilePath);
          const ocrTime = Date.now() - ocrStart;
          
          detectedDorsals = ocrResult.dorsalNumbers;
          console.log(`✅ OCR completado para ${photoFile.originalname}: ${detectedDorsals.length} dorsales detectados (${ocrTime}ms)`);
          
          // Registrar métricas de OCR
          performanceMonitor.recordPhotoProcessed(photoFile.originalname, ocrTime, detectedDorsals.length > 0);
        } catch (error) {
          console.error(`❌ Error en OCR para ${photoFile.originalname}:`, error);
          // Continuar sin OCR - foto se sube sin dorsales
        } finally {
          // Garantizar limpieza del archivo temporal
          if (tempFilePath) {
            try {
              const fs = await import('fs');
              if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
                console.log(`🗑️ Archivo temporal limpiado: ${tempFilePath}`);
              }
            } catch (cleanupError) {
              console.error(`⚠️ Error limpiando archivo temporal ${tempFilePath}:`, cleanupError);
            }
          }
        }
      }
      
      // 5. Crear registro en base de datos con URLs de la nube
      const photo = await storage.createPhoto({
        eventId,
        filename: photoFile.originalname,
        originalPath: originalCloudPath,
        webPath: webCloudPath,
        thumbnailPath: thumbnailCloudPath,
        detectedDorsals,
        faces: [],
        processed: detectedDorsals.length > 0,
        processingStatus: detectedDorsals.length > 0 ? 'completed' : 'pending',
      });
      
      // 6. Organizar por participante si hay dorsales detectados
      if (detectedDorsals.length > 0) {
        await this.cloudStorage.organizeByParticipant(eventId, originalCloudPath, detectedDorsals);
      }
      
      // 7. Generar URLs públicas
      const originalUrl = await this.cloudStorage.generateSignedUrl(originalCloudPath, 60);
      const webUrl = await this.cloudStorage.generatePublicUrl(webCloudPath);
      const thumbnailUrl = await this.cloudStorage.generatePublicUrl(thumbnailCloudPath);
      
      return {
        photoId: photo.id,
        originalUrl,
        webUrl,
        thumbnailUrl,
      };
      
    } catch (error) {
      console.error('Error processing and uploading photo:', error);
      throw new Error('Failed to process and upload photo to cloud storage');
    }
  }

  /**
   * Obtener URLs de una foto existente
   */
  async getPhotoUrls(photoId: number): Promise<{
    originalUrl: string;
    webUrl: string;
    thumbnailUrl: string;
  } | null> {
    try {
      const photo = await storage.getPhoto(photoId);
      if (!photo) return null;
      
      const originalUrl = await this.cloudStorage.generateSignedUrl(photo.originalPath, 60);
      const webUrl = await this.cloudStorage.generatePublicUrl(photo.webPath || photo.originalPath);
      const thumbnailUrl = await this.cloudStorage.generatePublicUrl(photo.thumbnailPath || photo.originalPath);
      
      return { originalUrl, webUrl, thumbnailUrl };
    } catch (error) {
      console.error('Error getting photo URLs:', error);
      return null;
    }
  }

  /**
   * Generar URL de descarga segura para fotos compradas
   */
  async generateSecureDownloadUrl(photoId: number, expirationMinutes: number = 30): Promise<string | null> {
    try {
      const photo = await storage.getPhoto(photoId);
      if (!photo) return null;
      
      return await this.cloudStorage.generateSignedUrl(photo.originalPath, expirationMinutes);
    } catch (error) {
      console.error('Error generating secure download URL:', error);
      return null;
    }
  }

  /**
   * Obtener fotos de un participante específico
   */
  async getParticipantPhotoUrls(eventId: number, dorsalNumber: number): Promise<Array<{
    photoId: number;
    filename: string;
    thumbnailUrl: string;
    webUrl: string;
  }>> {
    try {
      // Obtener lista de fotos del participante desde Cloud Storage
      const photoFileNames = await this.cloudStorage.getParticipantPhotos(eventId, dorsalNumber);
      
      const photoUrls = [];
      
      for (const fileName of photoFileNames) {
        // Buscar la foto en la base de datos
        const photos = await storage.searchPhotosByFilename(fileName);
        
        if (photos.length > 0) {
          const photo = photos[0];
          const thumbnailUrl = await this.cloudStorage.generatePublicUrl(photo.thumbnailPath || photo.originalPath);
          const webUrl = await this.cloudStorage.generatePublicUrl(photo.webPath || photo.originalPath);
          
          photoUrls.push({
            photoId: photo.id,
            filename: photo.filename,
            thumbnailUrl,
            webUrl,
          });
        }
      }
      
      return photoUrls;
    } catch (error) {
      console.error('Error getting participant photo URLs:', error);
      return [];
    }
  }

  /**
   * Migrar fotos existentes del almacenamiento local a la nube
   */
  async migrateLocalPhotosToCloud(eventId: number): Promise<{
    migrated: number;
    failed: number;
    errors: string[];
  }> {
    const result = { migrated: 0, failed: 0, errors: [] as string[] };
    
    try {
      const photos = await storage.getPhotos(eventId);
      
      for (const photo of photos) {
        try {
          // Solo migrar si la foto tiene ruta local
          if (photo.originalPath.startsWith('uploads/')) {
            const fs = await import('fs');
            const photoBuffer = fs.readFileSync(photo.originalPath);
            
            const mockFile: Express.Multer.File = {
              buffer: photoBuffer,
              originalname: photo.filename,
              mimetype: 'image/jpeg',
              fieldname: 'photos',
              encoding: '7bit',
              size: photoBuffer.length,
              destination: '',
              filename: '',
              path: '',
              stream: null as any,
            };
            
            // Procesar y subir a la nube
            const { originalUrl, webUrl, thumbnailUrl } = await this.processAndUploadPhoto(
              eventId, 
              mockFile, 
              photo.detectedDorsals || []
            );
            
            result.migrated++;
            console.log(`Migrated photo ${photo.id}: ${photo.filename}`);
          }
        } catch (error) {
          result.failed++;
          result.errors.push(`Failed to migrate photo ${photo.id}: ${error}`);
          console.error(`Error migrating photo ${photo.id}:`, error);
        }
      }
      
      return result;
    } catch (error) {
      console.error('Error during migration:', error);
      throw error;
    }
  }

  /**
   * Obtener estadísticas de almacenamiento
   */
  async getStorageStats(eventId: number): Promise<{
    cloud: any;
    database: {
      totalPhotos: number;
      processedPhotos: number;
      pendingPhotos: number;
    };
  }> {
    try {
      const [cloudStats, photos] = await Promise.all([
        this.cloudStorage.getEventStorageStats(eventId),
        storage.getPhotos(eventId),
      ]);
      
      const processedPhotos = photos.filter(p => p.processed).length;
      
      return {
        cloud: cloudStats,
        database: {
          totalPhotos: photos.length,
          processedPhotos,
          pendingPhotos: photos.length - processedPhotos,
        },
      };
    } catch (error) {
      console.error('Error getting storage stats:', error);
      throw error;
    }
  }
}

export const cloudImageService = new CloudImageService();