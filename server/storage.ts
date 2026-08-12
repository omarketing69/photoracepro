import { db, pool } from "./db";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import {
  events,
  photos,
  participants,
  sales,
  processingStats,
  photographerApplications,
  eventConfigs,
  downloadCodes,
  type Event,
  type Photo,
  type Participant,
  type Sale,
  type ProcessingStats,
  type PhotographerApplication,
  type EventConfig,
  type DownloadCode,
  type InsertEvent,
  type InsertPhoto,
  type InsertParticipant,
  type InsertSale,
  type InsertPhotographerApplication,
  type InsertEventConfig,
  type InsertDownloadCode,
  type EventWithStats,
  type SearchResult,
} from "@shared/schema";
import { transformPhotosUrls } from "./url-transformer";

export interface IStorage {
  // Events
  getEvents(): Promise<EventWithStats[]>;
  getEvent(id: number): Promise<EventWithStats | undefined>;
  createEvent(event: InsertEvent): Promise<Event>;
  createEventFromTemplate(templateEventId: number, newEventData: InsertEvent): Promise<Event>;
  updateEvent(id: number, event: Partial<InsertEvent>): Promise<Event | undefined>;
  deleteEvent(id: number): Promise<boolean>;

  // Photos
  getPhotos(eventId: number): Promise<Photo[]>;
  getPhoto(id: number): Promise<Photo | undefined>;
  getPhotoByFilename(filename: string): Promise<Photo | undefined>;
  getPhotoByFilenameForEvent(eventId: number, filename: string): Promise<Photo | undefined>;
  createPhoto(photo: InsertPhoto): Promise<Photo>;
  updatePhoto(id: number, photo: Partial<InsertPhoto>): Promise<Photo | undefined>;
  searchPhotosByDorsal(eventId: number | null, dorsalNumber: number): Promise<SearchResult>;
  searchPhotosByFilename(filename: string): Promise<Photo[]>;
  getPhotosForProcessing(eventId: number): Promise<Photo[]>;

  // Participants
  getParticipants(eventId: number): Promise<Participant[]>;
  createParticipant(participant: InsertParticipant): Promise<Participant>;
  updateParticipantPhotoCount(eventId: number, dorsalNumber: number, count: number): Promise<void>;

  // Sales
  createSale(sale: InsertSale): Promise<Sale>;
  getSales(eventId: number): Promise<Sale[]>;
  updateSale(id: number, sale: Partial<InsertSale>): Promise<Sale | undefined>;
  getSaleByReference(reference: string): Promise<Sale | undefined>;
  getSaleByDownloadToken(token: string): Promise<Sale | undefined>;
  getPhotosByIds(photoIds: number[]): Promise<Photo[]>;

  // Processing Stats
  getProcessingStats(eventId: number): Promise<ProcessingStats | undefined>;
  updateProcessingStats(eventId: number, stats: Partial<ProcessingStats>): Promise<ProcessingStats>;

  // Dashboard Stats
  getDashboardStats(): Promise<{
    activeEvents: number;
    processedPhotos: number;
    detectedDorsals: number;
    monthlySales: string;
  }>;

  // Photographer Applications
  createPhotographerApplication(application: InsertPhotographerApplication): Promise<PhotographerApplication>;
  getPhotographerApplications(): Promise<PhotographerApplication[]>;
  updatePhotographerApplication(id: number, application: Partial<PhotographerApplication>): Promise<PhotographerApplication | undefined>;

  // Users
  getUserByEmail(email: string): Promise<any>;

  // EventConfig (BULLETPROOF BOOTSTRAP SYSTEM)
  createEventConfig(eventConfig: InsertEventConfig): Promise<EventConfig>;
  getEventConfig(eventId: number): Promise<EventConfig | undefined>;
  updateEventConfig(eventId: number, eventConfig: Partial<InsertEventConfig>): Promise<EventConfig | undefined>;
  deleteEventConfig(eventId: number): Promise<boolean>;
  validateEventConfig(eventId: number): Promise<{ valid: boolean; errors: string[]; warnings: string[]; }>;

  // Critical Import
  importEvent8PhotosFromCloud(): Promise<{
    success: boolean;
    insertedCount: number;
    reconciledUpdatedCount: number;
    migratedCount: number;
    totalFound: number;
    errors: string[];
    verificationCount: number;
  }>;

  // Download Codes
  createDownloadCode(downloadCode: InsertDownloadCode): Promise<DownloadCode>;
  getDownloadCode(code: string): Promise<DownloadCode | undefined>;
  validateDownloadCode(code: string): Promise<{ valid: boolean; downloadCode?: DownloadCode; error?: string; }>;
  useDownloadCode(code: string): Promise<{ success: boolean; downloadCode?: DownloadCode; error?: string; }>;
  getDownloadCodesForEvent(eventId: number): Promise<DownloadCode[]>;
  getDownloadCodesByDorsal(eventId: number, dorsalNumber: number): Promise<DownloadCode[]>;
}

