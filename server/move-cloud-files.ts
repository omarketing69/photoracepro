import { getCloudStorage } from './cloud-storage';

export async function moveCloudFiles() {
  const cloudStorage = getCloudStorage();
  const bucket = cloudStorage.storage.bucket('REDACTED_GCS_BUCKET');
  
  console.log('Moving files from eventos/3/ to eventos/1/...');
  
  // Mover archivos originales
  const [originalFiles] = await bucket.getFiles({ prefix: 'eventos/3/originales/' });
  for (const file of originalFiles) {
    const newName = file.name.replace('eventos/3/', 'eventos/1/');
    await file.move(newName);
    console.log(`Moved: ${file.name} -> ${newName}`);
  }
  
  // Mover archivos web
  const [webFiles] = await bucket.getFiles({ prefix: 'eventos/3/web/' });
  for (const file of webFiles) {
    const newName = file.name.replace('eventos/3/', 'eventos/1/');
    await file.move(newName);
    console.log(`Moved: ${file.name} -> ${newName}`);
  }
  
  // Mover miniaturas
  const [thumbnailFiles] = await bucket.getFiles({ prefix: 'eventos/3/miniaturas/' });
  for (const file of thumbnailFiles) {
    const newName = file.name.replace('eventos/3/', 'eventos/1/');
    await file.move(newName);
    console.log(`Moved: ${file.name} -> ${newName}`);
  }
  
  console.log('Files moved successfully!');
}

// Ejecutar si se llama directamente
if (import.meta.main) {
  moveCloudFiles().catch(console.error);
}