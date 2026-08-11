import { getCloudStorage } from './server/cloud-storage';
import { db } from './server/db';
import { photos } from './shared/schema';
import { eq } from 'drizzle-orm';

async function importProcessedPhotos() {
  console.log('🔄 Importando fotos YA PROCESADAS desde Google Cloud Storage (sin OCR adicional)...');
  
  try {
    const cloudStorage = getCloudStorage();
    
    // Acceder directamente al bucket
    const storage = cloudStorage['storage'];
    const bucketName = cloudStorage['bucketName'];
    const bucket = storage.bucket(bucketName);
    
    // Obtener archivos JSON que contienen resultados de OCR ya procesados
    console.log('🔍 Buscando archivos JSON con OCR ya procesado...');
    const [jsonFiles] = await bucket.getFiles({ prefix: 'eventos/1/participantes/' });
    
    let totalPhotosImported = 0;
    let totalDorsalsFound = 0;
    
    console.log(`📁 Encontrados ${jsonFiles.length} archivos de participantes procesados`);
    
    for (const jsonFile of jsonFiles) {
      if (!jsonFile.name.endsWith('/fotos.json')) continue;
      
      try {
        // Extraer dorsal del path: eventos/1/participantes/dorsal_1234/fotos.json
        const dorsalMatch = jsonFile.name.match(/dorsal_(\d+)/);
        if (!dorsalMatch) continue;
        
        const dorsal = parseInt(dorsalMatch[1]);
        
        // Descargar y parsear el JSON
        const [content] = await jsonFile.download();
        const photosData = JSON.parse(content.toString());
        
        if (!Array.isArray(photosData) || photosData.length === 0) continue;
        
        console.log(`📋 Dorsal ${dorsal}: ${photosData.length} fotos encontradas`);
        totalDorsalsFound++;
        
        // Importar cada foto con sus datos de OCR ya procesados
        for (const photoData of photosData) {
          const filename = photoData.filename || `dorsal-${dorsal}-${Date.now()}.jpg`;
          
          // Verificar si ya existe
          const existing = await db.select().from(photos).where(eq(photos.filename, filename)).limit(1);
          if (existing.length > 0) continue;
          
          // Insertar con OCR ya procesado (sin costos adicionales)
          await db.insert(photos).values({
            eventId: 1,
            filename: filename,
            originalPath: photoData.originalPath || `eventos/1/originales/${filename}`,
            webPath: photoData.webPath || `eventos/1/web/${filename}`,
            thumbnailPath: photoData.thumbnailPath || `eventos/1/miniaturas/eventos/1/${filename}`,
            detectedDorsals: [dorsal], // OCR ya procesado previamente
            faces: photoData.faces || [],
            processed: true,
            processingStatus: 'completed',
            uploadedAt: new Date(photoData.uploadedAt || '2025-01-15T10:00:00Z'),
            processedAt: new Date(photoData.processedAt || '2025-01-15T11:00:00Z')
          });
          
          totalPhotosImported++;
        }
        
      } catch (error) {
        console.error(`❌ Error procesando ${jsonFile.name}:`, error);
      }
    }
    
    // También importar fotos originales que no estén en participantes pero existan en originales
    console.log('🔍 Importando fotos adicionales de eventos/1/originales/...');
    const [originalFiles] = await bucket.getFiles({ prefix: 'eventos/1/originales/' });
    
    let additionalPhotos = 0;
    for (const file of originalFiles) {
      const filename = file.name.split('/').pop();
      if (!filename || !filename.match(/\.(jpg|jpeg|png)$/i)) continue;
      
      // Verificar si ya existe
      const existing = await db.select().from(photos).where(eq(photos.filename, filename)).limit(1);
      if (existing.length > 0) continue;
      
      // Extraer dorsal del filename si es posible (sin OCR costoso)
      const dorsalMatch = filename.match(/(\d{3,4})/);
      const detectedDorsals = dorsalMatch ? [parseInt(dorsalMatch[1])] : [];
      
      await db.insert(photos).values({
        eventId: 1,
        filename: filename,
        originalPath: `eventos/1/originales/${filename}`,
        webPath: `eventos/1/web/${filename}`,
        thumbnailPath: `eventos/1/miniaturas/eventos/1/${filename}`,
        detectedDorsals: detectedDorsals,
        faces: [],
        processed: detectedDorsals.length > 0,
        processingStatus: detectedDorsals.length > 0 ? 'completed' : 'pending',
        uploadedAt: new Date('2025-01-15T10:00:00Z'),
        processedAt: detectedDorsals.length > 0 ? new Date('2025-01-15T11:00:00Z') : null
      });
      
      additionalPhotos++;
      
      if (additionalPhotos % 100 === 0) {
        console.log(`📊 ${additionalPhotos} fotos adicionales importadas...`);
      }
    }
    
    console.log(`✅ IMPORTACIÓN MASIVA COMPLETADA:`);
    console.log(`   📸 ${totalPhotosImported} fotos con OCR procesado importadas`);
    console.log(`   📸 ${additionalPhotos} fotos adicionales importadas`);
    console.log(`   🎯 ${totalDorsalsFound} dorsals únicos con OCR ya procesado`);
    console.log(`   💰 CERO costos adicionales de OCR - usando datos ya procesados`);
    
    return { 
      processedPhotos: totalPhotosImported, 
      additionalPhotos, 
      totalDorsals: totalDorsalsFound,
      total: totalPhotosImported + additionalPhotos 
    };
    
  } catch (error) {
    console.error('❌ Error importando fotos procesadas:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

importProcessedPhotos().catch(console.error);