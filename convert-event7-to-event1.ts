import { db } from './server/db';
import { events, photos } from './shared/schema';
import { eq } from 'drizzle-orm';

async function convertEvent7ToEvent1() {
  console.log('🔄 Convirtiendo Event 7 a Event 1...');
  
  try {
    // 1. Crear el Event 1 con los mismos datos del Event 7
    await db.insert(events).values({
      id: 1,
      name: "Media Maratón del Oriente 2024",
      date: new Date('2024-12-15T08:00:00Z'),
      location: "Cúcuta",
      expectedParticipants: 1500,
      status: 'active',
      freePhotosEnabled: false,
      freePhotosEnabledAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    console.log('✅ Event 1 creado exitosamente');
    
    // 2. Actualizar todas las fotos del Event 7 para que pertenezcan al Event 1
    const updateResult = await db
      .update(photos)
      .set({ eventId: 1 })
      .where(eq(photos.eventId, 7));
      
    console.log(`✅ Fotos actualizadas del Event 7 al Event 1`);
    
    // 3. Eliminar el Event 7
    await db.delete(events).where(eq(events.id, 7));
    console.log('✅ Event 7 eliminado');
    
    console.log('🎉 Conversión completada: Event 1 "Media Maratón del Oriente 2024" está listo');
    
  } catch (error) {
    console.error('❌ Error convirtiendo evento:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

convertEvent7ToEvent1().catch(console.error);