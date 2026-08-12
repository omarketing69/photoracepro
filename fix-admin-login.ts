import postgres from 'postgres';
import * as bcrypt from 'bcrypt';

async function fixAdminLogin() {
  if (!process.env.DATABASE_URL) { throw new Error('DATABASE_URL env var required'); }
  const sql = postgres(process.env.DATABASE_URL);
  
  try {
    console.log('🔍 Verificando usuario administrador...');
    
    // Verificar si existe el usuario admin
    const existingAdmin = await sql`SELECT * FROM users WHERE email = 'admin@racephoto.com'`;
    console.log('Usuario admin existente:', existingAdmin.length > 0 ? 'SÍ' : 'NO');
    
    if (existingAdmin.length > 0) {
      console.log('Datos del admin:', {
        id: existingAdmin[0].id,
        email: existingAdmin[0].email,
        role: existingAdmin[0].role,
        name: existingAdmin[0].name
      });
    }
    
    // Crear/actualizar contraseña del admin
    console.log('🔐 Actualizando contraseña del administrador...');
    const hashedPassword = await bcrypt.hash('omar987', 10);
    
    await sql`
      INSERT INTO users (email, password, role, name)
      VALUES ('admin@racephoto.com', ${hashedPassword}, 'admin', 'Administrador RacePhoto Pro')
      ON CONFLICT (email) DO UPDATE SET 
        password = EXCLUDED.password,
        role = EXCLUDED.role,
        name = EXCLUDED.name
    `;
    
    console.log('✅ Usuario administrador actualizado');
    
    // Verificar que la contraseña funciona
    console.log('🧪 Probando login...');
    const testUser = await sql`SELECT * FROM users WHERE email = 'admin@racephoto.com'`;
    
    if (testUser.length > 0) {
      const passwordMatch = await bcrypt.compare('omar987', testUser[0].password);
      console.log('Contraseña válida:', passwordMatch ? 'SÍ' : 'NO');
    }
    
    await sql.end();
    console.log('🎉 Login del administrador corregido!');
    console.log('📧 Email: admin@racephoto.com');
    console.log('🔑 Password: omar987');
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

fixAdminLogin();