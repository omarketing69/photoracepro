import Tesseract from 'tesseract.js';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';

interface EnhancedOCRResult {
  dorsalNumbers: number[];
  confidence: number;
  text: string;
  allDetectedText: string[];
  regions: Array<{
    text: string;
    confidence: number;
    region: string;
  }>;
}

export class EnhancedOCRProcessor {
  private worker: Tesseract.Worker | null = null;
  private tempDir = path.join(process.cwd(), 'temp', 'enhanced-ocr');

  async initialize() {
    if (!this.worker) {
      this.worker = await Tesseract.createWorker('eng');
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

  async processImage(imagePath: string): Promise<EnhancedOCRResult> {
    await this.initialize();
    
    console.log(`Enhanced OCR processing: ${imagePath}`);
    
    // Create multiple specialized preprocessed versions
    const preprocessedImages = await this.createSpecializedPreprocessing(imagePath);
    
    let allText: string[] = [];
    let allRegions: Array<{ text: string; confidence: number; region: string }> = [];
    let bestDorsals: number[] = [];
    let bestConfidence = 0;

    // Process each preprocessed version with different OCR configurations
    for (const { imagePath: processedPath, region } of preprocessedImages) {
      try {
        const configs = [
          // Configuration for single numbers (dorsals)
          {
            tessedit_pageseg_mode: Tesseract.PSM.SINGLE_WORD,
            tessedit_char_whitelist: '0123456789',
            tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY
          },
          // Configuration for single characters
          {
            tessedit_pageseg_mode: Tesseract.PSM.SINGLE_CHAR,
            tessedit_char_whitelist: '0123456789',
            tessedit_ocr_engine_mode: Tesseract.OEM.TESSERACT_LSTM_COMBINED
          },
          // Configuration for blocks of text
          {
            tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
            tessedit_char_whitelist: '0123456789',
            tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY
          }
        ];

        for (const config of configs) {
          await this.worker!.setParameters(config);
          const { data } = await this.worker!.recognize(processedPath);
          
          if (data.text && data.text.trim()) {
            allText.push(data.text.trim());
            allRegions.push({
              text: data.text.trim(),
              confidence: data.confidence,
              region: `${region}_${config.tessedit_pageseg_mode}`
            });

            const dorsals = this.extractDorsalNumbers(data.text);
            if (dorsals.length > 0 && data.confidence > bestConfidence) {
              bestDorsals = dorsals;
              bestConfidence = data.confidence;
            }
          }
        }
      } catch (error) {
        console.error(`Error processing ${processedPath}:`, error);
      }
    }

    // Clean up temp files
    await this.cleanupTempFiles(preprocessedImages.map(p => p.imagePath));

    // Extract all possible dorsals from all text
    const allDorsals = new Set<number>();
    allText.forEach(text => {
      const dorsals = this.extractDorsalNumbers(text);
      dorsals.forEach(d => allDorsals.add(d));
    });

    // Also try to form dorsals from individual digits
    const individualDigits = allText
      .join(' ')
      .split(/\s+/)
      .filter(text => /^\d+$/.test(text))
      .map(d => parseInt(d))
      .filter(d => d >= 0 && d <= 9);

    // Try to form 4-digit dorsals from individual digits
    if (individualDigits.length >= 4) {
      for (let i = 0; i <= individualDigits.length - 4; i++) {
        const dorsalCandidate = parseInt(
          individualDigits.slice(i, i + 4).join('')
        );
        if (dorsalCandidate >= 1000 && dorsalCandidate <= 9999) {
          allDorsals.add(dorsalCandidate);
        }
      }
    }

    const finalResult: EnhancedOCRResult = {
      dorsalNumbers: Array.from(allDorsals).sort((a, b) => a - b),
      confidence: bestConfidence / 100,
      text: allText.join(' | '),
      allDetectedText: allText,
      regions: allRegions
    };

    console.log(`Enhanced OCR results for ${imagePath}:`, {
      dorsals: finalResult.dorsalNumbers,
      totalText: allText.length,
      confidence: finalResult.confidence
    });

    return finalResult;
  }

  private async createSpecializedPreprocessing(imagePath: string): Promise<Array<{ imagePath: string; region: string }>> {
    const results: Array<{ imagePath: string; region: string }> = [];
    const baseFilename = path.basename(imagePath, path.extname(imagePath));

    try {
      const image = sharp(imagePath);
      const metadata = await image.metadata();
      
      if (!metadata.width || !metadata.height) {
        throw new Error('Could not get image dimensions');
      }

      // 1. Full image - high contrast
      const fullHighContrast = path.join(this.tempDir, `${baseFilename}_full_contrast.png`);
      await image
        .grayscale()
        .normalize()
        .linear(2.0, -(128 * 2.0) + 128) // High contrast
        .sharpen({ sigma: 1, m1: 1, m2: 2 })
        .png()
        .toFile(fullHighContrast);
      results.push({ imagePath: fullHighContrast, region: 'full_contrast' });

      // 2. Full image - binarized
      const fullBinary = path.join(this.tempDir, `${baseFilename}_full_binary.png`);
      await image
        .grayscale()
        .normalize()
        .threshold(128)
        .png()
        .toFile(fullBinary);
      results.push({ imagePath: fullBinary, region: 'full_binary' });

      // 3. Chest region (upper middle) - where dorsals usually are
      const chestRegion = path.join(this.tempDir, `${baseFilename}_chest.png`);
      const chestTop = Math.max(0, Math.floor(metadata.height * 0.2));
      const chestHeight = Math.min(metadata.height - chestTop, Math.floor(metadata.height * 0.4));
      
      if (chestHeight > 10) { // Only create if region is meaningful
        await image
          .extract({ 
            left: 0, 
            top: chestTop, 
            width: metadata.width, 
            height: chestHeight 
          })
          .grayscale()
          .normalize()
          .linear(3.0, -(128 * 3.0) + 128) // Very high contrast for chest
          .sharpen({ sigma: 2, m1: 1, m2: 3 })
          .resize({ width: Math.min(metadata.width * 2, 4000) }) // Upscale but limit size
          .png()
          .toFile(chestRegion);
        results.push({ imagePath: chestRegion, region: 'chest' });
      }

      // 4. Upper body region
      const upperRegion = path.join(this.tempDir, `${baseFilename}_upper.png`);
      const upperHeight = Math.min(metadata.height, Math.floor(metadata.height * 0.6));
      
      if (upperHeight > 10) {
        await image
          .extract({ 
            left: 0, 
            top: 0, 
            width: metadata.width, 
            height: upperHeight 
          })
          .grayscale()
          .normalize()
          .linear(2.5, -(128 * 2.5) + 128)
          .threshold(120)
          .png()
          .toFile(upperRegion);
        results.push({ imagePath: upperRegion, region: 'upper' });
      }

      // 5. Legs region (lower part) - sometimes dorsals are on legs
      const legsRegion = path.join(this.tempDir, `${baseFilename}_legs.png`);
      const legsTop = Math.max(0, Math.floor(metadata.height * 0.6));
      const legsHeight = Math.min(metadata.height - legsTop, Math.floor(metadata.height * 0.4));
      
      if (legsHeight > 10) {
        await image
          .extract({ 
            left: 0, 
            top: legsTop, 
            width: metadata.width, 
            height: legsHeight 
          })
          .grayscale()
          .normalize()
          .linear(2.0, -(128 * 2.0) + 128)
          .sharpen()
          .png()
          .toFile(legsRegion);
        results.push({ imagePath: legsRegion, region: 'legs' });
      }

    } catch (error) {
      console.error(`Error creating preprocessed versions for ${imagePath}:`, error);
    }

    return results;
  }

  private extractDorsalNumbers(text: string): number[] {
    const dorsals: number[] = [];
    
    // Remove all non-digit characters and spaces
    const cleanText = text.replace(/[^\d\s]/g, ' ');
    
    // Look for 4-digit numbers (typical race dorsals)
    const fourDigitMatches = cleanText.match(/\b\d{4}\b/g);
    if (fourDigitMatches) {
      fourDigitMatches.forEach(match => {
        const dorsal = parseInt(match);
        if (dorsal >= 1000 && dorsal <= 9999) {
          dorsals.push(dorsal);
        }
      });
    }

    // Look for 3-digit numbers
    const threeDigitMatches = cleanText.match(/\b\d{3}\b/g);
    if (threeDigitMatches) {
      threeDigitMatches.forEach(match => {
        const dorsal = parseInt(match);
        if (dorsal >= 100 && dorsal <= 999) {
          dorsals.push(dorsal);
        }
      });
    }

    // Look for 2-digit numbers
    const twoDigitMatches = cleanText.match(/\b\d{2}\b/g);
    if (twoDigitMatches) {
      twoDigitMatches.forEach(match => {
        const dorsal = parseInt(match);
        if (dorsal >= 10 && dorsal <= 99) {
          dorsals.push(dorsal);
        }
      });
    }

    // Look for 1-digit numbers
    const oneDigitMatches = cleanText.match(/\b\d{1}\b/g);
    if (oneDigitMatches) {
      oneDigitMatches.forEach(match => {
        const dorsal = parseInt(match);
        if (dorsal >= 1 && dorsal <= 9) {
          dorsals.push(dorsal);
        }
      });
    }

    return [...new Set(dorsals)]; // Remove duplicates
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

export const enhancedOCRProcessor = new EnhancedOCRProcessor();

export async function processImageWithEnhancedOCR(imagePath: string): Promise<EnhancedOCRResult> {
  return await enhancedOCRProcessor.processImage(imagePath);
}