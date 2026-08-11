import { db } from './db';
import { photos, events } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function debugDatabase() {
  console.log('🔍 Debugging database connection for Event 8 photos...');
  
  try {
    // Test 1: Count photos using raw SQL
    console.log('\n📊 Test 1: Raw SQL count');
    const rawResult = await db.execute(sql`SELECT COUNT(*) as count FROM photos WHERE event_id = 8`);
    console.log('Raw SQL result:', rawResult);
    
    // Test 2: Count photos using drizzle
    console.log('\n📊 Test 2: Drizzle count');
    const drizzleCount = await db.select({
      count: sql<number>`count(*)`
    }).from(photos).where(eq(photos.eventId, 8));
    console.log('Drizzle count result:', drizzleCount);
    
    // Test 3: Get first few photos
    console.log('\n📊 Test 3: First 5 photos');
    const firstPhotos = await db.select().from(photos).where(eq(photos.eventId, 8)).limit(5);
    console.log('First 5 photos:', firstPhotos.length);
    if (firstPhotos.length > 0) {
      console.log('Sample photo structure:');
      console.log(JSON.stringify(firstPhotos[0], null, 2));
    }
    
    // Test 4: Check event exists
    console.log('\n📊 Test 4: Event 8 exists');
    const event8 = await db.select().from(events).where(eq(events.id, 8));
    console.log('Event 8:', event8.length > 0 ? 'EXISTS' : 'NOT FOUND');
    
  } catch (error) {
    console.error('❌ Database debug error:', error);
  }
}

// Import sql function
import { sql } from 'drizzle-orm';

debugDatabase();