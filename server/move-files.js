import { Storage } from '@google-cloud/storage';

const storage = new Storage({
  projectId: 'REDACTED_GCS_PROJECT',
  keyFilename: './google-credentials.json'
});

const bucket = storage.bucket('REDACTED_GCS_BUCKET');

async function moveFiles() {
  console.log('Starting file move process...');
  
  // Obtener todos los archivos en eventos/3/
  const [files] = await bucket.getFiles({ prefix: 'eventos/3/' });
  
  console.log(`Found ${files.length} files to move`);
  
  for (const file of files) {
    const newName = file.name.replace('eventos/3/', 'eventos/1/');
    
    try {
      await file.move(newName);
      console.log(`✅ Moved: ${file.name} -> ${newName}`);
    } catch (error) {
      console.error(`❌ Error moving ${file.name}:`, error.message);
    }
  }
  
  console.log('File move process completed!');
}

moveFiles().catch(console.error);