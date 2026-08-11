#!/usr/bin/env npx tsx

import { getCloudStorage } from './server/cloud-storage';
import { createGoogleVisionProcessor } from './server/google-vision-ocr';

interface ValidationResult {
  success: boolean;
  photoAccessTests: Array<{
    path: string;
    success: boolean;
    signedUrlGenerated: boolean;
    downloadSize?: number;
    error?: string;
  }>;
  ocrTests: Array<{
    path: string;
    success: boolean;
    processingTime?: number;
    dorsalsFound?: number[];
    confidence?: number;
    textPreview?: string;
    error?: string;
  }>;
  summary: {
    totalPhotosAccessed: number;
    totalOcrProcessed: number;
    avgProcessingTime: number;
    totalDorsalsDetected: number;
  };
}

async function validateUnifiedOCRSystem(): Promise<ValidationResult> {
  const result: ValidationResult = {
    success: false,
    photoAccessTests: [],
    ocrTests: [],
    summary: {
      totalPhotosAccessed: 0,
      totalOcrProcessed: 0,
      avgProcessingTime: 0,
      totalDorsalsDetected: 0
    }
  };

  try {
    console.log('🧪 [MANUAL-CANARY-TEST] Starting unified OCR validation...');
    
    // 1. Initialize unified system
    console.log('🔧 [INIT] Initializing unified OCR system...');
    const cloudStorage = getCloudStorage();
    console.log('✅ [UNIFIED] CloudPhotoStorage initialized');
    
    const googleVisionProcessor = createGoogleVisionProcessor(cloudStorage);
    console.log('✅ [UNIFIED] GoogleVisionOCRProcessor initialized');
    
    // 2. Test photo access with signed URLs
    const testPhotos = [
      'eventos/8/originales/1757855112678-DSC1168.jpeg',
      'eventos/8/originales/1757855115345-IMG_6171.jpeg', 
      'eventos/8/originales/1757855118012-P2174.jpeg'
    ];
    
    console.log('🔗 [ACCESS-TEST] Testing signed URL generation and photo access...');
    
    for (const photoPath of testPhotos) {
      const accessTest = {
        path: photoPath,
        success: false,
        signedUrlGenerated: false
      };
      
      try {
        console.log(`📸 Testing access: ${photoPath}`);
        
        // Test signed URL generation
        const signedUrl = await cloudStorage.getSignedUrl(photoPath, 10); // 10 min TTL
        accessTest.signedUrlGenerated = true;
        console.log(`✅ [URL-GEN] Signed URL generated (TTL: 10 min)`);
        console.log(`🔗 [URL]: ${signedUrl.substring(0, 100)}...`);
        
        // Test file download (get size only)
        const fileBuffer = await cloudStorage.downloadFile(photoPath);
        accessTest.downloadSize = fileBuffer.length;
        accessTest.success = true;
        
        console.log(`✅ [DOWNLOAD] Downloaded ${fileBuffer.length} bytes`);
        result.summary.totalPhotosAccessed++;
        
      } catch (error: any) {
        accessTest.error = error.message;
        console.error(`❌ [ACCESS-ERROR] ${photoPath}: ${error.message}`);
      }
      
      result.photoAccessTests.push(accessTest);
    }
    
    // 3. Test Vision OCR processing on 2 samples
    console.log('🔍 [OCR-TEST] Testing Vision API processing...');
    
    const ocrTestPhotos = testPhotos.slice(0, 2); // Test first 2 photos
    let totalProcessingTime = 0;
    
    for (const photoPath of ocrTestPhotos) {
      const ocrTest = {
        path: photoPath,
        success: false
      };
      
      try {
        console.log(`🧠 Processing OCR: ${photoPath}`);
        const startTime = Date.now();
        
        const ocrResult = await googleVisionProcessor.processImage(photoPath);
        const processingTime = Date.now() - startTime;
        
        ocrTest.success = true;
        ocrTest.processingTime = processingTime;
        ocrTest.dorsalsFound = ocrResult.dorsalNumbers;
        ocrTest.confidence = ocrResult.confidence;
        ocrTest.textPreview = ocrResult.allText.substring(0, 50);
        
        totalProcessingTime += processingTime;
        result.summary.totalOcrProcessed++;
        result.summary.totalDorsalsDetected += ocrResult.dorsalNumbers.length;
        
        console.log(`✅ [OCR-SUCCESS] Processed in ${processingTime}ms`);
        console.log(`📊 [DORSALS] Found: [${ocrResult.dorsalNumbers.join(', ')}]`);
        console.log(`📝 [TEXT] Preview: "${ocrResult.allText.substring(0, 50)}..."`);
        console.log(`🎯 [CONFIDENCE] ${ocrResult.confidence}%`);
        
      } catch (error: any) {
        ocrTest.error = error.message;
        console.error(`❌ [OCR-ERROR] ${photoPath}: ${error.message}`);
      }
      
      result.ocrTests.push(ocrTest);
    }
    
    // Calculate summary
    result.summary.avgProcessingTime = result.summary.totalOcrProcessed > 0 
      ? totalProcessingTime / result.summary.totalOcrProcessed 
      : 0;
    
    // Determine overall success
    result.success = result.summary.totalPhotosAccessed > 0 && result.summary.totalOcrProcessed > 0;
    
    console.log('🎉 [VALIDATION-COMPLETE] Unified OCR system test completed!');
    console.log(`📊 [SUMMARY] Photos accessed: ${result.summary.totalPhotosAccessed}, OCR processed: ${result.summary.totalOcrProcessed}`);
    console.log(`🎯 [SUMMARY] Avg processing time: ${result.summary.avgProcessingTime.toFixed(2)}ms`);
    console.log(`🔢 [SUMMARY] Total dorsals detected: ${result.summary.totalDorsalsDetected}`);
    
    return result;
    
  } catch (error: any) {
    console.error('💥 [SYSTEM-ERROR] Unified OCR validation failed:', error.message);
    result.success = false;
    return result;
  }
}

// Execute validation
validateUnifiedOCRSystem()
  .then(result => {
    console.log('\n🎯 [FINAL-RESULT] Validation completed');
    console.log(`Success: ${result.success}`);
    
    if (result.success) {
      console.log('✅ [VALIDATION] Unified OCR system is ready for batch processing');
    } else {
      console.log('❌ [VALIDATION] Unified OCR system needs attention before batch processing');
    }
    
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 [CRITICAL-ERROR] Validation script failed:', error);
    process.exit(1);
  });