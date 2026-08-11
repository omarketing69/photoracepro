import { getCloudStorage } from './cloud-storage';
import { db } from './db';
import { photos } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function recoverOCRData() {
  const cloudStorage = getCloudStorage();
  const bucket = cloudStorage.storage.bucket('REDACTED_GCS_BUCKET');
  
  console.log('🔍 Recuperando datos de OCR desde Google Cloud Storage...');
  
  // Get all participant folders
  const [participantFiles] = await bucket.getFiles({ prefix: 'eventos/1/participantes/' });
  const jsonFiles = participantFiles.filter(file => file.name.endsWith('/fotos.json'));
  
  console.log(`📁 Archivos de participantes encontrados: ${jsonFiles.length}`);
  
  let processedCount = 0;
  let updatedPhotos = 0;
  
  for (const file of jsonFiles) {
    try {
      const [content] = await file.download();
      const data = JSON.parse(content.toString());
      
      if (data.fotos && data.fotos.length > 0) {
        // Extract dorsal from path: eventos/1/participantes/dorsal_1234/fotos.json
        const dorsalMatch = file.name.match(/dorsal_(\d+)/);
        const dorsal = dorsalMatch ? parseInt(dorsalMatch[1]) : null;
        
        if (dorsal) {
          console.log(`📸 Dorsal ${dorsal}: ${data.fotos.length} fotos`);
          
          // Update photos with this dorsal
          for (const fotoPath of data.fotos) {
            const filename = fotoPath.split('/').pop();
            if (filename) {
              const result = await db.update(photos)
                .set({ 
                  detectedDorsals: [dorsal],
                  processed: true,
                  processingStatus: 'completed'
                })
                .where(eq(photos.filename, filename));
              
              updatedPhotos++;
            }
          }
          
          processedCount++;
          if (processedCount % 100 === 0) {
            console.log(`✅ Procesados ${processedCount} dorsales, ${updatedPhotos} fotos actualizadas...`);
          }
        }
      }
    } catch (error) {
      console.log(`❌ Error procesando ${file.name}: ${error.message}`);
    }
  }
  
  console.log(`🎉 OCR DATA RECOVERY COMPLETE: ${processedCount} dorsales recuperados, ${updatedPhotos} fotos actualizadas`);
}

recoverOCRData().catch(console.error);