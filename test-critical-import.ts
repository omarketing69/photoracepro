#!/usr/bin/env tsx

/**
 * 🚨 CRITICAL TEST: Event 8 Photo Import
 * 
 * This script tests the critical import function directly
 * to import 898 photos from Google Cloud Storage to PostgreSQL
 */

import { storage } from './server/storage';

async function testCriticalImport() {
  console.log('🚨 [TEST] Starting critical Event 8 photo import test...');
  console.log('═'.repeat(60));
  
  try {
    // Execute the critical import
    console.log('📤 [TEST] Executing importEvent8PhotosFromCloud()...');
    const result = await storage.importEvent8PhotosFromCloud();
    
    console.log('\n🎯 [TEST] IMPORT RESULTS:');
    console.log('═'.repeat(60));
    console.log(`✅ Success: ${result.success}`);
    console.log(`📊 Total Found: ${result.totalFound}`);
    console.log(`✅ Imported: ${result.importedCount}`);
    console.log(`🔍 Final Verification: ${result.verificationCount} photos in database`);
    console.log(`❌ Errors: ${result.errors.length}`);
    
    if (result.errors.length > 0) {
      console.log('\n❌ [TEST] ERRORS ENCOUNTERED:');
      result.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }
    
    console.log('\n🎯 [TEST] EXPECTED: 898 photos should be imported');
    console.log(`🔍 [TEST] ACTUAL: ${result.verificationCount} photos in database`);
    
    if (result.verificationCount === 898) {
      console.log('🎉 [TEST] SUCCESS: All 898 photos imported correctly!');
    } else if (result.verificationCount > 0) {
      console.log(`⚠️ [TEST] PARTIAL: ${result.verificationCount} photos imported (expected 898)`);
    } else {
      console.log('❌ [TEST] FAILED: No photos were imported');
    }
    
    console.log('═'.repeat(60));
    
  } catch (error) {
    console.error('💥 [TEST] CRITICAL ERROR during import test:', error);
    process.exit(1);
  }
}

// Execute the test
testCriticalImport()
  .then(() => {
    console.log('🎉 [TEST] Critical import test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 [TEST] Test execution failed:', error);
    process.exit(1);
  });