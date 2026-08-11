import { GoogleVisionOCRProcessor } from './google-vision-ocr';
import { Storage } from '@google-cloud/storage';
import path from 'path';
import fs from 'fs';

export async function massReprocessEvent5() {
  console.log('🔄 REPROCESAMIENTO MASIVO EVENTO 5');
  console.log('═'.repeat(60));

  const eventId = 5;
  let processed = 0;
  let dorsalsFound = new Set<number>();

  try {
    // Google Cloud Storage
    const cloudStorage = new Storage({
      projectId: 'REDACTED_GCS_PROJECT',
      keyFilename: './google-credentials.json'
    });
    const bucket = cloudStorage.bucket('REDACTED_GCS_BUCKET');

    console.log('📂 Obteniendo todas las fotos para reprocesamiento...');
    const [files] = await bucket.getFiles({
      prefix: `eventos/${eventId}/originales/`,
      maxResults: 200 // Procesar 200 fotos para mejorar significativamente
    });

    const photoFiles = files.filter(file => 
      file.name.match(/\.(jpg|jpeg|png)$/i) && 
      !file.name.endsWith('/')
    );

    console.log(`📊 ${photoFiles.length} fotos para reprocesar`);

    const googleVisionProcessor = new GoogleVisionOCRProcessor();

    // Procesar en lotes
    for (let i = 0; i < Math.min(photoFiles.length, 200); i++) {
      const file = photoFiles[i];
      const filename = path.basename(file.name);

      try {
        console.log(`\n🔄 ${i + 1}/200: ${filename}`);

        // Descargar imagen
        const tempPath = `/tmp/mass-${Date.now()}-${filename}`;
        const [content] = await file.download();
        fs.writeFileSync(tempPath, content);

        // OCR con filtros mejorados (30%)
        const ocrResult = await googleVisionProcessor.processImage(tempPath);
        
        if (ocrResult.dorsalNumbers.length > 0) {
          ocrResult.dorsalNumbers.forEach(dorsal => dorsalsFound.add(dorsal));
          console.log(`✅ [${ocrResult.dorsalNumbers.join(', ')}]`);
        } else {
          console.log(`⚪ Sin dorsales`);
        }

        // Limpiar archivo temporal
        fs.unlinkSync(tempPath);
        processed++;

        // Pausa cada 50 fotos para evitar límites de API
        if (processed % 50 === 0) {
          console.log(`\n⏸️ PROGRESO: ${processed}/200`);
          console.log(`🎯 Dorsales únicos: ${dorsalsFound.size}`);
          console.log(`📈 Efectividad: ${Math.round(dorsalsFound.size / processed * 100)}%`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

      } catch (error) {
        console.error(`❌ Error con ${filename}: ${error}`);
        processed++;
      }
    }

    // Estadísticas finales
    const finalEffectiveness = Math.round(dorsalsFound.size / processed * 100);
    const sortedDorsals = Array.from(dorsalsFound).sort((a, b) => a - b);

    console.log('\n🎉 REPROCESAMIENTO MASIVO COMPLETADO');
    console.log('═'.repeat(60));
    console.log(`✅ Fotos procesadas: ${processed}/200`);
    console.log(`🎯 Dorsales únicos detectados: ${dorsalsFound.size}`);
    console.log(`📈 Efectividad final: ${finalEffectiveness}%`);
    console.log(`📋 Rango de dorsales: ${sortedDorsals[0]} - ${sortedDorsals[sortedDorsals.length - 1]}`);
    console.log(`📝 Muestra: [${sortedDorsals.slice(0, 20).join(', ')}...]`);

    // Proyección para las 500 fotos
    const estimatedTotal = Math.round((dorsalsFound.size / processed) * 500);
    console.log(`\n🎯 PROYECCIÓN PARA 500 FOTOS TOTALES:`);
    console.log(`📊 Dorsales únicos estimados: ${estimatedTotal}`);
    console.log(`📈 Mejora vs antes: ${estimatedTotal - 72} dorsales adicionales`);

    return {
      processed,
      dorsalsFound: dorsalsFound.size,
      effectiveness: finalEffectiveness,
      estimatedTotal,
      dorsalsList: sortedDorsals
    };

  } catch (error) {
    console.error('❌ Error en reprocesamiento masivo:', error);
    return null;
  }
}