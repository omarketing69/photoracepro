import { pgTable, text, serial, integer, boolean, timestamp, decimal, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { z } from "zod";

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  date: timestamp("date").notNull(),
  location: text("location").notNull(),
  expectedParticipants: integer("expected_participants").notNull(),
  status: text("status").notNull().default("active"), // active, processing, completed
  freePhotosEnabled: boolean("free_photos_enabled").default(false),
  freePhotosEnabledAt: timestamp("free_photos_enabled_at"),
  requiresAthleteLogin: boolean("requires_athlete_login").default(false), // For paid events requiring athlete auth
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const photos = pgTable("photos", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => events.id),
  filename: text("filename").notNull(),
  originalPath: text("original_path").notNull(), // Keep for backward compatibility during migration
  originalDir: text("original_dir"), // New field: directory path without filename
  originalFilename: text("original_filename"), // New field: filename only
  webPath: text("web_path"),
  thumbnailPath: text("thumbnail_path"),
  detectedDorsals: jsonb("detected_dorsals").$type<number[]>().default([]),
  faces: jsonb("faces").$type<Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
    landmarks?: Array<{ type: string; x: number; y: number }>;
    landmarkVector?: number[];
    joyLikelihood?: string;
    sorrowLikelihood?: string;
    angerLikelihood?: string;
    surpriseLikelihood?: string;
  }>>().default([]),
  processed: boolean("processed").default(false),
  processingStatus: text("processing_status").default("pending"), // pending, processing, completed, failed
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  processedAt: timestamp("processed_at"),
});

export const participants = pgTable("participants", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => events.id),
  dorsalNumber: integer("dorsal_number").notNull(),
  name: text("name"),
  email: text("email"),
  photoCount: integer("photo_count").default(0),
});

export const sales = pgTable("sales", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => events.id),
  dorsalNumber: integer("dorsal_number"),
  photoIds: jsonb("photo_ids").$type<number[]>().notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  customerEmail: text("customer_email").notNull(),
  customerName: text("customer_name"),
  status: text("status").notNull().default("pending"), // pending, approved, declined, failed
  wompiTransactionId: text("wompi_transaction_id"),
  wompiReference: text("wompi_reference"),
  wompiPaymentMethod: text("wompi_payment_method"), // CARD, PSE, NEQUI, etc.
  downloadToken: text("download_token"), // Token for secure downloads
  downloadExpiresAt: timestamp("download_expires_at"), // Download link expiration
  downloadCount: integer("download_count").default(0),
  maxDownloads: integer("max_downloads").default(3),
  createdAt: timestamp("created_at").defaultNow(),
  paidAt: timestamp("paid_at"),
});

export const processingStats = pgTable("processing_stats", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => events.id),
  totalPhotos: integer("total_photos").notNull(),
  processedPhotos: integer("processed_photos").notNull(),
  dorsalsDetected: integer("dorsals_detected").notNull(),
  facesDetected: integer("faces_detected").notNull(),
  ocrAccuracy: decimal("ocr_accuracy", { precision: 5, scale: 2 }),
  avgProcessingTime: decimal("avg_processing_time", { precision: 8, scale: 3 }),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"), // admin, user, photographer, athlete
  name: text("name"),
  assignedEventId: integer("assigned_event_id").references(() => events.id), // For photographers only
  createdAt: timestamp("created_at").defaultNow(),
  lastLogin: timestamp("last_login"),
});

export const eventPricing = pgTable("event_pricing", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => events.id),
  basePrice: integer("base_price").notNull().default(10000), // Price in COP
  currency: text("currency").notNull().default("COP"),
  // Volume pricing tiers
  tier2Photos: integer("tier2_photos").default(3), // 3+ photos
  tier2Price: integer("tier2_price").default(8000), // Price per photo for tier 2
  tier3Photos: integer("tier3_photos").default(5), // 5+ photos  
  tier3Price: integer("tier3_price").default(6000), // Price per photo for tier 3
  tier4Photos: integer("tier4_photos").default(10), // 10+ photos
  tier4Price: integer("tier4_price").default(5000), // Price per photo for tier 4
  // Settings
  volumeDiscountEnabled: boolean("volume_discount_enabled").default(true),
  downloadValidityDays: integer("download_validity_days").default(7), // Days that photos are available for download
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const photographerApplications = pgTable("photographer_applications", {
  id: serial("id").primaryKey(),
  // Datos personales
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  city: text("city").notNull(),
  // Información profesional
  experience: text("experience").notNull(), // beginner, intermediate, advanced, professional
  cameraType: text("camera_type"), // DSLR, Mirrorless, Professional, etc.
  cameraModel: text("camera_model"),
  lensDetails: text("lens_details"),
  // Información adicional
  portfolioUrl: text("portfolio_url"),
  previousEvents: text("previous_events"),
  availability: text("availability").notNull(), // weekends, weekdays, flexible
  message: text("message"),
  // Estado
  status: text("status").notNull().default("pending"), // pending, approved, rejected, contacted
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: integer("reviewed_by").references(() => users.id),
});

