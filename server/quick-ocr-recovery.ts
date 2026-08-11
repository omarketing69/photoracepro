import { getCloudStorage } from './cloud-storage';
import { db } from './db';
import { photos } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function quickOCRRecovery() {
  const cloudStorage = getCloudStorage();
  const bucket = cloudStorage.storage.bucket('REDACTED_GCS_BUCKET');
  
  console.log('🚀 QUICK OCR RECOVERY: Recuperando dorsales detectados...');
  
  try {
    // Get sample of participant files to verify structure
    const [participantFiles] = await bucket.getFiles({ 
      prefix: 'eventos/1/participantes/',
      maxResults: 50
    });
    
    const jsonFiles = participantFiles.filter(file => file.name.endsWith('/fotos.json'));
    console.log(`📁 Muestra de archivos: ${jsonFiles.length}`);
    
    let processed = 0;
    
    for (const file of jsonFiles) {
      try {
        const [content] = await file.download();
        const data = JSON.parse(content.toString());
        
        if (data.fotos && data.fotos.length > 0) {
          const dorsalMatch = file.name.match(/dorsal_(\d+)/);
          const dorsal = dorsalMatch ? parseInt(dorsalMatch[1]) : null;
          
          if (dorsal) {
            console.log(`📸 Dorsal ${dorsal}: ${data.fotos.length} fotos`);
            
            // Update each photo with this dorsal
            for (const fotoPath of data.fotos) {
              const filename = fotoPath.split('/').pop();
              if (filename) {
                await db.update(photos)
                  .set({ 
                    detectedDorsals: [dorsal],
                    processed: true,
                    processingStatus: 'completed'
                  })
                  .where(eq(photos.filename, filename));
                
                processed++;
              }
            }
          }
        }
      } catch (error) {
        console.log(`❌ Error: ${error.message}`);
      }
    }
    
    console.log(`✅ QUICK RECOVERY COMPLETE: ${processed} fotos actualizadas`);
    
  } catch (error) {
    console.error('❌ Error en quick recovery:', error);
  }
}

quickOCRRecovery().catch(console.error);