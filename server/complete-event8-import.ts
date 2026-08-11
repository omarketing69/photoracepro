import { CloudPhotoStorage } from './cloud-storage.js';
import { db } from './db.js';
import { photos } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

// Obtener configuración de GCS
const gcsConfig = {
  projectId: 'REDACTED_GCS_PROJECT',
  bucketName: 'REDACTED_GCS_BUCKET'
};

const cloudStorage = new CloudPhotoStorage(gcsConfig);

async function completeEvent8Import() {
  console.log('🔄 CRISIS COMERCIAL: Iniciando importación completa Event 8...');
  
  try {
    // 1. Obtener todos los archivos disponibles en GCS
    console.log('📁 Listando archivos en Google Cloud Storage...');
    const allCloudFiles = await cloudStorage.listEventFiles(8, 'originales');
    console.log(`📊 Total archivos en GCS: ${allCloudFiles.length}`);
    
    // 2. Obtener archivos ya importados en BD
    console.log('🔍 Verificando archivos ya importados...');
    const existingPhotos = await db.select({ filename: photos.filename })
      .from(photos)
      .where(eq(photos.eventId, 8));
    
    const existingFilenames = new Set(existingPhotos.map(p => p.filename));
    console.log(`✅ Archivos ya importados: ${existingFilenames.size}`);
    
    // 3. Identificar archivos faltantes
    const missingFiles = allCloudFiles.filter(file => !existingFilenames.has(file));
    console.log(`❌ Archivos pendientes: ${missingFiles.length}`);
    
    // 4. Generar SQL para archivos faltantes
    console.log('🔧 Generando SQL para importación...');
    
    let sqlStatements = [];
    missingFiles.forEach(filename => {
      const sql = `(8, '${filename}', 'eventos/8/originales/${filename}', 'eventos/8/web/${filename}', 'eventos/8/miniaturas/${filename}', '[]', '[]', true, 'completed', NOW(), NOW())`;
      sqlStatements.push(sql);
    });
    
    // 5. Dividir en batches de 50 fotos
    const batchSize = 50;
    const batches = [];
    for (let i = 0; i < sqlStatements.length; i += batchSize) {
      batches.push(sqlStatements.slice(i, i + batchSize));
    }
    
    console.log(`📦 Total batches a procesar: ${batches.length}`);
    
    // 6. Generar archivos SQL para cada batch
    for (let i = 0; i < batches.length; i++) {
      const batchNumber = i + 1;
      const batchSQL = `INSERT INTO photos (event_id, filename, original_path, web_path, thumbnail_path, detected_dorsals, faces, processed, processing_status, uploaded_at, processed_at) VALUES 
${batches[i].join(',\n')};`;
      
      console.log(`📝 Batch ${batchNumber}/${batches.length}: ${batches[i].length} fotos`);
      console.log('---START SQL---');
      console.log(batchSQL);
      console.log('---END SQL---\n');
    }
    
    console.log('✅ SQL generado. Listo para ejecutar con execute_sql_tool');
    
  } catch (error) {
    console.error('❌ Error durante importación:', error);
    throw error;
  }
}

// Ejecutar
completeEvent8Import().catch(console.error);