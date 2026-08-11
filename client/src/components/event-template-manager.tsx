import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Users, Copy, Plus, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Event {
  id: number;
  name: string;
  date: string;
  location: string;
  expectedParticipants: number;
  status: string;
  photoCount?: number;
  processingStats?: {
    ocrAccuracy: string;
    avgProcessingTime: string;
  };
}

interface CreateEventTemplateData {
  templateEventId: number;
  name: string;
  date: string;
  location: string;
  expectedParticipants: number;
}

export default function EventTemplateManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    date: '',
    location: '',
    expectedParticipants: 1000
  });

  // Obtener eventos existentes
  const { data: events, isLoading } = useQuery({
    queryKey: ['/api/events'],
    select: (data: Event[]) => data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  });

  // Mutación para crear evento desde plantilla
  const createEventMutation = useMutation({
    mutationFn: async (data: CreateEventTemplateData) => {
      return apiRequest('/api/events/from-template', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: (result) => {
      toast({
        title: "✅ Evento Creado Exitosamente",
        description: `${result.name} creado usando plantilla: ${result.templateUsed}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      setIsCreateDialogOpen(false);
      setSelectedTemplate(null);
      setFormData({ name: '', date: '', location: '', expectedParticipants: 1000 });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Error al Crear Evento",
        description: error.message || "Error desconocido al crear el evento",
        variant: "destructive"
      });
    }
  });

  const handleCreateEvent = () => {
    if (!selectedTemplate || !formData.name || !formData.date || !formData.location) {
      toast({
        title: "❌ Datos Incompletos",
        description: "Por favor completa todos los campos requeridos",
        variant: "destructive"
      });
      return;
    }

    createEventMutation.mutate({
      templateEventId: selectedTemplate,
      name: formData.name,
      date: formData.date,
      location: formData.location,
      expectedParticipants: formData.expectedParticipants
    });
  };

  const getTemplateEvents = () => {
    return events?.filter(event => 
      event.status === 'active' && 
      (event.photoCount || 0) > 0 &&
      event.processingStats
    ) || [];
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Cargando eventos...</div>
        </CardContent>
      </Card>
    );
  }

  const templateEvents = getTemplateEvents();

  return (
    <div className="space-y-6">
      {/* Header con botón para crear evento */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Gestión de Eventos</h2>
          <p className="text-muted-foreground">
            Crea nuevos eventos usando configuraciones probadas
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-green-600 hover:bg-green-700 text-white">
              <Plus className="mr-2 h-4 w-4" />
              Crear Evento desde Plantilla
            </Button>
          </DialogTrigger>
          
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Crear Evento desde Plantilla</DialogTitle>
              <DialogDescription>
                Selecciona un evento existente como plantilla y configura los datos del nuevo evento
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Seleccionar plantilla */}
              <div className="space-y-2">
                <Label htmlFor="template">Evento Plantilla</Label>
                <Select value={selectedTemplate?.toString() || ""} onValueChange={(value) => setSelectedTemplate(parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un evento como plantilla" />
                  </SelectTrigger>
                  <SelectContent>
                    {templateEvents.map((event) => (
                      <SelectItem key={event.id} value={event.id.toString()}>
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span>{event.name}</span>
                          <Badge variant="secondary">{event.photoCount} fotos</Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedTemplate && (
                  <div className="text-xs text-muted-foreground">
                    ✅ Se copiará toda la configuración: OCR, thumbnails, estructura Google Cloud Storage
                  </div>
                )}
              </div>

              {/* Datos del nuevo evento */}
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre del Evento *</Label>
                  <Input
                    id="name"
                    placeholder="ej: Maratón de Bogotá 2025"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Fecha del Evento *</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="location">Ubicación *</Label>
                    <Input
                      id="location"
                      placeholder="ej: Bogotá"
                      value={formData.location}
                      onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="participants">Participantes Esperados</Label>
                  <Input
                    id="participants"
                    type="number"
                    min="1"
                    value={formData.expectedParticipants}
                    onChange={(e) => setFormData(prev => ({ ...prev, expectedParticipants: parseInt(e.target.value) || 1000 }))}
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => setIsCreateDialogOpen(false)}
                  disabled={createEventMutation.isPending}
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleCreateEvent}
                  disabled={createEventMutation.isPending || !selectedTemplate}
                >
                  {createEventMutation.isPending ? "Creando..." : "Crear Evento"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista de eventos existentes */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {events?.map((event) => (
          <Card key={event.id} className={`relative ${templateEvents.includes(event) ? 'border-green-200 bg-green-50/50' : ''}`}>
            {templateEvents.includes(event) && (
              <Badge className="absolute -top-2 -right-2 bg-green-100 text-green-800 border-green-300">
                <Copy className="mr-1 h-3 w-3" />
                Plantilla
              </Badge>
            )}
            
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{event.name}</CardTitle>
              <CardDescription className="space-y-1">
                <div className="flex items-center text-sm">
                  <Calendar className="mr-2 h-4 w-4" />
                  {format(new Date(event.date), "d 'de' MMMM, yyyy", { locale: es })}
                </div>
                <div className="flex items-center text-sm">
                  <MapPin className="mr-2 h-4 w-4" />
                  {event.location}
                </div>
                <div className="flex items-center text-sm">
                  <Users className="mr-2 h-4 w-4" />
                  {event.expectedParticipants} participantes
                </div>
              </CardDescription>
            </CardHeader>
            
            <CardContent className="pt-0">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Estado:</span>
                  <Badge variant={event.status === 'active' ? 'default' : 'secondary'}>
                    {event.status}
                  </Badge>
                </div>
                
                {event.photoCount !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Fotos:</span>
                    <span className="text-sm font-medium">{event.photoCount}</span>
                  </div>
                )}
                
                {event.processingStats && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Precisión OCR:</span>
                      <span className="text-sm font-medium">{event.processingStats.ocrAccuracy}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Tiempo Proc:</span>
                      <span className="text-sm font-medium">{event.processingStats.avgProcessingTime}</span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {templateEvents.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">
              No hay eventos disponibles como plantilla. Los eventos deben tener fotos procesadas y configuración OCR para usarse como plantilla.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}