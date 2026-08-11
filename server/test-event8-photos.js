import { getCloudStorage } from './cloud-storage.js';

async function testEvent8Photos() {
  try {
    console.log('🔍 Testing Google Cloud Storage access for Event 8...');
    
    const cloudStorage = getCloudStorage();
    
    // Try to list files in eventos/8/originales/
    console.log('📁 Listing photos in eventos/8/originales/...');
    const files = await cloudStorage.listPhotosInFolder('eventos/8/originales');
    
    console.log(`✅ Found ${files.length} photos in Event 8 folder`);
    if (files.length > 0) {
      console.log('📸 First 5 photos:');
      files.slice(0, 5).forEach((file, index) => {
        console.log(`  ${index + 1}. ${file}`);
      });
    }
    
    return files;
    
  } catch (error) {
    console.error('❌ Error testing Event 8 photos:', error);
    throw error;
  }
}

testEvent8Photos()
  .then(files => {
    console.log(`\n🎉 SUCCESS: Found ${files.length} photos for Event 8`);
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 FAILURE: Could not access Event 8 photos');
    console.error(error.message);
    process.exit(1);
  });