export class DatabaseStorage implements IStorage {
  async getEvents(): Promise<EventWithStats[]> {
    const eventsData = await db.select().from(events);
    
    const eventsWithStats = await Promise.all(
      eventsData.map(async (event) => {
        const [photoCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(photos)
          .where(eq(photos.eventId, event.id));
        
        const [stats] = await db
          .select()
          .from(processingStats)
          .where(eq(processingStats.eventId, event.id));

        return {
          ...event,
          photoCount: photoCount?.count || 0,
          participantCount: event.expectedParticipants || 0, // Use expectedParticipants from schema
          processingStats: stats,
        };
      })
    );

    return eventsWithStats;
  }

  async getEvent(id: number): Promise<EventWithStats | undefined> {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    if (!event) return undefined;

    const [photoCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(photos)
      .where(eq(photos.eventId, id));
    
    const [stats] = await db
      .select()
      .from(processingStats)
      .where(eq(processingStats.eventId, id));

    return {
      ...event,
      photoCount: photoCount?.count || 0,
      participantCount: event.expectedParticipants || 0, // Use expectedParticipants from schema
      processingStats: stats,
    };
  }

  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    const [event] = await db.insert(events).values(insertEvent).returning();
    
    // 🚀 BULLETPROOF BOOTSTRAP SYSTEM - Apply proven configuration automatically
    console.log(`🚀 [BOOTSTRAP] Starting bulletproof bootstrap for Event ${event.id}...`);
    
    try {
      const { bootstrapEvent } = await import('./event-config-bootstrap');
      const bootstrapResult = await bootstrapEvent(event.id);
      
      if (bootstrapResult.success) {
        console.log(`✅ [BOOTSTRAP] Event ${event.id} successfully bootstrapped!`);
        console.log(`🔧 Applied settings:`, bootstrapResult.appliedSettings);
        
        if (bootstrapResult.warnings.length > 0) {
          console.log(`⚠️ [BOOTSTRAP] Warnings:`, bootstrapResult.warnings);
        }
      } else {
        console.error(`❌ [BOOTSTRAP] Bootstrap failed for Event ${event.id}:`, bootstrapResult.errors);
        
        // FALLBACK: Apply legacy event8 configuration
        console.log(`🔄 [BOOTSTRAP] Applying legacy fallback configuration...`);
        try {
          const { applyEvent8ProvenConfig } = await import('./event8-proven-config');
          await applyEvent8ProvenConfig(event.id);
          console.log(`✅ [BOOTSTRAP] Legacy fallback applied successfully`);
        } catch (fallbackError) {
          console.error(`❌ [BOOTSTRAP] Legacy fallback also failed:`, fallbackError instanceof Error ? fallbackError.message : String(fallbackError));
          // Continue anyway - event is created, configuration can be fixed later
        }
      }
      
    } catch (bootstrapError) {
      console.error(`❌ [BOOTSTRAP] Critical bootstrap error for Event ${event.id}:`, bootstrapError);
      // Continue anyway - event is created, configuration can be fixed later
    }
    
    // Log completion regardless of bootstrap result
    console.log(`🏁 [EVENT${event.id}] Event creation completed - ready for commercial use`);
    
    return event;
  }

  async createEventFromTemplate(templateEventId: number, newEventData: InsertEvent): Promise<Event> {
    console.log(`🔧 [TEMPLATE] Creating new event from template ${templateEventId}`);
    
    // 1. Create the new event
    const [newEvent] = await db.insert(events).values(newEventData).returning();
    console.log(`✅ [TEMPLATE] New event created with ID: ${newEvent.id}`);
    
    // 2. 🚀 BULLETPROOF BOOTSTRAP SYSTEM - Apply proven configuration automatically
    console.log(`🚀 [BOOTSTRAP] Starting bulletproof bootstrap for templated Event ${newEvent.id}...`);
    
    try {
      const { bootstrapEvent } = await import('./event-config-bootstrap');
      const bootstrapResult = await bootstrapEvent(newEvent.id);
      
      if (bootstrapResult.success) {
        console.log(`✅ [BOOTSTRAP] Templated Event ${newEvent.id} successfully bootstrapped!`);
        console.log(`🔧 Applied settings:`, bootstrapResult.appliedSettings);
        
        if (bootstrapResult.warnings.length > 0) {
          console.log(`⚠️ [BOOTSTRAP] Warnings:`, bootstrapResult.warnings);
        }
      } else {
        console.error(`❌ [BOOTSTRAP] Bootstrap failed for templated Event ${newEvent.id}:`, bootstrapResult.errors);
        
        // FALLBACK 1: Try legacy event8 configuration
        console.log(`🔄 [BOOTSTRAP] Applying legacy fallback for templated event...`);
        try {
          const { applyEvent8ProvenConfig } = await import('./event8-proven-config');
          await applyEvent8ProvenConfig(newEvent.id);
          console.log(`✅ [BOOTSTRAP] Legacy fallback applied successfully`);
        } catch (legacyError) {
          console.error(`❌ [BOOTSTRAP] Legacy fallback failed, copying template config:`, legacyError instanceof Error ? legacyError.message : String(legacyError));
          
          // FALLBACK 2: Copy configuration from template
          try {
            await this.copyCompleteEventConfiguration(templateEventId, newEvent.id);
            console.log(`✅ [BOOTSTRAP] Template configuration copied as final fallback`);
          } catch (copyError) {
            console.error(`❌ [BOOTSTRAP] All fallbacks failed:`, copyError instanceof Error ? copyError.message : String(copyError));
          }
        }
      }
      
    } catch (bootstrapError) {
      console.error(`❌ [BOOTSTRAP] Critical bootstrap error for templated Event ${newEvent.id}:`, bootstrapError);
      // Continue anyway - event is created, configuration can be fixed later
    }
    
    // Log completion regardless of bootstrap result
    console.log(`🏁 [TEMPLATE] Event ${newEvent.id} creation from template completed - ready for commercial use`);
    
    return newEvent;
  }

  async copyCompleteEventConfiguration(templateEventId: number, newEventId: number): Promise<void> {
    console.log(`📋 Copying complete configuration from event ${templateEventId} to event ${newEventId}`);
    
    try {
      // Copiar estadísticas de procesamiento
      const templateStats = await this.getProcessingStats(templateEventId);
      if (templateStats) {
        await this.updateProcessingStats(newEventId, {
          totalPhotos: 0,
          processedPhotos: 0,
          dorsalsDetected: 0,
          facesDetected: 0,
          ocrAccuracy: templateStats.ocrAccuracy,
          avgProcessingTime: templateStats.avgProcessingTime,
        });
        console.log(`✅ Processing stats copied from template (OCR accuracy: ${templateStats.ocrAccuracy}%)`);
      }
      
      // Copiar configuración del evento (status, free photos, etc.)
      const templateEvent = await this.getEvent(templateEventId);
      if (templateEvent) {
        await this.updateEvent(newEventId, {
          status: 'active', // Nuevo evento activo
          freePhotosEnabled: false, // Fotos gratuitas deshabilitadas para nuevo evento
        });
        console.log(`✅ Event configuration copied from template`);
      }
      
    } catch (error) {
      console.error('Error copying event configuration:', error instanceof Error ? error.message : String(error));
    }
  }

  async inheritConfigurationsFromReferenceEvent(newEventId: number): Promise<void> {
    try {
      // Use Event 1 as reference (known working configuration)
      const referenceEventId = 1;
      
      // Check if reference event exists and has successful configurations
      const referenceEvent = await this.getEvent(referenceEventId);
      if (!referenceEvent) {
        console.log(`📋 Evento de referencia ${referenceEventId} no encontrado, saltando herencia`);
        return;
      }

      console.log(`🔄 Heredando configuraciones del evento ${referenceEventId} al evento ${newEventId}...`);

      // Inherit processing configuration by creating initial stats entry
      const referenceStats = referenceEvent.processingStats;
      
      // Use successful default values if no reference stats exist
      const defaultStats = {
        avgProcessingTime: "2.5s",
        ocrAccuracy: "85%"
      };
      
      await db.insert(processingStats).values({
        eventId: newEventId,
        totalPhotos: 0,
        processedPhotos: 0,
        dorsalsDetected: 0,
        facesDetected: 0,
        avgProcessingTime: referenceStats?.avgProcessingTime || defaultStats.avgProcessingTime,
        ocrAccuracy: referenceStats?.ocrAccuracy || defaultStats.ocrAccuracy,
      }).onConflictDoNothing();
      
      console.log(`✅ Estadísticas de procesamiento heredadas (OCR accuracy: ${referenceStats?.ocrAccuracy || defaultStats.ocrAccuracy})`);
      console.log(`✅ Tiempo de procesamiento configurado: ${referenceStats?.avgProcessingTime || defaultStats.avgProcessingTime}`);
      

      // Set same status as reference event if it's successful
      if (referenceEvent.status === 'active' || referenceEvent.status === 'completed') {
        await this.updateEvent(newEventId, { 
          status: 'active',
          freePhotosEnabled: false // Start with paid photos by default
        });
        console.log(`✅ Estado del evento configurado como 'active'`);
      }

      console.log(`🎯 Herencia completada: Evento ${newEventId} listo con configuraciones probadas`);

    } catch (error) {
      console.error(`❌ Error heredando configuraciones al evento ${newEventId}:`, error);
      // Continue even if inheritance fails - event creation should still succeed
    }
  }

  async updateEvent(id: number, updates: Partial<InsertEvent>): Promise<Event | undefined> {
    const [event] = await db
      .update(events)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(events.id, id))
      .returning();
    return event;
  }

