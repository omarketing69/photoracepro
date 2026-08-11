import { storage } from './storage';
import { GoogleVisionOCRProcessor } from './google-vision-ocr';
import { Storage } from '@google-cloud/storage';
import path from 'path';
import fs from 'fs';

export async function fixEvent5Sync() {
  console.log('🚀 REPARANDO SINCRONIZACIÓN EVENTO 5 - FOTOS REALES');
  console.log('═'.repeat(60));

  const eventId = 5;
  let processed = 0;
  let saved = 0;
  let withDorsals = 0;

  try {
    // Acceso directo a Google Cloud Storage
    const cloudStorage = new Storage({
      projectId: 'REDACTED_GCS_PROJECT',
      keyFilename: './google-credentials.json'
    });
    const bucket = cloudStorage.bucket('REDACTED_GCS_BUCKET');

    console.log('📂 Listando fotos reales en Google Cloud Storage...');
    const [files] = await bucket.getFiles({
      prefix: `eventos/${eventId}/originales/`,
      maxResults: 100 // Empezar con 100 para probar
    });

    const photoFiles = files.filter(file => 
      file.name.match(/\.(jpg|jpeg|png|tiff)$/i) && 
      !file.name.endsWith('/') &&
      !file.name.includes('sample_photo') // Ignorar fotos de ejemplo
    );

    console.log(`📊 ${photoFiles.length} fotos reales encontradas`);

    const googleVisionProcessor = new GoogleVisionOCRProcessor();

    // Procesar en lotes pequeños
    for (let i = 0; i < Math.min(photoFiles.length, 50); i++) {
      const file = photoFiles[i];
      const filename = path.basename(file.name);

      try {
        console.log(`\n📸 ${i + 1}/50: ${filename}`);

        // Verificar si ya existe en el evento específico
        const existingQuery = `SELECT id FROM photos WHERE filename = $1 AND event_id = $2`;
        let existing;
        try {
          const db = storage.db;
          const result = await db.execute({ sql: existingQuery, args: [filename, eventId] });
          existing = result.rows.length > 0;
        } catch (e) {
          existing = false;
        }
        
        if (existing) {
          console.log(`⏭️ Ya existe en BD`);
          processed++;
          continue;
        }

        // Descargar y procesar
        const tempPath = `/tmp/${Date.now()}-${filename}`;
        try {
          const [content] = await file.download();
          fs.writeFileSync(tempPath, content);

          // OCR mejorado
          const ocrResult = await googleVisionProcessor.processImage(tempPath);
          
          // Crear registro en BD
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
            console.log(`✅ Guardado con ${ocrResult.dorsalNumbers.length} dorsales: [${ocrResult.dorsalNumbers.join(', ')}]`);
          } else {
            console.log(`💾 Guardado sin dorsales`);
          }

        } finally {
          if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
          }
        }

        processed++;

        // Pausa entre fotos
        if (processed % 10 === 0) {
          console.log(`\n⏸️ Pausa - Procesadas ${processed}/50`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        console.error(`❌ Error con ${filename}:`, error);
        processed++;
      }
    }

    console.log('\n🎉 SINCRONIZACIÓN COMPLETADA');
    console.log('═'.repeat(60));
    console.log(`✅ Procesadas: ${processed}/50`);
    console.log(`💾 Guardadas en BD: ${saved}`);
    console.log(`🎯 Con dorsales: ${withDorsals}`);
    console.log(`📊 Tasa éxito: ${Math.round(withDorsals/saved*100)}%`);

  } catch (error) {
    console.error('❌ Error en sincronización:', error);
  }
}

export async function runFixSync() {
  await fixEvent5Sync();
}