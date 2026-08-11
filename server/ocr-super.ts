import Tesseract from 'tesseract.js';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';

interface SuperOCRResult {
  dorsalNumbers: number[];
  confidence: number;
  text: string;
  details: string[];
}

export class SuperOCRProcessor {
  private worker: Tesseract.Worker | null = null;
  private tempDir = path.join(process.cwd(), 'temp', 'super-ocr');

  async initialize() {
    if (!this.worker) {
      this.worker = await Tesseract.createWorker('eng');
      // Configuration optimized for digits only
      await this.worker.setParameters({
        tessedit_char_whitelist: '0123456789',
        tessedit_pageseg_mode: Tesseract.PSM.AUTO,
      });
    }

    // Ensure temp directory exists
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      // Directory already exists
    }
  }

  async processImage(imagePath: string): Promise<SuperOCRResult> {
    await this.initialize();
    
    console.log(`Super OCR processing: ${imagePath}`);
    
    const baseFilename = path.basename(imagePath, path.extname(imagePath));
    const details: string[] = [];
    let allText: string[] = [];
    let bestDorsals: number[] = [];
    let bestConfidence = 0;

    try {
      // Create 8 different preprocessing versions optimized for dorsal detection
      const versions = await this.createDorsalOptimizedVersions(imagePath, baseFilename);
      
      // Process each version with OCR
      for (const { imagePath: processedPath, description } of versions) {
        try {
          const { data } = await this.worker!.recognize(processedPath);
          
          if (data.text && data.text.trim()) {
            const cleanText = data.text.trim();
            allText.push(cleanText);
            details.push(`${description}: "${cleanText}" (conf: ${data.confidence.toFixed(1)}%)`);
            
            const dorsals = this.extractDorsalNumbers(cleanText);
            if (dorsals.length > 0) {
              bestDorsals = [...bestDorsals, ...dorsals];
              if (data.confidence > bestConfidence) {
                bestConfidence = data.confidence;
              }
            }
          }
        } catch (error) {
          details.push(`${description}: Error - ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Clean up temp files
      await this.cleanupTempFiles(versions.map(v => v.imagePath));

      // Remove duplicates and sort dorsals
      const uniqueDorsals = Array.from(new Set(bestDorsals)).sort((a, b) => a - b);

      // Try to find 4-digit dorsals specifically in the 1000-9999 range
      const fourDigitDorsals = uniqueDorsals.filter(d => d >= 1000 && d <= 9999);
      
      // If we have 4-digit dorsals, prioritize them
      const finalDorsals = fourDigitDorsals.length > 0 ? fourDigitDorsals : uniqueDorsals;

      console.log(`Super OCR results for ${imagePath}:`, {
        dorsals: finalDorsals,
        totalVersions: versions.length,
        bestConfidence: bestConfidence.toFixed(1) + '%'
      });

      return {
        dorsalNumbers: finalDorsals,
        confidence: bestConfidence / 100,
        text: allText.join(' | '),
        details
      };

    } catch (error) {
      console.error(`Super OCR error for ${imagePath}:`, error);
      return {
        dorsalNumbers: [],
        confidence: 0,
        text: '',
        details: [`Error: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  private async createDorsalOptimizedVersions(imagePath: string, baseFilename: string): Promise<Array<{ imagePath: string; description: string }>> {
    const versions: Array<{ imagePath: string; description: string }> = [];

    try {
      const image = sharp(imagePath);
      const metadata = await image.metadata();
      
      if (!metadata.width || !metadata.height) {
        throw new Error('Could not get image dimensions');
      }

      // Version 1: High contrast grayscale
      const v1Path = path.join(this.tempDir, `${baseFilename}_v1_high_contrast.png`);
      await image
        .grayscale()
        .normalize()
        .linear(4.0, -(128 * 4.0) + 128) // Very high contrast
        .png()
        .toFile(v1Path);
      versions.push({ imagePath: v1Path, description: 'High Contrast' });

      // Version 2: Binarized (black and white)
      const v2Path = path.join(this.tempDir, `${baseFilename}_v2_binary.png`);
      await image
        .grayscale()
        .normalize()
        .threshold(128)
        .png()
        .toFile(v2Path);
      versions.push({ imagePath: v2Path, description: 'Binary' });

      // Version 3: Sharpened
      const v3Path = path.join(this.tempDir, `${baseFilename}_v3_sharp.png`);
      await image
        .grayscale()
        .normalize()
        .sharpen({ sigma: 3, m1: 1, m2: 3 })
        .png()
        .toFile(v3Path);
      versions.push({ imagePath: v3Path, description: 'Sharpened' });

      // Version 4: Upscaled 2x for better OCR
      const v4Path = path.join(this.tempDir, `${baseFilename}_v4_upscaled.png`);
      await image
        .grayscale()
        .normalize()
        .resize({ width: Math.min(metadata.width * 2, 6000) })
        .linear(2.0, -(128 * 2.0) + 128)
        .png()
        .toFile(v4Path);
      versions.push({ imagePath: v4Path, description: 'Upscaled 2x' });

      // Version 5: Adaptive threshold
      const v5Path = path.join(this.tempDir, `${baseFilename}_v5_adaptive.png`);
      await image
        .grayscale()
        .normalize()
        .threshold(110)
        .png()
        .toFile(v5Path);
      versions.push({ imagePath: v5Path, description: 'Adaptive Threshold' });

      // Version 6: Extremely high contrast
      const v6Path = path.join(this.tempDir, `${baseFilename}_v6_extreme.png`);
      await image
        .grayscale()
        .normalize()
        .linear(6.0, -(128 * 6.0) + 128)
        .threshold(128)
        .png()
        .toFile(v6Path);
      versions.push({ imagePath: v6Path, description: 'Extreme Contrast' });

      // Version 7: Inverted (for white text on dark background)
      const v7Path = path.join(this.tempDir, `${baseFilename}_v7_inverted.png`);
      await image
        .grayscale()
        .normalize()
        .negate()
        .linear(2.0, -(128 * 2.0) + 128)
        .png()
        .toFile(v7Path);
      versions.push({ imagePath: v7Path, description: 'Inverted' });

      // Version 8: Gamma corrected
      const v8Path = path.join(this.tempDir, `${baseFilename}_v8_gamma.png`);
      await image
        .grayscale()
        .normalize()
        .gamma(1.5) // Gamma correction (must be between 1.0 and 3.0)
        .linear(3.0, -(128 * 3.0) + 128)
        .png()
        .toFile(v8Path);
      versions.push({ imagePath: v8Path, description: 'Gamma Corrected' });

    } catch (error) {
      console.error(`Error creating versions for ${imagePath}:`, error);
    }

    return versions;
  }

  private extractDorsalNumbers(text: string): number[] {
    const dorsals: number[] = [];
    
    // Clean text of all non-digit characters
    const cleanText = text.replace(/[^\d\s]/g, ' ').trim();
    
    // Split by whitespace and filter digits
    const parts = cleanText.split(/\s+/).filter(part => /^\d+$/.test(part));
    
    for (const part of parts) {
      // Look for 4-digit dorsals (1000-9999) - most common in races
      if (part.length === 4) {
        const dorsal = parseInt(part);
        if (dorsal >= 1000 && dorsal <= 9999) {
          dorsals.push(dorsal);
        }
      }
      // Look for 3-digit dorsals (100-999)
      else if (part.length === 3) {
        const dorsal = parseInt(part);
        if (dorsal >= 100 && dorsal <= 999) {
          dorsals.push(dorsal);
        }
      }
      // Look for 2-digit dorsals (10-99)
      else if (part.length === 2) {
        const dorsal = parseInt(part);
        if (dorsal >= 10 && dorsal <= 99) {
          dorsals.push(dorsal);
        }
      }
      // Look for 1-digit dorsals (1-9)
      else if (part.length === 1) {
        const dorsal = parseInt(part);
        if (dorsal >= 1 && dorsal <= 9) {
          dorsals.push(dorsal);
        }
      }
    }

    // Also look for patterns like separated digits that could form dorsals
    const digits = cleanText.replace(/\s/g, '').split('').filter(c => /\d/.test(c));
    
    // Try to form 4-digit dorsals from consecutive digits
    for (let i = 0; i <= digits.length - 4; i++) {
      const potential4Digit = parseInt(digits.slice(i, i + 4).join(''));
      if (potential4Digit >= 1000 && potential4Digit <= 9999) {
        dorsals.push(potential4Digit);
      }
    }

    return Array.from(new Set(dorsals)); // Remove duplicates
  }

  private async cleanupTempFiles(filePaths: string[]) {
    for (const filePath of filePaths) {
      try {
        await fs.unlink(filePath);
      } catch (error) {
        // File might not exist, ignore error
      }
    }
  }

  async terminate() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}

export const superOCRProcessor = new SuperOCRProcessor();

export async function processImageWithSuperOCR(imagePath: string): Promise<SuperOCRResult> {
  return await superOCRProcessor.processImage(imagePath);
}