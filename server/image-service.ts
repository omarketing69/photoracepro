import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

export class ImageService {
  private thumbnailsDir = path.join(process.cwd(), 'uploads', 'thumbnails');
  private webDir = path.join(process.cwd(), 'uploads', 'web');

  constructor() {
    this.ensureDirectories();
  }

  private ensureDirectories() {
    if (!fs.existsSync(this.thumbnailsDir)) {
      fs.mkdirSync(this.thumbnailsDir, { recursive: true });
    }
    if (!fs.existsSync(this.webDir)) {
      fs.mkdirSync(this.webDir, { recursive: true });
    }
  }

  async generateThumbnail(originalPath: string, filename: string): Promise<string> {
    const thumbnailPath = path.join(this.thumbnailsDir, `thumb_${filename}`);
    
    try {
      await sharp(originalPath)
        .resize(200, 200, { 
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 80 })
        .toFile(thumbnailPath);
      
      return thumbnailPath;
    } catch (error) {
      console.error(`Error generating thumbnail for ${originalPath}:`, error);
      throw error;
    }
  }

  async generateWebVersion(originalPath: string, filename: string): Promise<string> {
    const webPath = path.join(this.webDir, `web_${filename}`);
    
    try {
      await sharp(originalPath)
        .resize(800, 1200, { 
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: 85 })
        .toFile(webPath);
      
      return webPath;
    } catch (error) {
      console.error(`Error generating web version for ${originalPath}:`, error);
      throw error;
    }
  }

  async processImageVersions(originalPath: string, filename: string): Promise<{ thumbnailPath: string; webPath: string }> {
    const thumbnailPath = await this.generateThumbnail(originalPath, filename);
    const webPath = await this.generateWebVersion(originalPath, filename);
    
    return { thumbnailPath, webPath };
  }
}

export const imageService = new ImageService();