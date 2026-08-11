import { getCloudStorage } from './cloud-storage';
import sharp from 'sharp';

export async function createMissingThumbnailOnDemand(filename: string, eventId: number): Promise<string | null> {
  console.log(`🚀 EMERGENCY THUMBNAIL: Creating ${filename} for event ${eventId}`);
  
  try {
    const cloudStorage = getCloudStorage();
    
    // Try to find original with timestamp prefix
    const originalsList = await cloudStorage.listEventFiles(eventId, 'originales');
    console.log(`🔍 Found ${originalsList.length} originals in event ${eventId}`);
    
    // Look for file that ends with our filename (handles timestamp prefix)
    const originalMatch = originalsList.find(file => 
      file.endsWith(`-${filename}`) || file === filename
    );
    
    if (!originalMatch) {
      console.log(`❌ No original found for ${filename}`);
      return null;
    }
    
    console.log(`✅ Found original: ${originalMatch}`);
    
    // Get original file
    const originalPath = `eventos/${eventId}/originales/${originalMatch}`;
    const originalUrl = await cloudStorage.generateSignedUrl(originalPath, 5);
    const originalResponse = await fetch(originalUrl);
    
    if (!originalResponse.ok) {
      console.log(`❌ Failed to fetch original: ${originalResponse.status}`);
      return null;
    }
    
    const originalBuffer = Buffer.from(await originalResponse.arrayBuffer());
    console.log(`📸 Original image size: ${originalBuffer.length} bytes`);
    
    // Generate thumbnail
    const thumbnailBuffer = await sharp(originalBuffer)
      .resize(200, 200, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    
    console.log(`🖼️ Thumbnail generated: ${thumbnailBuffer.length} bytes`);
    
    // Upload thumbnail with clean filename (no timestamp)
    const thumbnailPath = await cloudStorage.uploadThumbnail(eventId, filename, thumbnailBuffer);
    console.log(`✅ Thumbnail uploaded: ${thumbnailPath}`);
    
    // Generate serving URL
    const thumbnailUrl = await cloudStorage.generateSignedUrl(thumbnailPath, 60);
    console.log(`🔗 Thumbnail URL: ${thumbnailUrl}`);
    
    return thumbnailUrl;
    
  } catch (error) {
    console.error(`❌ Emergency thumbnail creation failed for ${filename}:`, error);
    return null;
  }
}