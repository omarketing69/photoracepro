import { getCloudStorage } from './cloud-storage';
import { storage } from './storage';
import sharp from 'sharp';

interface ThumbnailGenerationResult {
  eventId: number;
  generated: number;
  failed: number;
  errors: string[];
}

/**
 * Generate missing thumbnails for specific events
 * Uses canonical path: eventos/{eventId}/miniaturas/{filename}
 */
export async function generateMissingThumbnailsForEvent(eventId: number): Promise<ThumbnailGenerationResult> {
  console.log(`🎯 Starting thumbnail generation for event ${eventId}`);
  
  const result: ThumbnailGenerationResult = {
    eventId,
    generated: 0,
    failed: 0,
    errors: []
  };
  
  try {
    const cloudStorage = getCloudStorage();
    
    // Get all photos for this event
    const photos = await storage.getPhotos(eventId);
    console.log(`📊 Found ${photos.length} photos in event ${eventId}`);
    
    if (photos.length === 0) {
      console.log(`⚠️ No photos found for event ${eventId}`);
      return result;
    }
    
    // Filter photos that need thumbnails (no thumbnailPath or thumbnailPath doesn't exist)
    const photosNeedingThumbnails = photos.filter(photo => 
      !photo.thumbnailPath || 
      photo.thumbnailPath === '' ||
      photo.thumbnailPath === null
    );
    
    console.log(`🔍 ${photosNeedingThumbnails.length} photos need thumbnails in event ${eventId}`);
    
    // Process each photo
    for (const photo of photosNeedingThumbnails) {
      try {
        console.log(`🔨 Generating thumbnail for photo ${photo.id}: ${photo.filename}`);
        
        // Try to find the original photo in various paths
        const originalPaths = [
          photo.originalPath,
          `eventos/${eventId}/originales/${photo.filename}`,
          photo.webPath
        ].filter(Boolean);
        
        let originalBuffer: Buffer | null = null;
        let usedPath = '';
        
        // Try each path until we find the original
        for (const originalPath of originalPaths) {
          try {
            console.log(`  🔍 Checking original: ${originalPath}`);
            const originalUrl = await cloudStorage.generateSignedUrl(originalPath, 5);
            
            const response = await fetch(originalUrl);
            if (response.ok) {
              originalBuffer = Buffer.from(await response.arrayBuffer());
              usedPath = originalPath;
              console.log(`  ✅ Found original at: ${originalPath}`);
              break;
            }
          } catch (pathError) {
            console.log(`  ❌ Original path failed: ${originalPath}:`, pathError.message);
          }
        }
        
        if (!originalBuffer) {
          const error = `No original found for photo ${photo.id}: ${photo.filename}`;
          console.log(`  ❌ ${error}`);
          result.errors.push(error);
          result.failed++;
          continue;
        }
        
        // Generate 200x200 thumbnail using Sharp
        console.log(`  🖼️ Generating 200x200 thumbnail...`);
        const thumbnailBuffer = await sharp(originalBuffer)
          .resize(200, 200, {
            fit: 'cover',
            position: 'center'
          })
          .jpeg({ 
            quality: 80, 
            progressive: true,
            mozjpeg: true 
          })
          .toBuffer();
          
        console.log(`  ✅ Generated thumbnail: ${thumbnailBuffer.length} bytes`);
        
        // Upload thumbnail to canonical path: eventos/{eventId}/miniaturas/{filename}
        const thumbnailPath = await cloudStorage.uploadThumbnail(eventId, photo.filename, thumbnailBuffer);
        console.log(`  ☁️ Uploaded thumbnail to: ${thumbnailPath}`);
        
        // Update database with thumbnail path
        await storage.updatePhoto(photo.id, { 
          thumbnailPath: thumbnailPath
        });
        
        console.log(`  💾 Updated database for photo ${photo.id}`);
        console.log(`  🎉 SUCCESS: Thumbnail generated for ${photo.filename}`);
        result.generated++;
        
        // Add small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (photoError) {
        const error = `Failed to generate thumbnail for photo ${photo.id}: ${photoError.message}`;
        console.error(`  ❌ ${error}`);
        result.errors.push(error);
        result.failed++;
      }
    }
    
    console.log(`🎉 COMPLETED event ${eventId}: ${result.generated} generated, ${result.failed} failed`);
    return result;
    
  } catch (error) {
    console.error(`❌ Fatal error generating thumbnails for event ${eventId}:`, error);
    result.errors.push(`Fatal error: ${error.message}`);
    return result;
  }
}

/**
 * Generate missing thumbnails for multiple events
 */
export async function generateMissingThumbnailsForEvents(eventIds: number[]): Promise<ThumbnailGenerationResult[]> {
  console.log(`🚀 Starting batch thumbnail generation for events: ${eventIds.join(', ')}`);
  
  const results: ThumbnailGenerationResult[] = [];
  
  for (const eventId of eventIds) {
    const result = await generateMissingThumbnailsForEvent(eventId);
    results.push(result);
    
    // Add delay between events to avoid system overload
    if (eventIds.indexOf(eventId) < eventIds.length - 1) {
      console.log(`⏳ Waiting 2 seconds before processing next event...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Summary
  const totalGenerated = results.reduce((sum, r) => sum + r.generated, 0);
  const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
  const totalErrors = results.flatMap(r => r.errors);
  
  console.log(`🏁 BATCH COMPLETE: ${totalGenerated} generated, ${totalFailed} failed`);
  if (totalErrors.length > 0) {
    console.log(`❌ Errors encountered:`);
    totalErrors.forEach(error => console.log(`   - ${error}`));
  }
  
  return results;
}

/**
 * Fix Event 5's nested thumbnail structure by copying to canonical path
 */
export async function fixEvent5ThumbnailStructure(): Promise<void> {
  console.log(`🔧 Fixing Event 5 thumbnail structure...`);
  
  try {
    const cloudStorage = getCloudStorage();
    const photos = await storage.getPhotos(5);
    
    console.log(`📊 Found ${photos.length} photos in Event 5`);
    
    for (const photo of photos) {
      try {
        // Check if thumbnail is in nested path
        const nestedPath = `eventos/5/miniaturas/eventos/5/${photo.filename}`;
        const canonicalPath = `eventos/5/miniaturas/${photo.filename}`;
        
        // Try to get the nested thumbnail
        try {
          const nestedUrl = await cloudStorage.generateSignedUrl(nestedPath, 5);
          const response = await fetch(nestedUrl);
          
          if (response.ok) {
            const thumbnailBuffer = Buffer.from(await response.arrayBuffer());
            
            // Upload to canonical path
            await cloudStorage.uploadThumbnail(5, photo.filename, thumbnailBuffer);
            
            // Update database
            await storage.updatePhoto(photo.id, { 
              thumbnailPath: canonicalPath
            });
            
            console.log(`✅ Fixed: ${photo.filename} -> ${canonicalPath}`);
          }
        } catch (nestedError) {
          // If nested doesn't exist, skip
          console.log(`⚠️ No nested thumbnail for: ${photo.filename}`);
        }
        
      } catch (photoError) {
        console.error(`❌ Error fixing photo ${photo.id}:`, photoError.message);
      }
    }
    
    console.log(`🎉 Event 5 thumbnail structure fix completed`);
    
  } catch (error) {
    console.error(`❌ Fatal error fixing Event 5 structure:`, error);
  }
}