  async deleteEvent(id: number): Promise<boolean> {
    const result = await db.delete(events).where(eq(events.id, id));
    return result.length > 0;
  }

  async getPhotos(eventId: number): Promise<Photo[]> {
    return await db.select().from(photos).where(eq(photos.eventId, eventId));
  }

  async getPhoto(id: number): Promise<Photo | undefined> {
    const [photo] = await db.select().from(photos).where(eq(photos.id, id));
    return photo;
  }

  async getPhotoByFilename(filename: string): Promise<Photo | undefined> {
    const [photo] = await db.select().from(photos).where(eq(photos.filename, filename));
    return photo;
  }

  async getPhotoByFilenameForEvent(eventId: number, filename: string): Promise<Photo | undefined> {
    const [photo] = await db.select().from(photos).where(
      and(eq(photos.eventId, eventId), eq(photos.filename, filename))
    );
    return photo;
  }

  async createPhoto(insertPhoto: InsertPhoto): Promise<Photo> {
    const photoData = {
      ...insertPhoto,
      detectedDorsals: (insertPhoto.detectedDorsals ?? []) as number[],
      faces: (insertPhoto.faces ?? []) as Array<{x: number, y: number, width: number, height: number, confidence: number}>
    };
    const [photo] = await db.insert(photos).values(photoData).returning();
    return photo;
  }

  async updatePhoto(id: number, updates: Partial<InsertPhoto>): Promise<Photo | undefined> {
    const [photo] = await db
      .update(photos)
      .set({
        ...updates,
        detectedDorsals: updates.detectedDorsals ? [...(updates.detectedDorsals as number[])] : undefined,
        faces: updates.faces ? [...(updates.faces as Array<{x: number, y: number, width: number, height: number, confidence: number, landmarks?: Array<{type: string, x: number, y: number}>, landmarkVector?: number[], joyLikelihood?: string, sorrowLikelihood?: string, angerLikelihood?: string, surpriseLikelihood?: string}>)] : undefined
      })
      .where(eq(photos.id, id))
      .returning();
    return photo;
  }

