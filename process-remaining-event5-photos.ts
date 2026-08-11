#!/usr/bin/env tsx

/**
 * PROCESS REMAINING EVENT 5 PHOTOS WITH OCR
 * 
 * 389 photos still need dorsal detection:
 * - IMG_xxxx.jpeg files
 * - UUID.jpeg files  
 * These need real OCR processing since dorsals aren't in filenames
 */

import { db } from './server/db';
import { photos } from './shared/schema';
import { eq, and, sql } from 'drizzle-orm';

async function processRemainingPhotos() {
  console.log('🔄 PROCESSING REMAINING EVENT 5 PHOTOS WITH OCR...');
  
  try {
    // Get photos that still have empty detected_dorsals for Event 5
    const pendingPhotos = await db
      .select()
      .from(photos)
      .where(
        and(
          eq(photos.eventId, 5),
          sql`jsonb_array_length(COALESCE(detected_dorsals, '[]'::jsonb)) = 0`
        )
      );
    
    console.log(`📊 Found ${pendingPhotos.length} photos still needing OCR processing`);
    
    if (pendingPhotos.length === 0) {
      console.log('✅ No photos need processing!');
      return { success: true, processedCount: 0 };
    }
    
    // Import the OCR processor
    const { processImageWithSimpleOCR } = await import('./server/ocr-simple');
    
    let successCount = 0;
    let errorCount = 0;
    const allExtractedDorsals = new Set<number>();
    
    // Process in batches to avoid overwhelming the system
    const BATCH_SIZE = 20;
    
    for (let i = 0; i < pendingPhotos.length; i += BATCH_SIZE) {
      const batch = pendingPhotos.slice(i, i + BATCH_SIZE);
      console.log(`\n🔄 Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(pendingPhotos.length/BATCH_SIZE)} (${batch.length} photos)`);
      
      for (const photo of batch) {
        try {
          // Try to construct the full path to the image
          const imagePath = photo.webPath || photo.originalPath || `uploads/${photo.filename}`;
          
          console.log(`🔍 Processing: ${photo.filename}`);
          
          // Try OCR processing
          const ocrResult = await processImageWithSimpleOCR(imagePath);
          
          if (ocrResult.dorsalNumbers && ocrResult.dorsalNumbers.length > 0) {
            // Update photo with detected dorsals
            await db
              .update(photos)
              .set({ 
                detectedDorsals: ocrResult.dorsalNumbers,
                processedAt: new Date()
              })
              .where(eq(photos.id, photo.id));
            
            ocrResult.dorsalNumbers.forEach(d => allExtractedDorsals.add(d));
            successCount++;
            
            console.log(`✅ ${photo.filename} → dorsals: ${ocrResult.dorsalNumbers.join(', ')} (confidence: ${ocrResult.confidence?.toFixed(2) || 'N/A'})`);
          } else {
            // Try fallback extraction patterns
            const fallbackDorsals = tryFallbackExtraction(photo.filename);
            
            if (fallbackDorsals.length > 0) {
              await db
                .update(photos)
                .set({ 
                  detectedDorsals: fallbackDorsals,
                  processedAt: new Date()
                })
                .where(eq(photos.id, photo.id));
              
              fallbackDorsals.forEach(d => allExtractedDorsals.add(d));
              successCount++;
              
              console.log(`✅ ${photo.filename} → fallback dorsals: ${fallbackDorsals.join(', ')}`);
            } else {
              errorCount++;
              console.log(`❌ ${photo.filename} → no dorsals detected`);
            }
          }
          
        } catch (error) {
          errorCount++;
          console.error(`❌ Error processing ${photo.filename}:`, error.message);
        }
      }
      
      // Small delay between batches
      if (i + BATCH_SIZE < pendingPhotos.length) {
        console.log('⏳ Waiting 2 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log('\n📈 OCR PROCESSING RESULTS:');
    console.log(`✅ Successfully processed: ${successCount} photos`);
    console.log(`❌ Failed to process: ${errorCount} photos`);
    console.log(`🎯 New dorsals extracted: ${allExtractedDorsals.size}`);
    
    if (allExtractedDorsals.size > 0) {
      const sortedDorsals = Array.from(allExtractedDorsals).sort((a, b) => a - b);
      console.log(`🏃‍♂️ Dorsals range: ${Math.min(...sortedDorsals)} - ${Math.max(...sortedDorsals)}`);
      console.log(`📋 Sample new dorsals: ${sortedDorsals.slice(0, 20).join(', ')}${sortedDorsals.length > 20 ? '...' : ''}`);
    }
    
    return {
      success: true,
      processedCount: successCount,
      errorCount,
      newDorsalsCount: allExtractedDorsals.size
    };
    
  } catch (error) {
    console.error('🚨 OCR PROCESSING FAILED:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

function tryFallbackExtraction(filename: string): number[] {
  // Try various fallback patterns for remaining photos
  const dorsals: number[] = [];
  
  try {
    // Pattern 1: IMG_xxxx where xxxx might be a dorsal
    const imgMatch = filename.match(/IMG_(\d{3,6})/i);
    if (imgMatch) {
      const dorsal = parseInt(imgMatch[1]);
      if (dorsal && dorsal > 0 && dorsal < 100000) {
        dorsals.push(dorsal);
      }
    }
    
    // Pattern 2: Any 3-6 digit sequence in filename
    if (dorsals.length === 0) {
      const matches = filename.match(/(\d{3,6})/g);
      if (matches) {
        for (const match of matches) {
          const dorsal = parseInt(match);
          if (dorsal && dorsal > 100 && dorsal < 100000) {
            dorsals.push(dorsal);
            break; // Take first valid dorsal
          }
        }
      }
    }
    
  } catch (error) {
    console.error(`Error in fallback extraction for ${filename}:`, error);
  }
  
  return dorsals;
}

// Main execution
async function main() {
  console.log('🔄 STARTING OCR PROCESSING FOR REMAINING EVENT 5 PHOTOS');
  console.log('=' .repeat(60));
  
  const result = await processRemainingPhotos();
  
  console.log('\n' + '='.repeat(60));
  console.log('🔄 OCR PROCESSING COMPLETED');
  console.log('Result:', result);
  
  process.exit(result.success ? 0 : 1);
}

// Auto-run
main().catch(console.error);