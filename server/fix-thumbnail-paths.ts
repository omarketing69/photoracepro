import { db } from './db';
import { photos } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { getCloudStorage } from './cloud-storage';

// Mapeo de archivos existentes en Google Cloud Storage
const existingThumbnails = {
  'anderson-4.jpg': 'eventos/3/miniaturas/eventos/1/1751929831565-anderson-4.jpg',
  'anderson-61.jpg': 'eventos/3/miniaturas/eventos/1/1751929866816-anderson-61.jpg',
  'anderson-62.jpg': 'eventos/3/miniaturas/eventos/1/1751929872237-anderson-62.jpg',
  'anderson-63.jpg': 'eventos/3/miniaturas/eventos/1/1751929877184-anderson-63.jpg',
  'anderson-80.jpg': 'eventos/3/miniaturas/eventos/1/1751929881418-anderson-80.jpg',
  'anderson-91.jpg': 'eventos/3/miniaturas/eventos/1/1751929886221-anderson-91.jpg',
  'anderson-104.jpg': 'eventos/3/miniaturas/eventos/1/1751930165009-anderson-104.jpg',
  'anderson-110.jpg': 'eventos/3/miniaturas/eventos/1/1751930170597-anderson-110.jpg',
  'anderson-128.jpg': 'eventos/3/miniaturas/eventos/1/1751930176004-anderson-128.jpg',
  'anderson-102.jpg': 'eventos/3/miniaturas/eventos/1/1751929872237-anderson-62.jpg' // Misma miniatura que 62
};

export async function fixThumbnailPaths() {
  console.log('Fixing thumbnail paths...');
  
  let fixed = 0;
  let notFound = 0;
  
  for (const [filename, thumbnailPath] of Object.entries(existingThumbnails)) {
    try {
      const result = await db
        .update(photos)
        .set({ thumbnailPath })
        .where(eq(photos.filename, filename))
        .returning();
      
      if (result.length > 0) {
        console.log(`✅ Fixed ${filename} -> ${thumbnailPath}`);
        fixed++;
      } else {
        console.log(`❌ Photo not found: ${filename}`);
        notFound++;
      }
    } catch (error) {
      console.error(`Error fixing ${filename}:`, error);
    }
  }
  
  console.log(`\nSummary: ${fixed} fixed, ${notFound} not found`);
  return { fixed, notFound };
}

// Función para verificar qué miniaturas existen realmente
export async function verifyThumbnailsExist() {
  const cloudStorage = getCloudStorage();
  
  console.log('Verifying thumbnails exist in Google Cloud Storage...');
  
  for (const [filename, thumbnailPath] of Object.entries(existingThumbnails)) {
    try {
      const signedUrl = await cloudStorage.generateSignedUrl(thumbnailPath, 1);
      console.log(`✅ ${filename} -> ${signedUrl.substring(0, 80)}...`);
    } catch (error) {
      console.log(`❌ ${filename} -> NOT FOUND`);
    }
  }
}

// Ejecutar si se llama directamente
if (import.meta.main) {
  fixThumbnailPaths().catch(console.error);
}