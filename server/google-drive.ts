import { google } from 'googleapis';
import { Express } from 'express';
import fs from 'fs';
import path from 'path';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  thumbnailLink?: string;
  webContentLink?: string;
}

interface DriveImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: string[];
}

export class GoogleDriveManager {
  private drive: any;
  public auth: any;

  constructor() {
    this.initializeAuth();
  }

  private initializeAuth() {
    // Para autenticación con OAuth2
    const redirectUri = process.env.REPLIT_DOMAINS 
      ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}/auth/google/callback`
      : process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/auth/google/callback';
    
    console.log('Google OAuth Configuration:');
    console.log('- Client ID configured:', !!process.env.GOOGLE_CLIENT_ID);
    console.log('- Client Secret configured:', !!process.env.GOOGLE_CLIENT_SECRET);
    console.log('- Redirect URI:', redirectUri);
    
    this.auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    this.drive = google.drive({ version: 'v3', auth: this.auth });
  }

  // Generar URL de autorización para Google Drive
  getAuthUrl(loginHint?: string): string {
    const scopes = [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.file'
    ];

    const authParams: any = {
      access_type: 'offline',
      scope: scopes,
      prompt: 'select_account consent', // Forzar selección de cuenta
      include_granted_scopes: true,
      state: Math.random().toString(36).substring(7), // Estado único para evitar cache
      approval_prompt: 'force' // Forzar nueva aprobación
    };

    // Si se proporciona un email específico, agregarlo como hint
    if (loginHint) {
      authParams.login_hint = loginHint;
      // Solo agregar hd si es un dominio de organización (no gmail.com)
      const domain = loginHint.split('@')[1];
      if (domain !== 'gmail.com') {
        authParams.hd = domain;
      }
    }

    return this.auth.generateAuthUrl(authParams);
  }

  // Configurar tokens de acceso
  async setCredentials(code: string): Promise<boolean> {
    try {
      const { tokens } = await this.auth.getToken(code);
      this.auth.setCredentials(tokens);
      
      // Guardar tokens para uso futuro (en producción usar base de datos)
      fs.writeFileSync('./google-tokens.json', JSON.stringify(tokens));
      return true;
    } catch (error) {
      console.error('Error setting Google credentials:', error);
      return false;
    }
  }

  // Cargar tokens guardados
  async loadSavedTokens(): Promise<boolean> {
    try {
      if (fs.existsSync('./google-tokens.json')) {
        const tokens = JSON.parse(fs.readFileSync('./google-tokens.json', 'utf8'));
        this.auth.setCredentials(tokens);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error loading saved tokens:', error);
      return false;
    }
  }

  // Listar carpetas en Google Drive
  async listFolders(): Promise<DriveFile[]> {
    try {
      const response = await this.drive.files.list({
        q: "mimeType='application/vnd.google-apps.folder'",
        fields: 'files(id, name, mimeType)',
        pageSize: 100
      });

      return response.data.files || [];
    } catch (error) {
      console.error('Error listing folders:', error);
      throw error;
    }
  }

  // Listar fotos en una carpeta específica
  async listPhotosInFolder(folderId: string): Promise<DriveFile[]> {
    try {
      const imageTypes = [
        'image/jpeg',
        'image/jpg', 
        'image/png',
        'image/tiff',
        'image/bmp'
      ];

      const mimeTypeQuery = imageTypes.map(type => `mimeType='${type}'`).join(' or ');
      
      const response = await this.drive.files.list({
        q: `'${folderId}' in parents and (${mimeTypeQuery})`,
        fields: 'files(id, name, mimeType, size, thumbnailLink, webContentLink)',
        pageSize: 1000 // Manejar hasta 1000 archivos por petición
      });

      return response.data.files || [];
    } catch (error) {
      console.error('Error listing photos in folder:', error);
      throw error;
    }
  }

  // Descargar una foto desde Google Drive
  async downloadPhoto(fileId: string, filename: string, destinationPath: string): Promise<string> {
    try {
      const response = await this.drive.files.get({
        fileId: fileId,
        alt: 'media'
      }, { responseType: 'stream' });

      const fullPath = path.join(destinationPath, filename);
      const writer = fs.createWriteStream(fullPath);

      return new Promise((resolve, reject) => {
        response.data.pipe(writer);
        writer.on('finish', () => resolve(fullPath));
        writer.on('error', reject);
      });
    } catch (error) {
      console.error(`Error downloading photo ${filename}:`, error);
      throw error;
    }
  }

  // Importar fotos de una carpeta de Google Drive a un evento
  async importPhotosToEvent(folderId: string, eventId: number, batchSize = 50): Promise<DriveImportResult> {
    const result: DriveImportResult = {
      success: false,
      imported: 0,
      failed: 0,
      errors: []
    };

    try {
      // Listar todas las fotos en la carpeta
      const photos = await this.listPhotosInFolder(folderId);
      console.log(`Found ${photos.length} photos in Google Drive folder`);

      if (photos.length === 0) {
        result.errors.push('No photos found in the specified folder');
        return result;
      }

      // Crear directorio para el evento si no existe
      const eventDir = `./uploads/event_${eventId}`;
      if (!fs.existsSync(eventDir)) {
        fs.mkdirSync(eventDir, { recursive: true });
      }

      // Procesar fotos en lotes
      for (let i = 0; i < photos.length; i += batchSize) {
        const batch = photos.slice(i, i + batchSize);
        console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(photos.length/batchSize)}`);

        await Promise.allSettled(
          batch.map(async (photo) => {
            try {
              // Descargar foto
              const localPath = await this.downloadPhoto(photo.id, photo.name, eventDir);
              
              // Aquí integrarías con tu sistema de fotos existente
              // Por ejemplo, llamar a tu API para crear el registro en la base de datos
              
              result.imported++;
              console.log(`Imported: ${photo.name}`);
            } catch (error) {
              result.failed++;
              result.errors.push(`Failed to import ${photo.name}: ${error}`);
              console.error(`Failed to import ${photo.name}:`, error);
            }
          })
        );

        // Pausa pequeña entre lotes para no sobrecargar
        if (i + batchSize < photos.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      result.success = result.imported > 0;
      console.log(`Import completed: ${result.imported} imported, ${result.failed} failed`);
      
    } catch (error) {
      result.errors.push(`Import failed: ${error}`);
      console.error('Import failed:', error);
    }

    return result;
  }
}