// Tabla de relaciones muchos-a-muchos: Fotógrafos pueden asignarse a múltiples eventos
export const photographerEventAssignments = pgTable("photographer_event_assignments", {
  id: serial("id").primaryKey(),
  photographerId: integer("photographer_id").notNull().references(() => users.id),
  eventId: integer("event_id").notNull().references(() => events.id),
  assignedAt: timestamp("assigned_at").defaultNow(),
  assignedBy: integer("assigned_by").references(() => users.id), // Admin who made the assignment
  role: text("role").default("photographer"), // photographer, lead_photographer, assistant
  notes: text("notes"), // Optional notes about the assignment
});

// BULLETPROOF EVENT BOOTSTRAP SYSTEM
export const eventConfigs = pgTable("event_configs", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => events.id).unique(),
  
  // PROVEN EVENT8 CONFIGURATION SETTINGS
  // Auto-sync configuration
  autoSyncFromGCS: boolean("auto_sync_from_gcs").default(true),
  supportedImageFormats: jsonb("supported_image_formats").$type<string[]>().default([".jpg", ".jpeg", ".png", ".webp"]),
  
  // Search and detection configuration
  enableDatabaseSearch: boolean("enable_database_search").default(true),
  enableMultiDorsalSupport: boolean("enable_multi_dorsal_support").default(true),
  
  // OCR PROVEN SETTINGS FROM EVENT8
  ocrConfidenceThreshold: integer("ocr_confidence_threshold").default(95),
  enableAsyncProcessing: boolean("enable_async_processing").default(true),
  maxDorsalsPerPhoto: integer("max_dorsals_per_photo").default(10), // Increased from 5 to 10
  dorsalSizeThreshold: decimal("dorsal_size_threshold", { precision: 3, scale: 2 }).default("0.15"), // More permissive 0.15 vs 0.30
  allowDuplicateDorsals: boolean("allow_duplicate_dorsals").default(true),
  
  // STORAGE PATH CONFIGURATION (IDENTITY-ONLY MAPPING)
  cloudStoragePathTemplate: text("cloud_storage_path_template").default("eventos/{eventId}"),
  originalPhotosPath: text("original_photos_path").default("eventos/{eventId}/originales"),
  webPhotosPath: text("web_photos_path").default("eventos/{eventId}/web"),
  thumbnailPhotosPath: text("thumbnail_photos_path").default("eventos/{eventId}/miniaturas"),
  
  // SIGNED URL CONFIGURATION
  signedUrlExpiry: integer("signed_url_expiry").default(86400), // 24 hours in seconds
  enableSignedUrls: boolean("enable_signed_urls").default(true),
  
  // CROSS-EVENT PROTECTION
  enableCrossEventProtection: boolean("enable_cross_event_protection").default(true),
  requireAdminForSync: boolean("require_admin_for_sync").default(true),
  
  // AUTOMATIC PROCESSING SETTINGS
  autoProcessNewPhotos: boolean("auto_process_new_photos").default(true),
  processingTimeoutMinutes: integer("processing_timeout_minutes").default(120),
  thumbnailGenerationEnabled: boolean("thumbnail_generation_enabled").default(true),
  
  // BOOTSTRAP STATUS
  bootstrapCompleted: boolean("bootstrap_completed").default(false),
  bootstrapCompletedAt: timestamp("bootstrap_completed_at"),
  configurationVersion: text("configuration_version").default("event8-proven-v2"),
  
  // METADATA
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertEventConfigSchema = createInsertSchema(eventConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  bootstrapCompletedAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  lastLogin: true,
});

export const insertEventPricingSchema = createInsertSchema(eventPricing).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPhotographerApplicationSchema = createInsertSchema(photographerApplications).omit({
  id: true,
  createdAt: true,
  reviewedAt: true,
  reviewedBy: true,
  status: true,
  adminNotes: true,
});

// Insert schemas
export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  date: z.string().transform((str) => new Date(str)),
});

export const insertPhotoSchema = createInsertSchema(photos).omit({
  id: true,
  uploadedAt: true,
  processedAt: true,
});

export const insertParticipantSchema = createInsertSchema(participants).omit({
  id: true,
});

