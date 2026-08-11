import express, { type Request, Response, NextFunction } from "express";
import path from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

// Configuración aumentada para 1000 fotos adicionales
app.use(express.json({ 
  limit: '5gb'
}));

app.use(express.urlencoded({ 
  extended: false, 
  limit: '5gb'
}));

// Configurar timeout para requests largos - optimizado para 200 fotos
app.use((req, res, next) => {
  // Timeout de 45 minutos para uploads masivos con OCR
  req.setTimeout(45 * 60 * 1000, () => {
    res.status(408).send('Request timeout');
  });
  
  res.setTimeout(45 * 60 * 1000, () => {
    res.status(408).send('Response timeout');
  });
  
  next();
});

// Manejo específico para errores 413 (Request Entity Too Large)
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE' || err.code === 'LIMIT_PART_COUNT' || err.code === 'LIMIT_FIELD_COUNT' || err.code === 'LIMIT_FIELD_VALUE' || err.code === 'LIMIT_UNEXPECTED_FILE') {
    console.error('❌ Error 413 - Multer:', {
      code: err.code,
      limit: err.limit,
      field: err.field,
      message: err.message,
      url: req.url,
      method: req.method,
      contentLength: req.headers['content-length'],
      contentType: req.headers['content-type'],
      userAgent: req.headers['user-agent'],
      origin: req.headers.origin,
      referer: req.headers.referer
    });
    return res.status(413).json({
      error: 'Request Entity Too Large',
      message: 'El archivo es demasiado grande. Límites aumentados: 100MB por archivo, 1000 archivos máximo, 5GB total',
      code: err.code,
      limit: err.limit,
      field: err.field
    });
  }
  
  if (err.status === 413 || err.statusCode === 413) {
    console.error('❌ Error 413 - HTTP:', {
      status: err.status,
      statusCode: err.statusCode,
      message: err.message,
      url: req.url,
      method: req.method,
      contentLength: req.headers['content-length'],
      contentType: req.headers['content-type'],
      userAgent: req.headers['user-agent'],
      origin: req.headers.origin,
      referer: req.headers.referer
    });
    return res.status(413).json({
      error: 'Request Entity Too Large',
      message: 'La solicitud es demasiado grande. Intenta subir menos archivos o archivos más pequeños.'
    });
  }
  
  next(err);
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Static download photos endpoint removed - now using Google Cloud Storage direct downloads
  
  // Serve attached assets statically
  app.use('/attached_assets', express.static(path.join(process.cwd(), 'attached_assets')));
  
  // Serve uploads folder statically (for photo viewing)
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
  
  // Serve eventos folder statically (for thumbnails and processed photos)
  app.use('/eventos', express.static(path.join(process.cwd(), 'eventos')));
  
  // Setup routes BEFORE Vite to ensure API routes work correctly
  const server = await registerRoutes(app);
  
  // Setup Vite in development mode AFTER API routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  
  // Sistema de limpieza automática periódica
  const cleanupInterval = setInterval(async () => {
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      const tempDir = '/tmp';
      const files = fs.readdirSync(tempDir);
      
      let cleanedCount = 0;
      let totalSize = 0;
      
      for (const file of files) {
        const filePath = path.join(tempDir, file);
        try {
          const stats = fs.statSync(filePath);
          
          // Limpiar archivos temporales de imágenes más viejos de 10 minutos
          if (stats.isFile() && 
              (file.includes('.jpg') || file.includes('.jpeg') || file.includes('.png') || 
               file.includes('.tmp') || file.includes('temp') || file.includes('upload')) &&
              (Date.now() - stats.mtime.getTime()) > 600000) { // 10 minutos
            
            totalSize += stats.size;
            fs.unlinkSync(filePath);
            cleanedCount++;
          }
        } catch (error) {
          // Ignorar errores en archivos individuales
        }
      }
      
      if (cleanedCount > 0) {
        console.log(`🧹 Limpieza automática: ${cleanedCount} archivos temporales eliminados (${Math.round(totalSize / 1024)} KB)`);
      }
      
      // Monitorear uso de memoria
      const memUsage = process.memoryUsage();
      const memUsedMB = Math.round(memUsage.rss / 1024 / 1024);
      
      // Si el uso de memoria es muy alto (>500MB), forzar garbage collection
      if (memUsedMB > 500) {
        console.log(`🧠 Memoria alta detectada: ${memUsedMB}MB, forzando garbage collection...`);
        if (global.gc) {
          global.gc();
        }
      } else if (memUsedMB > 200) {
        console.log(`📊 Memoria actual: ${memUsedMB}MB`);
      }
    } catch (error) {
      console.error('⚠️ Error en limpieza automática:', error);
    }
  }, 300000); // Ejecutar cada 5 minutos
  
  // Limpiar el interval al cerrar el servidor
  process.on('SIGINT', () => {
    clearInterval(cleanupInterval);
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    clearInterval(cleanupInterval);
    process.exit(0);
  });
  
  // Configurar límites del servidor HTTP - optimizado para acceso global
  server.maxRequestsPerSocket = 0;
  server.requestTimeout = 45 * 60 * 1000; // 45 minutos para uploads masivos
  server.headersTimeout = 45 * 60 * 1000; // 45 minutos para headers
  server.maxHeaderSize = 8 * 1024 * 1024; // 8MB headers para multipart masivo global

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Vite setup moved earlier to prevent API interference

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
