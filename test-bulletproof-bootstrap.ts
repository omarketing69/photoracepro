/**
 * TEST BULLETPROOF EVENT BOOTSTRAP SYSTEM
 * 
 * This script verifies that the EventConfigBootstrap system works perfectly
 * and creates events with ZERO manual setup required.
 */

import { db } from './server/db';
import { storage } from './server/storage';
import { EventConfigBootstrap } from './server/event-config-bootstrap';

interface BootstrapTestResult {
  success: boolean;
  eventId?: number;
  configId?: number;
  errors: string[];
  validationResults: any;
  provenConfigApplied: boolean;
  pathMappingCorrect: boolean;
  autoSyncEnabled: boolean;
}

async function testBulletproofBootstrap(): Promise<BootstrapTestResult> {
  console.log('🚀 TESTING BULLETPROOF EVENT BOOTSTRAP SYSTEM');
  console.log('='.repeat(80));
  
  const result: BootstrapTestResult = {
    success: false,
    errors: [],
    validationResults: null,
    provenConfigApplied: false,
    pathMappingCorrect: false,
    autoSyncEnabled: false
  };

  try {
    // STEP 1: Create a test event through normal flow
    console.log('📝 [TEST] Creating test event to verify bootstrap...');
    const testEventData = {
      name: `Bootstrap Test Event ${Date.now()}`,
      date: new Date('2025-12-31'),
      location: 'Test Location - Bootstrap Verification',
      expectedParticipants: 500,
    };

    const testEvent = await storage.createEvent(testEventData);
    result.eventId = testEvent.id;
    console.log(`✅ [TEST] Test event created with ID: ${testEvent.id}`);

    // Wait a moment for bootstrap to complete
    console.log('⏳ [TEST] Waiting 2 seconds for bootstrap to complete...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // STEP 2: Verify EventConfig was created automatically
    console.log('🔍 [TEST] Verifying EventConfig was created automatically...');
    const eventConfig = await storage.getEventConfig(testEvent.id);
    
    if (!eventConfig) {
      result.errors.push('EventConfig was not created automatically');
      return result;
    }
    
    result.configId = eventConfig.id;
    console.log(`✅ [TEST] EventConfig found with ID: ${eventConfig.id}`);

    // STEP 3: Verify proven configuration was applied
    console.log('🔍 [TEST] Verifying proven Event8 configuration was applied...');
    
    // Check OCR settings
    if (eventConfig.ocrConfidenceThreshold === 95 &&
        eventConfig.maxDorsalsPerPhoto === 10 &&
        parseFloat(eventConfig.dorsalSizeThreshold) === 0.15 &&
        eventConfig.allowDuplicateDorsals === true) {
      result.provenConfigApplied = true;
      console.log('✅ [TEST] Proven OCR configuration applied correctly');
      console.log(`   📊 OCR confidence: ${eventConfig.ocrConfidenceThreshold}%`);
      console.log(`   📊 Max dorsals per photo: ${eventConfig.maxDorsalsPerPhoto}`);
      console.log(`   📊 Dorsal size threshold: ${eventConfig.dorsalSizeThreshold}`);
      console.log(`   📊 Allow duplicates: ${eventConfig.allowDuplicateDorsals}`);
    } else {
      result.errors.push('Proven OCR configuration not applied correctly');
    }

    // STEP 4: Verify identity-only path mapping
    console.log('🔍 [TEST] Verifying identity-only path mapping...');
    const expectedPath = `eventos/${testEvent.id}`;
    
    if (eventConfig.cloudStoragePathTemplate === expectedPath &&
        eventConfig.originalPhotosPath === `${expectedPath}/originales` &&
        eventConfig.webPhotosPath === `${expectedPath}/web` &&
        eventConfig.thumbnailPhotosPath === `${expectedPath}/miniaturas`) {
      result.pathMappingCorrect = true;
      console.log('✅ [TEST] Identity-only path mapping configured correctly');
      console.log(`   📂 Base path: ${eventConfig.cloudStoragePathTemplate}`);
      console.log(`   📂 Originals: ${eventConfig.originalPhotosPath}`);
      console.log(`   📂 Web: ${eventConfig.webPhotosPath}`);
      console.log(`   📂 Thumbnails: ${eventConfig.thumbnailPhotosPath}`);
    } else {
      result.errors.push('Identity-only path mapping not configured correctly');
    }

    // STEP 5: Verify auto-sync is enabled
    console.log('🔍 [TEST] Verifying auto-sync configuration...');
    
    if (eventConfig.autoSyncFromGCS === true &&
        eventConfig.enableAsyncProcessing === true &&
        eventConfig.autoProcessNewPhotos === true) {
      result.autoSyncEnabled = true;
      console.log('✅ [TEST] Auto-sync configuration enabled correctly');
      console.log(`   🔄 Auto sync from GCS: ${eventConfig.autoSyncFromGCS}`);
      console.log(`   ⚡ Async processing: ${eventConfig.enableAsyncProcessing}`);
      console.log(`   🤖 Auto process new photos: ${eventConfig.autoProcessNewPhotos}`);
    } else {
      result.errors.push('Auto-sync configuration not enabled correctly');
    }

    // STEP 6: Validate configuration using storage method
    console.log('🔍 [TEST] Running comprehensive validation...');
    const validation = await storage.validateEventConfig(testEvent.id);
    result.validationResults = validation;
    
    if (validation.valid) {
      console.log('✅ [TEST] Configuration validation passed');
      if (validation.warnings.length > 0) {
        console.log('⚠️ [TEST] Validation warnings:', validation.warnings);
      }
    } else {
      result.errors.push(`Configuration validation failed: ${validation.errors.join(', ')}`);
    }

    // STEP 7: Check bootstrap completion status
    console.log('🔍 [TEST] Verifying bootstrap completion status...');
    const bootstrapStatus = await EventConfigBootstrap.getBootstrapStatus(testEvent.id);
    
    if (bootstrapStatus.completed) {
      console.log('✅ [TEST] Bootstrap marked as completed successfully');
    } else {
      result.errors.push('Bootstrap not marked as completed');
    }

    // STEP 8: Final success assessment
    result.success = result.errors.length === 0 &&
                     result.provenConfigApplied &&
                     result.pathMappingCorrect &&
                     result.autoSyncEnabled &&
                     validation.valid;

    console.log('='.repeat(80));
    if (result.success) {
      console.log('🎉 [TEST] BULLETPROOF BOOTSTRAP SYSTEM TEST: ✅ SUCCESS');
      console.log('🚀 [TEST] System is ready for commercial launch!');
      console.log(`📊 [TEST] Event ID: ${testEvent.id} | Config ID: ${eventConfig.id}`);
      console.log(`🏁 [TEST] Bootstrap completed: ${bootstrapStatus.completed}`);
    } else {
      console.log('❌ [TEST] BULLETPROOF BOOTSTRAP SYSTEM TEST: ❌ FAILED');
      console.log('🔧 [TEST] Issues found:', result.errors);
    }
    console.log('='.repeat(80));

    return result;

  } catch (error) {
    result.errors.push(`Test execution failed: ${error.message}`);
    console.error('❌ [TEST] Critical test error:', error);
    return result;
  }
}

// Execute test automatically (ES module)
testBulletproofBootstrap().then(result => {
  if (result.success) {
    console.log('\n🎯 BULLETPROOF BOOTSTRAP SYSTEM: READY FOR PRODUCTION! 🚀');
    process.exit(0);
  } else {
    console.log('\n🚨 BULLETPROOF BOOTSTRAP SYSTEM: NEEDS ATTENTION ⚠️');
    console.log('Errors:', result.errors);
    process.exit(1);
  }
}).catch(error => {
  console.error('💥 TEST EXECUTION FAILED:', error);
  process.exit(1);
});

export { testBulletproofBootstrap, BootstrapTestResult };