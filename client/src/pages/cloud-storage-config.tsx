import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiRequest } from "@/lib/queryClient";
import { Cloud, HardDrive, Upload, Download, Trash2, Archive, DollarSign, BarChart3 } from "lucide-react";

export default function CloudStorageConfig() {
  const [selectedEventId, setSelectedEventId] = useState<number>(1);
  const queryClient = useQueryClient();

  // Obtener eventos disponibles
  const { data: events } = useQuery({
    queryKey: ["/api/events"],
  });

  // Test de conectividad con Google Cloud Storage
  const { data: cloudTest, isLoading: cloudTestLoading } = useQuery({
    queryKey: ["/api/cloud/test"],
    refetchInterval: 30000, // Refetch cada 30 segundos
  });

  // Obtener estadísticas de almacenamiento
  const { data: storageStats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/events", selectedEventId, "storage-stats"],
    enabled: !!selectedEventId,
  });

  // Migración a la nube
  const migrateMutation = useMutation({
    mutationFn: () => apiRequest(`/api/events/${selectedEventId}/migrate-to-cloud`, {
      method: "POST",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", selectedEventId, "storage-stats"] });
    },
  });

  // Upload a la nube
  const cloudUploadMutation = useMutation({
    mutationFn: (formData: FormData) => apiRequest(`/api/events/${selectedEventId}/upload-cloud`, {
      method: "POST",
      body: formData,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", selectedEventId, "storage-stats"] });
    },
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    Array.from(files).forEach(file => {
      formData.append('photos', file);
    });

    cloudUploadMutation.mutate(formData);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Configuración de Almacenamiento en la Nube</h1>
          <p className="text-muted-foreground">
            Gestiona el almacenamiento escalable de fotos en Google Cloud Storage
          </p>
        </div>
        <Badge variant="secondary" className="flex items-center gap-2">
          <Cloud className="h-4 w-4" />
          Google Cloud Storage
        </Badge>
      </div>

      {/* Estado de Conectividad */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Estado de Google Cloud Storage
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cloudTestLoading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Verificando conexión...</p>
            </div>
          ) : cloudTest?.connected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  ✓ Conectado
                </Badge>
                <span className="text-sm text-gray-600">
                  Google Cloud Storage funcionando correctamente
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Proyecto:</span> {cloudTest.projectId}
                </div>
                <div>
                  <span className="font-medium">Bucket:</span> {cloudTest.bucketName}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                  ✗ Error de Conexión
                </Badge>
                <span className="text-sm text-gray-600">
                  No se pudo conectar con Google Cloud Storage
                </span>
              </div>
              <Alert>
                <AlertDescription>
                  <strong>Error:</strong> {cloudTest?.error || 'Credenciales no configuradas'}
                  <br />
                  <strong>Proyecto:</strong> {cloudTest?.projectId || 'No configurado'}
                  <br />
                  <strong>Bucket:</strong> {cloudTest?.bucketName || 'No configurado'}
                </AlertDescription>
              </Alert>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selector de Evento */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Seleccionar Evento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(parseInt(e.target.value))}
            className="w-full p-2 border rounded-md"
          >
            {events?.map((event: any) => (
              <option key={event.id} value={event.id}>
                {event.name} - {new Date(event.date).toLocaleDateString()}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {/* Estadísticas de Almacenamiento */}
      {storageStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Fotos Originales</CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{storageStats.cloud.originalPhotos}</div>
              <p className="text-xs text-muted-foreground">
                Base de datos: {storageStats.database.totalPhotos}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Almacenamiento Total</CardTitle>
              <Cloud className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatBytes(storageStats.cloud.totalSizeBytes)}</div>
              <p className="text-xs text-muted-foreground">
                {storageStats.costs.storageGB} GB en la nube
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Costo Mensual</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${storageStats.costs.estimatedMonthlyCostUSD}</div>
              <p className="text-xs text-muted-foreground">USD por mes estimado</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Participantes</CardTitle>
              <Archive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{storageStats.cloud.participants}</div>
              <p className="text-xs text-muted-foreground">Con fotos organizadas</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Ventajas del Almacenamiento en la Nube */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            ¿Por qué Almacenamiento en la Nube?
          </CardTitle>
          <CardDescription>
            Beneficios del almacenamiento escalable vs almacenamiento local
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-green-600 mb-2">✅ Almacenamiento en la Nube</h4>
              <ul className="space-y-1 text-sm">
                <li>• Escalabilidad ilimitada para miles de fotos</li>
                <li>• Respaldo automático y alta disponibilidad</li>
                <li>• Costo optimizado: paga solo por lo que usas</li>
                <li>• Acceso global rápido con CDN</li>
                <li>• No afecta el rendimiento del deployment</li>
                <li>• URLs firmadas para seguridad</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-red-600 mb-2">❌ Almacenamiento Local</h4>
              <ul className="space-y-1 text-sm">
                <li>• Límites de espacio en Replit</li>
                <li>• Deployment lento con muchas fotos</li>
                <li>• Riesgo de pérdida de datos</li>
                <li>• Costo fijo alto independiente del uso</li>
                <li>• Problemas de rendimiento</li>
                <li>• No escalable para eventos grandes</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recomendaciones Automáticas */}
      {storageStats?.recommendations && (
        <Card>
          <CardHeader>
            <CardTitle>Recomendaciones del Sistema</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {storageStats.recommendations.shouldMigrate && (
              <Alert>
                <Upload className="h-4 w-4" />
                <AlertDescription>
                  <strong>Recomendado:</strong> Migrar a almacenamiento en la nube. 
                  Tienes {storageStats.database.totalPhotos} fotos que se beneficiarían del almacenamiento escalable.
                </AlertDescription>
              </Alert>
            )}
            
            {storageStats.recommendations.shouldOptimize && (
              <Alert className="border-orange-200 bg-orange-50">
                <BarChart3 className="h-4 w-4" />
                <AlertDescription>
                  <strong>Optimización:</strong> Considera optimizar imágenes. 
                  Tienes {storageStats.costs.storageGB} GB que podrían comprimirse.
                </AlertDescription>
              </Alert>
            )}
            
            {storageStats.recommendations.shouldArchive && (
              <Alert className="border-blue-200 bg-blue-50">
                <Archive className="h-4 w-4" />
                <AlertDescription>
                  <strong>Archivo:</strong> Considera archivar eventos antiguos. 
                  El almacenamiento está creciendo significativamente.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Acciones de Migración */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Migrar Fotos Existentes
            </CardTitle>
            <CardDescription>
              Mover fotos del almacenamiento local a Google Cloud Storage
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => migrateMutation.mutate()}
              disabled={migrateMutation.isPending || statsLoading}
              className="w-full"
            >
              {migrateMutation.isPending ? "Migrando..." : "Migrar a la Nube"}
            </Button>
            {migrateMutation.data && (
              <div className="mt-3 p-3 bg-green-50 rounded-md text-sm">
                ✅ {migrateMutation.data.message}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Subir Fotos Nuevas
            </CardTitle>
            <CardDescription>
              Subir directamente a Google Cloud Storage
            </CardDescription>
          </CardHeader>
          <CardContent>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileUpload}
              className="w-full p-2 border rounded-md"
              disabled={cloudUploadMutation.isPending}
            />
            {cloudUploadMutation.isPending && (
              <div className="mt-3">
                <Progress value={50} className="w-full" />
                <p className="text-sm text-muted-foreground mt-1">Subiendo fotos...</p>
              </div>
            )}
            {cloudUploadMutation.data && (
              <div className="mt-3 p-3 bg-green-50 rounded-md text-sm">
                ✅ {cloudUploadMutation.data.message}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Arquitectura de Cloud Storage */}
      <Card>
        <CardHeader>
          <CardTitle>Arquitectura de Almacenamiento</CardTitle>
          <CardDescription>
            Organización automática de fotos en Google Cloud Storage
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-50 p-4 rounded-md font-mono text-sm">
            <div>racephoto-fotos/</div>
            <div>├── eventos/</div>
            <div>│   ├── evento_{selectedEventId}/</div>
            <div>│   │   ├── originales/          # Fotos de alta resolución</div>
            <div>│   │   ├── web/                 # Versiones optimizadas</div>
            <div>│   │   ├── miniaturas/          # Thumbnails 200x200</div>
            <div>│   │   └── participantes/       # Organizado por dorsal</div>
            <div>│   │       ├── dorsal_1234/</div>
            <div>│   │       └── dorsal_5678/</div>
            <div>└── temp/                        # Archivos temporales</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}