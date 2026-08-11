import { getCloudStorage } from './cloud-storage';
import { db } from './db';
import { photos } from '../shared/schema';
import { eq } from 'drizzle-orm';

/**
 * FUNCIÓN CRÍTICA: Importación directa de 898 fotos del evento 8
 * Problema: Usuario pagó $1.35 por OCR que detectó 376 dorsales pero fotos no están en BD
 * Solución: Importar todas las fotos de eventos/8/originales/ a la base de datos
 */
export async function importEvent8Photos() {
  console.log('🚨 INICIANDO IMPORTACIÓN CRÍTICA - Evento 8 (898 fotos)');
  
  const cloudStorage = getCloudStorage();
  const bucket = cloudStorage.storage.bucket('REDACTED_GCS_BUCKET');
  
  let importedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  
  try {
    console.log('📋 Obteniendo lista de fotos de eventos/8/originales/...');
    
    // Obtener todas las fotos del evento 8 desde Google Cloud Storage
    const [originalFiles] = await bucket.getFiles({ 
      prefix: 'eventos/8/originales/',
      maxResults: 1000 // Suficiente para 898 fotos
    });
    
    console.log(`📸 Encontradas ${originalFiles.length} fotos en Google Cloud Storage`);
    
    if (originalFiles.length === 0) {
      console.log('⚠️ No se encontraron fotos en eventos/8/originales/');
      return {
        success: false,
        message: 'No se encontraron fotos en eventos/8/originales/',
        importedCount: 0,
        skippedCount: 0,
        errorCount: 0
      };
    }
    
    // Procesar cada foto
    for (const file of originalFiles) {
      const fullPath = file.name; // e.g., "eventos/8/originales/photo123.jpg"
      const filename = fullPath.split('/').pop(); // e.g., "photo123.jpg"
      
      // Validar que sea una imagen
      if (!filename || !filename.match(/\.(jpg|jpeg|png|tiff|gif)$/i)) {
        console.log(`⏭️ Saltando archivo no imagen: ${filename}`);
        continue;
      }
      
      try {
        // Verificar si la foto ya existe en la base de datos
        const existingPhoto = await db.query.photos.findFirst({
          where: (photos, { eq, and }) => and(
            eq(photos.eventId, 8),
            eq(photos.filename, filename)
          )
        });
        
        if (existingPhoto) {
          console.log(`⏭️ Foto ya existe: ${filename}`);
          skippedCount++;
          continue;
        }
        
        // Crear rutas para las diferentes versiones
        const originalPath = fullPath; // "eventos/8/originales/photo123.jpg"
        const webPath = fullPath.replace('/originales/', '/web/'); // "eventos/8/web/photo123.jpg"
        const thumbnailPath = fullPath.replace('/originales/', '/miniaturas/'); // "eventos/8/miniaturas/photo123.jpg"
        
        // Insertar foto en la base de datos
        await db.insert(photos).values({
          eventId: 8, // EVENTO 8 CRÍTICO
          filename: filename,
          originalPath: originalPath,
          webPath: webPath,
          thumbnailPath: thumbnailPath,
          detectedDorsals: [], // Vacío por ahora, OCR los llenará después
          faces: [],
          processed: true, // Marcar como procesada para que aparezca
          processingStatus: 'completed', // Completada para importación
          uploadedAt: new Date(),
          processedAt: new Date()
        });
        
        importedCount++;
        
        // Log de progreso cada 50 fotos
        if (importedCount % 50 === 0) {
          console.log(`📈 Progreso: ${importedCount} fotos importadas...`);
        }
        
      } catch (error) {
        console.error(`❌ Error importando ${filename}:`, error);
        errorCount++;
      }
    }
    
    // Resumen final
    console.log('🎉 IMPORTACIÓN COMPLETADA');
    console.log(`✅ Fotos importadas: ${importedCount}`);
    console.log(`⏭️ Fotos saltadas (ya existían): ${skippedCount}`);
    console.log(`❌ Errores: ${errorCount}`);
    
    // Verificar total en base de datos
    const totalPhotosEvent8 = await db.query.photos.findMany({
      where: (photos, { eq }) => eq(photos.eventId, 8)
    });
    
    console.log(`📊 Total fotos evento 8 en BD: ${totalPhotosEvent8.length}`);
    
    return {
      success: true,
      message: `Importación exitosa: ${importedCount} fotos importadas`,
      importedCount,
      skippedCount,
      errorCount,
      totalInDatabase: totalPhotosEvent8.length
    };
    
  } catch (error) {
    console.error('❌ ERROR CRÍTICO en importación:', error);
    return {
      success: false,
      message: `Error en importación: ${error.message}`,
      importedCount,
      skippedCount,
      errorCount
    };
  }
}

// Permitir ejecución directa
if (import.meta.main) {
  importEvent8Photos()
    .then(result => {
      console.log('📋 RESULTADO FINAL:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 ERROR FATAL:', error);
      process.exit(1);
    });
}