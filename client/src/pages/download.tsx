import { useQuery } from '@tanstack/react-query';
import { useLocation, useRoute } from 'wouter';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Download as DownloadIcon, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  Image as ImageIcon,
  Mail,
  Home,
  Eye,
  X
} from 'lucide-react';

interface DownloadPhoto {
  id: number;
  filename: string;
  downloadUrl: string;
  thumbnailUrl?: string;
  previewUrl?: string;
}

interface DownloadInfo {
  photos: DownloadPhoto[];
  remainingDownloads: number;
  expiresAt: string;
}

export default function Download() {
  const [location, setLocation] = useLocation();
  const [match, params] = useRoute('/download');
  const [downloadProgress, setDownloadProgress] = useState<{ [key: number]: number }>({});
  const [completedDownloads, setCompletedDownloads] = useState<number[]>([]);
  const [previewPhoto, setPreviewPhoto] = useState<DownloadPhoto | null>(null);
  
  // Get token from URL query parameters
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  const { data: downloadInfo, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/sales/download', token],
    queryFn: async () => {
      if (!token) throw new Error('Token de descarga requerido');
      
      const response = await fetch(`/api/sales/download/${token}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al obtener información de descarga');
      }
      return response.json() as Promise<DownloadInfo>;
    },
    enabled: !!token
  });

  // Redirect if no token
  useEffect(() => {
    if (!token) {
      setLocation('/search?error=no_download_token');
    }
  }, [token, setLocation]);

  const downloadSinglePhoto = async (photo: DownloadPhoto) => {
    try {
      setDownloadProgress(prev => ({ ...prev, [photo.id]: 0 }));
      
      const response = await fetch(photo.downloadUrl);
      if (!response.ok) throw new Error('Error al descargar foto');
      
      const contentLength = response.headers.get('Content-Length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      
      if (!total) {
        // If no content length, download directly
        const blob = await response.blob();
        downloadBlob(blob, photo.filename);
        setCompletedDownloads(prev => [...prev, photo.id]);
        setDownloadProgress(prev => ({ ...prev, [photo.id]: 100 }));
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No se pudo leer la respuesta');

      const chunks: Uint8Array[] = [];
      let loaded = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        chunks.push(value);
        loaded += value.length;
        
        const progress = (loaded / total) * 100;
        setDownloadProgress(prev => ({ ...prev, [photo.id]: progress }));
      }

      const blob = new Blob(chunks);
      downloadBlob(blob, photo.filename);
      setCompletedDownloads(prev => [...prev, photo.id]);
      
    } catch (error) {
      console.error('Error downloading photo:', error);
      alert('Error al descargar la foto. Por favor intenta de nuevo.');
      setDownloadProgress(prev => ({ ...prev, [photo.id]: 0 }));
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const downloadAllPhotos = async () => {
    if (!downloadInfo) return;
    
    for (const photo of downloadInfo.photos) {
      if (!completedDownloads.includes(photo.id)) {
        await downloadSinglePhoto(photo);
        // Small delay between downloads to avoid overwhelming the browser
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // Refresh download info to get updated remaining downloads
    setTimeout(() => refetch(), 1000);
  };

  const formatExpirationDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isExpired = () => {
    if (!downloadInfo?.expiresAt) return false;
    return new Date() > new Date(downloadInfo.expiresAt);
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Token Inválido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              No se encontró un token de descarga válido.
            </p>
            <Button onClick={() => setLocation('/search')} className="w-full">
              <Home className="mr-2 h-4 w-4" />
              Volver al Inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p>Verificando acceso de descarga...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Error de Acceso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              {error instanceof Error ? error.message : 'No se pudo acceder a las descargas'}
            </p>
            <Button onClick={() => setLocation('/search')} className="w-full">
              <Home className="mr-2 h-4 w-4" />
              Volver al Inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!downloadInfo) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-green-100 p-3 rounded-full">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            ¡Pago Exitoso!
          </h1>
          <p className="text-lg text-gray-600">
            Tus fotos están listas para descargar
          </p>
        </div>

        {/* Download Status */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              {downloadInfo.photos.length} Foto{downloadInfo.photos.length !== 1 ? 's' : ''} Disponible{downloadInfo.photos.length !== 1 ? 's' : ''}
            </CardTitle>
            <CardDescription>
              Fotos en alta resolución, sin marca de agua
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <Badge variant={isExpired() ? "destructive" : "secondary"}>
                  <Clock className="mr-1 h-3 w-3" />
                  {isExpired() ? 'Expirado' : `Válido hasta ${formatExpirationDate(downloadInfo.expiresAt)}`}
                </Badge>
                <Badge variant="outline">
                  {downloadInfo.remainingDownloads} descarga{downloadInfo.remainingDownloads !== 1 ? 's' : ''} restante{downloadInfo.remainingDownloads !== 1 ? 's' : ''}
                </Badge>
              </div>
            </div>

            {isExpired() ? (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  El tiempo de descarga ha expirado. Por favor contacta al organizador del evento para asistencia.
                </AlertDescription>
              </Alert>
            ) : downloadInfo.remainingDownloads <= 0 ? (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Has alcanzado el límite de descargas para esta compra.
                </AlertDescription>
              </Alert>
            ) : (
              <Button 
                onClick={downloadAllPhotos} 
                className="w-full bg-green-600 hover:bg-green-700"
                disabled={completedDownloads.length === downloadInfo.photos.length}
              >
                <DownloadIcon className="mr-2 h-4 w-4" />
                {completedDownloads.length === downloadInfo.photos.length 
                  ? 'Todas las fotos descargadas' 
                  : `Descargar todas las fotos (${downloadInfo.photos.length})`
                }
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Individual Photos */}
        <Card>
          <CardHeader>
            <CardTitle>Fotos Individuales</CardTitle>
            <CardDescription>
              Previsualiza y descarga cada foto por separado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {downloadInfo.photos.map((photo) => {
                const progress = downloadProgress[photo.id] || 0;
                const isCompleted = completedDownloads.includes(photo.id);
                const isDownloading = progress > 0 && progress < 100 && !isCompleted;
                
                return (
                  <div key={photo.id} className="border rounded-lg overflow-hidden">
                    {/* Photo Thumbnail */}
                    <div className="aspect-w-3 aspect-h-4 bg-gray-100 relative">
                      <img
                        src={`/api/thumbnails/${photo.filename}`}
                        alt="Foto comprada"
                        className="w-full h-48 object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                      <div className="hidden flex items-center justify-center h-48 bg-gray-100">
                        <ImageIcon className="h-12 w-12 text-gray-400" />
                      </div>
                      
                      {/* Preview Button Overlay */}
                      <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center opacity-0 hover:opacity-100">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setPreviewPhoto(photo)}
                          className="bg-white hover:bg-gray-100 text-gray-900"
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Vista Previa
                        </Button>
                      </div>
                    </div>
                    
                    {/* Photo Info */}
                    <div className="p-4">
                      <p className="font-medium text-gray-900 mb-2 truncate">{photo.filename}</p>
                      
                      {isDownloading && (
                        <div className="mb-3">
                          <Progress value={progress} className="h-2" />
                          <p className="text-xs text-gray-500 mt-1">{Math.round(progress)}% completado</p>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2">
                        {isCompleted ? (
                          <Badge variant="secondary" className="flex-1 justify-center">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Descargado
                          </Badge>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadSinglePhoto(photo)}
                            disabled={isDownloading || isExpired() || downloadInfo.remainingDownloads <= 0}
                            className="flex-1"
                          >
                            <DownloadIcon className="mr-2 h-3 w-3" />
                            Descargar
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Photo Preview Dialog */}
        {previewPhoto && (
          <Dialog open={!!previewPhoto} onOpenChange={() => setPreviewPhoto(null)}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
              <DialogHeader>
                <DialogTitle>Vista Previa</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {/* Full Size Preview */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <img
                    src={`/api/thumbnails/${previewPhoto.filename}`}
                    alt="Vista previa de foto"
                    className="w-full h-auto max-h-[60vh] object-contain mx-auto"
                    onError={(e) => {
                      console.log('Error loading preview image:', previewPhoto.filename);
                      console.log('Trying backup URL...');
                      // Try backup URL
                      e.currentTarget.src = `/api/photos/${previewPhoto.id}/original`;
                      e.currentTarget.onerror = () => {
                        console.log('Backup URL also failed');
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                      };
                    }}
                  />
                  <div className="hidden text-center py-12">
                    <ImageIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No se pudo cargar la vista previa</p>
                  </div>
                </div>
                
                {/* Download Button */}
                <div className="flex justify-center">
                  <Button
                    onClick={() => {
                      downloadSinglePhoto(previewPhoto);
                      setPreviewPhoto(null);
                    }}
                    disabled={completedDownloads.includes(previewPhoto.id) || isExpired() || downloadInfo.remainingDownloads <= 0}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <DownloadIcon className="mr-2 h-4 w-4" />
                    {completedDownloads.includes(previewPhoto.id) ? 'Ya descargado' : 'Descargar esta foto'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Help Section */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              ¿Necesitas ayuda?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Problemas con la descarga</h4>
                <p className="text-sm text-gray-600">
                  Si tienes problemas descargando tus fotos, verifica que tienes suficiente espacio en tu dispositivo 
                  y que tu navegador permite descargas múltiples.
                </p>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Conserva este enlace</h4>
                <p className="text-sm text-gray-600">
                  Puedes regresar a esta página usando el mismo enlace hasta que expire. 
                  Te recomendamos guardar esta página en tus favoritos.
                </p>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Soporte técnico</h4>
                <p className="text-sm text-gray-600">
                  Para cualquier problema técnico, contacta al organizador del evento con tu número de referencia.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Back to Home */}
        <div className="text-center mt-8">
          <Button variant="outline" onClick={() => setLocation('/search')}>
            <Home className="mr-2 h-4 w-4" />
            Buscar más fotos
          </Button>
        </div>
      </div>
    </div>
  );
}