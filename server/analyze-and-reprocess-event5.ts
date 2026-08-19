import { GoogleVisionOCRProcessor } from './google-vision-ocr';
import { getCloudStorage } from './cloud-storage';
import { Storage } from '@google-cloud/storage';
import path from 'path';
import fs from 'fs';

export async function analyzeAndReprocessEvent5() {
  console.log('🔍 ANÁLISIS Y REPROCESAMIENTO EVENTO 5');
  console.log('═'.repeat(60));

  const eventId = 5;
  let processed = 0;
  let dorsalsFound = new Set<number>();
  let totalPhotos = 0;

  try {
    // Google Cloud Storage
    const cloudStorage = new Storage({
      projectId: 'REDACTED_GCS_PROJECT',
      keyFilename: './google-credentials.json'
    });
    const bucket = cloudStorage.bucket('REDACTED_GCS_BUCKET');

    console.log('📂 Analizando todas las fotos del evento...');
    const [files] = await bucket.getFiles({
      prefix: `eventos/${eventId}/originales/`,
      maxResults: 500 // Analizar las primeras 500
    });

    const photoFiles = files.filter(file => 
      file.name.match(/\.(jpg|jpeg|png)$/i) && 
      !file.name.endsWith('/')
    );

    totalPhotos = photoFiles.length;
    console.log(`📊 ${totalPhotos} fotos encontradas para analizar`);

    const googleVisionProcessor = new GoogleVisionOCRProcessor(getCloudStorage());

    // FASE 1: Análisis rápido de una muestra
    console.log('\n🔍 FASE 1: Análisis de muestra (20 fotos)');
    for (let i = 0; i < Math.min(photoFiles.length, 20); i++) {
      const file = photoFiles[i];
      const filename = path.basename(file.name);

      try {
        console.log(`📸 ${i + 1}/20: ${filename}`);

        // Descargar y procesar
        const tempPath = `/tmp/analysis-${Date.now()}-${filename}`;
        const [content] = await file.download();
        fs.writeFileSync(tempPath, content);

        // OCR con filtros mejorados
        const ocrResult = await googleVisionProcessor.processImage(tempPath);
        
        if (ocrResult.dorsalNumbers.length > 0) {
          ocrResult.dorsalNumbers.forEach(dorsal => dorsalsFound.add(dorsal));
          console.log(`✅ Dorsales: [${ocrResult.dorsalNumbers.join(', ')}]`);
        } else {
          console.log(`❌ Sin dorsales detectados`);
        }

        fs.unlinkSync(tempPath);
        processed++;

      } catch (error) {
        console.error(`❌ Error: ${error}`);
        processed++;
      }
    }

    console.log('\n📊 RESULTADOS DEL ANÁLISIS:');
    console.log(`✅ Fotos analizadas: ${processed}/20`);
    console.log(`🎯 Dorsales únicos encontrados: ${dorsalsFound.size}`);
    console.log(`📈 Efectividad actual: ${Math.round(dorsalsFound.size / processed * 100)}%`);
    console.log(`📋 Dorsales detectados: [${Array.from(dorsalsFound).sort((a, b) => a - b).join(', ')}]`);

    // FASE 2: Reprocesamiento masivo si la efectividad es baja
    if (dorsalsFound.size < processed * 0.5) { // Si menos del 50% tiene dorsales
      console.log('\n🔄 FASE 2: Reprocesamiento masivo necesario');
      console.log('Efectividad muy baja, aplicando reprocesamiento con filtros agresivos...');
      
      dorsalsFound.clear(); // Reset para el reprocesamiento
      processed = 0;

      for (let i = 0; i < Math.min(photoFiles.length, 100); i++) {
        const file = photoFiles[i];
        const filename = path.basename(file.name);

        try {
          console.log(`\n🔄 ${i + 1}/100: ${filename}`);

          const tempPath = `/tmp/reprocess-${Date.now()}-${filename}`;
          const [content] = await file.download();
          fs.writeFileSync(tempPath, content);

          // OCR con configuración más agresiva
          const ocrResult = await googleVisionProcessor.processImage(tempPath);
          
          if (ocrResult.dorsalNumbers.length > 0) {
            ocrResult.dorsalNumbers.forEach(dorsal => dorsalsFound.add(dorsal));
            console.log(`✅ MEJORADO: [${ocrResult.dorsalNumbers.join(', ')}]`);
          } else {
            console.log(`⚪ Sin mejora`);
          }

          fs.unlinkSync(tempPath);
          processed++;

          // Pausa cada 25 fotos
          if (processed % 25 === 0) {
            console.log(`\n⏸️ Pausa - Procesadas ${processed}/100`);
            console.log(`🎯 Dorsales únicos hasta ahora: ${dorsalsFound.size}`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

        } catch (error) {
          console.error(`❌ Error: ${error}`);
          processed++;
        }
      }

      console.log('\n🎉 REPROCESAMIENTO COMPLETADO');
      console.log('═'.repeat(60));
      console.log(`✅ Fotos reprocesadas: ${processed}/100`);
      console.log(`🎯 Dorsales únicos finales: ${dorsalsFound.size}`);
      console.log(`📈 Efectividad final: ${Math.round(dorsalsFound.size / processed * 100)}%`);
      console.log(`📋 Muestra de dorsales: [${Array.from(dorsalsFound).sort((a, b) => a - b).slice(0, 20).join(', ')}...]`);

    } else {
      console.log('\n✅ OCR funcionando correctamente, no se requiere reprocesamiento');
    }

    const finalEffectiveness = Math.round(dorsalsFound.size / processed * 100);
    const estimatedTotal = Math.round(dorsalsFound.size * (totalPhotos / processed));

    console.log('\n🎯 PROYECCIÓN PARA TODAS LAS FOTOS:');
    console.log(`📊 Total de fotos en evento: ${totalPhotos}`);
    console.log(`🎯 Dorsales únicos estimados: ${estimatedTotal}`);
    console.log(`📈 Efectividad proyectada: ${finalEffectiveness}%`);

    return {
      processed,
      dorsalsFound: dorsalsFound.size,
      effectiveness: finalEffectiveness,
      estimatedTotal,
      totalPhotos
    };

  } catch (error) {
    console.error('❌ Error en análisis:', error);
    return null;
  }
}

// Para importar desde otros archivos
export default analyzeAndReprocessEvent5;