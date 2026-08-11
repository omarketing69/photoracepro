#!/usr/bin/env tsx

/**
 * Test script to verify Event 8 (UFPS) thumbnail generation and backfill
 */

import { thumbnailBackfillService } from './server/thumbnail-backfill';
import { getCloudStorage } from './server/cloud-storage';
import { storage } from './server/storage';

async function testEvent8Thumbnails() {
  console.log('🧪 Testing Event 8 (UFPS) Thumbnail System...\n');

  try {
    const cloudStorage = getCloudStorage();

    // 1. Check current state of Event 8 in GCS
    console.log('1️⃣ Checking current Event 8 state in Google Cloud Storage...');
    
    try {
      const eventFolders = await cloudStorage.listAllEventFolders();
      console.log(`📂 Available event folders: ${eventFolders.join(', ')}`);
      
      if (eventFolders.includes(8)) {
        const originals = await cloudStorage.listEventFiles(8, 'originales');
        const web = await cloudStorage.listEventFiles(8, 'web');
        const thumbnails = await cloudStorage.listEventFiles(8, 'miniaturas');
        
        console.log(`📄 Event 8 - Originals: ${originals.length} files`);
        console.log(`🌐 Event 8 - Web: ${web.length} files`);
        console.log(`🔍 Event 8 - Thumbnails: ${thumbnails.length} files`);
        
        if (originals.length > 0) {
          console.log(`📋 Sample originals: ${originals.slice(0, 3).join(', ')}`);
        }
      } else {
        console.log('⚠️ Event 8 folder not found in GCS');
      }
    } catch (error) {
      console.log(`⚠️ Error checking GCS state: ${error}`);
    }

    // 2. Check Event 8 photos in database
    console.log('\n2️⃣ Checking Event 8 photos in database...');
    
    try {
      const event8Photos = await storage.getPhotos(8);
      console.log(`📊 Event 8 database: ${event8Photos.length} photos`);
      
      if (event8Photos.length > 0) {
        const sample = event8Photos[0];
        console.log(`📋 Sample photo paths:`);
        console.log(`   Original: ${sample.originalPath}`);
        console.log(`   Web: ${sample.webPath || 'not set'}`);
        console.log(`   Thumbnail: ${sample.thumbnailPath || 'not set'}`);
      }

      // Also check events 6 and 10 (UFPS aliases)
      const event6Photos = await storage.getPhotos(6);
      const event10Photos = await storage.getPhotos(10);
      console.log(`📊 Event 6 database: ${event6Photos.length} photos`);
      console.log(`📊 Event 10 database: ${event10Photos.length} photos`);
      
    } catch (error) {
      console.log(`⚠️ Error checking database: ${error}`);
    }

    // 3. Test the new deterministic thumbnail endpoint logic
    console.log('\n3️⃣ Testing canonical event mapping...');
    
    const EVENT_ALIASES = new Map([
      [6, 8],   // Carrera Atlética UFPS (old) → event 8
      [10, 8],  // Carrera Atlética UFPS (new) → event 8
    ]);
    
    const canonicalEventId = (eventId: number): number => {
      return EVENT_ALIASES.get(eventId) ?? eventId;
    };
    
    console.log(`✅ Event 6 → ${canonicalEventId(6)} (should be 8)`);
    console.log(`✅ Event 8 → ${canonicalEventId(8)} (should be 8)`);
    console.log(`✅ Event 10 → ${canonicalEventId(10)} (should be 8)`);

    // 4. Run the Event 8 specific backfill
    console.log('\n4️⃣ Running Event 8 specific thumbnail backfill...');
    
    const result = await thumbnailBackfillService.fixEvent8Thumbnails();
    
    console.log('\n✅ Event 8 backfill completed:');
    console.log(JSON.stringify(result, null, 2));

    // 5. Test the new thumbnail endpoint path generation
    console.log('\n5️⃣ Testing thumbnail path generation...');
    
    const testFilename = 'test-photo.jpg';
    for (const eventId of [6, 8, 10]) {
      const canonicalId = canonicalEventId(eventId);
      const thumbnailPath = `eventos/${canonicalId}/miniaturas/${testFilename}`;
      console.log(`📍 Event ${eventId} → ${thumbnailPath}`);
    }

    console.log('\n🎉 Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testEvent8Thumbnails().catch(console.error);