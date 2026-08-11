import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import NavigationHeader from '@/components/navigation-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Settings as SettingsIcon, 
  DollarSign, 
  Save, 
  CheckCircle, 
  AlertTriangle,
  CreditCard,
  ExternalLink,
  Cloud,
  HardDrive,
  Lock,
  Shield,
  RotateCcw,
  Upload
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface Settings {
  photoPrice: number;
  currency: string;
  currencySymbol: string;
  maxDownloads: number;
  downloadValidityDays: number;
}

export default function SettingsPage({ onLogout }: { onLogout: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [settings, setSettings] = useState<Settings>({
    photoPrice: 15000,
    currency: 'COP',
    currencySymbol: '$',
    maxDownloads: 3,
    downloadValidityDays: 30
  });

  // Estados para funcionalidades de administración
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isResettingSales, setIsResettingSales] = useState(false);

  const [passwordError, setPasswordError] = useState("");

  // Fetch current settings
  const { data: currentSettings, isLoading } = useQuery({
    queryKey: ['/api/settings'],
    queryFn: async () => {
      const response = await fetch('/api/settings');
      if (!response.ok) throw new Error('Error cargando configuración');
      return response.json();
    }
  });

  // Test de conectividad con Google Cloud Storage
  const { data: cloudTest, isLoading: cloudTestLoading } = useQuery({
    queryKey: ["/api/cloud/test"],
    refetchInterval: 30000, // Refetch cada 30 segundos
    retry: 1,
  });

  // Update local state when settings are loaded
  useEffect(() => {
    if (currentSettings) {
      setSettings(currentSettings);
    }
  }, [currentSettings]);

  // Save settings mutation
  const saveSettings = useMutation({
    mutationFn: async (newSettings: Settings) => {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
      if (!response.ok) throw new Error('Error saving settings');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Configuración guardada",
        description: "Los cambios se han aplicado correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo guardar la configuración",
        variant: "destructive"
      });
    }
  });

  const handleSave = () => {
    saveSettings.mutate(settings);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(price);
  };

  // Función para cambiar contraseña
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    
    if (newPassword !== confirmPassword) {
      setPasswordError("Las contraseñas no coinciden");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setIsChangingPassword(true);

    try {
      const response = await fetch("/api/admin/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Error al cambiar la contraseña");
      }

      toast({
        title: "Contraseña actualizada",
        description: "Tu contraseña ha sido cambiada exitosamente.",
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Error al cambiar la contraseña");
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Función para reiniciar ventas
  const handleResetSales = async () => {
    setIsResettingSales(true);

    try {
      const response = await fetch("/api/admin/reset-sales", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Error al reiniciar las ventas");
      }

      toast({
        title: "Ventas reiniciadas",
        description: "El contador de ventas del evento se ha reiniciado exitosamente.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al reiniciar las ventas",
        variant: "destructive",
      });
    } finally {
      setIsResettingSales(false);
    }
  };

  // Función para migrar fotos a Google Cloud Storage


  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <NavigationHeader onLogout={onLogout} />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-gray-600">Cargando configuración...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationHeader onLogout={onLogout} />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center space-x-3 mb-2">
              <div className="bg-primary/10 p-2 rounded-lg">
                <SettingsIcon className="text-primary h-6 w-6" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900">Configuración del Sistema</h1>
            </div>
            <p className="text-gray-600">Configuración general del sistema, usuarios y almacenamiento</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  <Label htmlFor="photoPrice">Precio por Foto</Label>
                  <div className="flex items-center space-x-2 mt-1">
                    <Input
                      id="photoPrice"
                      type="number"
                      value={settings.photoPrice}
                      onChange={(e) => setSettings({
                        ...settings,
                        photoPrice: parseInt(e.target.value) || 0
                      })}
                      className="text-lg"
                      min="1000"
                      step="1000"
                    />
                    <Badge variant="secondary" className="text-sm">
                      {settings.currency}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Precio actual: {formatPrice(settings.photoPrice)}
                  </p>
                </div>

                <Separator />

                <div>
                  <Label htmlFor="currency">Moneda</Label>
                  <Input
                    id="currency"
                    value={settings.currency}
                    onChange={(e) => setSettings({
                      ...settings,
                      currency: e.target.value.toUpperCase()
                    })}
                    className="mt-1"
                    placeholder="COP"
                    maxLength={3}
                  />
                  <p className="text-sm text-gray-600 mt-1">
                    Código de moneda ISO (ej: COP, USD, EUR)
                  </p>
                </div>

                <div>
                  <Label htmlFor="currencySymbol">Símbolo de Moneda</Label>
                  <Input
                    id="currencySymbol"
                    value={settings.currencySymbol}
                    onChange={(e) => setSettings({
                      ...settings,
                      currencySymbol: e.target.value
                    })}
                    className="mt-1"
                    placeholder="$"
                    maxLength={2}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Download Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>Configuración de Descargas</CardTitle>
                <CardDescription>
                  Establece límites y validez de las descargas
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label htmlFor="maxDownloads">Máximo de Descargas por Compra</Label>
                  <Input
                    id="maxDownloads"
                    type="number"
                    value={settings.maxDownloads}
                    onChange={(e) => setSettings({
                      ...settings,
                      maxDownloads: parseInt(e.target.value) || 1
                    })}
                    className="mt-1"
                    min="1"
                    max="10"
                  />
                  <p className="text-sm text-gray-600 mt-1">
                    Número de veces que se pueden descargar las fotos compradas
                  </p>
                </div>

                <div>
                  <Label htmlFor="downloadValidityDays">Validez de Descarga (días)</Label>
                  <Input
                    id="downloadValidityDays"
                    type="number"
                    value={settings.downloadValidityDays}
                    onChange={(e) => setSettings({
                      ...settings,
                      downloadValidityDays: parseInt(e.target.value) || 1
                    })}
                    className="mt-1"
                    min="1"
                    max="365"
                  />
                  <p className="text-sm text-gray-600 mt-1">
                    Días que las fotos estarán disponibles para descarga después de la compra
                  </p>
                </div>

                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Los cambios en la configuración de descargas solo aplicarán a nuevas compras.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>

          {/* Preview Card */}
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Vista Previa</CardTitle>
              <CardDescription>
                Así se verán los precios en la tienda
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 p-6 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">Foto de carrera</h3>
                    <p className="text-sm text-gray-600">Alta resolución, descarga inmediata</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary">
                      {formatPrice(settings.photoPrice)}
                    </p>
                    <p className="text-sm text-gray-600">por foto</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Configuration Section */}
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CreditCard className="h-5 w-5" />
                <span>Configuración de Pagos</span>
              </CardTitle>
              <CardDescription>
                Configura el sistema de pagos Wompi para procesar transacciones
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h3 className="font-medium">Configuración de Wompi</h3>
                  <p className="text-sm text-gray-600">
                    Gestiona credenciales, webhooks y modo de producción
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => window.location.href = '/wompi-config'}
                  className="flex items-center space-x-2"
                >
                  <span>Configurar Pagos</span>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
              
              <Alert className="mt-4">
                <CreditCard className="h-4 w-4" />
                <AlertDescription>
                  <strong>Importante:</strong> Configura las credenciales de producción de Wompi 
                  para procesar pagos reales. Sin credenciales de producción, 
                  el sistema funcionará en modo de pruebas.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Cloud Storage Configuration Section */}
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Cloud className="h-5 w-5" />
                <span>Almacenamiento en la Nube</span>
              </CardTitle>
              <CardDescription>
                Estado y configuración de Google Cloud Storage para fotos
              </CardDescription>
            </CardHeader>
            <CardContent>
              {cloudTestLoading ? (
                <div className="flex items-center justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3"></div>
                  <span className="text-gray-600">Verificando conexión...</span>
                </div>
              ) : cloudTest?.connected ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg bg-green-50">
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="h-6 w-6 text-green-600" />
                      <div>
                        <h3 className="font-medium text-green-800">Google Cloud Storage Conectado</h3>
                        <p className="text-sm text-green-600">
                          Almacenamiento escalable funcionando correctamente
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-green-700 border-green-300">
                      Operativo
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Proyecto:</p>
                      <p className="text-sm text-gray-600 font-mono">{cloudTest.projectId}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Bucket:</p>
                      <p className="text-sm text-gray-600 font-mono">{cloudTest.bucketName}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg bg-red-50">
                    <div className="flex items-center space-x-3">
                      <AlertTriangle className="h-6 w-6 text-red-600" />
                      <div>
                        <h3 className="font-medium text-red-800">Error de Conexión</h3>
                        <p className="text-sm text-red-600">
                          No se pudo conectar con Google Cloud Storage
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-red-700 border-red-300">
                      Desconectado
                    </Badge>
                  </div>
                  
                  <Alert variant="destructive">
                    <HardDrive className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Error:</strong> {cloudTest?.error || 'Credenciales no configuradas'}
                      <br />
                      <strong>Proyecto configurado:</strong> {cloudTest?.projectId || 'No'}
                      <br />
                      <strong>Bucket configurado:</strong> {cloudTest?.bucketName || 'No'}
                      {cloudTest?.credentialsType === 'api-key-invalid' && (
                        <>
                          <br />
                          <strong>Problema:</strong> Se detectó una API key en lugar de credenciales de service account. 
                          Google Cloud Storage requiere un archivo JSON de service account, no una API key.
                        </>
                      )}
                    </AlertDescription>
                  </Alert>
                </div>
              )}
              
              <Separator className="my-4" />
              
              <div className="space-y-3">
                <h4 className="font-medium">Información del Sistema</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Proyecto configurado:</span>
                    <p className="text-gray-600 font-mono">REDACTED_GCS_PROJECT</p>
                  </div>
                  <div>
                    <span className="font-medium">Bucket configurado:</span>
                    <p className="text-gray-600 font-mono">REDACTED_GCS_BUCKET</p>
                  </div>
                </div>
                
                <Alert>
                  <Cloud className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Almacenamiento híbrido:</strong> El sistema usa almacenamiento local 
                    con respaldo automático a Google Cloud Storage para escalabilidad ilimitada. 
                    Costo aproximado: $0.02 USD por GB/mes.
                  </AlertDescription>
                </Alert>
                

              </div>
            </CardContent>
          </Card>

          {/* Admin Security Section */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Seguridad de Administrador
              </CardTitle>
              <CardDescription>
                Configuraciones de seguridad y administración del sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Cambio de Contraseña */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-4">Cambiar Contraseña</h3>
                  <form onSubmit={handlePasswordChange} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="currentPassword">Contraseña actual</Label>
                      <Input
                        id="currentPassword"
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Ingresa tu contraseña actual"
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">Nueva contraseña</Label>
                      <Input
                        id="newPassword"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Ingresa la nueva contraseña"
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirmar nueva contraseña</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirma la nueva contraseña"
                        required
                      />
                    </div>

                    {passwordError && (
                      <Alert variant="destructive">
                        <AlertDescription>{passwordError}</AlertDescription>
                      </Alert>
                    )}

                    <Button 
                      type="submit" 
                      disabled={isChangingPassword}
                      className="w-full"
                    >
                      {isChangingPassword ? "Cambiando..." : "Cambiar Contraseña"}
                    </Button>
                  </form>
                </div>

                {/* Configuración de Producción */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-4">Configuración de Producción</h3>
                  <div className="space-y-4">
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <h4 className="font-semibold text-orange-800 mb-2">
                        Reiniciar Contador de Ventas
                      </h4>
                      <p className="text-sm text-orange-700 mb-4">
                        Esto reiniciará el contador de ventas del evento actual pero conservará todas las fotos, 
                        estadísticas y datos históricos.
                      </p>
                      <Button 
                        onClick={handleResetSales}
                        disabled={isResettingSales}
                        variant="outline"
                        className="border-orange-300 text-orange-700 hover:bg-orange-100"
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        {isResettingSales ? "Reiniciando..." : "Reiniciar Ventas del Evento"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="mt-8 flex justify-end lg:col-span-2">
            <Button 
              onClick={handleSave}
              disabled={saveSettings.isPending}
              className="bg-primary text-white hover:bg-primary/90"
            >
              {saveSettings.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Guardar Configuración
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}