export const insertSaleSchema = createInsertSchema(sales).omit({
  id: true,
  createdAt: true,
});

export const insertPhotographerEventAssignmentSchema = createInsertSchema(photographerEventAssignments).omit({
  id: true,
  assignedAt: true,
});

// Types
export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Photo = typeof photos.$inferSelect;
export type InsertPhoto = z.infer<typeof insertPhotoSchema>;
export type PhotographerApplication = typeof photographerApplications.$inferSelect;
export type InsertPhotographerApplication = z.infer<typeof insertPhotographerApplicationSchema>;
export type Participant = typeof participants.$inferSelect;
export type InsertParticipant = z.infer<typeof insertParticipantSchema>;
export type Sale = typeof sales.$inferSelect;
export type InsertSale = z.infer<typeof insertSaleSchema>;
export type ProcessingStats = typeof processingStats.$inferSelect;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type EventPricing = typeof eventPricing.$inferSelect;
export type InsertEventPricing = z.infer<typeof insertEventPricingSchema>;
export type PhotographerEventAssignment = typeof photographerEventAssignments.$inferSelect;
export type InsertPhotographerEventAssignment = z.infer<typeof insertPhotographerEventAssignmentSchema>;

// Additional types for API responses
export type EventWithStats = Event & {
  photoCount: number;
  participantCount: number;
  processingStats?: ProcessingStats;
};

export type PhotoWithEvent = Photo & {
  event: Event;
};

export type SearchResult = {
  photos: Photo[];
  dorsalNumber?: number;
  totalFound: number;
};

// Database Relations
export const eventsRelations = relations(events, ({ many }) => ({
  photos: many(photos),
  participants: many(participants),
  sales: many(sales),
  processingStats: many(processingStats),
}));

export const photosRelations = relations(photos, ({ one }) => ({
  event: one(events, {
    fields: [photos.eventId],
    references: [events.id],
  }),
}));

export const participantsRelations = relations(participants, ({ one }) => ({
  event: one(events, {
    fields: [participants.eventId],
    references: [events.id],
  }),
}));

export const salesRelations = relations(sales, ({ one }) => ({
  event: one(events, {
    fields: [sales.eventId],
    references: [events.id],
  }),
}));

export const processingStatsRelations = relations(processingStats, ({ one }) => ({
  event: one(events, {
    fields: [processingStats.eventId],
    references: [events.id],
  }),
}));

// SLA Alerts table for monitoring commercial SLA compliance
export const slaAlerts = pgTable('sla_alerts', {
  id: serial('id').primaryKey(),
  eventId: integer('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  alertType: text('alert_type').notNull(),
  severity: text('severity').notNull(),
  message: text('message').notNull(),
  metadata: jsonb('metadata').notNull(),
  timestamp: timestamp('timestamp').notNull(),
  createdAt: timestamp('created_at').defaultNow()
});

// System Settings table
export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  photoPrice: integer("photo_price").default(15000), // Price in smallest currency unit (centavos for COP)
  currency: text("currency").default("COP"),
  currencySymbol: text("currency_symbol").default("$"),
  maxDownloads: integer("max_downloads").default(3),
  downloadValidityDays: integer("download_validity_days").default(30),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Download Codes table for unified free/paid photo download system
export const downloadCodes = pgTable("download_codes", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => events.id),
  dorsalNumber: integer("dorsal_number").notNull(),
  code: text("code").notNull().unique(), // User-friendly code like "PHOTO123"
  isUsed: boolean("is_used").default(false),
  usedAt: timestamp("used_at"),
  expiresAt: timestamp("expires_at"), // Optional expiration
  maxDownloads: integer("max_downloads").default(5),
  downloadCount: integer("download_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSLAAlertSchema = createInsertSchema(slaAlerts).omit({
  id: true,
  createdAt: true,
});

export const insertSystemSettingsSchema = createInsertSchema(systemSettings).omit({
  id: true,
  updatedAt: true,
});

export const insertDownloadCodeSchema = createInsertSchema(downloadCodes).omit({
  id: true,
  createdAt: true,
  usedAt: true,
});

export type SLAAlert = typeof slaAlerts.$inferSelect;
export type InsertSLAAlert = z.infer<typeof insertSLAAlertSchema>;
export type SystemSettings = typeof systemSettings.$inferSelect;
export type InsertSystemSettings = z.infer<typeof insertSystemSettingsSchema>;
export type EventConfig = typeof eventConfigs.$inferSelect;
export type InsertEventConfig = z.infer<typeof insertEventConfigSchema>;
export type DownloadCode = typeof downloadCodes.$inferSelect;
export type InsertDownloadCode = z.infer<typeof insertDownloadCodeSchema>;
