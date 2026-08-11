import { getCloudStorage } from './cloud-storage';
import { db } from './db';
import { photos } from '../shared/schema';
import { FilenameDorsalExtractor } from './filename-dorsal-extractor';
import { eq } from 'drizzle-orm';

export async function importCloudPhotosToEvent7() {
  console.log('🔄 Importando fotos desde Google Cloud Storage eventos/1/ al Event 7...');
  
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
    
    for (const file of files) {
      const filename = file.name.split('/').pop();
      if (!filename || !filename.match(/\.(jpg|jpeg|png)$/i)) continue;
      
      // Verificar si ya existe en la base de datos
      const [existing] = await db
        .select()
        .from(photos)
        .where(eq(photos.filename, filename))
        .limit(1);
        
      if (existing) {
        skipped++;
        if (skipped % 100 === 0) {
          console.log(`⏭️ Omitidas ${skipped} fotos duplicadas...`);
        }
        continue;
      }
      
      // Extraer dorsales del nombre del archivo
      const detectedDorsals = dorsalExtractor.extractFromFilename(filename);
      
      // Insertar en la base de datos para Event 7
      await db.insert(photos).values({
        eventId: 7, // Event 7 = "Media Maratón del Oriente 2024" restaurado
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
      
      if (imported % 100 === 0) {
        console.log(`📊 Progreso: ${imported} fotos importadas...`);
      }
    }
    
    console.log(`✅ Importación completada: ${imported} fotos importadas, ${skipped} omitidas`);
    console.log(`📈 Event 7 ahora tiene acceso a ${imported} fotos desde Google Cloud Storage`);
    
    return { imported, skipped, total: files.length };
    
  } catch (error) {
    console.error('❌ Error importando fotos desde Google Cloud Storage:', error);
    throw error;
  }
}