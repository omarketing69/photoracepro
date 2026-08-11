#!/usr/bin/env tsx

/**
 * Quick script to run full thumbnail backfill for all events
 */

import { thumbnailBackfillService } from './server/thumbnail-backfill';

async function runFullBackfill() {
  console.log('🚀 Running full thumbnail backfill for all events...\n');

  try {
    const result = await thumbnailBackfillService.backfillAllEvents();
    
    console.log('\n🎉 Full backfill completed successfully!');
    console.log('📊 Summary:');
    console.log(`   - Total files processed: ${result.totalProcessed}`);
    console.log(`   - Total versions generated: ${result.totalGenerated}`);
    console.log('\n📋 Per-event results:');
    
    for (const [eventId, eventResult] of Object.entries(result.eventResults)) {
      console.log(`   Event ${eventId}: ${eventResult.processed} processed, ${eventResult.generated} generated`);
      if (eventResult.errors.length > 0) {
        console.log(`     ⚠️ ${eventResult.errors.length} errors`);
      }
    }
    
  } catch (error) {
    console.error('❌ Backfill failed:', error);
    process.exit(1);
  }
}

runFullBackfill().catch(console.error);