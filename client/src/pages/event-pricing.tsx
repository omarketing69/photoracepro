import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import NavigationHeader from '@/components/navigation-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { DollarSign, TrendingDown, Users, Target } from 'lucide-react';

interface EventPricingData {
  id?: number;
  eventId: number;
  basePrice: number;
  currency: string;
  tier2Photos: number;
  tier2Price: number;
  tier3Photos: number;
  tier3Price: number;
  tier4Photos: number;
  tier4Price: number;
  volumeDiscountEnabled: boolean;
  downloadValidityDays: number;
}

export default function EventPricingPage({ onLogout }: { onLogout: () => void }) {
  const [selectedEventId, setSelectedEventId] = useState<string>('1');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get events list
  const { data: events } = useQuery({
    queryKey: ['/api/events'],
  });

  // Get pricing for selected event
  const { data: pricing, isLoading } = useQuery({
    queryKey: ['/api/events', selectedEventId, 'pricing'],
    queryFn: async () => {
      const response = await fetch(`/api/events/${selectedEventId}/pricing`);
      if (!response.ok) {
        throw new Error('Error cargando configuración de precios');
      }
      return response.json();
    },
    enabled: !!selectedEventId,
  });

  // Save pricing mutation
  const savePricingMutation = useMutation({
    mutationFn: async (data: Partial<EventPricingData>) => {
      return apiRequest('POST', `/api/events/${selectedEventId}/pricing`, data);
    },
    onSuccess: () => {
      toast({
        title: "Configuración guardada",
        description: "Los precios del evento se han actualizado correctamente",
      });
      queryClient.invalidateQueries({ 
        queryKey: ['/api/events', selectedEventId, 'pricing'] 
      });
    },
    onError: (error) => {
      console.error('Error saving pricing:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar la configuración de precios",
        variant: "destructive",
      });
    },
  });

  const handleSave = (data: Partial<EventPricingData>) => {
    savePricingMutation.mutate(data);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const calculateSavings = (basePrice: number, tierPrice: number) => {
    const savings = basePrice - tierPrice;
    const percentage = Math.round((savings / basePrice) * 100);
    return { savings, percentage };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <NavigationHeader onLogout={onLogout} />
        <div className="max-w-6xl mx-auto p-6">
          <div className="text-center py-12">Cargando configuración...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationHeader onLogout={onLogout} />
      
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Configuración de Precios</h1>
          <p className="text-gray-600 mt-2">
            Configura los precios y promociones por volumen para cada evento
          </p>
        </div>

        {/* Event Selector */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Seleccionar Evento</CardTitle>
            <CardDescription>
              Elige el evento para configurar sus precios y promociones
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-w-md">
              <Label htmlFor="event-select">Evento</Label>
              <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Selecciona un evento" />
                </SelectTrigger>
                <SelectContent>
                  {Array.isArray(events) && events.map((event: any) => (
                    <SelectItem key={event.id} value={event.id.toString()}>
                      {event.name} - {event.location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {pricing && (
          <PricingConfiguration 
            pricing={pricing} 
            onSave={handleSave}
            isLoading={savePricingMutation.isPending}
          />
        )}
      </div>
    </div>
  );
}

function PricingConfiguration({ 
  pricing, 
  onSave, 
  isLoading 
}: { 
  pricing: EventPricingData; 
  onSave: (data: Partial<EventPricingData>) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState(pricing);

  const handleInputChange = (field: keyof EventPricingData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const calculateSavings = (basePrice: number, tierPrice: number) => {
    const savings = basePrice - tierPrice;
    const percentage = Math.round((savings / basePrice) * 100);
    return { savings, percentage };
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Base Pricing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Precio Base
          </CardTitle>
          <CardDescription>
            Precio estándar por foto individual
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="basePrice">Precio por Foto</Label>
              <Input
                id="basePrice"
                type="number"
                value={formData.basePrice}
                onChange={(e) => handleInputChange('basePrice', parseInt(e.target.value))}
                className="mt-2"
                min="1000"
                step="1000"
              />
              <p className="text-sm text-gray-600 mt-1">
                Precio actual: {formatPrice(formData.basePrice)}
              </p>
            </div>
            <div>
              <Label htmlFor="currency">Moneda</Label>
              <Select 
                value={formData.currency} 
                onValueChange={(value) => handleInputChange('currency', value)}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COP">Peso Colombiano (COP)</SelectItem>
                  <SelectItem value="USD">Dólar Americano (USD)</SelectItem>
                  <SelectItem value="EUR">Euro (EUR)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Volume Discounts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Descuentos por Volumen
          </CardTitle>
          <CardDescription>
            Promociones automáticas basadas en la cantidad de fotos compradas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Enable/Disable Volume Discounts */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <Label className="text-base font-medium">Habilitar Descuentos por Volumen</Label>
                <p className="text-sm text-gray-600">
                  Aplica descuentos automáticos cuando los clientes compran múltiples fotos
                </p>
              </div>
              <Switch
                checked={formData.volumeDiscountEnabled}
                onCheckedChange={(checked) => handleInputChange('volumeDiscountEnabled', checked)}
              />
            </div>

            {formData.volumeDiscountEnabled && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Tier 2 */}
                <Card className="border-2 border-blue-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg text-blue-700">Nivel 2</CardTitle>
                    <CardDescription>Descuento por compras medianas</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="tier2Photos">Cantidad Mínima</Label>
                      <Input
                        id="tier2Photos"
                        type="number"
                        value={formData.tier2Photos}
                        onChange={(e) => handleInputChange('tier2Photos', parseInt(e.target.value))}
                        className="mt-2"
                        min="2"
                      />
                      <p className="text-xs text-gray-600 mt-1">fotos o más</p>
                    </div>
                    <div>
                      <Label htmlFor="tier2Price">Precio por Foto</Label>
                      <Input
                        id="tier2Price"
                        type="number"
                        value={formData.tier2Price}
                        onChange={(e) => handleInputChange('tier2Price', parseInt(e.target.value))}
                        className="mt-2"
                        min="1000"
                        step="1000"
                      />
                      <div className="text-xs text-green-600 mt-1">
                        {(() => {
                          const { savings, percentage } = calculateSavings(formData.basePrice, formData.tier2Price);
                          return `Ahorro: ${formatPrice(savings)} (${percentage}%)`;
                        })()}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Tier 3 */}
                <Card className="border-2 border-green-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg text-green-700">Nivel 3</CardTitle>
                    <CardDescription>Descuento por compras grandes</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="tier3Photos">Cantidad Mínima</Label>
                      <Input
                        id="tier3Photos"
                        type="number"
                        value={formData.tier3Photos}
                        onChange={(e) => handleInputChange('tier3Photos', parseInt(e.target.value))}
                        className="mt-2"
                        min="3"
                      />
                      <p className="text-xs text-gray-600 mt-1">fotos o más</p>
                    </div>
                    <div>
                      <Label htmlFor="tier3Price">Precio por Foto</Label>
                      <Input
                        id="tier3Price"
                        type="number"
                        value={formData.tier3Price}
                        onChange={(e) => handleInputChange('tier3Price', parseInt(e.target.value))}
                        className="mt-2"
                        min="1000"
                        step="1000"
                      />
                      <div className="text-xs text-green-600 mt-1">
                        {(() => {
                          const { savings, percentage } = calculateSavings(formData.basePrice, formData.tier3Price);
                          return `Ahorro: ${formatPrice(savings)} (${percentage}%)`;
                        })()}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Tier 4 */}
                <Card className="border-2 border-purple-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg text-purple-700">Nivel 4</CardTitle>
                    <CardDescription>Máximo descuento</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="tier4Photos">Cantidad Mínima</Label>
                      <Input
                        id="tier4Photos"
                        type="number"
                        value={formData.tier4Photos}
                        onChange={(e) => handleInputChange('tier4Photos', parseInt(e.target.value))}
                        className="mt-2"
                        min="5"
                      />
                      <p className="text-xs text-gray-600 mt-1">fotos o más</p>
                    </div>
                    <div>
                      <Label htmlFor="tier4Price">Precio por Foto</Label>
                      <Input
                        id="tier4Price"
                        type="number"
                        value={formData.tier4Price}
                        onChange={(e) => handleInputChange('tier4Price', parseInt(e.target.value))}
                        className="mt-2"
                        min="1000"
                        step="1000"
                      />
                      <div className="text-xs text-green-600 mt-1">
                        {(() => {
                          const { savings, percentage } = calculateSavings(formData.basePrice, formData.tier4Price);
                          return `Ahorro: ${formatPrice(savings)} (${percentage}%)`;
                        })()}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Vista Previa de Precios
          </CardTitle>
          <CardDescription>
            Cómo verán los precios los participantes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold">1 foto</h4>
              <p className="text-2xl font-bold text-gray-900">{formatPrice(formData.basePrice)}</p>
              <p className="text-sm text-gray-600">Precio estándar</p>
            </div>
            
            {formData.volumeDiscountEnabled && (
              <>
                <div className="p-4 border rounded-lg bg-blue-50">
                  <h4 className="font-semibold">{formData.tier2Photos}+ fotos</h4>
                  <p className="text-2xl font-bold text-blue-700">{formatPrice(formData.tier2Price)}</p>
                  <p className="text-sm text-blue-600">c/u</p>
                </div>
                
                <div className="p-4 border rounded-lg bg-green-50">
                  <h4 className="font-semibold">{formData.tier3Photos}+ fotos</h4>
                  <p className="text-2xl font-bold text-green-700">{formatPrice(formData.tier3Price)}</p>
                  <p className="text-sm text-green-600">c/u</p>
                </div>
                
                <div className="p-4 border rounded-lg bg-purple-50">
                  <h4 className="font-semibold">{formData.tier4Photos}+ fotos</h4>
                  <p className="text-2xl font-bold text-purple-700">{formatPrice(formData.tier4Price)}</p>
                  <p className="text-sm text-purple-600">c/u</p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Download Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Configuración de Descarga
          </CardTitle>
          <CardDescription>
            Configuración de validez y acceso a las fotos compradas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-md">
            <div>
              <Label htmlFor="downloadValidityDays">Validez de Descarga (días)</Label>
              <Input
                id="downloadValidityDays"
                type="number"
                value={formData.downloadValidityDays}
                onChange={(e) => handleInputChange('downloadValidityDays', parseInt(e.target.value) || 7)}
                className="mt-2"
                min="1"
                max="365"
              />
              <p className="text-sm text-gray-600 mt-1">
                Días que las fotos estarán disponibles para descarga después de la compra
              </p>
            </div>
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Nota:</strong> Una vez descargadas, los participantes pueden usar las fotos sin límites. 
                Esta configuración solo controla por cuánto tiempo pueden acceder al enlace de descarga.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button 
          type="submit" 
          disabled={isLoading}
          className="px-8"
        >
          {isLoading ? 'Guardando...' : 'Guardar Configuración'}
        </Button>
      </div>
    </form>
  );
}