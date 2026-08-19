import { getCloudStorage } from './cloud-storage';
import { storage } from './storage';
import { GoogleVisionOCRProcessor } from './google-vision-ocr';
import { Storage } from '@google-cloud/storage';
import path from 'path';
import fs from 'fs';

export async function syncAndProcessEvent5() {
  console.log('🚀 INICIANDO SINCRONIZACIÓN Y PROCESAMIENTO DEL EVENTO 5');
  console.log('📅 Carrera de la Rama Judicial - con OCR MEJORADO');
  console.log('═'.repeat(70));

  const eventId = 5;
  let processedCount = 0;
  let successfulOCR = 0;
  let totalDorsalsFound = 0;

  try {
    // 1. Obtener lista de fotos de Google Cloud Storage
    const cloudStorageService = new Storage({
      projectId: 'REDACTED_GCS_PROJECT',
      keyFilename: './google-credentials.json'
    });
    const bucket = cloudStorageService.bucket('REDACTED_GCS_BUCKET');
    
    console.log('📂 Buscando fotos en Google Cloud Storage...');
    const [files] = await bucket.getFiles({
      prefix: `eventos/${eventId}/originales/`,
      maxResults: 1000
    });

    const photoFiles = files.filter(file => 
      file.name.match(/\.(jpg|jpeg|png|tiff)$/i) && 
      !file.name.endsWith('/')
    );

    console.log(`📊 Encontradas ${photoFiles.length} fotos en Google Cloud Storage`);

    if (photoFiles.length === 0) {
      console.log('❌ No se encontraron fotos para procesar');
      return;
    }

    // 2. Inicializar OCR mejorado
    const cloudStorage = getCloudStorage();
    const googleVisionProcessor = new GoogleVisionOCRProcessor(cloudStorage);
    console.log('✅ OCR mejorado inicializado (filtros relajados)');

    // 3. Procesar cada foto
    for (const file of photoFiles) {
      try {
        const filename = path.basename(file.name);
        console.log(`\n📸 Procesando ${processedCount + 1}/${photoFiles.length}: ${filename}`);

        // Verificar si ya existe en la base de datos
        const existingPhoto = await storage.getPhotoByFilename(filename);
        const existsInDB = existingPhoto !== undefined;

        if (existsInDB) {
          console.log(`⏭️ Foto ya existe en BD: ${filename}`);
          processedCount++;
          continue;
        }

        // Crear archivo temporal para OCR
        const tempFilePath = `/tmp/${Date.now()}-${filename}`;
        
        try {
          // Descargar foto desde Google Cloud Storage
          const [content] = await file.download();
          fs.writeFileSync(tempFilePath, content);

          // Procesar con OCR mejorado
          console.log(`🔍 Aplicando OCR mejorado...`);
          const ocrStart = Date.now();
          const ocrResult = await googleVisionProcessor.processImage(tempFilePath);
          const ocrTime = Date.now() - ocrStart;

          // Crear registro en la base de datos
          const photoData = {
            eventId,
            filename,
            originalPath: file.name, // Ruta en Google Cloud Storage
            webPath: file.name.replace('/originales/', '/web/'),
            thumbnailPath: file.name.replace('/originales/', '/miniaturas/'),
            detectedDorsals: ocrResult.dorsalNumbers,
            faces: [],
            processed: true,
            processingStatus: ocrResult.dorsalNumbers.length > 0 ? 'completed' as const : 'no_dorsals_found' as const,
            uploadedAt: new Date(),
            processedAt: new Date()
          };

          const photo = await storage.createPhoto(photoData);
          
          if (ocrResult.dorsalNumbers.length > 0) {
            successfulOCR++;
            totalDorsalsFound += ocrResult.dorsalNumbers.length;
            console.log(`✅ ${ocrResult.dorsalNumbers.length} dorsales detectados: [${ocrResult.dorsalNumbers.join(', ')}] (${ocrTime}ms)`);
          } else {
            console.log(`❌ Sin dorsales detectados (${ocrTime}ms)`);
          }

        } catch (error) {
          console.error(`❌ Error procesando ${filename}:`, error);
        } finally {
          // Limpiar archivo temporal
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
          }
        }

        processedCount++;

        // Esperar un poco entre fotos para no sobrecargar
        if (processedCount % 10 === 0) {
          console.log(`\n⏸️ Pausa técnica - Procesadas ${processedCount}/${photoFiles.length} fotos`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

      } catch (error) {
        console.error(`❌ Error general con foto ${file.name}:`, error);
        processedCount++;
      }
    }

    // 4. Resumen final
    console.log('\n🎉 PROCESAMIENTO COMPLETADO');
    console.log('═'.repeat(70));
    console.log(`✅ Fotos procesadas: ${processedCount}/${photoFiles.length}`);
    console.log(`🎯 Fotos con dorsales detectados: ${successfulOCR}`);
    console.log(`🏆 Total dorsales encontrados: ${totalDorsalsFound}`);
    console.log(`📊 Promedio dorsales/foto exitosa: ${(totalDorsalsFound/successfulOCR || 0).toFixed(1)}`);
    console.log(`⚡ Tasa de éxito OCR: ${Math.round(successfulOCR/processedCount*100)}%`);

    // 5. Actualizar contadores del evento
    const photos = await storage.getPhotos(eventId);
    console.log(`\n📈 RESULTADO FINAL:`);
    console.log(`📊 Total fotos en BD: ${photos.length}`);
    console.log(`🎯 Fotos con dorsales: ${photos.filter(p => p.detectedDorsals && p.detectedDorsals.length > 0).length}`);

  } catch (error) {
    console.error('❌ Error durante sincronización:', error);
  }
}

// Función para ejecutar desde endpoint
export async function runSyncAndProcess() {
  await syncAndProcessEvent5();
}