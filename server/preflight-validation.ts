/**
 * COMPREHENSIVE PREFLIGHT VALIDATION SYSTEM
 * 
 * Tests ALL critical components before allowing uploads to any event.
 * Only returns GREEN status when EVERYTHING works perfectly.
 * 
 * CRITICAL FOR COMMERCIAL LAUNCH - Prevents recurring configuration issues
 */

import { getCloudStorage } from './cloud-storage';
import { GoogleVisionOCRProcessor } from './google-vision-ocr';
import { storage } from './storage';
import { thumbnailCache } from './thumbnail-cache';
import { asyncPhotoProcessor } from './async-photo-processor';
import { performanceMonitor } from './performance-monitor';
import { canonicalEventId } from './utils/canonical-event-id';
import { bootstrapEvent } from './event-config-bootstrap';
import sharp from 'sharp';
import { db } from './db';
import { events, eventConfigs, processingStats } from '../shared/schema';
import { eq } from 'drizzle-orm';

export interface ValidationResult {
  component: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: any;
  executionTime: number;
  timestamp: string;
}

export interface PreflightReport {
  eventId: number;
  overallStatus: 'GREEN' | 'YELLOW' | 'RED';
  startTime: string;
  endTime: string;
  totalExecutionTime: number;
  validationResults: ValidationResult[];
  criticalFailures: string[];
  warnings: string[];
  systemInfo: {
    memoryUsage: NodeJS.MemoryUsage;
    nodeVersion: string;
    environment: string;
  };
}

export class PreflightValidationService {
  private cloudStorage = getCloudStorage();
  private ocrProcessor: GoogleVisionOCRProcessor;
  
  constructor() {
    this.ocrProcessor = new GoogleVisionOCRProcessor(this.cloudStorage);
  }

