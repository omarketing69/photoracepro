import { storage } from './storage';

async function testStorage() {
  console.log('🔍 Testing storage.getPhotos for Event 8...');
  
  try {
    const photos = await storage.getPhotos(8);
    console.log(`✅ Found ${photos.length} photos in Event 8`);
    
    if (photos.length > 0) {
      const samplePhoto = photos[0];
      console.log('📷 Sample photo:');
      console.log(`  - ID: ${samplePhoto.id}`);
      console.log(`  - Filename: ${samplePhoto.filename}`);
      console.log(`  - Event ID: ${samplePhoto.eventId}`);
      console.log(`  - Detected Dorsals: ${JSON.stringify(samplePhoto.detectedDorsals)}`);
      console.log(`  - Processing Status: ${samplePhoto.processingStatus}`);
      console.log(`  - Processed: ${samplePhoto.processed}`);
      
      // Count photos with empty dorsals
      const emptyDorsals = photos.filter(photo => 
        !photo.detectedDorsals || 
        photo.detectedDorsals.length === 0 ||
        (Array.isArray(photo.detectedDorsals) && photo.detectedDorsals.length === 0)
      ).length;
      
      console.log(`📊 Photos needing OCR: ${emptyDorsals} / ${photos.length}`);
    }
    
  } catch (error) {
    console.error('❌ Error testing storage:', error);
  }
}

testStorage();