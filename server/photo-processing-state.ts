/**
 * Single source of truth for the `processed` / `processingStatus` / `processedAt`
 * fields on `photos`. Every call site that used to derive these fields by hand
 * (cloud-image-service.ts, async-photo-processor.ts, the reprocess endpoints in
 * routes.ts) should go through `derivePhotoProcessingState` instead, so a photo
 * can't end up in a state like processed:true + processingStatus:'pending'.
 */

export type PhotoProcessingStatus = 'pending' | 'completed' | 'failed';

export interface PhotoProcessingStateInput {
  /** Was an OCR attempt made for this photo in this pass? */
  ocrAttempted: boolean;
  /** Did the OCR attempt complete without the Vision API call itself failing? */
  ocrSucceeded: boolean;
  /** Was a face-detection attempt made for this photo in this pass? */
  facesAttempted: boolean;
  /** Did the face-detection attempt complete without the Vision API call itself failing? */
  facesSucceeded: boolean;
}

export interface PhotoProcessingState {
  processed: boolean;
  processingStatus: PhotoProcessingStatus;
  processedAt: Date | null;
}

/**
 * Derives processed/processingStatus/processedAt from the outcome of an OCR
 * and/or face-detection attempt. 0 results is NOT a failure — a landscape
 * photo with no bib number or no visible face is a legitimate, successful
 * outcome. Only an actual Vision API error (quota, network, auth) counts as
 * a failure.
 */
export function derivePhotoProcessingState(input: PhotoProcessingStateInput): PhotoProcessingState {
  const { ocrAttempted, ocrSucceeded, facesAttempted, facesSucceeded } = input;

  if (!ocrAttempted && !facesAttempted) {
    return { processed: false, processingStatus: 'pending', processedAt: null };
  }

  const anySucceeded = (ocrAttempted && ocrSucceeded) || (facesAttempted && facesSucceeded);
  const anyFailed = (ocrAttempted && !ocrSucceeded) || (facesAttempted && !facesSucceeded);

  // At least one attempted step came back clean → treat the photo as processed,
  // even if the other step failed (partial data is still usable data).
  const processingStatus: PhotoProcessingStatus = anySucceeded ? 'completed' : (anyFailed ? 'failed' : 'pending');

  return {
    processed: processingStatus !== 'pending',
    processingStatus,
    processedAt: processingStatus !== 'pending' ? new Date() : null,
  };
}

/**
 * In-memory lock so the same photoId is never processed by two callers at
 * once (async queue + admin reprocess, or a double-click on a reprocess
 * button). Single-process only — sufficient for this single-instance
 * deployment, not a distributed lock.
 */
class PhotoProcessingLock {
  private readonly inFlight = new Set<number>();

  /** Returns true and marks the photo as locked if it was free; false if already locked. */
  tryAcquire(photoId: number): boolean {
    if (this.inFlight.has(photoId)) {
      return false;
    }
    this.inFlight.add(photoId);
    return true;
  }

  release(photoId: number): void {
    this.inFlight.delete(photoId);
  }

  isLocked(photoId: number): boolean {
    return this.inFlight.has(photoId);
  }
}

export const photoProcessingLock = new PhotoProcessingLock();
