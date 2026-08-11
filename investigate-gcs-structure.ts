import { CloudPhotoStorage } from './server/cloud-storage.js';
import { db } from './server/db.js';
import { photos } from './shared/schema.js';
import { eq } from 'drizzle-orm';

// Initialize cloud storage
const gcsConfig = {
  projectId: 'REDACTED_GCS_PROJECT',
  bucketName: 'REDACTED_GCS_BUCKET'
};

const cloudStorage = new CloudPhotoStorage(gcsConfig);

async function investigateGCSStructure() {
  console.log('🔍 INVESTIGACIÓN CRÍTICA: Estructura de Google Cloud Storage vs Base de Datos');
  console.log('═'.repeat(80));
  
  try {
    // 1. Lista todos los eventos disponibles en GCS
    console.log('\n📁 PASO 1: Listando todos los eventos en Google Cloud Storage...');
    const allEventFolders = await cloudStorage.listAllEventFolders();
    console.log(`✅ Eventos encontrados en GCS: ${allEventFolders.length}`);
    console.log('Eventos:', allEventFolders.sort((a, b) => a - b));
    
    // 2. Para cada evento encontrado, listar subcarpetas
    console.log('\n📂 PASO 2: Investigando estructura de carpetas por evento...');
    for (const eventId of allEventFolders.sort((a, b) => a - b)) {
      console.log(`\n📋 Evento ${eventId}:`);
      
      try {
        // Listar originales
        const originales = await cloudStorage.listEventFiles(eventId, 'originales');
        console.log(`  📸 Originales: ${originales.length} archivos`);
        if (originales.length > 0) {
          console.log(`      Ejemplo: ${originales[0]}`);
          console.log(`      Último: ${originales[originales.length - 1]}`);
        }
        
        // Listar web
        try {
          const web = await cloudStorage.listEventFiles(eventId, 'web');
          console.log(`  🌐 Web: ${web.length} archivos`);
        } catch (e) {
          console.log(`  🌐 Web: carpeta no existe`);
        }
        
        // Listar thumbnails
        try {
          const thumbnails = await cloudStorage.listEventFiles(eventId, 'miniaturas');
          console.log(`  🖼️  Miniaturas: ${thumbnails.length} archivos`);
        } catch (e) {
          console.log(`  🖼️  Miniaturas: carpeta no existe`);
        }
        
      } catch (error) {
        console.log(`  ❌ Error listando evento ${eventId}: ${error.message}`);
      }
    }
    
    // 3. Analizar base de datos para evento 6 (problemático)
    console.log('\n🔍 PASO 3: Analizando Event 6 en base de datos...');
    const event6Photos = await db.select({
      id: photos.id,
      filename: photos.filename,
      originalPath: photos.originalPath,
      processed: photos.processed,
      processingStatus: photos.processingStatus
    })
    .from(photos)
    .where(eq(photos.eventId, 6))
    .limit(10);
    
    console.log(`📊 Event 6 en BD: ${event6Photos.length} fotos (mostrando primeras 10)`);
    event6Photos.forEach((photo, i) => {
      console.log(`  ${i + 1}. ${photo.filename}`);
      console.log(`     Path: ${photo.originalPath}`);
      console.log(`     Status: ${photo.processed ? '✅' : '❌'} ${photo.processingStatus}`);
    });
    
    // 4. Comparar con evento 1 (funcional)
    console.log('\n✅ PASO 4: Comparando con Event 1 (funcional)...');
    const event1Photos = await db.select({
      id: photos.id,
      filename: photos.filename,
      originalPath: photos.originalPath,
      processed: photos.processed,
      processingStatus: photos.processingStatus
    })
    .from(photos)
    .where(eq(photos.eventId, 1))
    .limit(5);
    
    console.log(`📊 Event 1 en BD: ${event1Photos.length} fotos (mostrando primeras 5)`);
    event1Photos.forEach((photo, i) => {
      console.log(`  ${i + 1}. ${photo.filename}`);
      console.log(`     Path: ${photo.originalPath}`);
      console.log(`     Status: ${photo.processed ? '✅' : '❌'} ${photo.processingStatus}`);
    });
    
    // 5. Intentar listar directamente las carpetas problemáticas
    console.log('\n🔍 PASO 5: Verificando existencia de carpetas específicas...');
    
    // Verificar eventos/8/originales (donde debería estar Event 6)
    try {
      const event8Originales = await cloudStorage.listEventFiles(8, 'originales');
      console.log(`📁 eventos/8/originales: ${event8Originales.length} archivos`);
      if (event8Originales.length > 0) {
        console.log(`  Primeros 3: ${event8Originales.slice(0, 3).join(', ')}`);
      }
    } catch (error) {
      console.log(`❌ eventos/8/originales: ${error.message}`);
    }
    
    // Verificar eventos/6/originales (donde podría estar realmente)
    try {
      const event6Originales = await cloudStorage.listEventFiles(6, 'originales');
      console.log(`📁 eventos/6/originales: ${event6Originales.length} archivos`);
      if (event6Originales.length > 0) {
        console.log(`  Primeros 3: ${event6Originales.slice(0, 3).join(', ')}`);
      }
    } catch (error) {
      console.log(`❌ eventos/6/originales: ${error.message}`);
    }
    
    // 6. Contar total de fotos por evento en BD
    console.log('\n📊 PASO 6: Conteo total de fotos por evento en BD...');
    const photoCounts = await db.select({
      eventId: photos.eventId,
      count: db.raw('COUNT(*)')
    })
    .from(photos)
    .groupBy(photos.eventId)
    .orderBy(photos.eventId);
    
    console.log('Fotos por evento en base de datos:');
    photoCounts.forEach(({ eventId, count }) => {
      console.log(`  Evento ${eventId}: ${count} fotos`);
    });
    
    console.log('\n🎯 INVESTIGACIÓN COMPLETADA');
    console.log('═'.repeat(80));
    
  } catch (error) {
    console.error('❌ Error durante investigación:', error);
    throw error;
  }
}

// Ejecutar investigación
investigateGCSStructure().catch(console.error);