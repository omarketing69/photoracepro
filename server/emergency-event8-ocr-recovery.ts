import { GoogleVisionOCRProcessor } from './google-vision-ocr';
import { getCloudStorage } from './cloud-storage';
import { storage } from './storage';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface OCRRecoveryProgress {
  totalPhotos: number;
  processedPhotos: number;
  successfulOCR: number;
  dorsalsFound: number;
  errors: string[];
  startTime: number;
  estimatedTimeRemaining: number;
  currentPhoto: string;
}

/**
 * EMERGENCY OCR RECOVERY FOR EVENT 8
 * Processes all 898 Event 8 photos to recover the lost $1.35 OCR processing
 */
export async function emergencyEvent8OCRRecovery(): Promise<{
  success: boolean;
  message: string;
  results?: OCRRecoveryProgress;
}> {
  const eventId = 8;
  
  console.log(`🚨 [EMERGENCY OCR] STARTING CRITICAL OCR RECOVERY FOR EVENT 8`);
  console.log(`💰 [EMERGENCY OCR] Recovering $1.35 worth of OCR processing`);
  console.log(`🎯 [EMERGENCY OCR] Target: 376 dorsals from 898 photos`);
  
  try {
    // Initialize components
    const cloudStorage = getCloudStorage();
    const ocrProcessor = new GoogleVisionOCRProcessor(cloudStorage);
    
    // Get all Event 8 photos from database
    console.log(`📊 [EMERGENCY OCR] Getting all Event 8 photos from database...`);
    const photos = await storage.getPhotos(eventId);
    
    if (photos.length === 0) {
      return {
        success: false,
        message: "No photos found for Event 8 in database"
      };
    }
    
    console.log(`✅ [EMERGENCY OCR] Found ${photos.length} photos in database`);
    
    // Filter only photos with empty detected_dorsals
    const photosNeedingOCR = photos.filter(photo => 
      !photo.detectedDorsals || 
      photo.detectedDorsals.length === 0 ||
      (Array.isArray(photo.detectedDorsals) && photo.detectedDorsals.length === 0)
    );
    
    console.log(`🔍 [EMERGENCY OCR] ${photosNeedingOCR.length} photos need OCR processing`);
    
    if (photosNeedingOCR.length === 0) {
      return {
        success: false,
        message: "All photos already have detected dorsals"
      };
    }
    
    // Initialize progress tracking
    const progress: OCRRecoveryProgress = {
      totalPhotos: photosNeedingOCR.length,
      processedPhotos: 0,
      successfulOCR: 0,
      dorsalsFound: 0,
      errors: [],
      startTime: Date.now(),
      estimatedTimeRemaining: 0,
      currentPhoto: ''
    };
    
    console.log(`🚀 [EMERGENCY OCR] Starting OCR processing of ${progress.totalPhotos} photos`);
    
    // Create temporary directory for downloaded images
    const tempDir = path.join(os.tmpdir(), 'event8-ocr-recovery');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Process photos in batches to avoid memory issues
    const BATCH_SIZE = 10;
    const batches = [];
    for (let i = 0; i < photosNeedingOCR.length; i += BATCH_SIZE) {
      batches.push(photosNeedingOCR.slice(i, i + BATCH_SIZE));
    }
    
    console.log(`📦 [EMERGENCY OCR] Processing in ${batches.length} batches of ${BATCH_SIZE} photos each`);
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`\n🔄 [BATCH ${batchIndex + 1}/${batches.length}] Processing batch of ${batch.length} photos`);
      
      for (const photo of batch) {
        try {
          progress.currentPhoto = photo.filename;
          console.log(`\n📷 [OCR] Processing photo: ${photo.filename} (${progress.processedPhotos + 1}/${progress.totalPhotos})`);
          
          // Construct cloud storage path for Event 8 photos
          const cloudPath = `eventos/${eventId}/originales/${photo.filename}`;
          
          // Download photo from Google Cloud Storage
          const tempFilePath = path.join(tempDir, photo.filename);
          console.log(`⬇️  [DOWNLOAD] Downloading from: ${cloudPath}`);
          
          try {
            const fileBuffer = await cloudStorage.downloadFile(cloudPath);
            fs.writeFileSync(tempFilePath, fileBuffer);
            console.log(`✅ [DOWNLOAD] Downloaded to: ${tempFilePath}`);
          } catch (downloadError) {
            console.error(`❌ [DOWNLOAD] Failed to download ${cloudPath}:`, downloadError);
            progress.errors.push(`Download failed for ${photo.filename}: ${downloadError}`);
            progress.processedPhotos++;
            continue;
          }
          
          // Verify file exists and has content
          if (!fs.existsSync(tempFilePath)) {
            console.error(`❌ [FILE] Downloaded file not found: ${tempFilePath}`);
            progress.errors.push(`Downloaded file not found: ${photo.filename}`);
            progress.processedPhotos++;
            continue;
          }
          
          const fileStat = fs.statSync(tempFilePath);
          if (fileStat.size === 0) {
            console.error(`❌ [FILE] Downloaded file is empty: ${tempFilePath}`);
            progress.errors.push(`Downloaded file is empty: ${photo.filename}`);
            progress.processedPhotos++;
            continue;
          }
          
          console.log(`📊 [FILE] File size: ${(fileStat.size / 1024 / 1024).toFixed(2)} MB`);
          
          // Process with Google Vision OCR
          console.log(`🔍 [OCR] Starting Google Vision processing...`);
          const ocrResult = await ocrProcessor.processImage(tempFilePath);
          
          console.log(`📊 [OCR] Results: ${ocrResult.dorsalNumbers.length} dorsals detected`);
          console.log(`📝 [OCR] Dorsals: [${ocrResult.dorsalNumbers.join(', ')}]`);
          
          // Update database with results
          const updateData: any = {
            processed: true,
            processingStatus: 'completed'
          };
          
          if (ocrResult.dorsalNumbers.length > 0) {
            updateData.detectedDorsals = ocrResult.dorsalNumbers;
            progress.successfulOCR++;
            progress.dorsalsFound += ocrResult.dorsalNumbers.length;
            
            console.log(`✅ [UPDATE] Updating photo ${photo.id} with ${ocrResult.dorsalNumbers.length} dorsals`);
          } else {
            updateData.processingStatus = 'no_dorsals_found';
            console.log(`⚠️  [UPDATE] No dorsals found for photo ${photo.id}`);
          }
          
          // Update photo in database
          const updatedPhoto = await storage.updatePhoto(photo.id, updateData);
          
          if (updatedPhoto) {
            console.log(`✅ [DATABASE] Successfully updated photo ${photo.id}`);
          } else {
            console.error(`❌ [DATABASE] Failed to update photo ${photo.id}`);
            progress.errors.push(`Database update failed for photo ${photo.id}`);
          }
          
          // Clean up temporary file
          try {
            fs.unlinkSync(tempFilePath);
          } catch (cleanupError) {
            console.warn(`⚠️  [CLEANUP] Could not delete temp file: ${tempFilePath}`);
          }
          
        } catch (error) {
          console.error(`❌ [ERROR] Failed to process photo ${photo.filename}:`, error);
          progress.errors.push(`Processing failed for ${photo.filename}: ${error.message}`);
        }
        
        progress.processedPhotos++;
        
        // Update time estimate
        const elapsedTime = Date.now() - progress.startTime;
        const avgTimePerPhoto = elapsedTime / progress.processedPhotos;
        const remainingPhotos = progress.totalPhotos - progress.processedPhotos;
        progress.estimatedTimeRemaining = avgTimePerPhoto * remainingPhotos;
        
        // Log progress
        const percentComplete = ((progress.processedPhotos / progress.totalPhotos) * 100).toFixed(1);
        const estimatedRemainingMin = (progress.estimatedTimeRemaining / 1000 / 60).toFixed(1);
        
        console.log(`📊 [PROGRESS] ${progress.processedPhotos}/${progress.totalPhotos} (${percentComplete}%) - ETA: ${estimatedRemainingMin}min`);
        console.log(`📊 [RESULTS] Successful OCR: ${progress.successfulOCR}, Total dorsals found: ${progress.dorsalsFound}`);
      }
      
      // Small delay between batches to avoid API rate limits
      if (batchIndex < batches.length - 1) {
        console.log(`⏳ [BATCH] Waiting 2 seconds before next batch...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Clean up temporary directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log(`🧹 [CLEANUP] Temporary directory cleaned up`);
    } catch (cleanupError) {
      console.warn(`⚠️  [CLEANUP] Could not remove temp directory: ${tempDir}`);
    }
    
    // Final results
    const totalTime = Date.now() - progress.startTime;
    const totalTimeMin = (totalTime / 1000 / 60).toFixed(2);
    
    console.log(`\n🎉 [EMERGENCY OCR] RECOVERY COMPLETED!`);
    console.log(`⏱️  [TIMING] Total time: ${totalTimeMin} minutes`);
    console.log(`📊 [RESULTS] Photos processed: ${progress.processedPhotos}/${progress.totalPhotos}`);
    console.log(`✅ [RESULTS] Successful OCR: ${progress.successfulOCR}`);
    console.log(`🔢 [RESULTS] Total dorsals recovered: ${progress.dorsalsFound}`);
    console.log(`❌ [ERRORS] ${progress.errors.length} errors occurred`);
    
    if (progress.errors.length > 0) {
      console.log(`\n📋 [ERROR LIST]:`);
      progress.errors.slice(0, 10).forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
      if (progress.errors.length > 10) {
        console.log(`  ... and ${progress.errors.length - 10} more errors`);
      }
    }
    
    return {
      success: true,
      message: `OCR recovery completed successfully! Processed ${progress.processedPhotos} photos, found ${progress.dorsalsFound} dorsals in ${totalTimeMin} minutes.`,
      results: progress
    };
    
  } catch (error) {
    console.error(`❌ [EMERGENCY OCR] Critical error during OCR recovery:`, error);
    return {
      success: false,
      message: `Critical error during OCR recovery: ${error.message}`
    };
  }
}

/**
 * Simple runner function for the emergency recovery
 */
export async function runEmergencyRecovery(): Promise<void> {
  console.log(`🚨 EMERGENCY EVENT 8 OCR RECOVERY STARTING...`);
  
  try {
    const result = await emergencyEvent8OCRRecovery();
    
    if (result.success) {
      console.log(`✅ SUCCESS: ${result.message}`);
      if (result.results) {
        console.log(`📊 Final Results: ${result.results.dorsalsFound} dorsals found from ${result.results.processedPhotos} photos`);
      }
    } else {
      console.log(`❌ FAILED: ${result.message}`);
    }
  } catch (error) {
    console.error(`❌ CRITICAL ERROR:`, error);
  }
}