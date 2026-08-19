import { db } from './db';
import { photos as photosSchema } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { createGoogleVisionProcessor } from './google-vision-ocr';
import { getCloudStorage } from './cloud-storage';

export interface FaceMatchResult {
  photoId: number;
  filename: string;
  originalPath: string;
  webPath?: string;
  thumbnailPath?: string;
  detectedDorsals: number[];
  similarity: number;
  cosineSimilarity: number;
}

export interface FaceSearchStats {
  photosScanned: number;
  photosWithFaceData: number;
  selfieFacesFound: number;
}

export interface FaceSearchOptions {
  relaxed?: boolean;
}

/**
 * Calcula similitud coseno entre dos vectores de landmarks normalizados.
 * Escala/ángulo invariantes — más robusto que euclidiana para fotos de carrera.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export class SelfieFaceError extends Error {
  selfieFacesFound: number;
  constructor(message: string, selfieFacesFound: number) {
    super(message);
    this.name = 'SelfieFaceError';
    this.selfieFacesFound = selfieFacesFound;
  }
}

/**
 * Detecta la cara más grande (por bounding-box) en un buffer de imagen y devuelve
 * su landmarkVector. Lanza SelfieFaceError si Vision no detecta ninguna cara o
 * no hay landmarks utilizables.
 */
export async function extractSelfieVector(imageBuffer: Buffer): Promise<{
  selfieFacesFound: number;
  landmarkVector: number[];
}> {
  const visionProcessor = createGoogleVisionProcessor(getCloudStorage());
  // Convertir HEIC si fuera necesario (la selfie del usuario podría venir de iPhone).
  let buffer = imageBuffer;
  try {
    const { HeicConverter } = await import('./heic-converter');
    if (HeicConverter.isHeicFile({ buffer, mimetype: '' } as any)) {
      buffer = await HeicConverter.convertToJpeg(buffer);
    }
  } catch { /* keep original buffer */ }

  const selfieFaces = await visionProcessor.detectFacesFromBuffer(buffer);
  if (selfieFaces.length === 0) {
    throw new SelfieFaceError('No se detectó ninguna cara en la foto. Por favor sube una foto clara de tu cara.', selfieFaces.length);
  }
  const selfieFace = selfieFaces.reduce((best, f) => (f.width * f.height > best.width * best.height ? f : best));
  const selfieVector = selfieFace.landmarkVector;
  if (!selfieVector || selfieVector.length === 0) {
    throw new SelfieFaceError('No se pudieron extraer características faciales. Por favor intenta con otra foto.', selfieFaces.length);
  }
  return { selfieFacesFound: selfieFaces.length, landmarkVector: selfieVector };
}

/**
 * Busca fotos de un evento que coincidan con el landmarkVector de la selfie.
 * Devuelve los matches ordenados por similitud (desc).
 */
export async function searchByFace(
  eventId: number,
  selfieVector: number[],
  options: FaceSearchOptions = {},
): Promise<{ matches: FaceMatchResult[]; totalMatches: number; stats: FaceSearchStats }> {
  const isRelaxed = options.relaxed === true;
  // Umbrales calibrados para landmarks normalizados (no embeddings profundos).
  // Las fotos de carrera suelen tener ángulos laterales, sombras y motion blur,
  // lo que reduce la similitud coseno frente a una selfie frontal. Priorizan
  // evitar falsos positivos (mostrar la foto de otro corredor) sobre recall.
  const SIMILARITY_THRESHOLD = isRelaxed ? 0.55 : 0.70;
  const minExpected = isRelaxed ? 0.40 : 0.55;

  const photosWithFaces = await db
    .select({
      id: photosSchema.id,
      filename: photosSchema.filename,
      originalPath: photosSchema.originalPath,
      webPath: photosSchema.webPath,
      thumbnailPath: photosSchema.thumbnailPath,
      detectedDorsals: photosSchema.detectedDorsals,
      faces: photosSchema.faces,
    })
    .from(photosSchema)
    .where(eq(photosSchema.eventId, eventId));

  const results: FaceMatchResult[] = [];
  for (const photo of photosWithFaces) {
    const facesData = photo.faces;
    if (!facesData || !Array.isArray(facesData) || facesData.length === 0) continue;
    let bestSimilarity = -Infinity;
    for (const face of facesData as any[]) {
      const vec = face.landmarkVector;
      if (!vec || !Array.isArray(vec) || vec.length === 0) continue;
      const sim = cosineSimilarity(selfieVector, vec);
      if (sim > bestSimilarity) bestSimilarity = sim;
    }
    if (bestSimilarity >= SIMILARITY_THRESHOLD) {
      const similarity = Math.max(0, Math.min(100, Math.round(
        ((bestSimilarity - minExpected) / (1 - minExpected)) * 100
      )));
      results.push({
        photoId: photo.id,
        filename: photo.filename,
        originalPath: photo.originalPath,
        webPath: photo.webPath ?? undefined,
        thumbnailPath: photo.thumbnailPath ?? undefined,
        detectedDorsals: (photo.detectedDorsals as number[]) ?? [],
        similarity,
        cosineSimilarity: Math.round(bestSimilarity * 1000) / 1000,
      });
    }
  }

  results.sort((a, b) => b.similarity - a.similarity);

  const photosWithFaceData = photosWithFaces.filter(p => {
    const faces = p.faces;
    return Array.isArray(faces) && faces.length > 0 && (faces as any[]).some(face => (face.landmarkVector?.length ?? 0) > 0);
  }).length;

  return {
    matches: results.slice(0, 50),
    totalMatches: results.length,
    stats: {
      photosScanned: photosWithFaces.length,
      photosWithFaceData,
      selfieFacesFound: 0, // lo rellena el caller
    },
  };
}