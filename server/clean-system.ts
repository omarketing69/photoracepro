import { db } from './db';
import { photos, events } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { getCloudStorage } from './cloud-storage';
import * as fs from 'fs';
import * as path from 'path';

export async function cleanSystem() {
  console.log('🧹 Starting complete system cleanup...');
  
  try {
    // 1. Delete all photos from Google Cloud Storage
    console.log('1. Deleting all photos from Google Cloud Storage...');
    const cloudStorage = getCloudStorage();
    
    // Delete all event photos (this will delete everything in eventos/ folder)
    const eventsList = await db.select().from(events);
    for (const event of eventsList) {
      try {
        await cloudStorage.deleteEventPhotos(event.id);
        console.log(`   ✓ Deleted Google Cloud Storage photos for event ${event.id}`);
      } catch (error) {
        console.log(`   ⚠️  Error deleting photos for event ${event.id}:`, error.message);
      }
    }
    
    // 2. Delete all photo records from database
    console.log('2. Deleting all photo records from database...');
    const deletedPhotos = await db.delete(photos).returning();
    console.log(`   ✓ Deleted ${deletedPhotos.length} photo records from database`);
    
    // 3. Clean up local uploads directory
    console.log('3. Cleaning up local uploads directory...');
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (fs.existsSync(uploadsDir)) {
      fs.rmSync(uploadsDir, { recursive: true, force: true });
      console.log(`   ✓ Deleted local uploads directory`);
    }
    
    // 4. Clean up local web directory
    const webDir = path.join(process.cwd(), 'uploads', 'web');
    if (fs.existsSync(webDir)) {
      fs.rmSync(webDir, { recursive: true, force: true });
      console.log(`   ✓ Deleted local web directory`);
    }
    
    // 5. Clean up temp directories
    console.log('4. Cleaning up temp directories...');
    const tempDirs = ['temp', 'temp-ocr'];
    for (const tempDir of tempDirs) {
      const tempPath = path.join(process.cwd(), tempDir);
      if (fs.existsSync(tempPath)) {
        fs.rmSync(tempPath, { recursive: true, force: true });
        console.log(`   ✓ Deleted ${tempDir} directory`);
      }
    }
    
    // 6. Reset event statistics but keep events intact
    console.log('5. Resetting event statistics...');
    await db.update(events).set({
      totalPhotos: 0,
      processedPhotos: 0,
      detectedDorsals: 0,
      totalFaces: 0
    });
    console.log(`   ✓ Reset statistics for all events`);
    
    console.log('✅ System cleanup completed successfully!');
    console.log('📸 Ready to upload 5000 photos without conflicts');
    
    return {
      success: true,
      message: 'System cleaned successfully',
      details: {
        photosDeleted: deletedPhotos.length,
        eventsReset: events.length,
        directoriesCleared: ['uploads', 'temp', 'temp-ocr']
      }
    };
    
  } catch (error) {
    console.error('❌ Error during system cleanup:', error);
    return {
      success: false,
      message: 'System cleanup failed',
      error: error.message
    };
  }
}