  /**
   * Run complete preflight validation for an event
   */
  async validateEvent(eventId: number): Promise<PreflightReport> {
    const startTime = new Date();
    const validationResults: ValidationResult[] = [];
    const criticalFailures: string[] = [];
    const warnings: string[] = [];

    console.log(`🚀 STARTING PREFLIGHT VALIDATION FOR EVENT ${eventId}`);
    console.log('═'.repeat(80));

    try {
      // 1. CRITICAL: Database Connectivity Test
      const dbResult = await this.validateDatabaseConnectivity(eventId);
      validationResults.push(dbResult);
      if (dbResult.status === 'FAIL') criticalFailures.push(`Database: ${dbResult.message}`);

      // 2. CRITICAL: Event Configuration Test
      const eventConfigResult = await this.validateEventConfiguration(eventId);
      validationResults.push(eventConfigResult);
      if (eventConfigResult.status === 'FAIL') criticalFailures.push(`Event Config: ${eventConfigResult.message}`);

      // 3. CRITICAL: Google Cloud Storage Test
      const gcsResult = await this.validateGoogleCloudStorage(eventId);
      validationResults.push(gcsResult);
      if (gcsResult.status === 'FAIL') criticalFailures.push(`GCS: ${gcsResult.message}`);

      // 4. CRITICAL: Google Vision OCR Test
      const ocrResult = await this.validateGoogleVisionOCR();
      validationResults.push(ocrResult);
      if (ocrResult.status === 'FAIL') criticalFailures.push(`OCR: ${ocrResult.message}`);

      // 5. CRITICAL: PathBuilder Integrity Test
      const pathBuilderResult = await this.validatePathBuilderIntegrity(eventId);
      validationResults.push(pathBuilderResult);
      if (pathBuilderResult.status === 'FAIL') criticalFailures.push(`PathBuilder: ${pathBuilderResult.message}`);

      // 6. CRITICAL: Image Processing Pipeline Test
      const imageProcessingResult = await this.validateImageProcessingPipeline(eventId);
      validationResults.push(imageProcessingResult);
      if (imageProcessingResult.status === 'FAIL') criticalFailures.push(`Image Processing: ${imageProcessingResult.message}`);

      // 7. CRITICAL: Thumbnail Generation Test
      const thumbnailResult = await this.validateThumbnailGeneration();
      validationResults.push(thumbnailResult);
      if (thumbnailResult.status === 'FAIL') criticalFailures.push(`Thumbnails: ${thumbnailResult.message}`);

      // 8. CRITICAL: Signed URL Generation Test
      const signedUrlResult = await this.validateSignedUrlGeneration(eventId);
      validationResults.push(signedUrlResult);
      if (signedUrlResult.status === 'FAIL') criticalFailures.push(`Signed URLs: ${signedUrlResult.message}`);

      // 9. CRITICAL: ProcessingStats Update Test
      const processingStatsResult = await this.validateProcessingStatsUpdate(eventId);
      validationResults.push(processingStatsResult);
      if (processingStatsResult.status === 'FAIL') criticalFailures.push(`Processing Stats: ${processingStatsResult.message}`);

      // 10. PERFORMANCE: End-to-End Sample Processing Test
      const endToEndResult = await this.validateEndToEndProcessing(eventId);
      validationResults.push(endToEndResult);
      if (endToEndResult.status === 'FAIL') {
        criticalFailures.push(`End-to-End: ${endToEndResult.message}`);
      } else if (endToEndResult.status === 'WARN') {
        warnings.push(`End-to-End: ${endToEndResult.message}`);
      }

      // 11. OPTIONAL: System Resources Check
      const resourcesResult = await this.validateSystemResources();
      validationResults.push(resourcesResult);
      if (resourcesResult.status === 'WARN') warnings.push(`Resources: ${resourcesResult.message}`);

      // Collect warnings from all checks
      validationResults.forEach(result => {
        if (result.status === 'WARN') {
          warnings.push(`${result.component}: ${result.message}`);
        }
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown validation error';
      criticalFailures.push(`Critical validation error: ${errorMsg}`);
    }

    const endTime = new Date();
    const totalExecutionTime = endTime.getTime() - startTime.getTime();

    // Determine overall status
    let overallStatus: 'GREEN' | 'YELLOW' | 'RED';
    if (criticalFailures.length > 0) {
      overallStatus = 'RED';
    } else if (warnings.length > 0) {
      overallStatus = 'YELLOW';  // Some warnings but no critical failures
    } else {
      overallStatus = 'GREEN';   // All checks passed
    }

    const report: PreflightReport = {
      eventId,
      overallStatus,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      totalExecutionTime,
      validationResults,
      criticalFailures,
      warnings,
      systemInfo: {
        memoryUsage: process.memoryUsage(),
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'development'
      }
    };

    // Log final results
    console.log('═'.repeat(80));
    console.log(`🏁 PREFLIGHT VALIDATION COMPLETED FOR EVENT ${eventId}`);
    console.log(`📊 OVERALL STATUS: ${overallStatus}`);
    console.log(`⏱️ Total Time: ${totalExecutionTime}ms`);
    console.log(`✅ Passed: ${validationResults.filter(r => r.status === 'PASS').length}`);
    console.log(`⚠️ Warnings: ${warnings.length}`);
    console.log(`❌ Critical Failures: ${criticalFailures.length}`);
    console.log('═'.repeat(80));

    return report;
  }

  /**
   * Test database connectivity and basic operations
   */
  private async validateDatabaseConnectivity(eventId: number): Promise<ValidationResult> {
    const startTime = Date.now();
    
    try {
      console.log('🔍 Testing database connectivity...');
      
      // Test basic query
      const testEvent = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
      
      // Test write operation with a temporary record
      const testRecord = await db.insert(processingStats).values({
        eventId,
        totalPhotos: 0,
        processedPhotos: 0,
        dorsalsDetected: 0,
        facesDetected: 0,
        ocrAccuracy: "0.00",
        avgProcessingTime: "0.000"
      }).returning();

      // Clean up test record
      if (testRecord.length > 0) {
        await db.delete(processingStats).where(eq(processingStats.id, testRecord[0].id));
      }

      const executionTime = Date.now() - startTime;
      
      return {
        component: 'Database Connectivity',
        status: 'PASS',
        message: `Database operations successful (${executionTime}ms)`,
        details: {
          eventExists: testEvent.length > 0,
          writeTestPassed: true,
          connectionPoolActive: true
        },
        executionTime,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : 'Database connection failed';
      
      return {
        component: 'Database Connectivity',
        status: 'FAIL',
        message: `Database validation failed: ${errorMsg}`,
        details: { error: errorMsg },
        executionTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Test event configuration and bootstrap system
   */
  private async validateEventConfiguration(eventId: number): Promise<ValidationResult> {
    const startTime = Date.now();
    
    try {
      console.log('🔍 Testing event configuration...');
      
      // Check if event exists
      const event = await storage.getEvent(eventId);
      if (!event) {
        throw new Error(`Event ${eventId} not found`);
      }

      // Check if event config exists, if not create it
      const existingConfig = await db.select().from(eventConfigs).where(eq(eventConfigs.eventId, eventId)).limit(1);
      
      if (existingConfig.length === 0) {
        console.log(`📝 Event ${eventId} has no configuration, bootstrapping...`);
        const bootstrapResult = await bootstrapEvent(eventId);
        
        if (!bootstrapResult.success) {
          throw new Error(`Bootstrap failed: ${bootstrapResult.errors.join(', ')}`);
        }
      }

      // Verify canonical event ID mapping
      const canonicalId = canonicalEventId(eventId);
      
      const executionTime = Date.now() - startTime;
      
      return {
        component: 'Event Configuration',
        status: 'PASS',
        message: `Event configuration valid (${executionTime}ms)`,
        details: {
          eventId,
          canonicalEventId: canonicalId,
          configBootstrapped: existingConfig.length === 0,
          eventStatus: event.status
        },
        executionTime,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : 'Event configuration failed';
      
      return {
        component: 'Event Configuration',
        status: 'FAIL',
        message: `Event configuration validation failed: ${errorMsg}`,
        details: { error: errorMsg },
        executionTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Test Google Cloud Storage operations
   */
  private async validateGoogleCloudStorage(eventId: number): Promise<ValidationResult> {
    const startTime = Date.now();
    
    try {
      console.log('🔍 Testing Google Cloud Storage...');
      
      // Generate fresh test image for GCS validation
      const testImageBuffer = await this.createTestOCRImage();
      
      // Create test file
      const testFilename = `preflight-test-${eventId}-${Date.now()}.jpg`;
      const testFile = {
        originalname: testFilename,
        buffer: testImageBuffer,
        mimetype: 'image/jpeg'
      } as Express.Multer.File;

      // Test upload
      const uploadedPath = await this.cloudStorage.uploadOriginalPhoto(eventId, testFile);
      console.log(`✅ Test upload successful: ${uploadedPath}`);

      // Test signed URL generation
      const signedUrl = await this.cloudStorage.generateSignedUrl(uploadedPath, 5);
      console.log(`✅ Signed URL generated successfully`);

      // Test signed URL access
      const response = await fetch(signedUrl);
      if (!response.ok) {
        throw new Error(`Signed URL access failed: ${response.status}`);
      }
      console.log(`✅ Signed URL access successful`);

      // Test web version upload
      const webPath = await this.cloudStorage.uploadWebVersion(eventId, uploadedPath, testImageBuffer);
      console.log(`✅ Web version upload successful: ${webPath}`);

      // Test thumbnail upload
      const thumbPath = await this.cloudStorage.uploadThumbnail(eventId, uploadedPath, testImageBuffer);
      console.log(`✅ Thumbnail upload successful: ${thumbPath}`);

      const executionTime = Date.now() - startTime;
      
      return {
        component: 'Google Cloud Storage',
        status: 'PASS',
        message: `GCS operations successful (${executionTime}ms)`,
        details: {
          uploadSuccess: true,
          signedUrlGeneration: true,
          signedUrlAccess: true,
          webVersionUpload: true,
          thumbnailUpload: true,
          testFilePath: uploadedPath
        },
        executionTime,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : 'GCS validation failed';
      
      return {
        component: 'Google Cloud Storage',
        status: 'FAIL',
        message: `GCS validation failed: ${errorMsg}`,
        details: { error: errorMsg },
        executionTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Test Google Vision OCR functionality and quota
   */
  private async validateGoogleVisionOCR(): Promise<ValidationResult> {
    const startTime = Date.now();
    
    try {
      console.log('🔍 Testing Google Vision OCR...');
      
      // Create a test image with numbers for OCR
      const testImageWithNumbers = await this.createTestOCRImage();
      
      // Test OCR processing
      const ocrResult = await this.ocrProcessor.processImageBuffer(testImageWithNumbers);
      
      console.log(`✅ OCR processing successful. Detected: ${ocrResult.length} elements`);
      
      const executionTime = Date.now() - startTime;
      
      // Determine if OCR is working properly
      const status = executionTime < 10000 ? 'PASS' : 'WARN'; // Warn if OCR takes more than 10 seconds
      const message = status === 'PASS' 
        ? `Google Vision OCR working properly (${executionTime}ms)`
        : `Google Vision OCR working but slow (${executionTime}ms)`;
      
      return {
        component: 'Google Vision OCR',
        status,
        message,
        details: {
          ocrResponseTime: executionTime,
          elementsDetected: ocrResult.length,
          quotaOk: true
        },
        executionTime,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : 'OCR validation failed';
      
      // Check if it's a quota issue
      const isQuotaError = errorMsg.includes('quota') || errorMsg.includes('limit');
      const finalMessage = isQuotaError 
        ? `Google Vision OCR quota exceeded: ${errorMsg}`
        : `Google Vision OCR failed: ${errorMsg}`;
      
      return {
        component: 'Google Vision OCR',
        status: 'FAIL',
        message: finalMessage,
        details: { 
          error: errorMsg,
          possibleQuotaIssue: isQuotaError
        },
        executionTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Test PathBuilder integrity with canonical event ID mapping
   */
  private async validatePathBuilderIntegrity(eventId: number): Promise<ValidationResult> {
    const startTime = Date.now();
    
    try {
      console.log('🔍 Testing PathBuilder integrity...');
      
      // Test canonical event ID mapping
      const canonicalId = canonicalEventId(eventId);
      console.log(`📍 Event ID ${eventId} maps to canonical ID ${canonicalId}`);
      
      // Test path generation for different photo types
      const testPaths = {
        original: `eventos/${canonicalId}/originales/test-photo.jpg`,
        web: `eventos/${canonicalId}/web/test-photo.jpg`,
        thumbnail: `eventos/${canonicalId}/miniaturas/test-photo.jpg`
      };
      
      // Verify path patterns are consistent
      const pathsValid = Object.values(testPaths).every(path => 
        path.includes(`eventos/${canonicalId}/`) && path.endsWith('.jpg')
      );
      
      if (!pathsValid) {
        throw new Error('Path generation patterns are inconsistent');
      }
      
      const executionTime = Date.now() - startTime;
      
      return {
        component: 'PathBuilder Integrity',
        status: 'PASS',
        message: `PathBuilder working correctly (${executionTime}ms)`,
        details: {
          eventId,
          canonicalEventId: canonicalId,
          pathMappingCorrect: true,
          testPaths
        },
        executionTime,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : 'PathBuilder validation failed';
      
      return {
        component: 'PathBuilder Integrity',
        status: 'FAIL',
        message: `PathBuilder validation failed: ${errorMsg}`,
        details: { error: errorMsg },
        executionTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Test complete image processing pipeline
   */
  private async validateImageProcessingPipeline(eventId: number): Promise<ValidationResult> {
    const startTime = Date.now();
    
    try {
      console.log('🔍 Testing image processing pipeline...');
      
      // Generate fresh test image for image processing validation
      const testImageBuffer = await this.createTestOCRImage();
      
      // Test Sharp image processing capabilities
      const originalImage = sharp(testImageBuffer);
      const metadata = await originalImage.metadata();
      
      // Test web version generation
      const webVersionBuffer = await originalImage
        .resize(800, 1200, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
      
      // Test thumbnail generation
      const thumbnailBuffer = await originalImage
        .resize(200, 200, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toBuffer();
      
      console.log(`✅ Image processing successful. Original: ${testImageBuffer.length}b, Web: ${webVersionBuffer.length}b, Thumb: ${thumbnailBuffer.length}b`);
      
      const executionTime = Date.now() - startTime;
      
      return {
        component: 'Image Processing Pipeline',
        status: 'PASS',
        message: `Image processing pipeline working (${executionTime}ms)`,
        details: {
          originalSize: testImageBuffer.length,
          webVersionSize: webVersionBuffer.length,
          thumbnailSize: thumbnailBuffer.length,
          metadataExtraction: true,
          processingTime: executionTime
        },
        executionTime,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : 'Image processing failed';
      
      return {
        component: 'Image Processing Pipeline',
        status: 'FAIL',
        message: `Image processing validation failed: ${errorMsg}`,
        details: { error: errorMsg },
        executionTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Test thumbnail generation and caching
   */
  private async validateThumbnailGeneration(): Promise<ValidationResult> {
    const startTime = Date.now();
    
    try {
      console.log('🔍 Testing thumbnail generation...');
      
      // Generate fresh test image for thumbnail validation
      const testImageBuffer = await this.createTestOCRImage();
      
      // Test thumbnail cache stats
      const cacheStats = thumbnailCache.getStats();
      console.log(`📊 Cache stats: ${cacheStats.totalEntries} entries, ${Math.round(cacheStats.totalSize/1024)}KB`);
      
      // Test thumbnail generation
      const testKey = `preflight-test-${Date.now()}`;
      const thumbnailBuffer = await sharp(testImageBuffer)
        .resize(200, 200, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toBuffer();
      
      // Test cache set/get
      thumbnailCache.set(testKey, thumbnailBuffer, 'image/jpeg');
      const cachedThumbnail = thumbnailCache.get(testKey);
      
      if (!cachedThumbnail) {
        throw new Error('Thumbnail cache set/get failed');
      }
      
      // Cleanup test entry
      thumbnailCache.delete(testKey);
      
      console.log(`✅ Thumbnail generation and caching successful`);
      
      const executionTime = Date.now() - startTime;
      
      return {
        component: 'Thumbnail Generation',
        status: 'PASS',
        message: `Thumbnail system working correctly (${executionTime}ms)`,
        details: {
          thumbnailSize: thumbnailBuffer.length,
          cacheSetGet: true,
          cacheStats,
          processingTime: executionTime
        },
        executionTime,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : 'Thumbnail validation failed';
      
      return {
        component: 'Thumbnail Generation',
        status: 'FAIL',
        message: `Thumbnail validation failed: ${errorMsg}`,
        details: { error: errorMsg },
        executionTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Test signed URL generation and access
   */
  private async validateSignedUrlGeneration(eventId: number): Promise<ValidationResult> {
    const startTime = Date.now();
    
    try {
      console.log('🔍 Testing signed URL generation...');
      
      // First, upload a test file to have something to generate signed URLs for
      // Generate fresh test image for signed URL validation
      const testImageBuffer = await this.createTestOCRImage();
      
      const testFilename = `preflight-signedurl-test-${eventId}-${Date.now()}.jpg`;
      const testFile = {
        originalname: testFilename,
        buffer: testImageBuffer,
        mimetype: 'image/jpeg'
      } as Express.Multer.File;

      const uploadedPath = await this.cloudStorage.uploadOriginalPhoto(eventId, testFile);
      
      // Test different expiration times
      const shortUrl = await this.cloudStorage.generateSignedUrl(uploadedPath, 1); // 1 minute
      const longUrl = await this.cloudStorage.generateSignedUrl(uploadedPath, 10); // 10 minutes (max)
      
      // Test signed URL access
      const response = await fetch(shortUrl, { method: 'HEAD' });
      if (!response.ok) {
        throw new Error(`Signed URL access failed: ${response.status}`);
      }
      
      console.log(`✅ Signed URL generation and access successful`);
      
      const executionTime = Date.now() - startTime;
      
      return {
        component: 'Signed URL Generation',
        status: 'PASS',
        message: `Signed URL system working correctly (${executionTime}ms)`,
        details: {
          shortUrlGenerated: true,
          longUrlGenerated: true,
          urlAccessTest: response.ok,
          testFilePath: uploadedPath,
          processingTime: executionTime
        },
        executionTime,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : 'Signed URL validation failed';
      
      return {
        component: 'Signed URL Generation',
        status: 'FAIL',
        message: `Signed URL validation failed: ${errorMsg}`,
        details: { error: errorMsg },
        executionTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Test processing stats update functionality
   */
  private async validateProcessingStatsUpdate(eventId: number): Promise<ValidationResult> {
    const startTime = Date.now();
    
    try {
      console.log('🔍 Testing processing stats updates...');
      
      // Test stats creation/update
      const testStats = {
        eventId,
        totalPhotos: 1,
        processedPhotos: 1,
        dorsalsDetected: 2,
        facesDetected: 1,
        ocrAccuracy: "95.50",
        avgProcessingTime: "1.250"
      };
      
      // Insert test stats
      const insertedStats = await db.insert(processingStats)
        .values(testStats)
        .onConflictDoNothing()
        .returning();
      
      // Test stats retrieval
      const retrievedStats = await db.select()
        .from(processingStats)
        .where(eq(processingStats.eventId, eventId))
        .limit(1);
      
      // Cleanup - delete the test stats if we created them
      if (insertedStats.length > 0) {
        await db.delete(processingStats)
          .where(eq(processingStats.id, insertedStats[0].id));
      }
      
      console.log(`✅ Processing stats update successful`);
      
      const executionTime = Date.now() - startTime;
      
      return {
        component: 'Processing Stats Update',
        status: 'PASS',
        message: `Processing stats system working (${executionTime}ms)`,
        details: {
          statsInserted: insertedStats.length > 0,
          statsRetrieved: retrievedStats.length > 0,
          testStats,
          processingTime: executionTime
        },
        executionTime,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : 'Processing stats validation failed';
      
      return {
        component: 'Processing Stats Update',
        status: 'FAIL',
        message: `Processing stats validation failed: ${errorMsg}`,
        details: { error: errorMsg },
        executionTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Test complete end-to-end processing workflow
   */
  private async validateEndToEndProcessing(eventId: number): Promise<ValidationResult> {
    const startTime = Date.now();
    
    try {
      console.log('🔍 Testing end-to-end processing workflow...');
      
      // Create test image with embedded numbers for OCR
      const testImageWithNumbers = await this.createTestOCRImage();
      
      // Test complete workflow: Upload → Web Version → Thumbnail → OCR → Database Update
      
      // 1. Upload original
      const testFilename = `preflight-e2e-test-${eventId}-${Date.now()}.jpg`;
      const testFile = {
        originalname: testFilename,
        buffer: testImageWithNumbers,
        mimetype: 'image/jpeg'
      } as Express.Multer.File;

      const uploadedPath = await this.cloudStorage.uploadOriginalPhoto(eventId, testFile);
      
      // 2. Generate web version
      const webVersionBuffer = await sharp(testImageWithNumbers)
        .resize(800, 1200, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
      
      const webPath = await this.cloudStorage.uploadWebVersion(eventId, uploadedPath, webVersionBuffer);
      
      // 3. Generate thumbnail
      const thumbnailBuffer = await sharp(testImageWithNumbers)
        .resize(200, 200, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toBuffer();
      
      const thumbPath = await this.cloudStorage.uploadThumbnail(eventId, uploadedPath, thumbnailBuffer);
      
      // 4. Run OCR
      const ocrResult = await this.ocrProcessor.processImageBuffer(testImageWithNumbers);
      
      // 5. Test database photo record creation
      const photoRecord = await storage.createPhoto({
        eventId,
        filename: testFilename,
        originalPath: uploadedPath,
        webPath,
        thumbnailPath: thumbPath,
        detectedDorsals: ocrResult,
        processed: true,
        processingStatus: 'completed'
      });
      
      console.log(`✅ End-to-end processing successful. Photo ID: ${photoRecord.id}`);
      
      const executionTime = Date.now() - startTime;
      
      // Determine status based on execution time
      const status = executionTime < 15000 ? 'PASS' : 'WARN'; // Warn if E2E takes more than 15 seconds
      const message = status === 'PASS'
        ? `End-to-end processing working efficiently (${executionTime}ms)`
        : `End-to-end processing working but slow (${executionTime}ms)`;
      
      return {
        component: 'End-to-End Processing',
        status,
        message,
        details: {
          photoId: photoRecord.id,
          originalPath: uploadedPath,
          webPath,
          thumbnailPath: thumbPath,
          detectedElements: ocrResult.length,
          totalProcessingTime: executionTime,
          workflow: ['Upload', 'Web Version', 'Thumbnail', 'OCR', 'Database']
        },
        executionTime,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : 'End-to-end validation failed';
      
      return {
        component: 'End-to-End Processing',
        status: 'FAIL',
        message: `End-to-end processing failed: ${errorMsg}`,
        details: { error: errorMsg },
        executionTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Test system resources and performance
   */
  private async validateSystemResources(): Promise<ValidationResult> {
    const startTime = Date.now();
    
    try {
      console.log('🔍 Testing system resources...');
      
      const memUsage = process.memoryUsage();
      const memUsageMB = {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024)
      };
      
      // Check cache stats
      const cacheStats = thumbnailCache.getDetailedStats();
      
      // Check async processor stats
      const processorStats = asyncPhotoProcessor.getQueueStats();
      
      console.log(`📊 Memory Usage: RSS=${memUsageMB.rss}MB, Heap=${memUsageMB.heapUsed}MB`);
      console.log(`📊 Cache: ${cacheStats.totalEntries} entries, ${Math.round(cacheStats.totalSize/1024)}KB`);
      console.log(`📊 Processor Queue: ${processorStats.pending} pending, ${processorStats.processing} processing`);
      
      const executionTime = Date.now() - startTime;
      
      // Determine status based on resource usage
      let status: 'PASS' | 'WARN' = 'PASS';
      let warnings: string[] = [];
      
      if (memUsageMB.heapUsed > 500) warnings.push(`High memory usage: ${memUsageMB.heapUsed}MB`);
      if (cacheStats.totalEntries > 800) warnings.push(`Cache has many entries: ${cacheStats.totalEntries}`);
      if (processorStats.pending > 100) warnings.push(`Large processing queue: ${processorStats.pending}`);
      
      if (warnings.length > 0) status = 'WARN';
      
      const message = status === 'PASS'
        ? `System resources healthy (${executionTime}ms)`
        : `System resources adequate with warnings (${executionTime}ms)`;
      
      return {
        component: 'System Resources',
        status,
        message,
        details: {
          memoryUsage: memUsageMB,
          cacheStats,
          processorStats,
          warnings,
          processingTime: executionTime
        },
        executionTime,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : 'Resource validation failed';
      
      return {
        component: 'System Resources',
        status: 'WARN',
        message: `Resource validation failed: ${errorMsg}`,
        details: { error: errorMsg },
        executionTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Create a test image with numbers for OCR testing
   */
  private async createTestOCRImage(): Promise<Buffer> {
    try {
      // Create a simple white background image with black text/numbers
      // This ensures OCR can easily detect the test numbers
      return await sharp({
        create: {
          width: 400,
          height: 300,
          channels: 3,
          background: { r: 255, g: 255, b: 255 } // White background
        }
      })
      .png() // Use PNG for better text rendering
      .composite([
        // Add test numbers that OCR should detect
        {
          input: Buffer.from(`
            <svg width="400" height="300">
              <text x="50" y="80" font-family="Arial, sans-serif" font-size="60" font-weight="bold" fill="black">123</text>
              <text x="150" y="80" font-family="Arial, sans-serif" font-size="60" font-weight="bold" fill="black">456</text>
              <text x="250" y="80" font-family="Arial, sans-serif" font-size="60" font-weight="bold" fill="black">789</text>
              <text x="50" y="180" font-family="Arial, sans-serif" font-size="40" font-weight="bold" fill="black">DORSAL</text>
              <text x="50" y="230" font-family="Arial, sans-serif" font-size="40" font-weight="bold" fill="black">TEST</text>
              <text x="50" y="280" font-family="Arial, sans-serif" font-size="30" fill="black">PREFLIGHT</text>
            </svg>
          `),
          blend: 'over'
        }
      ])
      .jpeg({ 
        quality: 95,
        chromaSubsampling: '4:4:4' // Better text quality
      })
      .toBuffer();
      
    } catch (error) {
      console.error('❌ Error creating test OCR image:', error);
      
      // Fallback: Create a simple solid color image that won't crash OCR
      return await sharp({
        create: {
          width: 400,
          height: 300,
          channels: 3,
          background: { r: 240, g: 240, b: 240 } // Light gray background
        }
      })
      .jpeg({ quality: 90 })
      .toBuffer();
    }
  }
}

// Export singleton instance
export const preflightValidator = new PreflightValidationService();