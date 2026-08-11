import { getCloudStorage } from './cloud-storage';
import { storage } from './storage';

/**
 * Restaurar las fotos originales que funcionaban en el estado anterior
 * Solo registrar sin volver a procesar OCR
 */
export async function restoreOriginalPhotos(): Promise<void> {
  try {
    console.log('🔄 Restaurando fotos originales desde Google Cloud Storage...');
    
    const cloudStorage = getCloudStorage();
    const bucket = cloudStorage.storage.bucket(cloudStorage.bucketName);
    
    // Buscar fotos en todos los eventos
    const [allFiles] = await bucket.getFiles({
      prefix: 'eventos/',
    });
    
    // Agrupar por evento
    const photosByEvent = new Map<number, string[]>();
    
    for (const file of allFiles) {
      if (file.name.includes('/originales/') && 
          (file.name.endsWith('.jpg') || file.name.endsWith('.jpeg') || file.name.endsWith('.png'))) {
        
        const eventMatch = file.name.match(/eventos\/(\d+)\//);
        if (eventMatch) {
          const eventId = parseInt(eventMatch[1]);
          if (!photosByEvent.has(eventId)) {
            photosByEvent.set(eventId, []);
          }
          photosByEvent.get(eventId)!.push(file.name);
        }
      }
    }
    
    console.log(`📊 Fotos encontradas por evento:`);
    for (const [eventId, photos] of photosByEvent.entries()) {
      console.log(`   Evento ${eventId}: ${photos.length} fotos`);
    }
    
    // Trabajar con el evento que tenga más fotos
    let mainEventId = 1;
    let maxPhotos = 0;
    for (const [eventId, photos] of photosByEvent.entries()) {
      if (photos.length > maxPhotos) {
        maxPhotos = photos.length;
        mainEventId = eventId;
      }
    }
    
    console.log(`🎯 Usando evento ${mainEventId} con ${maxPhotos} fotos`);
    
    const mainPhotos = photosByEvent.get(mainEventId) || [];
    let registered = 0;
    
    // Registrar fotos básicas sin OCR
    for (const photoPath of mainPhotos) {
      try {
        const filename = photoPath.split('/').pop();
        if (!filename) continue;
        
        // Verificar si ya existe
        const existingPhotos = await storage.getPhotos(mainEventId);
        const existingPhoto = existingPhotos.find(p => p.filename === filename);
        
        if (existingPhoto) {
          console.log(`⏭️  Ya existe: ${filename}`);
          continue;
        }
        
        // Crear registro básico
        const webPath = photoPath.replace('/originales/', '/web/');
        const thumbnailPath = photoPath.replace('/originales/', '/miniaturas/');
        
        await storage.createPhoto({
          eventId: mainEventId,
          filename,
          originalPath: photoPath,
          webPath,
          thumbnailPath,
          detectedDorsals: [], // Sin dorsales por ahora
          faces: [],
          processed: false,
          processingStatus: 'pending',
        });
        
        registered++;
        console.log(`✅ Registrada: ${filename}`);
        
      } catch (error) {
        console.error(`❌ Error registrando ${photoPath}:`, error);
      }
    }
    
    console.log(`\n🎉 Restauración completada:`);
    console.log(`   📊 Evento principal: ${mainEventId}`);
    console.log(`   ✅ Fotos registradas: ${registered}`);
    console.log(`   📁 Total fotos encontradas: ${maxPhotos}`);
    
  } catch (error) {
    console.error('💥 Error en restauración:', error);
    throw error;
  }
}

// Ejecutar restauración
restoreOriginalPhotos().then(() => {
  console.log('Restauración completada');
  process.exit(0);
}).catch(error => {
  console.error('Error:', error);
  process.exit(1);
});