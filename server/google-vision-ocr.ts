import { ImageAnnotatorClient } from '@google-cloud/vision';
import fs from 'fs';
import path from 'path';
import { CloudPhotoStorage } from './cloud-storage';

interface GoogleVisionResult {
  dorsalNumbers: number[];
  confidence: number;
  allText: string;
  detectedWords: Array<{
    text: string;
    confidence: number;
    boundingBox?: any;
  }>;
  // true = Vision API call completed without error (even if 0 dorsals were found).
  // false = the API call itself failed (quota, network, auth) after retries were exhausted.
  success: boolean;
}

// Races on this platform default to dorsal range 1–1600. Callers can override
// per event via `event.maxDorsalNumber` when it differs from the default.
export const DEFAULT_MAX_DORSAL = 1600;

export interface FaceAnnotation {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  landmarks: Array<{ type: string; x: number; y: number }>;
  landmarkVector: number[];
  joyLikelihood: string;
  sorrowLikelihood: string;
  angerLikelihood: string;
  surpriseLikelihood: string;
}

export class GoogleVisionOCRProcessor {
  private client: ImageAnnotatorClient;
  private cloudStorage: CloudPhotoStorage;
  private rateLimiter: {
    tokens: number;
    lastRefill: number;
    maxTokens: number;
    refillRate: number; // tokens per second
  };

