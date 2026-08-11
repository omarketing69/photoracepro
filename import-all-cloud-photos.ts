import { getCloudStorage } from './server/cloud-storage';
import { db } from './server/db';
import { photos } from './shared/schema';
import { FilenameDorsalExtractor } from './server/filename-dorsal-extractor';
import { eq } from 'drizzle-orm';

async function importAllCloudPhotos() {
  console.log('🔄 Importando TODAS las fotos reales desde Google Cloud Storage...');
  
  try {
    const cloudStorage = getCloudStorage();
    const dorsalExtractor = new FilenameDorsalExtractor();
    
    // Acceder directamente al bucket de Google Cloud Storage
    const storage = cloudStorage['storage'];
    const bucketName = cloudStorage['bucketName'];
    const bucket = storage.bucket(bucketName);
    
    // Obtener todos los archivos de eventos/1/originales/
    const [files] = await bucket.getFiles({ prefix: 'eventos/1/originales/' });
    console.log(`📁 Encontrados ${files.length} archivos en eventos/1/originales/`);
    
    let imported = 0;
    let skipped = 0;
    let processed = 0;
    
    // Procesar en lotes de 100 para evitar problemas de memoria
    const batchSize = 100;
    const totalBatches = Math.ceil(files.length / batchSize);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIndex = batchIndex * batchSize;
      const endIndex = Math.min(startIndex + batchSize, files.length);
      const batch = files.slice(startIndex, endIndex);
      
      console.log(`📦 Procesando lote ${batchIndex + 1}/${totalBatches} (${batch.length} archivos)...`);
      
      for (const file of batch) {
        processed++;
        
        if (!file.name || !file.name.match(/\.(jpg|jpeg|png)$/i)) {
          continue;
        }
        
        const filename = file.name.split('/').pop();
        if (!filename) continue;
        
        // Verificar si ya existe
        const existingPhotos = await db.select().from(photos).where(eq(photos.filename, filename)).limit(1);
        if (existingPhotos.length > 0) {
          skipped++;
          continue;
        }
        
        // Extraer dorsales del nombre del archivo
        const detectedDorsals = dorsalExtractor.extractFromFilename(filename);
        
        // Insertar en la base de datos
        await db.insert(photos).values({
          eventId: 1,
          filename: filename,
          originalPath: `eventos/1/originales/${filename}`,
          webPath: `eventos/1/web/${filename}`,
          thumbnailPath: `eventos/1/miniaturas/eventos/1/${filename}`,
          detectedDorsals: detectedDorsals,
          faces: [],
          processed: true,
          processingStatus: 'completed',
          uploadedAt: new Date('2025-01-15T10:00:00Z'),
          processedAt: new Date('2025-01-15T11:00:00Z')
        });
        
        imported++;
        
        if (imported % 50 === 0) {
          console.log(`📊 Progreso: ${imported} fotos importadas, ${skipped} omitidas...`);
        }
      }
      
      // Pausa entre lotes para evitar sobrecarga
      if (batchIndex < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`✅ Importación masiva completada:`);
    console.log(`   📸 ${imported} fotos importadas`);
    console.log(`   ⏭️ ${skipped} fotos ya existían`);
    console.log(`   📁 ${processed} archivos procesados`);
    console.log(`   🎯 Event 1 ahora tiene acceso completo a todas las fotos de Google Cloud Storage`);
    
    return { imported, skipped, processed, total: files.length };
    
  } catch (error) {
    console.error('❌ Error importando fotos masivas:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

importAllCloudPhotos().catch(console.error);