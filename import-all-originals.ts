import { getCloudStorage } from './server/cloud-storage';
import { db } from './server/db';
import { photos } from './shared/schema';
import { FilenameDorsalExtractor } from './server/filename-dorsal-extractor';
import { eq } from 'drizzle-orm';

async function importAllOriginalPhotos() {
  console.log('🔄 Importando TODAS las fotos de eventos/1/originales/ (incluyendo las no organizadas)...');
  
  try {
    const cloudStorage = getCloudStorage();
    const dorsalExtractor = new FilenameDorsalExtractor();
    
    // Acceder directamente al bucket
    const storage = cloudStorage['storage'];
    const bucketName = cloudStorage['bucketName'];
    const bucket = storage.bucket(bucketName);
    
    // Obtener TODOS los archivos de eventos/1/originales/ sin filtros
    console.log('🔍 Obteniendo todos los archivos de eventos/1/originales/...');
    const [allFiles] = await bucket.getFiles({ prefix: 'eventos/1/originales/' });
    
    console.log(`📁 Total archivos encontrados: ${allFiles.length}`);
    
    let imported = 0;
    let skipped = 0;
    let processed = 0;
    
    // Filtrar solo archivos de imagen
    const imageFiles = allFiles.filter(file => {
      const filename = file.name.split('/').pop();
      return filename && filename.match(/\.(jpg|jpeg|png)$/i);
    });
    
    console.log(`📸 Archivos de imagen válidos: ${imageFiles.length}`);
    
    // Procesar en lotes de 50 para no sobrecargar la base de datos
    const batchSize = 50;
    const totalBatches = Math.ceil(imageFiles.length / batchSize);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIndex = batchIndex * batchSize;
      const endIndex = Math.min(startIndex + batchSize, imageFiles.length);
      const batch = imageFiles.slice(startIndex, endIndex);
      
      console.log(`📦 Lote ${batchIndex + 1}/${totalBatches}: procesando ${batch.length} archivos...`);
      
      for (const file of batch) {
        processed++;
        
        const filename = file.name.split('/').pop();
        if (!filename) continue;
        
        // Verificar si ya existe en la base de datos
        const [existing] = await db
          .select()
          .from(photos)
          .where(eq(photos.filename, filename))
          .limit(1);
          
        if (existing) {
          skipped++;
          continue;
        }
        
        // Extraer dorsales del nombre del archivo (sin OCR costoso)
        const dorsalFromFilename = dorsalExtractor.extractDorsalFromFilename(filename);
        const detectedDorsals = dorsalFromFilename ? [dorsalFromFilename] : [];
        
        // Insertar foto con datos basados en el filename
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
        
        imported++;
        
        if (imported % 25 === 0) {
          console.log(`📊 Progreso: ${imported} importadas, ${skipped} ya existían...`);
        }
      }
      
      // Pausa entre lotes
      if (batchIndex < totalBatches - 1) {
        console.log(`⏸️ Pausa entre lotes... (${imported} importadas hasta ahora)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log(`\n✅ IMPORTACIÓN MASIVA COMPLETADA:`);
    console.log(`   📸 ${imported} fotos nuevas importadas`);
    console.log(`   ⏭️ ${skipped} fotos ya existían`);
    console.log(`   📁 ${processed} archivos procesados de ${imageFiles.length} totales`);
    console.log(`   🎯 Event 1 ahora tiene acceso a ${imported + skipped} fotos totales`);
    console.log(`   💰 Método: Extracción de dorsals por filename (sin OCR costoso)`);
    
    // Verificar el resultado final
    const [finalCount] = await db.select().from(photos).where(eq(photos.eventId, 1));
    console.log(`\n📊 Total final de fotos en Event 1: ${finalCount.length || 'N/A'}`);
    
    return { imported, skipped, processed, totalFiles: imageFiles.length };
    
  } catch (error) {
    console.error('❌ Error importando todas las fotos originales:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

importAllOriginalPhotos().catch(console.error);