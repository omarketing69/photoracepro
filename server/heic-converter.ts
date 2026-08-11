// @ts-ignore - heic-convert doesn't have TypeScript types
import convert from 'heic-convert';
import path from 'path';

/**
 * HEIC/HEIF to JPEG Converter
 * Converts iPhone HEIC/HEIF photos to JPEG for Sharp processing
 */
export class HeicConverter {
  
  /**
   * Check if file is HEIC/HEIF format
   */
  static isHeicFile(file: Express.Multer.File): boolean {
    const isHeicMime = file.mimetype === 'image/heic' || file.mimetype === 'image/heif';
    const isHeicExt = /\.(heic|heif)$/i.test(file.originalname);
    return isHeicMime || isHeicExt;
  }

  /**
   * Convert HEIC/HEIF buffer to JPEG buffer
   */
  static async convertToJpeg(inputBuffer: Buffer): Promise<Buffer> {
    try {
      console.log(`🔄 [HEIC] Converting HEIC/HEIF to JPEG...`);
      
      const outputBuffer = await convert({
        buffer: inputBuffer,
        format: 'JPEG',
        quality: 0.9 // High quality conversion
      });

      console.log(`✅ [HEIC] Conversion successful: ${inputBuffer.length} → ${outputBuffer.length} bytes`);
      return outputBuffer;
      
    } catch (error) {
      console.error(`❌ [HEIC] Conversion failed:`, error);
      throw new Error(`Failed to convert HEIC/HEIF: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Process file: convert HEIC/HEIF to JPEG if needed
   */
  static async processFile(file: Express.Multer.File): Promise<{
    buffer: Buffer;
    filename: string;
    mimetype: string;
  }> {
    
    // Read file buffer
    const fs = await import('fs');
    const inputBuffer = fs.readFileSync(file.path);
    
    // If not HEIC/HEIF, return original
    if (!this.isHeicFile(file)) {
      return {
        buffer: inputBuffer,
        filename: file.originalname,
        mimetype: file.mimetype
      };
    }

    // Convert HEIC/HEIF to JPEG
    console.log(`📱 [HEIC] Processing iPhone photo: ${file.originalname}`);
    const jpegBuffer = await this.convertToJpeg(inputBuffer);
    
    // Generate new filename with .jpg extension
    const baseName = path.parse(file.originalname).name;
    const newFilename = `${baseName}.jpg`;
    
    return {
      buffer: jpegBuffer,
      filename: newFilename,
      mimetype: 'image/jpeg'
    };
  }
}