import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Cloud, FolderOpen, Download, CheckCircle, AlertCircle, Upload } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  thumbnailLink?: string;
}

interface ImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: string[];
}

interface GoogleDriveImportProps {
  eventId: number;
  onImportComplete?: (result: ImportResult) => void;
}

export default function GoogleDriveImport({ eventId, onImportComplete }: GoogleDriveImportProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string>("");
  const [targetEmail, setTargetEmail] = useState<string>("mediamaratondeloriente@gmail.com");
  const [importProgress, setImportProgress] = useState<{
    isImporting: boolean;
    progress: number;
    status: string;
  }>({
    isImporting: false,
    progress: 0,
    status: ""
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Verificar si ya está conectado al cargar
  useEffect(() => {
    checkConnectionStatus();
  }, []);

  const checkConnectionStatus = async () => {
    try {
      const response = await fetch('/api/drive/folders');
      setIsConnected(response.ok);
    } catch (error) {
      setIsConnected(false);
    }
  };

  // Limpiar conexión existente y reconectar
  const resetConnection = async () => {
    try {
      await fetch('/api/drive/reset', { method: 'POST' });
      setIsConnected(false);
      setSelectedFolder("");
      toast({
        title: "Conexión reiniciada",
        description: "Puedes conectar una nueva cuenta de Google Drive",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo reiniciar la conexión",
        variant: "destructive",
      });
    }
  };

  // Función especial para conectar con ventana limpia (sin cache)
  const connectDriveClean = async () => {
    try {
      // Limpiar tokens existentes primero
      await fetch('/api/drive/reset', { method: 'POST' });
      
      const response = await fetch(`/api/drive/auth?email=${encodeURIComponent(targetEmail)}&clean=true`);
      const data = await response.json();
      
      if (data.authUrl) {
        // Crear URL con parámetros especiales para evitar cache
        const timestamp = Date.now();
        const cleanUrl = `${data.authUrl}&t=${timestamp}&clean_session=true&authuser=`;
        
        // Mostrar instrucciones claras al usuario
        toast({
          title: "Ventana de Autenticación",
          description: `Se abrirá una ventana nueva. Asegúrate de seleccionar la cuenta: ${targetEmail}`,
          duration: 5000,
        });
        
        // Abrir ventana con configuración especial
        const authWindow = window.open(
          cleanUrl,
          `google_clean_${timestamp}`,
          'width=650,height=750,scrollbars=yes,resizable=yes,menubar=no,toolbar=no,location=yes,status=no'
        );
        
        if (authWindow) {
          // Monitor la ventana
          const checkAuth = setInterval(async () => {
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('drive_auth') === 'success') {
              setIsConnected(true);
              clearInterval(checkAuth);
              authWindow.close();
              toast({
                title: "¡Perfecto!",
                description: "Google Drive conectado con la cuenta correcta",
              });
              queryClient.invalidateQueries({ queryKey: ['/api/drive/folders'] });
            } else if (urlParams.get('drive_auth') === 'error') {
              clearInterval(checkAuth);
              authWindow.close();
              toast({
                title: "Error de conexión",
                description: "No se pudo conectar. Intenta nuevamente.",
                variant: "destructive",
              });
            }
            
            // Verificar si la ventana fue cerrada
            try {
              if (authWindow.closed) {
                clearInterval(checkAuth);
              }
            } catch (e) {
              clearInterval(checkAuth);
            }
          }, 1000);
          
          // Limpiar después de 5 minutos
          setTimeout(() => {
            clearInterval(checkAuth);
            if (!authWindow.closed) {
              authWindow.close();
            }
          }, 300000);
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo iniciar la ventana limpia",
        variant: "destructive",
      });
    }
  };

  // Obtener URL de autorización de Google Drive
  const connectDrive = async () => {
    try {
      const response = await fetch(`/api/drive/auth?email=${encodeURIComponent(targetEmail)}`);
      const data = await response.json();
      
      if (data.authUrl) {
        // Agregar parámetros adicionales para forzar nueva autenticación
        const timestamp = Date.now();
        const finalUrl = `${data.authUrl}&t=${timestamp}&force_select=true`;
        
        // Abrir ventana con opciones específicas para evitar cache
        const authWindow = window.open(
          finalUrl, 
          'google_auth_' + timestamp, 
          'width=600,height=700,scrollbars=yes,resizable=yes,menubar=no,toolbar=no,location=no,status=no'
        );
        
        // Escuchar cuando se complete la autorización
        const checkAuth = setInterval(async () => {
          const urlParams = new URLSearchParams(window.location.search);
          if (urlParams.get('drive_auth') === 'success') {
            setIsConnected(true);
            clearInterval(checkAuth);
            toast({
              title: "Conexión exitosa",
              description: "Google Drive se conectó correctamente",
            });
            queryClient.invalidateQueries({ queryKey: ['/api/drive/folders'] });
          } else if (urlParams.get('drive_auth') === 'error') {
            clearInterval(checkAuth);
            toast({
              title: "Error de conexión",
              description: "No se pudo conectar con Google Drive",
              variant: "destructive",
            });
          }
        }, 1000);

        // Limpiar el intervalo después de 60 segundos
        setTimeout(() => clearInterval(checkAuth), 60000);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo iniciar la conexión con Google Drive",
        variant: "destructive",
      });
    }
  };

  // Obtener carpetas de Google Drive
  const { data: folders = [], isLoading: foldersLoading } = useQuery({
    queryKey: ['/api/drive/folders'],
    enabled: isConnected,
  });

  // Obtener fotos de la carpeta seleccionada
  const { data: photos = [], isLoading: photosLoading } = useQuery({
    queryKey: ['/api/drive/folders', selectedFolder, 'photos'],
    enabled: isConnected && !!selectedFolder,
  });

  // Mutación para importar fotos
  const importMutation = useMutation({
    mutationFn: async (folderId: string) => {
      const response = await fetch(`/api/drive/import/${eventId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ folderId }),
      });

      if (!response.ok) {
        throw new Error('Error importing photos');
      }

      return response.json();
    },
    onSuccess: (result: ImportResult) => {
      setImportProgress({
        isImporting: false,
        progress: 100,
        status: `Importación completada: ${result.imported} fotos importadas`
      });

      toast({
        title: "Importación completada",
        description: `Se importaron ${result.imported} fotos correctamente`,
      });

      onImportComplete?.(result);
      queryClient.invalidateQueries({ queryKey: ['/api/events', eventId, 'photos'] });
    },
    onError: (error) => {
      setImportProgress({
        isImporting: false,
        progress: 0,
        status: "Error en la importación"
      });

      toast({
        title: "Error de importación",
        description: "No se pudieron importar las fotos desde Google Drive",
        variant: "destructive",
      });
    },
  });

  const handleImport = () => {
    if (!selectedFolder) {
      toast({
        title: "Selecciona una carpeta",
        description: "Debes seleccionar una carpeta antes de importar",
        variant: "destructive",
      });
      return;
    }

    setImportProgress({
      isImporting: true,
      progress: 0,
      status: "Iniciando importación..."
    });

    importMutation.mutate(selectedFolder);
  };

  const formatFileSize = (bytes?: string) => {
    if (!bytes) return "Tamaño desconocido";
    const size = parseInt(bytes);
    const mb = size / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Cloud className="h-5 w-5 text-blue-500" />
          <span>Importar desde Google Drive</span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {!isConnected ? (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Conecta tu cuenta de Google Drive para importar fotos directamente desde tus carpetas.
              </AlertDescription>
            </Alert>
            
            <div>
              <label className="text-sm font-medium mb-2 block">
                Cuenta de Google Drive:
              </label>
              <Input
                value={targetEmail}
                onChange={(e) => setTargetEmail(e.target.value)}
                placeholder="tu@email.com"
                className="mb-2"
              />
              <p className="text-xs text-gray-500 mb-2">
                Especifica el email de la cuenta de Google Drive que contiene las fotos
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs">
                <p className="font-medium text-amber-800 mb-2">⚠️ Solución para cuenta incorrecta:</p>
                <div className="space-y-2">
                  <p className="text-amber-700">
                    1. Haz clic en "Cerrar Sesión Google" abajo
                  </p>
                  <p className="text-amber-700">
                    2. Luego haz clic en "Conectar con Cuenta Limpia"
                  </p>
                  <div className="flex gap-2">
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={() => window.open('https://accounts.google.com/logout', '_blank')}
                      className="text-xs h-7"
                    >
                      🚪 Cerrar Sesión Google
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => connectDriveClean()}
                      className="text-xs h-7"
                    >
                      🔄 Conectar con Cuenta Limpia
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>Google Drive conectado correctamente. Puedes seleccionar una carpeta para importar fotos.</span>
              <Button variant="outline" size="sm" onClick={resetConnection}>
                Cambiar Cuenta
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {!isConnected ? (
          <div className="space-y-3">
            <Button onClick={connectDrive} className="w-full">
              <Cloud className="mr-2 h-4 w-4" />
              Conectar Google Drive
            </Button>
            
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-xs">
              <p className="font-medium text-red-800 mb-2">⚠️ Error: Acceso Bloqueado por Google</p>
              <div className="space-y-1 text-red-700">
                <p><strong>El dominio de Replit no está autorizado en Google Cloud Console.</strong></p>
                <p>Para solucionarlo:</p>
                <p>1. Ve a <strong>console.cloud.google.com</strong></p>
                <p>2. APIs y servicios → Credenciales</p>
                <p>3. Edita el Cliente OAuth 2.0</p>
                <p>4. En "URIs de redirección autorizados" agrega:</p>
                <div className="bg-gray-100 p-2 rounded font-mono text-xs">
                  https://714af085-ebae-4b14-afab-db74eb2764b1-00-2hrl0mpybem4j.worf.replit.dev/auth/google/callback
                </div>
                <p>5. Guarda los cambios y prueba nuevamente</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Selector de carpetas */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Seleccionar carpeta de fotos:
              </label>
              <Select value={selectedFolder} onValueChange={setSelectedFolder}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una carpeta..." />
                </SelectTrigger>
                <SelectContent>
                  {foldersLoading ? (
                    <SelectItem value="loading" disabled>
                      Cargando carpetas...
                    </SelectItem>
                  ) : folders.length === 0 ? (
                    <SelectItem value="empty" disabled>
                      No se encontraron carpetas
                    </SelectItem>
                  ) : (
                    folders.map((folder: DriveFile) => (
                      <SelectItem key={folder.id} value={folder.id}>
                        <div className="flex items-center space-x-2">
                          <FolderOpen className="h-4 w-4" />
                          <span>{folder.name}</span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Vista previa de fotos */}
            {selectedFolder && (
              <div className="border rounded-lg p-4">
                <h4 className="font-medium mb-3 flex items-center space-x-2">
                  <Upload className="h-4 w-4" />
                  <span>Vista previa de la carpeta</span>
                </h4>
                
                {photosLoading ? (
                  <p className="text-gray-500">Cargando fotos...</p>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <Badge variant="outline">
                        {photos.length} fotos encontradas
                      </Badge>
                      <span className="text-sm text-gray-500">
                        Tamaño total: {photos.reduce((total: number, photo: DriveFile) => 
                          total + (photo.size ? parseInt(photo.size) / (1024 * 1024) : 0), 0
                        ).toFixed(1)} MB
                      </span>
                    </div>

                    {photos.length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-40 overflow-y-auto">
                        {photos.slice(0, 12).map((photo: DriveFile) => (
                          <div key={photo.id} className="text-xs border rounded p-2">
                            <p className="font-medium truncate">{photo.name}</p>
                            <p className="text-gray-500">{formatFileSize(photo.size)}</p>
                          </div>
                        ))}
                        {photos.length > 12 && (
                          <div className="text-xs border rounded p-2 flex items-center justify-center text-gray-500">
                            +{photos.length - 12} más
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Progreso de importación */}
            {importProgress.isImporting && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Importando fotos...</span>
                  <span>{importProgress.progress}%</span>
                </div>
                <Progress value={importProgress.progress} className="h-2" />
                <p className="text-xs text-gray-500">{importProgress.status}</p>
              </div>
            )}

            {/* Botón de importación */}
            <Button 
              onClick={handleImport}
              disabled={!selectedFolder || importProgress.isImporting || photos.length === 0}
              className="w-full"
            >
              <Download className="mr-2 h-4 w-4" />
              {importProgress.isImporting 
                ? "Importando fotos..." 
                : `Importar ${photos.length} fotos`
              }
            </Button>
          </div>
        )}

        {/* Información adicional */}
        <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded">
          <p><strong>Nota:</strong> Las fotos se importarán directamente desde Google Drive y se procesarán automáticamente para detectar dorsales y rostros.</p>
          <p className="mt-1">Formatos compatibles: JPEG, PNG, TIFF, BMP</p>
        </div>
      </CardContent>
    </Card>
  );
}