import { getCloudStorage } from './cloud-storage';
import { db } from './db';
import { photos } from '../shared/schema';

async function emergencyRecovery() {
  const cloudStorage = getCloudStorage();
  const bucket = cloudStorage.storage.bucket('REDACTED_GCS_BUCKET');
  
  console.log('🚨 EMERGENCY RECOVERY: Recuperando todas las fotos...');
  
  try {
    // Get all original files from all events
    const [files] = await bucket.getFiles({ prefix: 'eventos/' });
    const originalFiles = files.filter(file => file.name.includes('/originales/') && file.name.endsWith('.jpg'));
    
    console.log(`📸 Encontradas ${originalFiles.length} fotos originales en Google Cloud Storage`);
    
    // Process in batches of 100 to avoid timeouts
    const batchSize = 100;
    let recovered = 0;
    
    for (let i = 0; i < originalFiles.length; i += batchSize) {
      const batch = originalFiles.slice(i, i + batchSize);
      
      const photoData = batch.map(file => {
        const filename = file.name.split('/').pop()!;
        const eventMatch = file.name.match(/eventos\/(\d+)\//);
        const eventId = eventMatch ? parseInt(eventMatch[1]) : 1;
        
        return {
          eventId,
          filename,
          originalPath: file.name,
          webPath: file.name.replace('/originales/', '/web/'),
          thumbnailPath: file.name.replace('/originales/', '/miniaturas/'),
          detectedDorsals: [],
          faces: [],
          processed: false,
          processingStatus: 'pending' as const
        };
      });
      
      await db.insert(photos).values(photoData).onConflictDoNothing();
      recovered += batch.length;
      
      console.log(`✅ Batch ${Math.ceil(i/batchSize) + 1}: Recuperadas ${recovered}/${originalFiles.length} fotos`);
    }
    
    console.log(`🎉 RECOVERY COMPLETE: ${recovered} fotos recuperadas exitosamente`);
    
  } catch (error) {
    console.error('❌ Error en recovery:', error);
  }
}

// Run immediately
emergencyRecovery().catch(console.error);