import { db } from "./db";
import { events, photos, participants, processingStats } from "@shared/schema";

async function seedDatabase() {
  console.log("Seeding database with sample data...");

  try {
    // Check if data already exists
    const existingEvents = await db.select().from(events);
    if (existingEvents.length > 0) {
      console.log("Database already has data, skipping seed");
      return;
    }

    // Create sample events
    const [event1, event2] = await db.insert(events).values([
      {
        name: "Maratón Ciudad 2024",
        date: new Date("2024-03-15"),
        location: "Centro de la Ciudad",
        expectedParticipants: 500,
        status: "active",
      },
      {
        name: "Carrera Montaña 10K",
        date: new Date("2024-04-20"),
        location: "Parque Natural",
        expectedParticipants: 200,
        status: "processing",
      }
    ]).returning();

    // Create sample photos
    await db.insert(photos).values([
      {
        eventId: event1.id,
        filename: "marathon_start_001.jpg",
        originalPath: "/uploads/marathon_start_001.jpg",
        webPath: "/uploads/web/marathon_start_001.jpg",
        thumbnailPath: "/uploads/thumbnails/marathon_start_001.jpg",
        detectedDorsals: [123, 456, 789],
        faces: [
          { x: 100, y: 150, width: 80, height: 100, confidence: 0.95 },
          { x: 300, y: 120, width: 75, height: 95, confidence: 0.89 }
        ],
        processed: true,
        processingStatus: "completed",
      },
      {
        eventId: event1.id,
        filename: "marathon_finish_001.jpg",
        originalPath: "/uploads/marathon_finish_001.jpg",
        webPath: "/uploads/web/marathon_finish_001.jpg",
        thumbnailPath: "/uploads/thumbnails/marathon_finish_001.jpg",
        detectedDorsals: [234, 567],
        faces: [
          { x: 200, y: 180, width: 70, height: 90, confidence: 0.92 }
        ],
        processed: true,
        processingStatus: "completed",
      },
      {
        eventId: event2.id,
        filename: "mountain_trail_001.jpg",
        originalPath: "/uploads/mountain_trail_001.jpg",
        webPath: "/uploads/web/mountain_trail_001.jpg",
        thumbnailPath: "/uploads/thumbnails/mountain_trail_001.jpg",
        detectedDorsals: [101, 202],
        faces: [
          { x: 150, y: 200, width: 65, height: 85, confidence: 0.88 }
        ],
        processed: true,
        processingStatus: "completed",
      }
    ]);

    // Create sample participants
    await db.insert(participants).values([
      {
        eventId: event1.id,
        dorsalNumber: 123,
        name: "Juan Pérez",
        email: "juan.perez@email.com",
        photoCount: 3,
      },
      {
        eventId: event1.id,
        dorsalNumber: 456,
        name: "María García",
        email: "maria.garcia@email.com",
        photoCount: 2,
      },
      {
        eventId: event1.id,
        dorsalNumber: 789,
        name: "Carlos López",
        email: "carlos.lopez@email.com",
        photoCount: 1,
      },
      {
        eventId: event2.id,
        dorsalNumber: 101,
        name: "Ana Martínez",
        email: "ana.martinez@email.com",
        photoCount: 2,
      },
      {
        eventId: event2.id,
        dorsalNumber: 202,
        name: "Luis Rodríguez",
        email: "luis.rodriguez@email.com",
        photoCount: 1,
      }
    ]);

    // Create sample processing stats
    await db.insert(processingStats).values([
      {
        eventId: event1.id,
        totalPhotos: 1250,
        processedPhotos: 1100,
        detectedDorsals: 450,
        detectedFaces: 380,
        averageProcessingTime: 2.3,
        accuracyRate: 0.92,
      },
      {
        eventId: event2.id,
        totalPhotos: 680,
        processedPhotos: 500,
        detectedDorsals: 180,
        detectedFaces: 150,
        averageProcessingTime: 1.8,
        accuracyRate: 0.89,
      }
    ]);

    console.log("✅ Database seeded successfully!");
    console.log(`Created ${2} events, ${3} photos, ${5} participants, and ${2} processing stats`);

  } catch (error) {
    console.error("❌ Error seeding database:", error);
    throw error;
  }
}

// Run seed if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { seedDatabase };