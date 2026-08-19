import {
  RekognitionClient,
  CreateCollectionCommand,
  IndexFacesCommand,
  SearchFacesByImageCommand,
  ResourceAlreadyExistsException,
  InvalidParameterException,
  type FaceMatch,
} from '@aws-sdk/client-rekognition';
import { storage } from './storage';
import { SelfieFaceError, type FaceMatchResult, type FaceSearchStats, type FaceSearchOptions } from './face-matching';

/**
 * AWS Rekognition Face Search — motor de reconocimiento facial real para
 * eventos nuevos (faceSearchProvider='rekognition'). Los eventos existentes
 * siguen usando el matching casero de face-matching.ts sin ningún cambio.
 *
 * Una "collection" de Rekognition por evento. IndexFaces guarda el embedding
 * de cada cara detectada en una foto, etiquetada con el photoId como
 * ExternalImageId; SearchFacesByImage compara la selfie contra esa collection
 * y devuelve coincidencias reales con un score de confianza — no una
 * heurística geométrica sobre landmarks.
 */

let cachedClient: RekognitionClient | null = null;

function getRekognitionClient(): RekognitionClient {
  if (cachedClient) return cachedClient;

  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!region || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'AWS_REGION, AWS_ACCESS_KEY_ID y AWS_SECRET_ACCESS_KEY deben estar configurados para usar reconocimiento facial con AWS Rekognition'
    );
  }

  cachedClient = new RekognitionClient({ region, credentials: { accessKeyId, secretAccessKey } });
  return cachedClient;
}

function collectionIdForEvent(eventId: number): string {
  return `photoracepro-event-${eventId}`;
}

// Cache en memoria de collections ya confirmadas en este proceso, para no
// llamar a CreateCollection en cada foto — CreateCollection ya es idempotente
// (ResourceAlreadyExistsException se ignora abajo), esto es solo una optimización.
const ensuredCollections = new Set<number>();

export async function ensureCollection(eventId: number): Promise<string> {
  const collectionId = collectionIdForEvent(eventId);
  if (ensuredCollections.has(eventId)) return collectionId;

  const client = getRekognitionClient();
  try {
    await client.send(new CreateCollectionCommand({ CollectionId: collectionId }));
    console.log(`✅ [REKOGNITION] Collection creada: ${collectionId}`);
  } catch (error) {
    if (!(error instanceof ResourceAlreadyExistsException)) {
      throw error;
    }
  }
  ensuredCollections.add(eventId);
  return collectionId;
}

export interface IndexFaceResult {
  faceIds: string[];
  succeeded: boolean;
}

/**
 * Indexa las caras detectadas en una foto dentro de la collection del evento.
 * ExternalImageId = photoId, para poder mapear los resultados de búsqueda de
 * vuelta a la foto. No lanza — un fallo se refleja en succeeded:false para
 * que el caller decida si reintenta (mismo patrón que el resto del pipeline).
 */
export async function indexFace(eventId: number, photoId: number, imageBuffer: Buffer): Promise<IndexFaceResult> {
  try {
    const collectionId = await ensureCollection(eventId);
    const client = getRekognitionClient();

    const result = await client.send(new IndexFacesCommand({
      CollectionId: collectionId,
      Image: { Bytes: imageBuffer },
      ExternalImageId: String(photoId),
      MaxFaces: 10,
      QualityFilter: 'AUTO',
      DetectionAttributes: [],
    }));

    const faceIds = (result.FaceRecords ?? [])
      .map(record => record.Face?.FaceId)
      .filter((id): id is string => Boolean(id));

    console.log(`👤 [REKOGNITION] Foto ${photoId}: ${faceIds.length} cara(s) indexada(s) en ${collectionId}`);
    return { faceIds, succeeded: true };
  } catch (error) {
    console.error(`❌ [REKOGNITION] Error indexando foto ${photoId}:`, error);
    return { faceIds: [], succeeded: false };
  }
}

