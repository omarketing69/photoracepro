import { GoogleVisionOCRProcessor } from './google-vision-ocr';
import { getCloudStorage } from './cloud-storage';
import { Storage } from '@google-cloud/storage';
import { storage } from './storage';
import path from 'path';
import fs from 'fs';

export async function simpleSyncEvent5() {
  console.log('🚀 SINCRONIZACIÓN SIMPLE EVENTO 5');
  console.log('═'.repeat(50));

  const eventId = 5;
  let processed = 0;
  let saved = 0;
  let withDorsals = 0;

  try {
    // Google Cloud Storage
    const cloudStorage = new Storage({
      projectId: 'REDACTED_GCS_PROJECT',
      keyFilename: './google-credentials.json'
    });
    const bucket = cloudStorage.bucket('REDACTED_GCS_BUCKET');

    console.log('📂 Listando fotos...');
    const [files] = await bucket.getFiles({
      prefix: `eventos/${eventId}/originales/`,
      maxResults: 20 // Solo 20 para probar
    });

    const photoFiles = files.filter(file => 
      file.name.match(/\.(jpg|jpeg|png)$/i) && 
      !file.name.endsWith('/')
    );

    console.log(`📊 ${photoFiles.length} fotos encontradas`);

    const googleVisionProcessor = new GoogleVisionOCRProcessor(getCloudStorage());

    for (let i = 0; i < Math.min(photoFiles.length, 20); i++) {
      const file = photoFiles[i];
      const filename = path.basename(file.name);

      try {
        console.log(`\n📸 ${i + 1}: ${filename}`);

        // Verificar si existe directamente
        const existingPhoto = await storage.getPhotoByFilename(filename);
        if (existingPhoto && existingPhoto.eventId === eventId) {
          console.log(`⏭️ Existe`);
          processed++;
          continue;
        }

        // Descargar imagen
        const tempPath = `/tmp/${Date.now()}-${filename}`;
        const [content] = await file.download();
        fs.writeFileSync(tempPath, content);

        // OCR
        const ocrResult = await googleVisionProcessor.processImage(tempPath);
        
        // Crear en BD usando el storage principal
        const photoData = {
          eventId,
          filename,
          originalPath: file.name,
          webPath: file.name.replace('/originales/', '/web/'),
          thumbnailPath: file.name.replace('/originales/', '/miniaturas/'),
          detectedDorsals: ocrResult.dorsalNumbers,
          faces: [],
          processed: true,
          processingStatus: ocrResult.dorsalNumbers.length > 0 ? 'completed' as const : 'no_dorsals_found' as const,
          uploadedAt: new Date(),
          processedAt: new Date()
        };

        await storage.createPhoto(photoData);
        saved++;

        if (ocrResult.dorsalNumbers.length > 0) {
          withDorsals++;
          console.log(`✅ Guardado: ${ocrResult.dorsalNumbers.join(', ')}`);
        } else {
          console.log(`💾 Sin dorsales`);
        }

        // Limpiar
        fs.unlinkSync(tempPath);
        processed++;

      } catch (error) {
        console.error(`❌ Error: ${error}`);
        processed++;
      }
    }

    console.log('\n🎉 COMPLETADO');
    console.log(`✅ Procesadas: ${processed}`);
    console.log(`💾 Guardadas: ${saved}`);
    console.log(`🎯 Con dorsales: ${withDorsals}`);
    console.log(`📊 Éxito: ${Math.round(withDorsals/saved*100)}%`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Se ejecuta desde run-simple-sync.ts