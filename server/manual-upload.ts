import multer from 'multer';
import path from 'path';
import { storage } from './storage';
import { GoogleVisionOCRProcessor } from './google-vision-ocr';
import { imageService } from './image-service';
import { getCloudStorage } from './cloud-storage';

// Configure multer for bulk photo uploads
const bulkUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  fileFilter: (req, file, cb) => {
    // 📱 CRITICAL FIX: Add HEIC/HEIF support for iPhone photos
    const allowedTypes = /jpeg|jpg|png|tiff|gif|webp|bmp|heic|heif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes (JPG, PNG, TIFF, HEIC, HEIF)'));
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB per file
    files: 200 // Allow up to 200 files
  }
});

export class ManualUploadProcessor {
  
  async processBulkUpload(files: Express.Multer.File[], eventId: number = 1): Promise<void> {
    console.log(`🚀 PROCESANDO ${files.length} FOTOS SUBIDAS MANUALMENTE`);
    console.log('═'.repeat(70));

    let processedCount = 0;
    let successfulPhotos = 0;
    let totalDorsalsFound = 0;

    for (const file of files) {
      try {
        console.log(`\n📸 Procesando ${processedCount + 1}/${files.length}: ${file.originalname}`);

        // Create photo record
        const photoData = {
          eventId,
          filename: file.originalname,
          originalPath: file.path,
          detectedDorsals: [],
          faces: [],
          processed: false,
          processingStatus: 'pending' as const
        };

        const photo = await storage.createPhoto(photoData);

        // Process with Google Vision OCR
        const googleVisionProcessor = new GoogleVisionOCRProcessor(getCloudStorage());
        const ocrResult = await googleVisionProcessor.processImage(file.path);

        // Detección facial real — antes este flujo dejaba `faces: []` y la búsqueda
        // por selfie nunca encontraba caras en estas fotos.
        let detectedFaces: Awaited<ReturnType<GoogleVisionOCRProcessor['detectFacesFromBuffer']>> = [];
        try {
          const fsSync = await import('fs');
          if (fsSync.existsSync(file.path)) {
            const buffer = fsSync.readFileSync(file.path);
            detectedFaces = await googleVisionProcessor.detectFacesFromBuffer(buffer);
            console.log(`👤 [FACE] Photo ${photo.id}: ${detectedFaces.length} face(s) detected (manual-upload)`);
          }
        } catch (faceErr) {
          console.warn(`⚠️ [FACE] No se pudieron detectar caras para photo ${photo.id}:`, faceErr);
        }

        if (ocrResult.dorsalNumbers.length > 0) {
          // Generate thumbnail
          const thumbnailPath = await imageService.generateThumbnail(file.path, file.originalname);

          // Update photo with results (incluyendo caras detectadas)
          await storage.updatePhoto(photo.id, {
            detectedDorsals: ocrResult.dorsalNumbers,
            faces: detectedFaces,
            thumbnailPath,
            processed: true,
            processingStatus: 'completed'
          });

          totalDorsalsFound += ocrResult.dorsalNumbers.length;
          successfulPhotos++;

          console.log(`✅ Detectados ${ocrResult.dorsalNumbers.length} dorsales: [${ocrResult.dorsalNumbers.join(', ')}]`);
        } else {
          await storage.updatePhoto(photo.id, {
            faces: detectedFaces,
            processed: true,
            processingStatus: 'no_dorsals_found'
          });

          console.log(`❌ Sin dorsales detectados (pero ${detectedFaces.length} cara(s) guardadas)`);
        }

        processedCount++;

      } catch (error) {
        console.error(`❌ Error procesando ${file.originalname}:`, error);
        processedCount++;
      }
    }

    // Final summary
    console.log('\n🎉 CARGA COMPLETADA');
    console.log('═'.repeat(50));
    console.log(`✅ Fotos procesadas: ${processedCount}/${files.length}`);
    console.log(`🏆 Fotos con dorsales: ${successfulPhotos}`);
    console.log(`🎯 Total dorsales detectados: ${totalDorsalsFound}`);
    console.log(`📊 Promedio dorsales/foto: ${(totalDorsalsFound/successfulPhotos || 0).toFixed(1)}`);
    console.log(`⚡ Tasa de éxito: ${Math.round(successfulPhotos/processedCount*100)}%`);
  }
}

export const manualUploadProcessor = new ManualUploadProcessor();

// Export multer configuration for use in routes
export { bulkUpload };