import { CloudPhotoStorage, getCloudStorage } from './cloud-storage';
import { GoogleVisionOCRProcessor } from './google-vision-ocr';
import { storage } from './storage';
import * as fs from 'fs';
import * as path from 'path';

interface ReprocessingProgress {
  totalPhotos: number;
  processedPhotos: number;
  newDorsalsFound: number;
  totalCost: number;
  startTime: number;
  estimatedTimeRemaining: number;
  currentStatus: string;
  isRunning: boolean;
  completedPhotos: Array<{
    filename: string;
    dorsalsFound: number[];
    newDorsals: number[];
  }>;
}

// In-memory progress tracking (could be moved to database for persistence)
const reprocessingProgress: Map<number, ReprocessingProgress> = new Map();

const COST_PER_PHOTO = 0.0015; // $0.0015 per Google Vision API call

/**
 * Main function to reprocess all Event 8 photos with new OCR configuration
 */
export async function reprocessEvent8WithNewOCR(): Promise<{ success: boolean; message: string; progressId?: string }> {
  const eventId = 8;
  
  try {
    console.log(`🚀 [OCR REPROCESS] Starting Event 8 OCR reprocessing with new permissive configuration`);
    console.log(`💰 [OCR REPROCESS] Cost: $${COST_PER_PHOTO} per photo`);
    
    // Check if already running
    const existingProgress = reprocessingProgress.get(eventId);
    if (existingProgress?.isRunning) {
      return {
        success: false,
        message: "OCR reprocessing is already running for Event 8"
      };
    }
    
    // Initialize Google Cloud Storage and OCR processor
    const cloudStorage = getCloudStorage();
    const ocrProcessor = new GoogleVisionOCRProcessor(cloudStorage);
    
    // Get all photos from Event 8
    console.log(`🔍 [OCR REPROCESS] Getting all photos for Event 8...`);
    const photos = await storage.getPhotos(eventId);
    
    if (photos.length === 0) {
      return {
        success: false,
        message: "No photos found for Event 8"
      };
    }
    
    console.log(`📊 [OCR REPROCESS] Found ${photos.length} photos in Event 8 database`);
    
    // Initialize progress tracking
    const progressId = `event_${eventId}_${Date.now()}`;
    const progress: ReprocessingProgress = {
      totalPhotos: photos.length,
      processedPhotos: 0,
      newDorsalsFound: 0,
      totalCost: 0,
      startTime: Date.now(),
      estimatedTimeRemaining: 0,
      currentStatus: 'Starting reprocessing...',
      isRunning: true,
      completedPhotos: []
    };
    
    reprocessingProgress.set(eventId, progress);
    
    // Start background processing (don't await to return immediately)
    processPhotosInBackground(eventId, photos, cloudStorage, ocrProcessor, progress);
    
    return {
      success: true,
      message: `OCR reprocessing started for Event 8. Processing ${photos.length} photos with estimated cost: $${(photos.length * COST_PER_PHOTO).toFixed(2)}`,
      progressId: progressId
    };
    
  } catch (error) {
    console.error(`❌ [OCR REPROCESS] Error starting reprocessing:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: `Failed to start OCR reprocessing: ${errorMessage}`
    };
  }
}

/**
 * Background processing function
 */
async function processPhotosInBackground(
  eventId: number,
  photos: any[],
  cloudStorage: CloudPhotoStorage,
  ocrProcessor: GoogleVisionOCRProcessor,
  progress: ReprocessingProgress
) {
  console.log(`🔧 [OCR REPROCESS] Starting background processing of ${photos.length} photos`);
  
  let processedCount = 0;
  let newDorsalsFoundTotal = 0;
  let successfulProcessing = 0;
  let failedProcessing = 0;
  
  // Process photos with rate limiting to avoid overwhelming the API
  const BATCH_SIZE = 5; // Process 5 photos at once
  const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds between batches
  
  try {
    for (let i = 0; i < photos.length; i += BATCH_SIZE) {
      const batch = photos.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(photo => processPhotoWithNewOCR(photo, cloudStorage, ocrProcessor, eventId));
      
      // Process batch
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Update progress for each photo in batch
      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];
        const photo = batch[j];
        processedCount++;
        
        if (result.status === 'fulfilled' && result.value.success) {
          const photoResult = result.value;
          newDorsalsFoundTotal += photoResult.newDorsalsCount;
          successfulProcessing++;
          
          progress.completedPhotos.push({
            filename: photo.filename,
            dorsalsFound: photoResult.allDorsals,
            newDorsals: photoResult.newDorsals
          });
          
          console.log(`✅ [OCR REPROCESS] [${processedCount}/${photos.length}] ${photo.filename}: ${photoResult.newDorsalsCount} new dorsals found`);
        } else {
          failedProcessing++;
          const errorMsg = result.status === 'rejected' 
            ? (result.reason instanceof Error ? result.reason.message : String(result.reason))
            : result.value.error;
          console.error(`❌ [OCR REPROCESS] [${processedCount}/${photos.length}] ${photo.filename}: Failed - ${errorMsg}`);
        }
        
        // Update progress
        const elapsed = Date.now() - progress.startTime;
        const averageTimePerPhoto = elapsed / processedCount;
        const remainingPhotos = photos.length - processedCount;
        
        progress.processedPhotos = processedCount;
        progress.newDorsalsFound = newDorsalsFoundTotal;
        progress.totalCost = processedCount * COST_PER_PHOTO;
        progress.estimatedTimeRemaining = remainingPhotos * averageTimePerPhoto;
        progress.currentStatus = `Processing photo ${processedCount}/${photos.length}: ${photo.filename}`;
        
        // Log progress every 10 photos
        if (processedCount % 10 === 0) {
          const percentage = Math.round((processedCount / photos.length) * 100);
          const costSoFar = (processedCount * COST_PER_PHOTO).toFixed(3);
          const timeRemaining = Math.round(progress.estimatedTimeRemaining / 1000 / 60);
          
          console.log(`📊 [OCR REPROCESS] Progress: ${percentage}% (${processedCount}/${photos.length})`);
          console.log(`🎯 [OCR REPROCESS] New dorsals found: ${newDorsalsFoundTotal}`);
          console.log(`💰 [OCR REPROCESS] Cost so far: $${costSoFar}`);
          console.log(`⏱️ [OCR REPROCESS] Estimated time remaining: ${timeRemaining} minutes`);
          console.log(`✅ Success rate: ${Math.round((successfulProcessing / processedCount) * 100)}%`);
        }
      }
      
      // Rate limiting: wait between batches (except for the last batch)
      if (i + BATCH_SIZE < photos.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }
    
    // Final summary
    const totalTime = Date.now() - progress.startTime;
    const totalCost = photos.length * COST_PER_PHOTO;
    
    progress.isRunning = false;
    progress.currentStatus = 'Completed successfully';
    progress.estimatedTimeRemaining = 0;
    
    console.log(`\n🎉 [OCR REPROCESS] REPROCESSING COMPLETED!`);
    console.log(`═══════════════════════════════════════════`);
    console.log(`📊 Total photos processed: ${processedCount}/${photos.length}`);
    console.log(`✅ Successful: ${successfulProcessing}`);
    console.log(`❌ Failed: ${failedProcessing}`);
    console.log(`🎯 New dorsals detected: ${newDorsalsFoundTotal}`);
    console.log(`💰 Total cost: $${totalCost.toFixed(3)}`);
    console.log(`⏱️ Total time: ${Math.round(totalTime / 1000 / 60)} minutes`);
    console.log(`📈 Average time per photo: ${Math.round(totalTime / photos.length)}ms`);
    
    // Get updated participant count
    try {
      const updatedEvent = await storage.getEvent(eventId);
      console.log(`\n📊 [OCR REPROCESS] COMPARISON RESULTS:`);
      console.log(`BEFORE: 328 dorsals available`);
      console.log(`AFTER: Checking updated dorsals...`);
      
      // This will require checking all dorsals with photos now
      // Could implement a count query here if needed
      
    } catch (error) {
      console.error(`❌ Error getting updated stats:`, error);
    }
    
  } catch (error) {
    console.error(`❌ [OCR REPROCESS] Fatal error during background processing:`, error);
    progress.isRunning = false;
    progress.currentStatus = `Failed: ${error.message}`;
  }
}

/**
 * Process a single photo with new OCR configuration
 */
async function processPhotoWithNewOCR(
  photo: any,
  cloudStorage: CloudPhotoStorage,
  ocrProcessor: GoogleVisionOCRProcessor,
  eventId: number
): Promise<{ success: boolean; newDorsalsCount: number; allDorsals: number[]; newDorsals: number[]; error?: string }> {
  let tempFilePath: string | null = null;
  
  try {
    // Get the original cloud storage path for the photo
    let cloudImagePath = '';
    if (photo.originalPath && photo.originalPath.includes('eventos/')) {
      // Photo is already in cloud storage format
      cloudImagePath = photo.originalPath;
    } else {
      // Construct cloud storage path
      cloudImagePath = `eventos/${eventId}/originales/${photo.filename}`;
    }
    
    console.log(`🔍 [OCR REPROCESS] Processing ${photo.filename} from path: ${cloudImagePath}`);
    
    // Download photo temporarily for OCR processing
    const photoBuffer = await cloudStorage.downloadFile(cloudImagePath);
    
    // Create temporary file
    tempFilePath = path.join('/tmp', `ocr_${Date.now()}_${photo.filename}`);
    fs.writeFileSync(tempFilePath, photoBuffer);
    
    // Store original dorsals for comparison
    const originalDorsals = photo.detectedDorsals || [];
    
    // Process with new Google Vision OCR configuration
    const ocrResult = await ocrProcessor.processImage(tempFilePath);
    
    // Identify truly new dorsals
    const newDorsals = ocrResult.dorsalNumbers.filter(dorsal => 
      !originalDorsals.includes(dorsal)
    );
    
    // Update database with new results (merge with existing dorsals)
    const combinedDorsals = [...originalDorsals, ...ocrResult.dorsalNumbers];
    const allDorsals = Array.from(new Set(combinedDorsals));
    
    if (ocrResult.dorsalNumbers.length > 0) {
      await storage.updatePhoto(photo.id, {
        detectedDorsals: allDorsals,
        processed: true,
        processingStatus: 'completed'
      });
    }
    
    return {
      success: true,
      newDorsalsCount: newDorsals.length,
      allDorsals: allDorsals,
      newDorsals: newDorsals
    };
    
  } catch (error) {
    console.error(`❌ [OCR REPROCESS] Error processing ${photo.filename}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown processing error';
    return {
      success: false,
      newDorsalsCount: 0,
      allDorsals: [],
      newDorsals: [],
      error: errorMessage
    };
  } finally {
    // Clean up temporary file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupError) {
        console.warn(`⚠️ [OCR REPROCESS] Could not clean up temp file ${tempFilePath}:`, cleanupError);
      }
    }
  }
}

/**
 * Get current reprocessing progress
 */
export function getReprocessingProgress(eventId: number): ReprocessingProgress | null {
  return reprocessingProgress.get(eventId) || null;
}

/**
 * Stop reprocessing (if possible)
 */
export function stopReprocessing(eventId: number): boolean {
  const progress = reprocessingProgress.get(eventId);
  if (progress && progress.isRunning) {
    progress.isRunning = false;
    progress.currentStatus = 'Stopped by user';
    return true;
  }
  return false;
}

/**
 * Clear completed reprocessing progress
 */
export function clearReprocessingProgress(eventId: number): boolean {
  const progress = reprocessingProgress.get(eventId);
  if (progress && !progress.isRunning) {
    reprocessingProgress.delete(eventId);
    return true;
  }
  return false;
}