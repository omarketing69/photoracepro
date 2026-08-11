import bcrypt from 'bcrypt';
import { db } from '../db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Crear usuario 'atleta' para acceso a eventos pagos
 * Se ejecuta de forma idempotente - no crea duplicados
 */
export async function createAthleteUser(): Promise<{ success: boolean; message: string }> {
  try {
    const athleteEmail = 'atleta@racephoto.pro';
    const athletePassword = process.env.ATHLETE_DEFAULT_PASSWORD || 'atleta123';
    
    // Verificar si ya existe el usuario atleta
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, athleteEmail));
    
    if (existingUser) {
      console.log('✅ [SETUP] Usuario atleta ya existe');
      return {
        success: true,
        message: 'Usuario atleta ya existe'
      };
    }

    // Hashear contraseña
    const hashedPassword = await bcrypt.hash(athletePassword, 12);

    // Crear usuario atleta
    const [newUser] = await db
      .insert(users)
      .values({
        email: athleteEmail,
        password: hashedPassword,
        role: 'athlete',
        name: 'Usuario Atleta',
      })
      .returning();

    console.log('✅ [SETUP] Usuario atleta creado exitosamente:', {
      id: newUser.id,
      email: newUser.email,
      role: newUser.role
    });

    return {
      success: true,
      message: `Usuario atleta creado con ID: ${newUser.id}`
    };

  } catch (error) {
    console.error('❌ [SETUP] Error creando usuario atleta:', error);
    return {
      success: false,
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  createAthleteUser()
    .then(result => {
      console.log(result.message);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ [SETUP] Fatal error:', error);
      process.exit(1);
    });
}