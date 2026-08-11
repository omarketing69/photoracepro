/**
 * URL transformation utilities for converting local paths to proxy endpoints
 */

/**
 * Transforms a thumbnail path from local format to Google Cloud Storage proxy endpoint
 * 
 * @param thumbnailPath - The original thumbnail path (e.g. "eventos/1/miniaturas/eventos/1/filename.jpg")
 * @returns The transformed proxy endpoint URL (e.g. "/api/cloud-images/1/miniaturas/filename.jpg")
 */
export function transformThumbnailUrl(thumbnailPath: string | null | undefined): string | null {
  if (!thumbnailPath || typeof thumbnailPath !== 'string') {
    return null;
  }

  // Skip if already transformed or not a local path
  if (thumbnailPath.startsWith('/api/') || thumbnailPath.startsWith('http')) {
    return thumbnailPath;
  }

  // Pattern: eventos/{eventId}/miniaturas/eventos/{eventId}/{filename}
  // or: eventos/{eventId}/miniaturas/{filename}
  const match = thumbnailPath.match(/eventos\/(\d+)\/miniaturas\/(?:eventos\/\d+\/)?(.+)$/);
  
  if (match) {
    const [, eventId, filename] = match;
    return `/api/cloud-images/${eventId}/miniaturas/${filename}`;
  }

  // If no match, try to extract basic pattern
  const basicMatch = thumbnailPath.match(/eventos\/(\d+)\/.*\/(.+\.(jpg|jpeg|png|gif))$/i);
  if (basicMatch) {
    const [, eventId, filename] = basicMatch;
    return `/api/cloud-images/${eventId}/miniaturas/${filename}`;
  }

  // If all else fails, return null
  console.warn(`Could not transform thumbnail URL: ${thumbnailPath}`);
  return null;
}

/**
 * Transforms the thumbnailPath field in a photo object
 * 
 * @param photo - The photo object to transform
 * @returns The photo object with transformed thumbnailPath
 */
export function transformPhotoUrls<T extends { thumbnailPath?: string | null }>(photo: T): T {
  if (photo.thumbnailPath) {
    return {
      ...photo,
      thumbnailPath: transformThumbnailUrl(photo.thumbnailPath)
    };
  }
  return photo;
}

/**
 * Transforms thumbnailPath field in an array of photo objects
 * 
 * @param photos - Array of photo objects to transform
 * @returns Array of photo objects with transformed thumbnailPath
 */
export function transformPhotosUrls<T extends { thumbnailPath?: string | null }>(photos: T[]): T[] {
  return photos.map(photo => transformPhotoUrls(photo));
}