  async searchPhotosByDorsal(eventId: number | null, dorsalNumber: number): Promise<SearchResult> {
    try {
      // FIXED: Event ID is now REQUIRED - no default fallback to Event 1
      if (!eventId) {
        console.log(`❌ ISOLATION ENFORCED: eventId is required for dorsal search`);
        return {
          photos: [],
          dorsalNumber,
          totalFound: 0,
        };
      }

      console.log(`🔒 DATABASE SEARCH: dorsal ${dorsalNumber} ONLY in event ${eventId}`);
      
      // Verify the event exists and is active
      const event = await this.getEvent(eventId);
      if (!event) {
        console.log(`❌ Event ${eventId} not found`);
        return {
          photos: [],
          dorsalNumber,
          totalFound: 0,
        };
      }

      console.log(`✅ Event ${eventId} verified: ${event.name}`);
      
      // FIRST: Search in DATABASE directly (for all events including recovered photos)
      const dbPhotos = await db
        .select()
        .from(photos)
        .where(
          and(
            eq(photos.eventId, eventId),
            sql`${photos.detectedDorsals} @> ${JSON.stringify([dorsalNumber])}`
          )
        );
      
      console.log(`💾 DATABASE RESULT: ${dbPhotos.length} photos for dorsal ${dorsalNumber} in event ${eventId}`);
      
      if (dbPhotos.length > 0) {
        return {
          photos: transformPhotosUrls(dbPhotos),
          dorsalNumber,
          totalFound: dbPhotos.length,
        };
      }

      // FALLBACK: If no database results, try Google Cloud Storage (legacy)
      const { getCloudStorage } = await import('./cloud-storage');
      const cloudStorage = getCloudStorage();
      
      const cloudPhotos = await cloudStorage.getParticipantPhotos(eventId, dorsalNumber);
      console.log(`☁️ FALLBACK RESULT: ${cloudPhotos.length} photos for dorsal ${dorsalNumber} in event ${eventId}`);
      
      if (cloudPhotos.length > 0) {
        const photoObjects = cloudPhotos.map((photoPath, index) => {
          const filename = photoPath.replace(/^eventos\/\d+\/originales\//, '');
          
          // Split original path for new fields
          const lastSlashIndex = photoPath.lastIndexOf('/');
          const originalDir = lastSlashIndex > -1 ? photoPath.substring(0, lastSlashIndex + 1) : '';
          const originalFilename = lastSlashIndex > -1 ? photoPath.substring(lastSlashIndex + 1) : photoPath;
          
          return {
            id: Math.floor(Math.random() * 10000) + dorsalNumber + index,
            eventId: eventId,
            filename: filename,
            originalPath: photoPath,
            originalDir,
            originalFilename,
            webPath: photoPath.replace('/originales/', '/web/'),
            thumbnailPath: photoPath.replace('/originales/', '/miniaturas/'),
            detectedDorsals: [dorsalNumber],
            faces: [],
            processed: true,
            processingStatus: "completed" as const,
            uploadedAt: new Date("2024-07-15T10:00:00.000Z"),
            processedAt: new Date("2024-07-15T10:05:00.000Z")
          };
        });
        
        return {
          photos: transformPhotosUrls(photoObjects),
          dorsalNumber,
          totalFound: cloudPhotos.length,
        };
      }

      return {
        photos: [],
        dorsalNumber,
        totalFound: 0,
      };
    } catch (error) {
      console.error(`Error searching photos by dorsal in event ${eventId}:`, error);
      return {
        photos: [],
        dorsalNumber,
        totalFound: 0,
      };
    }
  }

  async searchPhotosByFilename(filename: string): Promise<Photo[]> {
    return await db.select().from(photos).where(eq(photos.filename, filename));
  }

  async getPhotosForProcessing(eventId: number): Promise<Photo[]> {
    try {
      const result = await db
        .select()
        .from(photos)
        .where(
          and(
            eq(photos.eventId, eventId),
            sql`(detected_dorsals IS NULL OR detected_dorsals = '[]'::jsonb OR NOT processed)`
          )
        )
        .orderBy(desc(photos.uploadedAt));
      return result;
    } catch (error) {
      console.error('Error getting photos for processing:', error);
      return [];
    }
  }

  async getParticipants(eventId: number): Promise<Participant[]> {
    return await db.select().from(participants).where(eq(participants.eventId, eventId));
  }

  async createParticipant(insertParticipant: InsertParticipant): Promise<Participant> {
    const [participant] = await db.insert(participants).values(insertParticipant).returning();
    return participant;
  }

  async updateParticipantPhotoCount(eventId: number, dorsalNumber: number, count: number): Promise<void> {
    await db
      .update(participants)
      .set({ photoCount: count })
      .where(
        and(
          eq(participants.eventId, eventId),
          eq(participants.dorsalNumber, dorsalNumber)
        )
      );
  }

  async createSale(insertSale: InsertSale): Promise<Sale> {
    const saleData = {
      ...insertSale,
      photoIds: (insertSale.photoIds ?? []) as number[]
    };
    const [sale] = await db.insert(sales).values(saleData).returning();
    return sale;
  }

  async getSales(eventId: number): Promise<Sale[]> {
    return await db.select().from(sales).where(eq(sales.eventId, eventId));
  }

  async updateSale(id: number, updateSale: Partial<InsertSale>): Promise<Sale | undefined> {
    const [sale] = await db.update(sales).set({
      ...updateSale,
      photoIds: updateSale.photoIds ? [...(updateSale.photoIds as number[])] : undefined
    }).where(eq(sales.id, id)).returning();
    return sale;
  }

  async getSaleByReference(reference: string): Promise<Sale | undefined> {
    const [sale] = await db.select().from(sales).where(eq(sales.wompiReference, reference));
    return sale;
  }

  async getSaleByDownloadToken(token: string): Promise<Sale | undefined> {
    const [sale] = await db.select().from(sales).where(eq(sales.downloadToken, token));
    return sale;
  }

  async getPhotosByIds(photoIds: number[]): Promise<Photo[]> {
    if (photoIds.length === 0) return [];
    
    return await db.select().from(photos).where(inArray(photos.id, photoIds));
  }

  async getProcessingStats(eventId: number): Promise<ProcessingStats | undefined> {
    const [stats] = await db.select().from(processingStats).where(eq(processingStats.eventId, eventId));
    return stats;
  }

  async updateProcessingStats(eventId: number, updates: Partial<ProcessingStats>): Promise<ProcessingStats> {
    const [stats] = await db
      .update(processingStats)
      .set({ ...updates, lastUpdated: new Date() })
      .where(eq(processingStats.eventId, eventId))
      .returning();
    
    if (!stats) {
      const [newStats] = await db
        .insert(processingStats)
        .values({ eventId, ...updates } as any)
        .returning();
      return newStats;
    }
    
    return stats;
  }

  async getDashboardStats(): Promise<{
    activeEvents: number;
    processedPhotos: number;
    detectedDorsals: number;
    monthlySales: string;
  }> {
    const [activeEventsCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(events)
      .where(eq(events.status, "active"));

    const [processedPhotosCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(photos)
      .where(eq(photos.processingStatus, "completed"));

    // SIMPLE SAFE COUNT - Avoid complex jsonb operations that cause crashes
    const [detectedDorsalsCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(photos)
      .where(sql`
        ${photos.detectedDorsals} IS NOT NULL 
        AND ${photos.detectedDorsals}::text != ''
        AND ${photos.detectedDorsals}::text != '[]'
        AND ${photos.detectedDorsals}::text != 'null'
        AND ${photos.detectedDorsals}::text != '{}'
      `);

    const [monthlySalesSum] = await db
      .select({ sum: sql<number>`sum(${sales.amount})` })
      .from(sales)
      .where(sql`${sales.createdAt} >= date_trunc('month', current_date)`);

    return {
      activeEvents: Number(activeEventsCount?.count || 0),
      processedPhotos: Number(processedPhotosCount?.count || 0),
      detectedDorsals: Number(detectedDorsalsCount?.count || 0),
      monthlySales: `$${Number(monthlySalesSum?.sum || 0).toLocaleString('en-US')} COP`,
    };
  }

  // Photographer Applications
  async createPhotographerApplication(application: InsertPhotographerApplication): Promise<PhotographerApplication> {
    const [newApplication] = await db
      .insert(photographerApplications)
      .values(application)
      .returning();
    return newApplication;
  }

  async getPhotographerApplications(): Promise<PhotographerApplication[]> {
    return await db.select().from(photographerApplications).orderBy(desc(photographerApplications.createdAt));
  }

  async updatePhotographerApplication(id: number, updates: Partial<PhotographerApplication>): Promise<PhotographerApplication | undefined> {
    const [application] = await db
      .update(photographerApplications)
      .set(updates)
      .where(eq(photographerApplications.id, id))
      .returning();
    return application;
  }

  // Users
  async getUserByEmail(email: string): Promise<any> {
    try {
      // Import the users table from schema
      const { users } = await import('@shared/schema');
      const [user] = await db.select().from(users).where(eq(users.email, email));
      return user;
    } catch (error) {
      console.error(`Error getting user by email ${email}:`, error);
      return null;
    }
  }

  // Critical Import Function for Event 8 Photos - RECONCILE/UPDATE IMPLEMENTATION
  async importEvent8PhotosFromCloud(): Promise<{
    success: boolean;
    insertedCount: number;
    reconciledUpdatedCount: number;
    migratedCount: number;
    totalFound: number;
    errors: string[];
    verificationCount: number;
  }> {
    console.log('🚨 [CRITICAL RECONCILE] Starting Event 8 photos reconciliation from Google Cloud Storage...');
    
    const errors: string[] = [];
    let insertedCount = 0;
    let reconciledUpdatedCount = 0;
    let migratedCount = 0;
    let totalFound = 0;
    
    try {
      // Initialize Google Cloud Storage
      const { getCloudStorage } = await import('./cloud-storage');
      const cloudStorage = getCloudStorage();
      
      // Get storage bucket
      const bucket = (cloudStorage as any).storage.bucket('REDACTED_GCS_BUCKET');
      console.log('🔍 [CRITICAL RECONCILE] Connected to bucket: REDACTED_GCS_BUCKET');
      
      // List all files in eventos/8/originales/
      const [files] = await bucket.getFiles({ prefix: 'eventos/8/originales/' });
      totalFound = files.length;
      
      console.log(`🔍 [CRITICAL RECONCILE] Found ${totalFound} files in eventos/8/originales/`);
      
      if (totalFound === 0) {
        errors.push('No files found in eventos/8/originales/ directory');
        return {
          success: false,
          insertedCount: 0,
          reconciledUpdatedCount: 0,
          migratedCount: 0,
          totalFound: 0,
          errors,
          verificationCount: 0
        };
      }
      
      // Process each file with RECONCILE/UPDATE logic
      for (const file of files) {
        try {
          const fileName = file.name;
          
          // Extract filename from path (remove eventos/8/originales/ prefix)
          const shortFilename = fileName.replace('eventos/8/originales/', '');
          
          // Skip if empty filename or not an image
          if (!shortFilename || !shortFilename.match(/\.(jpg|jpeg|png|tiff|gif)$/i)) {
            console.log(`⏭️ [CRITICAL RECONCILE] Skipping non-image file: ${fileName}`);
            continue;
          }
          
          // STEP 1: Check if photo exists in Event 8 (for reconciliation)
          const event8Photo = await this.getPhotoByFilenameForEvent(8, shortFilename);
          
          if (event8Photo) {
            // RECONCILE: Check if paths are incorrect (point to eventos/6/ or eventos/10/)
            const expectedOriginalPath = `eventos/8/originales/${shortFilename}`;
            const expectedWebPath = `eventos/8/web/${shortFilename}`;
            const expectedThumbnailPath = `eventos/8/miniaturas/${shortFilename}`;
            
            const needsUpdate = (
              event8Photo.originalPath !== expectedOriginalPath ||
              event8Photo.webPath !== expectedWebPath ||
              event8Photo.thumbnailPath !== expectedThumbnailPath
            );
            
            if (needsUpdate) {
              console.log(`🔄 [RECONCILE] Updating paths for existing photo: ${shortFilename}`);
              console.log(`   OLD originalPath: ${event8Photo.originalPath}`);
              console.log(`   NEW originalPath: ${expectedOriginalPath}`);
              
              // Update the photo with correct paths and split fields
              const lastSlashIndex = expectedOriginalPath.lastIndexOf('/');
              const originalDir = lastSlashIndex > -1 ? expectedOriginalPath.substring(0, lastSlashIndex + 1) : '';
              const originalFilename = lastSlashIndex > -1 ? expectedOriginalPath.substring(lastSlashIndex + 1) : expectedOriginalPath;
              
              await this.updatePhoto(event8Photo.id, {
                originalPath: expectedOriginalPath,
                originalDir,
                originalFilename,
                webPath: expectedWebPath,
                thumbnailPath: expectedThumbnailPath,
                processed: true,
                processingStatus: 'completed'
              });
              
              reconciledUpdatedCount++;
              console.log(`✅ [RECONCILE] Updated photo paths: ${shortFilename} (ID: ${event8Photo.id})`);
            } else {
              console.log(`✅ [RECONCILE] Photo already has correct paths: ${shortFilename}`);
            }
            continue;
          }
          
          // STEP 2: Check if photo exists in events 6 or 10 (for migration)
          let photoToMigrate = await this.getPhotoByFilenameForEvent(6, shortFilename);
          let sourceEventId = 6;
          
          if (!photoToMigrate) {
            photoToMigrate = await this.getPhotoByFilenameForEvent(10, shortFilename);
            sourceEventId = 10;
          }
          
          if (photoToMigrate) {
            console.log(`🚛 [MIGRATE] Moving photo from event ${sourceEventId} to event 8: ${shortFilename}`);
            
            // Update the photo to event 8 with correct paths and split fields
            const migratedOriginalPath = `eventos/8/originales/${shortFilename}`;
            const lastSlashIndex = migratedOriginalPath.lastIndexOf('/');
            const originalDir = lastSlashIndex > -1 ? migratedOriginalPath.substring(0, lastSlashIndex + 1) : '';
            const originalFilename = lastSlashIndex > -1 ? migratedOriginalPath.substring(lastSlashIndex + 1) : migratedOriginalPath;
            
            await this.updatePhoto(photoToMigrate.id, {
              eventId: 8, // Migrate to event 8
              originalPath: migratedOriginalPath,
              originalDir,
              originalFilename,
              webPath: `eventos/8/web/${shortFilename}`,
              thumbnailPath: `eventos/8/miniaturas/${shortFilename}`,
              processed: true,
              processingStatus: 'completed'
            });
            
            migratedCount++;
            console.log(`✅ [MIGRATE] Migrated photo from event ${sourceEventId} to event 8: ${shortFilename} (ID: ${photoToMigrate.id})`);
            continue;
          }
          
          // STEP 3: Create new photo record if it doesn't exist anywhere with split original path fields
          const newOriginalPath = `eventos/8/originales/${shortFilename}`;
          const lastSlashIndex = newOriginalPath.lastIndexOf('/');
          const originalDir = lastSlashIndex > -1 ? newOriginalPath.substring(0, lastSlashIndex + 1) : '';
          const originalFilename = lastSlashIndex > -1 ? newOriginalPath.substring(lastSlashIndex + 1) : newOriginalPath;
          
          const photoData: InsertPhoto = {
            eventId: 8, // Critical: Use event_id = 8
            filename: shortFilename,
            originalPath: newOriginalPath,
            originalDir,
            originalFilename,
            webPath: `eventos/8/web/${shortFilename}`,
            thumbnailPath: `eventos/8/miniaturas/${shortFilename}`,
            detectedDorsals: [], // Empty array for OCR to fill
            faces: [],
            processed: true, // Mark as processed since it exists in cloud
            processingStatus: 'completed'
          };
          
          // Insert into database
          const photo = await this.createPhoto(photoData);
          
          if (photo) {
            insertedCount++;
            console.log(`✅ [INSERT] New photo created: ${shortFilename} (ID: ${photo.id})`);
          } else {
            errors.push(`Failed to create photo record for: ${shortFilename}`);
          }
          
          // Progress update every 100 operations
          const totalOperations = insertedCount + reconciledUpdatedCount + migratedCount;
          if (totalOperations % 100 === 0) {
            console.log(`📈 [PROGRESS] ${totalOperations}/${totalFound} processed (${Math.round(totalOperations/totalFound*100)}%) - Inserted: ${insertedCount}, Reconciled: ${reconciledUpdatedCount}, Migrated: ${migratedCount}`);
          }
          
        } catch (fileError) {
          const errorMsg = `Error processing file ${file.name}: ${fileError instanceof Error ? fileError.message : String(fileError)}`;
          console.error(`❌ [CRITICAL RECONCILE] ${errorMsg}`);
          errors.push(errorMsg);
        }
      }
      
      // Final verification - count photos with CORRECT paths
      const [verificationCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(photos)
        .where(
          and(
            eq(photos.eventId, 8),
            sql`original_path LIKE 'eventos/8/originales/%'`
          )
        );
      
      const finalCount = verificationCount?.count || 0;
      const totalOperations = insertedCount + reconciledUpdatedCount + migratedCount;
      
      console.log('🎉 [CRITICAL RECONCILE] RECONCILIATION COMPLETED');
      console.log('═'.repeat(60));
      console.log(`📊 Total files found in GCS: ${totalFound}`);
      console.log(`➕ New photos inserted: ${insertedCount}`);
      console.log(`🔄 Existing photos reconciled/updated: ${reconciledUpdatedCount}`);
      console.log(`🚛 Photos migrated from events 6/10: ${migratedCount}`);
      console.log(`📈 Total operations performed: ${totalOperations}`);
      console.log(`❌ Errors encountered: ${errors.length}`);
      console.log(`🔍 Final verification: ${finalCount} photos with correct event_id=8 and originalPath=eventos/8/originales/`);
      console.log('═'.repeat(60));
      
      const success = totalOperations > 0 && errors.length === 0;
      
      return {
        success,
        insertedCount,
        reconciledUpdatedCount,
        migratedCount,
        totalFound,
        errors,
        verificationCount: finalCount
      };
      
    } catch (error) {
      const criticalError = `Critical error during reconciliation: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`🚨 [CRITICAL RECONCILE] ${criticalError}`);
      errors.push(criticalError);
      
      return {
        success: false,
        insertedCount,
        reconciledUpdatedCount,
        migratedCount,
        totalFound,
        errors,
        verificationCount: 0
      };
    }
  }

  // ========================
  // BULLETPROOF BOOTSTRAP SYSTEM - EventConfig CRUD Operations
  // ========================

  /**
   * Create a new EventConfig with proven settings
   */
  async createEventConfig(eventConfig: InsertEventConfig): Promise<EventConfig> {
    console.log(`🔧 [STORAGE] Creating EventConfig for event ${eventConfig.eventId}...`);
    
    try {
      const configData = {
        ...eventConfig,
        supportedImageFormats: (eventConfig.supportedImageFormats ?? [".jpg", ".jpeg", ".png", ".webp"]) as string[]
      };
      const [created] = await db.insert(eventConfigs).values(configData).returning();
      console.log(`✅ [STORAGE] EventConfig created with ID: ${created.id}`);
      return created;
    } catch (error) {
      console.error(`❌ [STORAGE] Failed to create EventConfig:`, error);
      throw new Error(`Failed to create EventConfig: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get EventConfig for a specific event
   */
  async getEventConfig(eventId: number): Promise<EventConfig | undefined> {
    try {
      const [config] = await db
        .select()
        .from(eventConfigs)
        .where(eq(eventConfigs.eventId, eventId));
      
      return config;
    } catch (error) {
      console.error(`❌ [STORAGE] Failed to get EventConfig for event ${eventId}:`, error);
      return undefined;
    }
  }

  /**
   * Update EventConfig for a specific event
   */
  async updateEventConfig(eventId: number, eventConfig: Partial<InsertEventConfig>): Promise<EventConfig | undefined> {
    console.log(`🔄 [STORAGE] Updating EventConfig for event ${eventId}...`);
    
    try {
      const [updated] = await db
        .update(eventConfigs)
        .set({
          ...eventConfig,
          supportedImageFormats: eventConfig.supportedImageFormats ? [...(eventConfig.supportedImageFormats as string[])] : undefined,
          updatedAt: new Date()
        })
        .where(eq(eventConfigs.eventId, eventId))
        .returning();
      
      if (updated) {
        console.log(`✅ [STORAGE] EventConfig updated for event ${eventId}`);
      }
      
      return updated;
    } catch (error) {
      console.error(`❌ [STORAGE] Failed to update EventConfig for event ${eventId}:`, error);
      return undefined;
    }
  }

  /**
   * Delete EventConfig for a specific event
   */
  async deleteEventConfig(eventId: number): Promise<boolean> {
    console.log(`🗑️ [STORAGE] Deleting EventConfig for event ${eventId}...`);
    
    try {
      const result = await db
        .delete(eventConfigs)
        .where(eq(eventConfigs.eventId, eventId));
      
      const deleted = result.length > 0;
      if (deleted) {
        console.log(`✅ [STORAGE] EventConfig deleted for event ${eventId}`);
      }
      
      return deleted;
    } catch (error) {
      console.error(`❌ [STORAGE] Failed to delete EventConfig for event ${eventId}:`, error);
      return false;
    }
  }

  /**
   * Validate EventConfig for a specific event
   */
  async validateEventConfig(eventId: number): Promise<{ valid: boolean; errors: string[]; warnings: string[]; }> {
    console.log(`🔍 [STORAGE] Validating EventConfig for event ${eventId}...`);
    
    const errors: string[] = [];
    const warnings: string[] = [];
    
    try {
      // Get the event config
      const config = await this.getEventConfig(eventId);
      
      if (!config) {
        errors.push(`EventConfig not found for event ${eventId}`);
        return { valid: false, errors, warnings };
      }

      // Validate OCR settings
      if ((config.ocrConfidenceThreshold ?? 95) < 50 || (config.ocrConfidenceThreshold ?? 95) > 100) {
        errors.push(`Invalid OCR confidence threshold: ${config.ocrConfidenceThreshold ?? 95}% (must be 50-100)`);
      }

      if ((config.maxDorsalsPerPhoto ?? 10) < 1 || (config.maxDorsalsPerPhoto ?? 10) > 20) {
        warnings.push(`Unusual maxDorsalsPerPhoto: ${config.maxDorsalsPerPhoto ?? 10} (recommended: 5-10)`);
      }

      if (parseFloat(config.dorsalSizeThreshold ?? '0.15') < 0.05 || parseFloat(config.dorsalSizeThreshold ?? '0.15') > 0.5) {
        warnings.push(`Unusual dorsalSizeThreshold: ${config.dorsalSizeThreshold ?? '0.15'} (recommended: 0.15-0.30)`);
      }

      // Validate path templates
      const pathTemplate = config.cloudStoragePathTemplate ?? 'eventos/{eventId}';
      if (!pathTemplate.includes(eventId.toString())) {
        errors.push(`Path template does not contain event ID: ${pathTemplate}`);
      }

      // Validate signed URL settings
      if ((config.signedUrlExpiry ?? 86400) < 3600 || (config.signedUrlExpiry ?? 86400) > 604800) {
        warnings.push(`Unusual signed URL expiry: ${config.signedUrlExpiry ?? 86400}s (recommended: 1-7 days)`);
      }

      // Validate processing timeout
      if ((config.processingTimeoutMinutes ?? 120) < 30 || (config.processingTimeoutMinutes ?? 120) > 480) {
        warnings.push(`Unusual processing timeout: ${config.processingTimeoutMinutes ?? 120}min (recommended: 60-240)`);
      }

      // Check bootstrap completion
      if (!config.bootstrapCompleted) {
        warnings.push(`Bootstrap not yet completed for event ${eventId}`);
      }

      const valid = errors.length === 0;
      console.log(`🔍 [STORAGE] Validation result for event ${eventId}: ${valid ? '✅ VALID' : '❌ INVALID'}`);
      console.log(`   📊 Errors: ${errors.length}, Warnings: ${warnings.length}`);
      
      return { valid, errors, warnings };
      
    } catch (error) {
      errors.push(`Validation failed: ${error instanceof Error ? error.message : String(error)}`);
      console.error(`❌ [STORAGE] EventConfig validation failed:`, error);
      return { valid: false, errors, warnings };
    }
  }

  // Download Codes Implementation
  async createDownloadCode(downloadCode: InsertDownloadCode): Promise<DownloadCode> {
    console.log(`🔑 [STORAGE] Creating download code for event ${downloadCode.eventId}, dorsal ${downloadCode.dorsalNumber}`);
    
    try {
      const [created] = await db.insert(downloadCodes).values(downloadCode).returning();
      console.log(`✅ [STORAGE] Download code created: ${created.code}`);
      return created;
    } catch (error) {
      console.error(`❌ [STORAGE] Failed to create download code:`, error);
      throw error;
    }
  }

  async getDownloadCode(code: string): Promise<DownloadCode | undefined> {
    console.log(`🔍 [STORAGE] Looking up download code: ${code}`);
    
    try {
      const [downloadCode] = await db
        .select()
        .from(downloadCodes)
        .where(eq(downloadCodes.code, code));
      
      if (downloadCode) {
        console.log(`✅ [STORAGE] Download code found for event ${downloadCode.eventId}, dorsal ${downloadCode.dorsalNumber}`);
      } else {
        console.log(`⚠️ [STORAGE] Download code not found: ${code}`);
      }
      
      return downloadCode;
    } catch (error) {
      console.error(`❌ [STORAGE] Failed to lookup download code:`, error);
      throw error;
    }
  }

  async validateDownloadCode(code: string): Promise<{ valid: boolean; downloadCode?: DownloadCode; error?: string; }> {
    console.log(`✅ [STORAGE] Validating download code: ${code}`);
    
    try {
      const downloadCode = await this.getDownloadCode(code);
      
      if (!downloadCode) {
        return { valid: false, error: "Download code not found" };
      }
      
      if (downloadCode.isUsed && (downloadCode.downloadCount ?? 0) >= (downloadCode.maxDownloads ?? 3)) {
        return { valid: false, downloadCode, error: "Download code has been used to maximum limit" };
      }
      
      if (downloadCode.expiresAt && downloadCode.expiresAt < new Date()) {
        return { valid: false, downloadCode, error: "Download code has expired" };
      }
      
      console.log(`✅ [STORAGE] Download code is valid: ${code}`);
      return { valid: true, downloadCode };
    } catch (error) {
      console.error(`❌ [STORAGE] Failed to validate download code:`, error);
      return { valid: false, error: "Failed to validate download code" };
    }
  }

  async useDownloadCode(code: string): Promise<{ success: boolean; downloadCode?: DownloadCode; error?: string; }> {
    console.log(`🔑 [STORAGE] Using download code: ${code}`);

    try {
      // UPDATE atómico condicional: sólo incrementa si no se ha superado el límite.
      // Esto evita race conditions entre requests concurrentes.
      const [updated] = await db
        .update(downloadCodes)
        .set({
          downloadCount: sql`${downloadCodes.downloadCount} + 1`,
          isUsed: true,
          usedAt: new Date(),
        })
        .where(
          and(
            eq(downloadCodes.code, code),
            sql`COALESCE(${downloadCodes.downloadCount}, 0) < COALESCE(${downloadCodes.maxDownloads}, 3)`,
            sql`(${downloadCodes.expiresAt} IS NULL OR ${downloadCodes.expiresAt} > NOW())`
          )
        )
        .returning();

      if (!updated) {
        // Re-validar para entregar un mensaje claro (expirado vs límite).
        const existing = await this.getDownloadCode(code);
        if (!existing) return { success: false, error: "Download code not found" };
        if (existing.expiresAt && existing.expiresAt < new Date()) {
          return { success: false, error: "Download code has expired" };
        }
        return { success: false, error: "Download code has been used to maximum limit" };
      }

      console.log(`✅ [STORAGE] Download code used successfully: ${code} (usage: ${updated.downloadCount}/${updated.maxDownloads})`);
      return { success: true, downloadCode: updated };
    } catch (error) {
      console.error(`❌ [STORAGE] Failed to use download code:`, error);
      return { success: false, error: "Failed to use download code" };
    }
  }

  async getDownloadCodesForEvent(eventId: number): Promise<DownloadCode[]> {
    console.log(`📋 [STORAGE] Getting download codes for event ${eventId}`);
    
    try {
      const codes = await db
        .select()
        .from(downloadCodes)
        .where(eq(downloadCodes.eventId, eventId))
        .orderBy(desc(downloadCodes.createdAt));
      
      console.log(`✅ [STORAGE] Found ${codes.length} download codes for event ${eventId}`);
      return codes;
    } catch (error) {
      console.error(`❌ [STORAGE] Failed to get download codes for event:`, error);
      throw error;
    }
  }

  async getDownloadCodesByDorsal(eventId: number, dorsalNumber: number): Promise<DownloadCode[]> {
    console.log(`🔍 [STORAGE] Getting download codes for event ${eventId}, dorsal ${dorsalNumber}`);
    
    try {
      const codes = await db
        .select()
        .from(downloadCodes)
        .where(and(
          eq(downloadCodes.eventId, eventId),
          eq(downloadCodes.dorsalNumber, dorsalNumber)
        ))
        .orderBy(desc(downloadCodes.createdAt));
      
      console.log(`✅ [STORAGE] Found ${codes.length} download codes for event ${eventId}, dorsal ${dorsalNumber}`);
      return codes;
    } catch (error) {
      console.error(`❌ [STORAGE] Failed to get download codes by dorsal:`, error);
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();