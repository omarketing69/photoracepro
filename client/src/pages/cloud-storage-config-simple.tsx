import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiRequest } from "@/lib/queryClient";
import { Cloud, HardDrive, Upload, AlertTriangle, CheckCircle } from "lucide-react";

export default function CloudStorageConfigSimple() {
  const queryClient = useQueryClient();

  // Test de conectividad con Google Cloud Storage
  const { data: cloudTest, isLoading: cloudTestLoading, error: cloudTestError } = useQuery({
    queryKey: ["/api/cloud/test"],
    refetchInterval: 30000, // Refetch cada 30 segundos
    retry: 2,
  });

  // Migración demo
  const migrateMutation = useMutation({
    mutationFn: () => apiRequest("/api/demo/migrate-to-cloud", {
      method: "POST",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cloud/test"] });
    },
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Google Cloud Storage</h1>
          <p className="text-muted-foreground">
            Configuración de almacenamiento escalable en la nube
          </p>
        </div>
        <Badge variant="secondary" className="flex items-center gap-2">
          <Cloud className="h-4 w-4" />
          Almacenamiento en Nube
        </Badge>
      </div>

      {/* Estado de Conectividad */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Estado de Conexión
          </CardTitle>
          <CardDescription>
            Estado actual de la conexión con Google Cloud Storage
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cloudTestLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Verificando conexión con Google Cloud...</p>
            </div>
          ) : cloudTest?.connected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-6 w-6 text-green-600" />
                <div>
                  <p className="font-semibold text-green-800">Conectado exitosamente</p>
                  <p className="text-sm text-gray-600">Google Cloud Storage está funcionando correctamente</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-green-50 rounded-lg">
                <div>
                  <span className="font-medium text-sm text-gray-700">Proyecto:</span>
                  <p className="text-green-800 font-mono text-sm">{cloudTest.projectId}</p>
                </div>
                <div>
                  <span className="font-medium text-sm text-gray-700">Bucket:</span>
                  <p className="text-green-800 font-mono text-sm">{cloudTest.bucketName}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-6 w-6 text-red-600" />
                <div>
                  <p className="font-semibold text-red-800">Error de Conexión</p>
                  <p className="text-sm text-gray-600">No se pudo establecer conexión con Google Cloud Storage</p>
                </div>
              </div>
              
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p><strong>Error:</strong> {cloudTest?.error || cloudTestError?.message || 'Credenciales no configuradas'}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      <p><strong>Proyecto configurado:</strong> {cloudTest?.projectId || 'No'}</p>
                      <p><strong>Bucket configurado:</strong> {cloudTest?.bucketName || 'No'}</p>
                      <p><strong>Credenciales:</strong> {cloudTest?.credentialsConfigured ? 'Sí' : 'No'}</p>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuración Actual */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Configuración Actual
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="font-medium text-sm">Proyecto de Google Cloud:</p>
              <p className="text-sm text-gray-600 font-mono bg-gray-100 p-2 rounded">
                REDACTED_GCS_PROJECT
              </p>
            </div>
            <div className="space-y-2">
              <p className="font-medium text-sm">Bucket de almacenamiento:</p>
              <p className="text-sm text-gray-600 font-mono bg-gray-100 p-2 rounded">
                REDACTED_GCS_BUCKET
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Acciones */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Acciones Disponibles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">Probar Conexión</p>
                <p className="text-sm text-gray-600">Verificar conectividad con Google Cloud Storage</p>
              </div>
              <Button 
                variant="outline" 
                onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/cloud/test"] })}
                disabled={cloudTestLoading}
              >
                {cloudTestLoading ? "Probando..." : "Probar Ahora"}
              </Button>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">Migrar Fotos Demo</p>
                <p className="text-sm text-gray-600">Probar subida de fotos a la nube</p>
              </div>
              <Button 
                onClick={() => migrateMutation.mutate()}
                disabled={migrateMutation.isPending || !cloudTest?.connected}
              >
                {migrateMutation.isPending ? "Migrando..." : "Migrar Demo"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Información de Estado */}
      {migrateMutation.data && (
        <Card>
          <CardHeader>
            <CardTitle>Resultado de Migración</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                {migrateMutation.data.message}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}
    </div>
  );
}