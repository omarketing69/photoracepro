// Simple script to generate Google Drive authorization URL
const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
const redirectUri = process.env.REPLIT_DOMAINS
  ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}/auth/google/drive/callback`
  : 'http://localhost:5000/auth/google/drive/callback';

if (!clientId) {
  console.log('❌ Error: GOOGLE_DRIVE_CLIENT_ID no configurado');
  process.exit(1);
}

const params = new URLSearchParams({
  client_id: clientId,
  redirect_uri: redirectUri,
  response_type: 'code',
  scope: 'https://www.googleapis.com/auth/drive.readonly',
  access_type: 'offline',
  prompt: 'select_account consent',
  login_hint: 'mediamaratondeloriente@gmail.com'
});

const authUrl = `https://accounts.google.com/o/oauth2/auth?${params.toString()}`;

console.log('🔗 URL DE AUTORIZACIÓN DE GOOGLE DRIVE:');
console.log('═'.repeat(80));
console.log(authUrl);
console.log('');
console.log('📋 INSTRUCCIONES:');
console.log('1. Copia y pega la URL en tu navegador');
console.log('2. Selecciona la cuenta: mediamaratondeloriente@gmail.com');
console.log('3. Autoriza el acceso a Google Drive');
console.log('4. Serás redirigido automáticamente de vuelta');
console.log('');
console.log('📍 URI de redirección configurada:', redirectUri);