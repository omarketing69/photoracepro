import { getCloudStorage } from './cloud-storage';
import { db } from './db';
import { photos } from '../shared/schema';
import { eq } from 'drizzle-orm';
import * as fs from 'fs';
import { GoogleVisionOCRProcessor } from './google-vision-ocr';

export async function syncEvent8Photos() {
  const cloudStorage = getCloudStorage();
  const bucket = cloudStorage.storage.bucket('REDACTED_GCS_BUCKET');
  const ocrProcessor = new GoogleVisionOCRProcessor();
  
  console.log('🔄 Synchronizing Event 8 photos from Google Cloud Storage...');
  
  // Get all files from eventos/8/originales/
  const [originalFiles] = await bucket.getFiles({ prefix: 'eventos/8/originales/' });
  
  console.log(`📁 Found ${originalFiles.length} original files in Google Cloud Storage for Event 8`);
  
  let synchronized = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const file of originalFiles) {
    const filename = file.name.split('/').pop();
    if (!filename || !(/\.(jpe?g|png|webp)$/i.test(filename))) continue;
    
    try {
      // Check if photo already exists in database
      const existingPhoto = await db.query.photos.findFirst({
        where: (photos, { eq, and }) => and(
          eq(photos.filename, filename),
          eq(photos.eventId, 8)
        )
      });
      
      if (existingPhoto) {
        console.log(`⏭️ Photo ${filename} already exists in database`);
        skipped++;
        continue;
      }
      
      // Insert into database without OCR processing (OCR se ejecutará después)
      await db.insert(photos).values({
        eventId: 8,
        filename: filename,
        originalPath: `eventos/8/originales/${filename}`,
        webPath: `eventos/8/web/${filename}`,
        thumbnailPath: `/api/cloud-images/8/miniaturas/${filename}`,
        detectedDorsals: [], // Será actualizado por el OCR posterior
        faces: [],
        processed: false, // Será marcado como true cuando el OCR procese
        processingStatus: 'pending'
      });
      
      console.log(`✅ Registered ${filename} in database`);
      synchronized++;
      
    } catch (error) {
      console.error(`❌ Error registering ${filename}:`, error);
      errors++;
    }
  }
  
  console.log(`🎉 Event 8 photo synchronization completed!`);
  console.log(`📊 Results: ${synchronized} synchronized, ${skipped} skipped, ${errors} errors`);
  
  return {
    synchronized,
    skipped,
    errors,
    total: originalFiles.length
  };
}

// Run if called directly
if (import.meta.main) {
  syncEvent8Photos().catch(console.error);
}