/**
 * Busca fotos del evento cuya cara coincida con la selfie, usando el índice
 * real de AWS Rekognition en vez del cosine-similarity casero. Misma firma
 * de retorno que face-matching.ts::searchByFace para que routes.ts pueda
 * bifurcar entre ambos motores sin cambiar el resto del endpoint.
 */
export async function searchByFaceAWS(
  eventId: number,
  selfieBuffer: Buffer,
  options: FaceSearchOptions = {}
): Promise<{ matches: FaceMatchResult[]; totalMatches: number; stats: FaceSearchStats }> {
  const isRelaxed = options.relaxed === true;
  // Escala 0-100 nativa de Rekognition (Similarity). Mismo criterio que el
  // umbral 0.70/0.55 del matching casero: priorizar evitar falsos positivos
  // (mostrar la foto de otro corredor) sobre recall.
  const SIMILARITY_THRESHOLD = isRelaxed ? 55 : 70;

  const collectionId = await ensureCollection(eventId);
  const client = getRekognitionClient();

  let faceMatches: FaceMatch[];
  try {
    const searchResult = await client.send(new SearchFacesByImageCommand({
      CollectionId: collectionId,
      Image: { Bytes: selfieBuffer },
      FaceMatchThreshold: SIMILARITY_THRESHOLD,
      MaxFaces: 50,
    }));
    faceMatches = searchResult.FaceMatches ?? [];
  } catch (error) {
    if (error instanceof InvalidParameterException) {
      // Rekognition no detectó ninguna cara utilizable en la selfie.
      throw new SelfieFaceError('No se detectó ninguna cara en la foto. Por favor sube una foto clara de tu cara.', 0);
    }
    throw error;
  }

  // Si varias caras indexadas de la misma foto hacen match, quedarnos con la de mayor similitud.
  const bestSimilarityByPhoto = new Map<number, number>();
  for (const match of faceMatches) {
    const externalImageId = match.Face?.ExternalImageId;
    if (!externalImageId) continue;
    const photoId = parseInt(externalImageId, 10);
    if (isNaN(photoId)) continue;
    const similarity = match.Similarity ?? 0;
    if (similarity > (bestSimilarityByPhoto.get(photoId) ?? -1)) {
      bestSimilarityByPhoto.set(photoId, similarity);
    }
  }

  const matchedPhotoIds = Array.from(bestSimilarityByPhoto.keys());
  const matchedPhotos = matchedPhotoIds.length > 0 ? await storage.getPhotosByIds(matchedPhotoIds) : [];
  const photoById = new Map(matchedPhotos.map(p => [p.id, p]));

  const results: FaceMatchResult[] = [];
  for (const [photoId, similarity] of Array.from(bestSimilarityByPhoto.entries())) {
    const photo = photoById.get(photoId);
    if (!photo) continue;
    results.push({
      photoId: photo.id,
      filename: photo.filename,
      originalPath: photo.originalPath,
      webPath: photo.webPath ?? undefined,
      thumbnailPath: photo.thumbnailPath ?? undefined,
      detectedDorsals: (photo.detectedDorsals as number[]) ?? [],
      similarity: Math.round(similarity),
      cosineSimilarity: Math.round(similarity) / 100,
    });
  }

  results.sort((a, b) => b.similarity - a.similarity);

  const allEventPhotos = await storage.getPhotos(eventId);
  const photosWithFaceData = allEventPhotos.filter(p => ((p as any).rekognitionFaceIds?.length ?? 0) > 0).length;

  return {
    matches: results.slice(0, 50),
    totalMatches: results.length,
    stats: {
      photosScanned: allEventPhotos.length,
      photosWithFaceData,
      selfieFacesFound: 1, // SearchFacesByImage ya validó (sin lanzar InvalidParameterException) que hay al menos 1 cara utilizable
    },
  };
}
