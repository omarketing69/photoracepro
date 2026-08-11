#!/usr/bin/env tsx

/**
 * Backfill Script: Split original_path into original_dir and original_filename
 * 
 * This script safely migrates existing photos table data to populate the new
 * original_dir and original_filename fields from the existing original_path field.
 * 
 * Pattern: "eventos/1/originales/1752529301503-sebas-390.jpg"
 * Split into:
 * - original_dir: "eventos/1/originales/"
 * - original_filename: "1752529301503-sebas-390.jpg"
 */

import { db } from "./server/db";
import { photos } from "./shared/schema";
import { eq } from "drizzle-orm";

interface PhotoRecord {
  id: number;
  original_path: string;
  original_dir: string | null;
  original_filename: string | null;
}

async function backfillOriginalPathSplit() {
  console.log("🔄 Starting original_path split backfill...");

  try {
    // Get all photos that need backfilling (where new fields are null)
    const photosToUpdate = await db
      .select({
        id: photos.id,
        original_path: photos.originalPath,
        original_dir: photos.originalDir,
        original_filename: photos.originalFilename,
      })
      .from(photos)
      .where(eq(photos.originalDir, null));

    console.log(`📊 Found ${photosToUpdate.length} photos to backfill`);

    if (photosToUpdate.length === 0) {
      console.log("✅ No photos need backfilling - all records already processed");
      return { success: true, processed: 0 };
    }

    let successful = 0;
    let failed = 0;
    const errors: string[] = [];

    // Process in batches for better performance and memory management
    const batchSize = 100;
    for (let i = 0; i < photosToUpdate.length; i += batchSize) {
      const batch = photosToUpdate.slice(i, i + batchSize);
      
      console.log(`⚡ Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(photosToUpdate.length / batchSize)} (${batch.length} photos)`);

      for (const photo of batch) {
        try {
          // Split original_path at the last forward slash
          const originalPath = photo.original_path;
          const lastSlashIndex = originalPath.lastIndexOf('/');
          
          if (lastSlashIndex === -1) {
            // No slash found - treat entire path as filename, empty directory
            const originalDir = "";
            const originalFilename = originalPath;
            
            await db
              .update(photos)
              .set({
                originalDir,
                originalFilename,
              })
              .where(eq(photos.id, photo.id));

            console.log(`📝 Photo ${photo.id}: No directory, filename only: "${originalFilename}"`);
          } else {
            // Split at last slash
            const originalDir = originalPath.substring(0, lastSlashIndex + 1); // Include trailing slash
            const originalFilename = originalPath.substring(lastSlashIndex + 1);

            // Validate the split makes sense
            if (!originalFilename) {
              throw new Error(`Empty filename after split from path: ${originalPath}`);
            }

            await db
              .update(photos)
              .set({
                originalDir,
                originalFilename,
              })
              .where(eq(photos.id, photo.id));

            console.log(`✅ Photo ${photo.id}: "${originalDir}" + "${originalFilename}"`);
          }

          successful++;
          
        } catch (error) {
          failed++;
          const errorMsg = `Failed to process photo ${photo.id} (${photo.original_path}): ${error.message}`;
          errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
        }
      }

      // Brief pause between batches to avoid overwhelming the database
      if (i + batchSize < photosToUpdate.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log("\n📈 BACKFILL RESULTS:");
    console.log(`✅ Successfully processed: ${successful} photos`);
    console.log(`❌ Failed: ${failed} photos`);
    
    if (errors.length > 0) {
      console.log(`\n🚨 ERRORS (${errors.length}):`);
      errors.forEach(error => console.log(`  - ${error}`));
    }

    // Verify results
    const verificationCount = await db
      .select({ count: db.$count() })
      .from(photos)
      .where(eq(photos.originalDir, null));

    console.log(`\n🔍 VERIFICATION: ${verificationCount[0].count} photos still need backfilling`);

    return {
      success: failed === 0,
      processed: successful,
      failed,
      errors,
      remaining: verificationCount[0].count
    };

  } catch (error) {
    console.error("💥 Fatal error during backfill:", error);
    throw error;
  }
}

// Execute if run directly (ES module compatible)
if (import.meta.url === `file://${process.argv[1]}`) {
  backfillOriginalPathSplit()
    .then((result) => {
      if (result.success) {
        console.log(`\n🎉 BACKFILL COMPLETED SUCCESSFULLY! Processed ${result.processed} photos.`);
        process.exit(0);
      } else {
        console.log(`\n⚠️  BACKFILL COMPLETED WITH ERRORS. Processed ${result.processed}, failed ${result.failed}.`);
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error("\n💥 BACKFILL FAILED:", error);
      process.exit(1);
    });
}

export { backfillOriginalPathSplit };