// Registrar rutas de Google Drive
export function registerGoogleDriveRoutes(app: Express) {
  const driveManager = new GoogleDriveManager();

  // Limpiar tokens existentes y forzar nueva autenticación
  app.post('/api/drive/reset', async (req, res) => {
    try {
      // Limpiar tokens guardados
      if (fs.existsSync('./google-tokens.json')) {
        fs.unlinkSync('./google-tokens.json');
      }
      // Limpiar credenciales en memoria
      driveManager.auth.setCredentials({});
      res.json({ success: true, message: 'Tokens cleared successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to reset tokens' });
    }
  });

  // Iniciar autenticación con Google Drive
  app.get('/api/drive/auth', async (req, res) => {
    try {
      const { email, clean } = req.query;
      const authUrl = driveManager.getAuthUrl(email as string);
      
      if (clean === 'true') {
        // Para modo limpio, crear una URL que primero haga logout completo
        const logoutUrl = `https://accounts.google.com/logout?continue=${encodeURIComponent(authUrl)}`;
        res.json({ authUrl: logoutUrl });
      } else {
        res.json({ authUrl });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to generate auth URL' });
    }
  });

  // Ruta de diagnóstico para verificar configuración
  app.get('/api/drive/config', async (req, res) => {
    try {
      const config = {
        hasClientId: !!process.env.GOOGLE_CLIENT_ID,
        hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
        redirectUri: process.env.REPLIT_DOMAINS 
          ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}/auth/google/callback`
          : process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/auth/google/callback',
        currentDomain: req.get('host'),
        replitDomains: process.env.REPLIT_DOMAINS
      };
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get config' });
    }
  });

  // Callback de autenticación
  app.get('/auth/google/callback', async (req, res) => {
    try {
      const { code } = req.query;
      if (!code) {
        return res.status(400).json({ error: 'No authorization code provided' });
      }

      const success = await driveManager.setCredentials(code as string);
      if (success) {
        res.redirect('/?drive_auth=success');
      } else {
        res.redirect('/?drive_auth=error');
      }
    } catch (error) {
      console.error('Google Drive callback error:', error);
      res.redirect('/?drive_auth=error');
    }
  });

  // Listar carpetas
  app.get('/api/drive/folders', async (req, res) => {
    try {
      await driveManager.loadSavedTokens();
      const folders = await driveManager.listFolders();
      res.json(folders);
    } catch (error) {
      res.status(500).json({ error: 'Failed to list folders', details: error });
    }
  });

  // Listar fotos en carpeta
  app.get('/api/drive/folders/:folderId/photos', async (req, res) => {
    try {
      await driveManager.loadSavedTokens();
      const photos = await driveManager.listPhotosInFolder(req.params.folderId);
      res.json(photos);
    } catch (error) {
      res.status(500).json({ error: 'Failed to list photos', details: error });
    }
  });

  // Importar fotos desde Google Drive
  app.post('/api/drive/import/:eventId', async (req, res) => {
    try {
      const { folderId } = req.body;
      if (!folderId) {
        return res.status(400).json({ error: 'Folder ID is required' });
      }

      await driveManager.loadSavedTokens();
      const result = await driveManager.importPhotosToEvent(
        folderId, 
        parseInt(req.params.eventId)
      );

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Failed to import photos', details: error });
    }
  });
}