  constructor(cloudStorage: CloudPhotoStorage) {
    this.cloudStorage = cloudStorage;
    
    // SECURE: Use environment-based credentials only (unified with CloudPhotoStorage)
    try {
      const credentialsJson = process.env.GOOGLE_CREDENTIALS_JSON;
      
      if (!credentialsJson) {
        throw new Error('GOOGLE_CREDENTIALS_JSON environment variable is required');
      }
      
      let credentialsObj;
      try {
        credentialsObj = JSON.parse(credentialsJson);
      } catch (parseError) {
        throw new Error('GOOGLE_CREDENTIALS_JSON contains invalid JSON');
      }
      
      this.client = new ImageAnnotatorClient({
        credentials: credentialsObj
      });
      
      console.log('✅ [SECURE] Vision API using environment-based credentials (unified with CloudPhotoStorage)');
      
    } catch (error) {
      console.error('❌ [VISION] Failed to initialize with environment credentials:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Could not initialize Google Vision client: ${errorMessage}`);
    }

    // Initialize rate limiter for 6,000 photos (8-12 QPS, burst 16)
    this.rateLimiter = {
      tokens: 16, // Burst capacity
      lastRefill: Date.now(),
      maxTokens: 16,
      refillRate: 10 // 10 tokens per second for sustained throughput
    };
    
    console.log('⚡ [RATE LIMITER] Initialized for high-volume processing (10 QPS, burst 16)');
  }

  private async waitForToken(): Promise<void> {
    this.refillTokens();
    
    if (this.rateLimiter.tokens >= 1) {
      this.rateLimiter.tokens--;
      return;
    }
    
    // Wait for next token
    const waitTime = 1000 / this.rateLimiter.refillRate; // milliseconds per token
    console.log(`⏳ [RATE LIMITER] Waiting ${waitTime}ms for next token`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    
    return this.waitForToken(); // Recursive wait
  }
  
  private refillTokens(): void {
    const now = Date.now();
    const elapsed = (now - this.rateLimiter.lastRefill) / 1000; // seconds
    const tokensToAdd = Math.floor(elapsed * this.rateLimiter.refillRate);
    
    if (tokensToAdd > 0) {
      this.rateLimiter.tokens = Math.min(
        this.rateLimiter.maxTokens,
        this.rateLimiter.tokens + tokensToAdd
      );
      this.rateLimiter.lastRefill = now;
    }
  }

  async processImage(imagePath: string, maxDorsal: number = DEFAULT_MAX_DORSAL): Promise<GoogleVisionResult> {
    return this.processImageWithRetry(imagePath, 0, maxDorsal);
  }

  private async processImageWithRetry(imagePath: string, attempt: number, maxDorsal: number = DEFAULT_MAX_DORSAL): Promise<GoogleVisionResult> {
    try {
      // Rate limiting for 6,000 photos
      await this.waitForToken();
      
      console.log(`🔍 Procesando con Google Vision OCR: ${imagePath} (intento ${attempt + 1})`);
      
      // Try local file first, then fallback to GCS
      let result: any;
      
      if (fs.existsSync(imagePath)) {
        // Local file processing (for backward compatibility)
        const imageBuffer = fs.readFileSync(imagePath);
        [result] = await this.client.textDetection({
          image: { content: imageBuffer }
        });
        console.log(`📁 Procesado desde archivo local: ${imagePath}`);
      } else {
        // Process from Google Cloud Storage
        console.log(`☁️ Archivo local no encontrado, procesando desde GCS: ${imagePath}`);
        [result] = await this.processImageFromGCSInternal(imagePath);
      }
      
      if (!result) {
        throw new Error(`Failed to process image from both local and GCS: ${imagePath}`);
      }
      
      // Process results
      const processedResult = this.processGoogleVisionResponse(result, maxDorsal);

      console.log(`📊 Google Vision detectó: ${processedResult.dorsalNumbers.length} dorsales`);
      console.log(`📝 Dorsales encontrados: [${processedResult.dorsalNumbers.join(', ')}]`);
      console.log(`📄 Texto completo: "${processedResult.allText.substring(0, 100)}..."`);

      return processedResult;

    } catch (error) {
      console.error(`❌ Error con Google Vision OCR (intento ${attempt + 1}):`, error);

      // Handle 429 rate limit errors with exponential backoff
      if (error instanceof Error && (error.message.includes('429') || error.message.includes('RATE_LIMIT'))) {
        const maxRetries = 5;
        if (attempt < maxRetries) {
          const backoffDelay = Math.min(1000 * Math.pow(2, attempt), 10000); // Max 10 seconds
          console.log(`⚠️ [RATE LIMIT] API rate limited, retrying in ${backoffDelay}ms (intento ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          return this.processImageWithRetry(imagePath, attempt + 1, maxDorsal);
        }
      }

      // Return fallback result after exhausting retries — success:false lets
      // callers distinguish a real API failure from a legitimate 0-dorsal result.
      return {
        dorsalNumbers: [],
        confidence: 0,
        allText: '',
        detectedWords: [],
        success: false
      };
    }
  }

  /**
   * Process image directly from Buffer (required by preflight validation)
   */
  async processImageBuffer(imageBuffer: Buffer, maxDorsal: number = DEFAULT_MAX_DORSAL): Promise<GoogleVisionResult> {
    try {
      console.log(`🔍 Procesando buffer de imagen con Google Vision OCR (${imageBuffer.length} bytes)`);
      
      // Process image buffer directly
      const [result] = await this.client.textDetection({
        image: { content: imageBuffer }
      });
      
      if (!result) {
        throw new Error(`Failed to process image buffer`);
      }

      // CRITICAL: Check for Vision API errors in response
      if (result.error) {
        console.error(`❌ [VISION-ERROR] Google Vision returned error: ${result.error.message}`);
        throw new Error(`Google Vision API error: ${result.error.message}`);
      }
      
      // Process results
      const processedResult = this.processGoogleVisionResponse(result, maxDorsal);

      console.log(`📊 Google Vision (buffer) detectó: ${processedResult.dorsalNumbers.length} dorsales`);
      console.log(`📝 Dorsales encontrados: [${processedResult.dorsalNumbers.join(', ')}]`);
      console.log(`📄 Texto completo: "${processedResult.allText.substring(0, 100)}..."`);

      return processedResult;

    } catch (error) {
      console.error('❌ Error con Google Vision OCR (buffer):', error);

      // Return fallback result — success:false lets callers distinguish a real
      // API failure from a legitimate 0-dorsal result.
      return {
        dorsalNumbers: [],
        confidence: 0,
        allText: '',
        detectedWords: [],
        success: false
      };
    }
  }

  /**
   * Detect faces in an image buffer using Google Vision FACE_DETECTION
   * Returns face annotations with landmarks for selfie comparison
   */
  async detectFacesFromBuffer(imageBuffer: Buffer): Promise<FaceAnnotation[]> {
    try {
      return await this.detectFacesCore(imageBuffer);
    } catch (error) {
      console.error('❌ [FACE] Error detecting faces:', error);
      return [];
    }
  }

  /**
   * Same as detectFacesFromBuffer but also reports whether the Vision API
   * call itself failed, so callers can distinguish "0 faces found" (success)
   * from "the API call errored" (failure) instead of treating both the same.
   */
  async detectFacesFromBufferWithStatus(imageBuffer: Buffer): Promise<{ faces: FaceAnnotation[]; success: boolean }> {
    try {
      const faces = await this.detectFacesCore(imageBuffer);
      return { faces, success: true };
    } catch (error) {
      console.error('❌ [FACE] Error detecting faces:', error);
      return { faces: [], success: false };
    }
  }

  private async detectFacesCore(imageBuffer: Buffer): Promise<FaceAnnotation[]> {
    {
      console.log(`🔍 [FACE] Detecting faces in buffer (${imageBuffer.length} bytes)`);

      const [result] = await this.client.faceDetection({
        image: { content: imageBuffer }
      });

      if (!result || !result.faceAnnotations || result.faceAnnotations.length === 0) {
        console.log('🔍 [FACE] No faces detected');
        return [];
      }

      const faces: FaceAnnotation[] = [];

      for (const face of result.faceAnnotations) {
        const boundingPoly = face.fdBoundingPoly || face.boundingPoly;
        if (!boundingPoly || !boundingPoly.vertices || boundingPoly.vertices.length < 4) {
          continue;
        }

        const vertices = boundingPoly.vertices;
        const x = vertices[0]?.x || 0;
        const y = vertices[0]?.y || 0;
        const width = (vertices[2]?.x || 0) - x;
        const height = (vertices[2]?.y || 0) - y;

        const KEY_LANDMARKS = ['LEFT_EYE', 'RIGHT_EYE', 'NOSE_TIP', 'MOUTH_LEFT', 'MOUTH_RIGHT', 'LEFT_EAR_TRAGION', 'RIGHT_EAR_TRAGION'];
        // Google Vision can return landmark.type as a string ("LEFT_EYE") OR as a
        // numeric proto enum value (1 = LEFT_EYE, 2 = RIGHT_EYE, …).
        // Map both so we never silently drop landmarks.
        const LANDMARK_NUM_TO_NAME: Record<number, string> = {
          1: 'LEFT_EYE', 2: 'RIGHT_EYE', 8: 'NOSE_TIP',
          11: 'MOUTH_LEFT', 12: 'MOUTH_RIGHT',
          27: 'LEFT_EAR_TRAGION', 28: 'RIGHT_EAR_TRAGION',
        };
        const landmarks: Array<{ type: string; x: number; y: number }> = [];

        for (const landmark of face.landmarks || []) {
          let landmarkType = String(landmark.type || '');
          // If type came as a number, convert to canonical string name
          const numericType = Number(landmark.type);
          if (!isNaN(numericType) && LANDMARK_NUM_TO_NAME[numericType]) {
            landmarkType = LANDMARK_NUM_TO_NAME[numericType];
          }
          if (KEY_LANDMARKS.includes(landmarkType) && landmark.position) {
            landmarks.push({
              type: landmarkType,
              x: landmark.position.x || 0,
              y: landmark.position.y || 0
            });
          }
        }
        // Log raw types from Vision API to diagnose string vs numeric format
        const rawTypes = (face.landmarks || []).map((l: any) => l.type).slice(0, 5);
        console.log(`🔍 [FACE] Raw landmark types from Vision (first 5): ${JSON.stringify(rawTypes)}`);
        console.log(`🔍 [FACE] Matched landmarks: ${landmarks.map(l => l.type).join(', ') || 'none'}`);

        const landmarkVector = this.extractLandmarkVector(landmarks);
        console.log(`🔍 [FACE] landmarkVector length: ${landmarkVector.length} (${landmarkVector.length > 0 ? '✅ usable for comparison' : '❌ empty - face not comparable'})`);

        faces.push({
          x,
          y,
          width,
          height,
          confidence: face.detectionConfidence || 0.5,
          landmarks,
          landmarkVector,
          joyLikelihood: String(face.joyLikelihood || 'UNKNOWN'),
          sorrowLikelihood: String(face.sorrowLikelihood || 'UNKNOWN'),
          angerLikelihood: String(face.angerLikelihood || 'UNKNOWN'),
          surpriseLikelihood: String(face.surpriseLikelihood || 'UNKNOWN')
        });
      }

      console.log(`✅ [FACE] Detected ${faces.length} face(s)`);
      return faces;
    }
  }

  /**
   * Normalize facial landmarks into a 14-dim comparison vector.
   *
   * Primary: eye-normalized (scale/pose-invariant) when both eyes visible.
   * Fallback: nose-normalized when only one eye or no eyes (common in race
   *   photos where runners look sideways or are motion-blurred).
   * Last resort: returns empty [] only if there are truly 0 landmarks at all.
   */
  extractLandmarkVector(landmarks: Array<{ type: string; x: number; y: number }>): number[] {
    const KEY_LANDMARKS = ['LEFT_EYE', 'RIGHT_EYE', 'NOSE_TIP', 'MOUTH_LEFT', 'MOUTH_RIGHT', 'LEFT_EAR_TRAGION', 'RIGHT_EAR_TRAGION'];

    if (landmarks.length === 0) return [];

    const landmarkMap = new Map<string, { x: number; y: number }>();
    for (const lm of landmarks) {
      landmarkMap.set(lm.type, { x: lm.x, y: lm.y });
    }

    const leftEye = landmarkMap.get('LEFT_EYE');
    const rightEye = landmarkMap.get('RIGHT_EYE');
    const noseTip = landmarkMap.get('NOSE_TIP');
    const mouthLeft = landmarkMap.get('MOUTH_LEFT');
    const mouthRight = landmarkMap.get('MOUTH_RIGHT');

    let refX: number;
    let refY: number;
    let scale: number;

    if (leftEye && rightEye) {
      // Best case: both eyes visible → eye-normalized vector
      const eyeDistance = Math.sqrt(
        Math.pow(rightEye.x - leftEye.x, 2) + Math.pow(rightEye.y - leftEye.y, 2)
      );
      if (eyeDistance < 1) return [];
      refX = (leftEye.x + rightEye.x) / 2;
      refY = (leftEye.y + rightEye.y) / 2;
      scale = eyeDistance;
    } else if (noseTip && (mouthLeft || mouthRight)) {
      // Fallback: nose+mouth visible → nose-normalized (profile shots, one eye hidden)
      const mouth = mouthLeft || mouthRight!;
      const mouthDist = Math.sqrt(
        Math.pow(mouth.x - noseTip.x, 2) + Math.pow(mouth.y - noseTip.y, 2)
      );
      if (mouthDist < 1) return [];
      refX = noseTip.x;
      refY = noseTip.y;
      scale = mouthDist;
    } else {
      // Not enough anchor points to normalize reliably
      return [];
    }

    const vector: number[] = [];
    for (const landmarkType of KEY_LANDMARKS) {
      const lm = landmarkMap.get(landmarkType);
      if (lm) {
        vector.push((lm.x - refX) / scale);
        vector.push((lm.y - refY) / scale);
      } else {
        vector.push(0, 0);
      }
    }

    return vector;
  }

  private processGoogleVisionResponse(result: any, maxDorsal: number = DEFAULT_MAX_DORSAL): GoogleVisionResult {
    const textAnnotations = result.textAnnotations || [];
    const detectedWords: Array<{ text: string; confidence: number; boundingBox?: any }> = [];
    let allText = '';
    
    // First annotation contains all detected text
    if (textAnnotations.length > 0) {
      allText = textAnnotations[0].description || '';
    }
    
    // Process individual words (skip first annotation which is full text)
    for (let i = 1; i < textAnnotations.length; i++) {
      const annotation = textAnnotations[i];
      detectedWords.push({
        text: annotation.description,
        confidence: 95, // Google Vision doesn't provide confidence per word, assume high
        boundingBox: annotation.boundingPoly
      });
    }
    
    // Filter dorsal numbers by size and position to get only the most representative ones
    const dorsalNumbers = this.extractRepresentativeDorsalNumbers(detectedWords, maxDorsal);

    console.log(`🎯 Filtrado inteligente: ${dorsalNumbers.length} dorsales representativos de ${detectedWords.length} elementos detectados`);

    return {
      dorsalNumbers,
      confidence: detectedWords.length > 0 ? 95 : 0, // Google Vision is generally very accurate
      allText: allText.trim(),
      detectedWords,
      success: true
    };
  }

  private extractRepresentativeDorsalNumbers(detectedWords: Array<{ text: string; confidence: number; boundingBox?: any }>, maxDorsal: number = DEFAULT_MAX_DORSAL): number[] {
    // Step 1: Find all potential dorsal numbers with their bounding boxes
    const dorsalCandidates: Array<{ 
      number: number; 
      text: string; 
      boundingBox: any; 
      size: number; 
      centerY: number; 
      centerX: number; 
    }> = [];
    
    detectedWords.forEach(word => {
      if (word.boundingBox && word.boundingBox.vertices && word.boundingBox.vertices.length >= 4) {
        const vertices = word.boundingBox.vertices;
        
        // Calculate bounding box dimensions
        const minX = Math.min(...vertices.map((v: any) => v.x || 0));
        const maxX = Math.max(...vertices.map((v: any) => v.x || 0));
        const minY = Math.min(...vertices.map((v: any) => v.y || 0));
        const maxY = Math.max(...vertices.map((v: any) => v.y || 0));
        
        const width = maxX - minX;
        const height = maxY - minY;
        const size = width * height; // Area of the bounding box
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        
        // Check if this looks like a dorsal number
        const dorsalMatches = this.extractDorsalNumbersFromText(word.text, maxDorsal);
        
        dorsalMatches.forEach(number => {
          dorsalCandidates.push({
            number,
            text: word.text,
            boundingBox: word.boundingBox,
            size,
            centerX,
            centerY
          });
        });
      }
    });
    
    // Step 2: Filter out small dorsals (likely distant participants)
    const sizeThreshold = this.calculateSizeThreshold(dorsalCandidates);
    const largeDorsals = dorsalCandidates.filter(d => d.size >= sizeThreshold);
    
    console.log(`📏 Filtrado por tamaño: ${largeDorsals.length} dorsales grandes de ${dorsalCandidates.length} candidatos`);
    console.log(`📐 Umbral de tamaño: ${sizeThreshold.toFixed(0)} píxeles²`);
    
    // Step 3: Keep multiple instances of same dorsal for maximum coverage
    // Sort by size descending but keep all instances (no duplicate removal)
    const allDorsals = largeDorsals
      .sort((a, b) => b.size - a.size) // Sort by size descending
      .slice(0, 10); // Take up to 10 dorsals total (allows duplicates)
    
    // Step 4: Extract numbers and group same dorsals for logging
    const finalDorsals = allDorsals.map(d => d.number);
    const dorsalCounts = finalDorsals.reduce((acc, num) => {
      acc[num] = (acc[num] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
    
    console.log(`🔢 Dorsales con instancias múltiples:`, Object.entries(dorsalCounts)
      .filter(([_, count]) => count > 1)
      .map(([num, count]) => `${num}(${count}x)`)
      .join(', ') || 'ninguno');
    
    // Return all dorsal numbers (including duplicates)
    const sortedDorsals = Array.from(new Set(finalDorsals)).sort((a, b) => a - b);
    
    console.log(`🎯 Dorsales únicos finales: [${sortedDorsals.join(', ')}] (de ${finalDorsals.length} instancias totales)`);
    
    return sortedDorsals;
  }
  
  /**
   * Strips digit sequences that are almost certainly NOT a race dorsal even
   * though they match a plain \d{N} pattern: stopwatch overlays ("01:23:45"),
   * distance labels ("10K", "21 KM"), and calendar dates ("15/07/2024"). Each
   * match is blanked out (replaced with spaces of the same length) so word
   * boundaries and downstream digit-length matching stay unaffected for the
   * rest of the text.
   */
  private stripNonDorsalContext(text: string): string {
    const blank = (match: string) => ' '.repeat(match.length);
    return text
      // Stopwatch / split time overlays: "1:23:45", "01:23", "12:34:56.7"
      .replace(/\b\d{1,2}:\d{2}(:\d{2})?(\.\d+)?\b/g, blank)
      // Distance labels: "10K", "21 KM", "5km"
      .replace(/\b\d{1,3}\s?(?:k|km)\b/gi, blank)
      // Calendar dates: "15/07/2024", "07-15-24", "2024/07/15"
      .replace(/\b\d{1,4}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g, blank);
  }

  private extractDorsalNumbersFromText(rawText: string, maxDorsal: number = DEFAULT_MAX_DORSAL): number[] {
    const dorsals = new Set<number>();
    const text = this.stripNonDorsalContext(rawText);

    // Hard limits for valid race dorsal numbers.
    // Default range is 1–1600, but callers may pass a different upper bound
    // per event (shared.events.maxDorsalNumber) for events with more participants.
    // Any number outside this range is NOT a real bib number — it is likely
    // a year stamp, timestamp fragment, banner text, or image metadata artefact.
    const MIN_DORSAL = 1;
    const MAX_DORSAL = maxDorsal;

    // Extract 4-digit numbers that fall in the valid range 1000–MAX_DORSAL.
    // (Numbers above MAX_DORSAL are NOT valid race dorsals for this event.)
    const fourDigitMatches = text.match(/\b\d{4}\b/g) || [];
    fourDigitMatches.forEach(match => {
      const num = parseInt(match, 10);
      if (num >= 1000 && num <= MAX_DORSAL) {
        dorsals.add(num);
      }
    });

    // Extract 3-digit numbers (100–999), bounded by MAX_DORSAL for events
    // with fewer than 999 participants.
    const threeDigitMatches = text.match(/\b\d{3}\b/g) || [];
    threeDigitMatches.forEach(match => {
      const num = parseInt(match, 10);
      if (num >= 100 && num <= Math.min(999, MAX_DORSAL)) {
        dorsals.add(num);
      }
    });

    // Extract 2-digit numbers (10–99), bounded by MAX_DORSAL.
    const twoDigitMatches = text.match(/\b\d{2}\b/g) || [];
    twoDigitMatches.forEach(match => {
      const num = parseInt(match, 10);
      if (num >= 10 && num <= Math.min(99, MAX_DORSAL)) {
        dorsals.add(num);
      }
    });

    // Extract 1-digit numbers (1–9).
    const oneDigitMatches = text.match(/\b\d{1}\b/g) || [];
    oneDigitMatches.forEach(match => {
      const num = parseInt(match, 10);
      if (num >= MIN_DORSAL && num <= 9) {
        dorsals.add(num);
      }
    });

    return Array.from(dorsals);
  }
  
  private calculateSizeThreshold(candidates: Array<{ size: number }>): number {
    if (candidates.length === 0) return 0;
    
    const sizes = candidates.map(c => c.size).sort((a, b) => b - a);
    
    // Use a more strict threshold: average of top 25% of sizes
    const topQuarter = sizes.slice(0, Math.ceil(sizes.length / 4));
    const averageTopSize = topQuarter.reduce((sum, size) => sum + size, 0) / topQuarter.length;
    
    // Set threshold to 15% for maximum permissiveness (capture distant/small dorsals)
    return averageTopSize * 0.15;
  }

  async testWithKnownDorsal(imagePath: string, expectedDorsal: number): Promise<boolean> {
    const result = await this.processImage(imagePath);
    const found = result.dorsalNumbers.includes(expectedDorsal);
    
    console.log(`🎯 Test Google Vision - Esperado: ${expectedDorsal}, Encontrado: ${found}`);
    console.log(`📋 Todos los dorsales detectados: ${result.dorsalNumbers.join(', ')}`);
    
    return found;
  }

  /**
   * Process image from Google Cloud Storage using unified CloudPhotoStorage
   * Reuses existing GCS client to avoid credential duplication
   */
  private async processImageFromGCSInternal(imagePath: string): Promise<any[]> {
    try {
      console.log(`☁️ [UNIFIED-GCS] Downloading image via CloudPhotoStorage: ${imagePath}`);
      
      // Use the unified CloudPhotoStorage to download image bytes
      const imageBuffer = await this.cloudStorage.downloadFile(imagePath);
      
      console.log(`☁️ [UNIFIED-GCS] Downloaded ${imageBuffer.length} bytes successfully`);
      
      // Request text detection using image content (not URI)
      const result = await this.client.textDetection({
        image: {
          content: imageBuffer
        }
      });
      
      // CRITICAL: Check for Vision API errors in response
      if (result && result[0] && result[0].error) {
        console.error(`❌ [VISION-ERROR] Google Vision returned error: ${result[0].error.message}`);
        return [];
      }
      
      console.log(`✅ [UNIFIED-GCS] Vision processing successful with unified credentials`);
      return result; // Return array for destructuring compatibility
      
    } catch (error) {
      console.error(`❌ [UNIFIED-GCS] Error downloading/processing from GCS (${imagePath}):`, error);
      
      // Return empty array to avoid destructuring errors
      return [];
    }
  }
}

// Factory function to create GoogleVisionOCRProcessor with unified credentials
export function createGoogleVisionProcessor(cloudStorage: CloudPhotoStorage): GoogleVisionOCRProcessor {
  return new GoogleVisionOCRProcessor(cloudStorage);
}

// Test function for batch processing
export async function testGoogleVisionBatch(photoIds: number[]): Promise<void> {
  console.log(`\n🚀 PROCESAMIENTO EN LOTE CON GOOGLE VISION`);
  console.log(`📊 Procesando ${photoIds.length} fotos...`);
  
  const { storage } = await import('./storage');
  let totalDorsalsDetected = 0;
  let successfulPhotos = 0;
  
  for (const photoId of photoIds) {
    try {
      const photo = await storage.getPhoto(photoId);
      if (!photo) continue;
      
      console.log(`\n📸 Procesando foto ${photoId}: ${photo.filename}`);
      const cloudStorage = (await import('./cloud-storage')).getCloudStorage();
      const processor = new GoogleVisionOCRProcessor(cloudStorage);
      const result = await processor.processImage(photo.originalPath);
      
      if (result.dorsalNumbers.length > 0) {
        // Update photo with detected dorsals
        // Update photo with detected dorsals (if method exists)
        if ('updatePhotoProcessing' in storage && typeof storage.updatePhotoProcessing === 'function') {
          await storage.updatePhotoProcessing(photoId, result.dorsalNumbers, []);
        }
        totalDorsalsDetected += result.dorsalNumbers.length;
        successfulPhotos++;
        
        console.log(`✅ Detectados ${result.dorsalNumbers.length} dorsales: [${result.dorsalNumbers.join(', ')}]`);
      } else {
        console.log(`❌ Sin dorsales detectados`);
      }
      
    } catch (error) {
      console.error(`❌ Error procesando foto ${photoId}:`, error);
    }
  }
  
  console.log(`\n📈 RESUMEN DEL PROCESAMIENTO:`);
  console.log(`✅ Fotos procesadas exitosamente: ${successfulPhotos}/${photoIds.length}`);
  console.log(`🎯 Total de dorsales detectados: ${totalDorsalsDetected}`);
  console.log(`📊 Promedio de dorsales por foto: ${(totalDorsalsDetected / successfulPhotos || 0).toFixed(1)}`);
}