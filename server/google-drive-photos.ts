import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { storage } from './storage';
import { GoogleVisionOCRProcessor } from './google-vision-ocr';
import { getCloudStorage } from './cloud-storage';
import { imageService } from './image-service';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  thumbnailLink?: string;
  webContentLink?: string;
}

export class GoogleDrivePhotosManager {
  private drive: any;
  private auth: any;

  constructor() {
    this.initializeAuth();
  }

  private initializeAuth() {
    const redirectUri = process.env.REPLIT_DOMAINS 
      ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}/auth/google/drive/callback`
      : 'http://localhost:5000/auth/google/drive/callback';
    
    console.log('Google Drive OAuth Configuration:');
    console.log('- Drive Client ID configured:', !!process.env.GOOGLE_DRIVE_CLIENT_ID);
    console.log('- Drive Client Secret configured:', !!process.env.GOOGLE_DRIVE_CLIENT_SECRET);
    console.log('- Drive Redirect URI:', redirectUri);
    
    this.auth = new google.auth.OAuth2(
      process.env.GOOGLE_DRIVE_CLIENT_ID,
      process.env.GOOGLE_DRIVE_CLIENT_SECRET,
      redirectUri
    );
    
    this.drive = google.drive({ version: 'v3', auth: this.auth });
  }

  getAuthUrl(loginHint?: string): string {
    if (!this.auth) {
      throw new Error('OAuth2 client not initialized');
    }
    
    const authUrl = this.auth.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/drive.readonly'],
      prompt: 'select_account consent',
      include_granted_scopes: true,
      state: Math.random().toString(36).substring(7),
      approval_prompt: 'force',
      login_hint: loginHint
    });
    return authUrl;
  }

  async setCredentials(code: string): Promise<boolean> {
    try {
      const { tokens } = await this.auth.getToken(code);
      this.auth.setCredentials(tokens);
      
      // Save tokens for future use
      if (tokens.refresh_token) {
        fs.writeFileSync('google-drive-tokens.json', JSON.stringify(tokens, null, 2));
      }
      
      return true;
    } catch (error) {
      console.error('Error setting credentials:', error);
      return false;
    }
  }

  async loadSavedTokens(): Promise<boolean> {
    try {
      if (fs.existsSync('google-drive-tokens.json')) {
        const tokens = JSON.parse(fs.readFileSync('google-drive-tokens.json', 'utf8'));
        this.auth.setCredentials(tokens);
        return true;
      }
    } catch (error) {
      console.error('Error loading saved tokens:', error);
    }
    return false;
  }

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
      return [];
    }
  }

  async listPhotosInFolder(folderId: string): Promise<DriveFile[]> {
    try {
      let allFiles: DriveFile[] = [];
      let nextPageToken = undefined;
      
      do {
        const response = await this.drive.files.list({
          q: `'${folderId}' in parents and (mimeType contains 'image/jpeg' or mimeType contains 'image/png' or mimeType contains 'image/tiff')`,
          fields: 'nextPageToken, files(id, name, mimeType, size, thumbnailLink, webContentLink)',
          pageSize: 1000,
          pageToken: nextPageToken
        });
        
        allFiles = allFiles.concat(response.data.files || []);
        nextPageToken = response.data.nextPageToken;
        
        console.log(`📁 Encontradas ${response.data.files?.length || 0} fotos en esta página. Total: ${allFiles.length}`);
        
      } while (nextPageToken);
      
      return allFiles;
    } catch (error) {
      console.error('Error listing photos in folder:', error);
      return [];
    }
  }

  async downloadPhoto(fileId: string, filename: string, destinationPath: string): Promise<string> {
    try {
      const dest = fs.createWriteStream(destinationPath);
      
      const response = await this.drive.files.get({
        fileId: fileId,
        alt: 'media'
      }, { responseType: 'stream' });
      
      return new Promise((resolve, reject) => {
        response.data
          .on('end', () => resolve(destinationPath))
          .on('error', reject)
          .pipe(dest);
      });
      
    } catch (error) {
      console.error(`Error downloading photo ${filename}:`, error);
      throw error;
    }
  }

  async importPhotosToEvent(folderId: string, eventId: number, maxPhotos: number = 100): Promise<void> {
    console.log(`🚀 IMPORTANDO FOTOS DESDE GOOGLE DRIVE`);
    console.log(`📁 Folder ID: ${folderId}`);
    console.log(`🎯 Event ID: ${eventId}`);
    console.log(`📊 Máximo fotos: ${maxPhotos}`);
    console.log('═'.repeat(70));

    try {
      // Get photos from folder
      const photos = await this.listPhotosInFolder(folderId);
      console.log(`📸 Total fotos encontradas: ${photos.length}`);

      // Limit number of photos to process
      const photosToProcess = photos.slice(0, maxPhotos);
      console.log(`🎯 Fotos a procesar: ${photosToProcess.length}`);

      let processedCount = 0;
      let successfulPhotos = 0;
      let totalDorsalsFound = 0;

      for (const photo of photosToProcess) {
        try {
          console.log(`\n📸 Procesando ${processedCount + 1}/${photosToProcess.length}: ${photo.name}`);

          // Download photo
          const destinationPath = path.join(process.cwd(), 'uploads', photo.name);
          await this.downloadPhoto(photo.id, photo.name, destinationPath);

          // Create photo record
          const photoData = {
            eventId,
            filename: photo.name,
            originalPath: destinationPath,
            detectedDorsals: [],
            faces: [],
            processed: false,
            processingStatus: 'pending' as const
          };

          const photoRecord = await storage.createPhoto(photoData);

          // Process with Google Vision OCR
          const googleVisionProcessor = new GoogleVisionOCRProcessor(getCloudStorage());
          const ocrResult = await googleVisionProcessor.processImage(destinationPath);

          if (ocrResult.dorsalNumbers.length > 0) {
            // Generate thumbnail
            const thumbnailPath = await imageService.generateThumbnail(destinationPath, photo.name);
            
            // Update photo with results
            await storage.updatePhoto(photoRecord.id, {
              detectedDorsals: ocrResult.dorsalNumbers,
              thumbnailPath,
              processed: true,
              processingStatus: 'completed'
            });

            totalDorsalsFound += ocrResult.dorsalNumbers.length;
            successfulPhotos++;

            console.log(`✅ Detectados ${ocrResult.dorsalNumbers.length} dorsales: [${ocrResult.dorsalNumbers.join(', ')}]`);
          } else {
            await storage.updatePhoto(photoRecord.id, {
              processed: true,
              processingStatus: 'no_dorsals_found'
            });

            console.log(`❌ Sin dorsales detectados`);
          }

          processedCount++;

          // Progress update
          if (processedCount % 10 === 0) {
            console.log(`\n📈 PROGRESO: ${processedCount}/${photosToProcess.length} (${Math.round(processedCount/photosToProcess.length*100)}%)`);
            console.log(`🎯 Dorsales encontrados: ${totalDorsalsFound}`);
          }

        } catch (error) {
          console.error(`❌ Error procesando ${photo.name}:`, error);
          processedCount++;
        }
      }

      // Final summary
      console.log('\n🎉 IMPORTACIÓN COMPLETADA');
      console.log('═'.repeat(50));
      console.log(`✅ Fotos procesadas: ${processedCount}/${photosToProcess.length}`);
      console.log(`🏆 Fotos con dorsales: ${successfulPhotos}`);
      console.log(`🎯 Total dorsales detectados: ${totalDorsalsFound}`);
      console.log(`📊 Promedio dorsales/foto: ${(totalDorsalsFound/successfulPhotos || 0).toFixed(1)}`);
      console.log(`⚡ Tasa de éxito: ${Math.round(successfulPhotos/processedCount*100)}%`);

    } catch (error) {
      console.error('❌ Error en importación:', error);
    }
  }
}

export const googleDrivePhotosManager = new GoogleDrivePhotosManager();

// Add routes to main app
export function registerGoogleDrivePhotosRoutes(app: any) {
  app.get('/auth/google/drive/url', async (req: any, res: any) => {
    try {
      const loginHint = req.query.loginHint || 'mediamaratondeloriente@gmail.com';
      const authUrl = googleDrivePhotosManager.getAuthUrl(loginHint);
      res.json({ authUrl });
    } catch (error) {
      console.error('Error generating drive auth URL:', error);
      res.status(500).json({ error: 'Error generating auth URL' });
    }
  });

  app.get('/auth/google/drive/callback', async (req: any, res: any) => {
    try {
      const { code } = req.query;
      if (!code) {
        return res.status(400).send('Authorization code not found');
      }

      const success = await googleDrivePhotosManager.setCredentials(code);
      if (success) {
        res.send(`
          <html>
            <body>
              <h2>✅ Google Drive autorizado exitosamente</h2>
              <p>Ya puedes acceder a las fotos del evento.</p>
              <script>
                setTimeout(() => {
                  window.close();
                }, 3000);
              </script>
            </body>
          </html>
        `);
      } else {
        res.status(500).send('Error setting up credentials');
      }
    } catch (error) {
      console.error('Drive callback error:', error);
      res.status(500).send('Authorization failed');
    }
  });

  app.get('/api/drive/folders', async (req: any, res: any) => {
    try {
      // Try to load saved tokens first
      await googleDrivePhotosManager.loadSavedTokens();
      
      const folders = await googleDrivePhotosManager.listFolders();
      res.json({ folders });
    } catch (error) {
      console.error('Error listing folders:', error);
      res.status(500).json({ error: 'Error listing folders', needsAuth: true });
    }
  });

  app.post('/api/drive/import', async (req: any, res: any) => {
    try {
      const { folderId, eventId = 1, maxPhotos = 50 } = req.body;
      
      if (!folderId) {
        return res.status(400).json({ error: 'folderId is required' });
      }

      // Start import process (async)
      googleDrivePhotosManager.importPhotosToEvent(folderId, eventId, maxPhotos).catch(console.error);
      
      res.json({ 
        success: true, 
        message: `Iniciando importación de hasta ${maxPhotos} fotos`,
        folderId,
        eventId
      });
    } catch (error) {
      console.error('Error starting import:', error);
      res.status(500).json({ error: 'Error starting import' });
    }
  });
}