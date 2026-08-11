import { storage } from './storage';
import { getCloudStorage } from './cloud-storage';

interface PhotoComparisonResult {
  eventId: number;
  dbPhotos: number;
  gcsPhotos: number;
  missingInDb: number;
  missingInGcs: number;
  sampleMissing: string[];
}

export async function verifyPhotosIntegrity() {
  console.log('🔍 INTEGRITY CHECK: Starting photo integrity verification...');
  
  const events = [1, 2, 5];
  const results: PhotoComparisonResult[] = [];
  
  for (const eventId of events) {
    console.log(`\n📁 Checking event ${eventId}...`);
    
    // Get photos from database
    const dbPhotos = await storage.getPhotos(eventId);
    console.log(`💾 Database: ${dbPhotos.length} photos for event ${eventId}`);
    
    // Get photos from Google Cloud Storage
    const cloudStorage = getCloudStorage();
    const gcsPhotos = await cloudStorage.listFiles(`eventos/${eventId}/originales/`);
    console.log(`☁️ Google Cloud Storage: ${gcsPhotos.length} photos for event ${eventId}`);
    
    // Find missing files
    const dbFilenames = new Set(dbPhotos.map(p => {
      // Extract filename from originalPath
      const pathParts = p.originalPath.split('/');
      return pathParts[pathParts.length - 1];
    }));
    
    const gcsFilenames = new Set(gcsPhotos.map((file: any) => {
      const pathParts = file.name.split('/');
      return pathParts[pathParts.length - 1];
    }));
    
    // Photos in GCS but not in DB (missing in DB)
    const missingInDb = [];
    for (const gcsFilename of Array.from(gcsFilenames)) {
      if (!dbFilenames.has(gcsFilename)) {
        missingInDb.push(gcsFilename);
      }
    }
    
    // Photos in DB but not in GCS (missing in GCS)  
    const missingInGcs = [];
    for (const dbFilename of Array.from(dbFilenames)) {
      if (!gcsFilenames.has(dbFilename)) {
        missingInGcs.push(dbFilename);
      }
    }
    
    const result: PhotoComparisonResult = {
      eventId,
      dbPhotos: dbPhotos.length,
      gcsPhotos: gcsPhotos.length,
      missingInDb: missingInDb.length,
      missingInGcs: missingInGcs.length,
      sampleMissing: missingInDb.slice(0, 5) // First 5 missing files as sample
    };
    
    results.push(result);
    
    console.log(`📊 RESULT for Event ${eventId}:`);
    console.log(`   DB Photos: ${result.dbPhotos}`);
    console.log(`   GCS Photos: ${result.gcsPhotos}`);
    console.log(`   Missing in DB: ${result.missingInDb}`);
    console.log(`   Missing in GCS: ${result.missingInGcs}`);
    
    if (missingInDb.length > 0) {
      console.log(`🚨 Sample missing in DB:`, missingInDb.slice(0, 3));
    }
  }
  
  console.log('\n📋 INTEGRITY SUMMARY:');
  for (const result of results) {
    console.log(`Event ${result.eventId}: DB=${result.dbPhotos}, GCS=${result.gcsPhotos}, Missing=${result.missingInDb}`);
  }
  
  return results;
}