import { getCloudStorage } from './cloud-storage';
import { db } from './db';
import { photos } from '../shared/schema';
import { eq } from 'drizzle-orm';
import * as fs from 'fs';
import { GoogleVisionOCRProcessor } from './google-vision-ocr';

export async function syncCloudPhotos() {
  const cloudStorage = getCloudStorage();
  const bucket = cloudStorage.storage.bucket('REDACTED_GCS_BUCKET');
  const ocrProcessor = new GoogleVisionOCRProcessor(cloudStorage);
  
  console.log('Synchronizing photos from Google Cloud Storage...');
  
  // Get all files from eventos/1/originales/
  const [originalFiles] = await bucket.getFiles({ prefix: 'eventos/1/originales/' });
  
  console.log(`Found ${originalFiles.length} original files in Google Cloud Storage`);
  
  for (const file of originalFiles) {
    const filename = file.name.split('/').pop();
    if (!filename || !filename.endsWith('.jpg')) continue;
    
    // Check if photo already exists in database
    const existingPhoto = await db.query.photos.findFirst({
      where: (photos, { eq }) => eq(photos.filename, filename)
    });
    
    if (existingPhoto) {
      console.log(`Photo ${filename} already exists in database`);
      continue;
    }
    
    // Process with OCR to detect dorsals
    console.log(`Processing ${filename} with OCR...`);
    
    try {
      // Download file temporarily for OCR
      const tempPath = `/tmp/${filename}`;
      await file.download({ destination: tempPath });
      
      // Run OCR
      const dorsals = await ocrProcessor.detectDorsals(tempPath);
      
      // Insert into database
      await db.insert(photos).values({
        eventId: 7, // Nuevo Event ID restaurado
        filename: filename,
        originalPath: `eventos/1/originales/${filename}`,
        webPath: `eventos/1/web/${filename}`,
        thumbnailPath: `eventos/1/miniaturas/eventos/1/${filename}`,
        detectedDorsals: dorsals,
        faces: [],
        processed: true,
        processingStatus: 'completed'
      });
      
      console.log(`✅ Restored ${filename} with ${dorsals.length} dorsals: ${dorsals.join(', ')}`);
      
      // Clean up temp file
      require('fs').unlinkSync(tempPath);
      
    } catch (error) {
      console.error(`Error processing ${filename}:`, error);
    }
  }
  
  console.log('Photo synchronization completed!');
}

// Run if called directly
if (import.meta.main) {
  syncCloudPhotos().catch(console.error);
}