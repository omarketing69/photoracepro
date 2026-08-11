import fs from 'fs';
import path from 'path';
import { db } from './db';
import { photos } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { GoogleVisionOCRProcessor } from './google-vision-ocr';

export async function processExistingPhotos(eventId: number) {
  console.log(`🔄 Iniciando procesamiento de fotos existentes para evento ${eventId}`);
  
  try {
    // Obtener todas las fotos no procesadas
    const unprocessedPhotos = await db
      .select()
      .from(photos)
      .where(eq(photos.eventId, eventId));
    
    console.log(`📸 Encontradas ${unprocessedPhotos.length} fotos para procesar`);
    
    const googleVisionProcessor = new GoogleVisionOCRProcessor();
    let processedCount = 0;
    let failedCount = 0;
    
    for (const photo of unprocessedPhotos) {
      try {
        console.log(`🔍 Procesando: ${photo.filename}`);
        
        // Verificar si el archivo existe
        const imagePath = path.join(process.cwd(), photo.originalPath);
        if (!fs.existsSync(imagePath)) {
          console.log(`❌ Archivo no encontrado: ${imagePath}`);
          failedCount++;
          continue;
        }
        
        // Procesar con Google Vision OCR
        const ocrResult = await googleVisionProcessor.processImage(imagePath);
        
        // Actualizar base de datos
        await db
          .update(photos)
          .set({
            detectedDorsals: ocrResult.dorsalNumbers,
            processed: true,
            processingStatus: 'completed',
            processedAt: new Date()
          })
          .where(eq(photos.id, photo.id));
        
        console.log(`✅ ${photo.filename}: ${ocrResult.dorsalNumbers.length} dorsales detectados [${ocrResult.dorsalNumbers.join(', ')}]`);
        processedCount++;
        
      } catch (error) {
        console.error(`❌ Error procesando ${photo.filename}:`, error);
        
        // Marcar como fallida
        await db
          .update(photos)
          .set({
            processingStatus: 'failed',
            processedAt: new Date()
          })
          .where(eq(photos.id, photo.id));
        
        failedCount++;
      }
    }
    
    console.log(`📊 Procesamiento completado: ${processedCount} exitosas, ${failedCount} fallidas`);
    
    return {
      success: true,
      processed: processedCount,
      failed: failedCount,
      total: unprocessedPhotos.length
    };
    
  } catch (error) {
    console.error('❌ Error general en procesamiento:', error);
    throw error;
  }
}