import { getCloudStorage } from './cloud-storage';
import { storage } from './storage';
import { promises as fs } from 'fs';
import path from 'path';
import sharp from 'sharp';
import { GoogleVisionOCRProcessor } from './google-vision-ocr';

const cloudStorage = getCloudStorage();
const ocrProcessor = new GoogleVisionOCRProcessor();

export async function migrateLocalPhotosToCloud(eventId: number = 1): Promise<{
  migrated: number;
  failed: number;
  errors: string[];
}> {
  console.log(`🔄 Iniciando migración de fotos locales a Google Cloud Storage para evento ${eventId}...`);
  
  // Obtener todas las fotos del evento con rutas locales
  const photos = await storage.getPhotos(eventId);
  const localPhotos = photos.filter(photo => 
    photo.originalPath && 
    !photo.originalPath.startsWith('eventos/') && 
    photo.originalPath.includes('/home/runner/workspace/uploads/')
  );
  
  console.log(`📦 Encontradas ${localPhotos.length} fotos locales para migrar`);
  
  const results = {
    migrated: 0,
    failed: 0,
    errors: [] as string[]
  };
  
  for (const photo of localPhotos) {
    try {
      console.log(`📸 Migrando foto: ${photo.filename}`);
      
      // Verificar si el archivo local existe
      const localPath = photo.originalPath;
      let fileExists = false;
      
      try {
        await fs.access(localPath);
        fileExists = true;
      } catch {
        fileExists = false;
      }
      
      if (!fileExists) {
        // Buscar el archivo en diferentes ubicaciones
        const possiblePaths = [
          `/home/runner/workspace/uploads/${photo.filename}`,
          `/home/runner/workspace/uploads/1/${photo.filename}`,
          `/home/runner/workspace/uploads/demo/${photo.filename}`,
          localPath
        ];
        
        for (const testPath of possiblePaths) {
          try {
            await fs.access(testPath);
            console.log(`✅ Archivo encontrado en: ${testPath}`);
            photo.originalPath = testPath;
            fileExists = true;
            break;
          } catch {
            continue;
          }
        }
      }
      
      if (!fileExists) {
        results.errors.push(`Archivo no encontrado: ${photo.filename} (${localPath})`);
        results.failed++;
        continue;
      }
      
      // Leer el archivo local
      const fileBuffer = await fs.readFile(photo.originalPath);
      
      // Crear objeto file simulado para el cloud storage
      const mockFile: Express.Multer.File = {
        fieldname: 'photos',
        originalname: photo.filename,
        encoding: '7bit',
        mimetype: 'image/jpeg',
        buffer: fileBuffer,
        size: fileBuffer.length,
        stream: null as any,
        destination: '',
        filename: '',
        path: ''
      };
      
      // Subir a Google Cloud Storage
      const cloudPath = await cloudStorage.uploadOriginalPhoto(eventId, mockFile);
      console.log(`☁️ Subido a cloud: ${cloudPath}`);
      
      // Generar versión web optimizada
      const webBuffer = await sharp(fileBuffer)
        .resize(1200, 1600, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
      
      const webPath = await cloudStorage.uploadWebVersion(eventId, photo.filename, webBuffer);
      console.log(`🌐 Versión web creada: ${webPath}`);
      
      // Generar miniatura
      const thumbnailBuffer = await sharp(fileBuffer)
        .resize(300, 400, { fit: 'cover' })
        .jpeg({ quality: 75 })
        .toBuffer();
      
      const thumbnailPath = await cloudStorage.uploadThumbnail(eventId, photo.filename, thumbnailBuffer);
      console.log(`🖼️ Miniatura creada: ${thumbnailPath}`);
      
      // Procesar OCR si no tiene dorsales detectados
      let detectedDorsals = photo.detectedDorsals || [];
      
      if (detectedDorsals.length === 0) {
        try {
          console.log(`🔍 Procesando OCR para ${photo.filename}...`);
          detectedDorsals = await ocrProcessor.processImageBuffer(fileBuffer);
          console.log(`📊 OCR completado: ${detectedDorsals.length} dorsales detectados`);
        } catch (ocrError) {
          console.error(`❌ Error en OCR para ${photo.filename}:`, ocrError);
        }
      }
      
      // Actualizar la foto en la base de datos con las nuevas rutas
      await storage.updatePhoto(photo.id, {
        originalPath: cloudPath,
        webPath: webPath,
        thumbnailPath: thumbnailPath,
        detectedDorsals: detectedDorsals,
        processed: true,
        processingStatus: 'completed'
      });
      
      // Organizar por participante si hay dorsales
      if (detectedDorsals.length > 0) {
        await cloudStorage.organizeByParticipant(eventId, photo.filename, detectedDorsals);
      }
      
      console.log(`✅ Migración completada: ${photo.filename}`);
      results.migrated++;
      
    } catch (error) {
      console.error(`❌ Error migrando ${photo.filename}:`, error);
      results.errors.push(`Error migrando ${photo.filename}: ${error.message}`);
      results.failed++;
    }
  }
  
  console.log(`🎉 Migración completada: ${results.migrated} exitosas, ${results.failed} fallidas`);
  
  return results;
}

// Función para ejecutar la migración directamente
export async function runMigration() {
  try {
    const result = await migrateLocalPhotosToCloud(1);
    console.log('Resultado de migración:', result);
  } catch (error) {
    console.error('Error en migración:', error);
  }
}