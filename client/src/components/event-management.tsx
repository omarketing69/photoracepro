import { useState } from "react";
import React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Calendar, MapPin, Users, Images, ChevronRight, Plus, Upload, Cloud, FileArchive, Gift, Lock, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertEventSchema, type InsertEvent, type EventWithStats } from "@shared/schema";
import { z } from "zod";
import GoogleDriveImport from "./google-drive-import";
import ZipUpload from "./zip-upload";
import PhotoUpload from "./photo-upload";
import EventTemplateManager from "./event-template-manager";

const createEventFormSchema = insertEventSchema.extend({
  date: z.string().min(1, "Date is required"),
});

type CreateEventForm = z.infer<typeof createEventFormSchema>;

export default function EventManagement() {
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<EventWithStats | null>(null);
  const [adminPassword, setAdminPassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const { data: events, isLoading } = useQuery<EventWithStats[]>({
    queryKey: ["/api/events"],
  });

  // Auto-select the most recent event (highest ID) by default
  React.useEffect(() => {
    if (events && events.length > 0 && !selectedEventId) {
      const mostRecentEvent = events.reduce((latest, current) => 
        current.id > latest.id ? current : latest
      );
      setSelectedEventId(mostRecentEvent.id);
      console.log(`📋 Dashboard: Auto-selected event ${mostRecentEvent.id} (${mostRecentEvent.name})`);
    }
  }, [events, selectedEventId]);

  const form = useForm<CreateEventForm>({
    resolver: zodResolver(createEventFormSchema),
    defaultValues: {
      name: "",
      date: "",
      location: "",
      expectedParticipants: 0,
      status: "active",
    },
  });

  const createEventMutation = useMutation({
    mutationFn: async (data: CreateEventForm) => {
      const eventData: InsertEvent = {
        ...data,
        date: new Date(data.date),
      };
      return apiRequest("POST", "/api/events", eventData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      form.reset();
      toast({
        title: "Evento creado",
        description: "El evento se ha creado exitosamente.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo crear el evento.",
        variant: "destructive",
      });
    },
  });

  const enableFreePhotosMutation = useMutation({
    mutationFn: async (eventId: number) => {
      return apiRequest("POST", `/api/events/${eventId}/enable-free-photos`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({
        title: "Fotos liberadas",
        description: "Las fotos del evento ahora están disponibles gratuitamente.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudieron liberar las fotos.",
        variant: "destructive",
      });
    },
  });

  const disableFreePhotosMutation = useMutation({
    mutationFn: async (eventId: number) => {
      return apiRequest("POST", `/api/events/${eventId}/disable-free-photos`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({
        title: "Fotos protegidas",
        description: "Las fotos del evento requieren compra nuevamente.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudieron proteger las fotos.",
        variant: "destructive",
      });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async ({ eventId, password }: { eventId: number; password: string }) => {
      return apiRequest("DELETE", `/api/events/${eventId}`, { adminPassword: password });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setDeleteDialogOpen(false);
      setEventToDelete(null);
      setAdminPassword("");
      setIsDeleting(false);
      toast({
        title: "Evento eliminado",
        description: "El evento y todas sus fotos han sido eliminados definitivamente.",
      });
    },
    onError: (error: any) => {
      setIsDeleting(false);
      toast({
        title: "Error al eliminar evento",
        description: error.message || "No se pudo eliminar el evento. Verifica la contraseña de administrador.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteEvent = (event: EventWithStats) => {
    setEventToDelete(event);
    setDeleteDialogOpen(true);
    setAdminPassword("");
  };

  const confirmDeleteEvent = async () => {
    if (!eventToDelete || !adminPassword.trim()) {
      toast({
        title: "Error",
        description: "Ingresa la contraseña de administrador para confirmar la eliminación.",
        variant: "destructive",
      });
      return;
    }

    setIsDeleting(true);
    deleteEventMutation.mutate({ eventId: eventToDelete.id, password: adminPassword });
  };

  const onSubmit = (data: CreateEventForm) => {
    createEventMutation.mutate(data);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default" className="bg-green-100 text-green-800">Procesado</Badge>;
      case "processing":
        return <Badge variant="default" className="bg-orange-100 text-orange-800">Procesando</Badge>;
      case "active":
        return <Badge variant="default" className="bg-blue-100 text-blue-800">Activo</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (isLoading) {
    return <div>Cargando eventos...</div>;
  }

  return (
    <Card className="border border-gray-200">
      <CardHeader className="border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Gestión de Eventos</h3>
          <Button variant="ghost" className="text-primary hover:text-blue-700 text-sm font-medium">
            Ver todos <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        {/* Create New Event Form */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-4">Crear Nuevo Evento</h4>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Nombre del Evento</Label>
                <Input
                  id="name"
                  placeholder="Ej: Maratón Valencia 2024"
                  {...form.register("name")}
                />
                {form.formState.errors.name && (
                  <p className="text-red-500 text-sm">{form.formState.errors.name.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="date">Fecha</Label>
                <Input
                  id="date"
                  type="date"
                  {...form.register("date")}
                />
                {form.formState.errors.date && (
                  <p className="text-red-500 text-sm">{form.formState.errors.date.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="location">Ubicación</Label>
                <Input
                  id="location"
                  placeholder="Ciudad, País"
                  {...form.register("location")}
                />
                {form.formState.errors.location && (
                  <p className="text-red-500 text-sm">{form.formState.errors.location.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="expectedParticipants">Participantes Esperados</Label>
                <Input
                  id="expectedParticipants"
                  type="number"
                  placeholder="1000"
                  {...form.register("expectedParticipants", { valueAsNumber: true })}
                />
                {form.formState.errors.expectedParticipants && (
                  <p className="text-red-500 text-sm">{form.formState.errors.expectedParticipants.message}</p>
                )}
              </div>
            </div>
            <div className="mt-4 flex space-x-3">
              <Button
                type="submit"
                disabled={createEventMutation.isPending}
                className="bg-primary text-white hover:bg-blue-700"
              >
                <Plus className="mr-2 h-4 w-4" />
                {createEventMutation.isPending ? "Creando..." : "Crear Evento"}
              </Button>
              <Button type="button" variant="outline">
                <Upload className="mr-2 h-4 w-4" />
                Subir Lista Participantes
              </Button>
            </div>
          </form>
        </div>

        {/* Recent Events */}
        <div>
          <h4 className="font-medium text-gray-900 mb-4">Eventos Recientes</h4>
          <div className="space-y-3">
            {events?.map((event) => (
              <div key={event.id} className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex items-center space-x-4">
                    <div className="bg-primary/10 p-2 rounded-lg">
                      <Calendar className="text-primary h-5 w-5" />
                    </div>
                    <div>
                      <h5 className="font-medium text-gray-900">{event.name}</h5>
                      <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                        <span className="flex items-center">
                          <Calendar className="mr-1 h-4 w-4" />
                          {new Date(event.date).toLocaleDateString()}
                        </span>
                        <span className="flex items-center">
                          <Users className="mr-1 h-4 w-4" />
                          {event.expectedParticipants} participantes
                        </span>
                        <span className="flex items-center">
                          <Images className="mr-1 h-4 w-4" />
                          {event.photoCount} fotos
                        </span>
                        {event.freePhotosEnabled && (
                          <span className="flex items-center">
                            <Badge variant="default" className="bg-green-100 text-green-800 text-xs">
                              <Gift className="mr-1 h-3 w-3" />
                              Gratis
                            </Badge>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusBadge(event.status)}
                    {/* Botones de acceso rápido para fotos gratuitas */}
                    {event.freePhotosEnabled ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => disableFreePhotosMutation.mutate(event.id)}
                        disabled={disableFreePhotosMutation.isPending}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        <Lock className="h-3 w-3" />
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => enableFreePhotosMutation.mutate(event.id)}
                        disabled={enableFreePhotosMutation.isPending}
                        className="text-green-600 border-green-200 hover:bg-green-50"
                      >
                        <Gift className="h-3 w-3" />
                      </Button>
                    )}
                    {/* Botón de eliminar evento */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteEvent(event)}
                      className="text-red-600 border-red-300 hover:bg-red-50"
                      title="Eliminar evento"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setSelectedEventId(selectedEventId === event.id ? null : event.id)}
                    >
                      <ChevronRight className={`h-4 w-4 transition-transform ${selectedEventId === event.id ? 'rotate-90' : ''}`} />
                    </Button>
                  </div>
                </div>
                
                {/* Expanded photo management section */}
                {selectedEventId === event.id && (
                  <div className="ml-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="font-medium text-gray-900">
                          Gestión de Fotos - {event.name}
                        </h5>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                        <div className="flex items-center">
                          <div className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium mr-3">
                            📋 EVENTO SELECCIONADO
                          </div>
                          <div>
                            <p className="font-medium text-blue-900">{event.name}</p>
                            <p className="text-sm text-blue-700">
                              ID: {event.id} • Todas las fotos que subas irán a este evento
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {event.freePhotosEnabled ? (
                          <div className="flex items-center space-x-2">
                            <Badge variant="default" className="bg-green-100 text-green-800">
                              <Gift className="mr-1 h-3 w-3" />
                              Fotos Gratuitas
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => disableFreePhotosMutation.mutate(event.id)}
                              disabled={disableFreePhotosMutation.isPending}
                            >
                              <Lock className="mr-1 h-3 w-3" />
                              Proteger Fotos
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => enableFreePhotosMutation.mutate(event.id)}
                            disabled={enableFreePhotosMutation.isPending}
                            className="border-green-200 text-green-700 hover:bg-green-50"
                          >
                            <Gift className="mr-1 h-3 w-3" />
                            Liberar Fotos Gratis
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    <Tabs defaultValue="zip" className="w-full">
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="zip">
                          <FileArchive className="mr-2 h-4 w-4" />
                          Archivo ZIP
                        </TabsTrigger>
                        <TabsTrigger value="upload">
                          <Upload className="mr-2 h-4 w-4" />
                          Fotos Individuales
                        </TabsTrigger>
                        <TabsTrigger value="drive">
                          <Cloud className="mr-2 h-4 w-4" />
                          Google Drive
                        </TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="zip" className="mt-4">
                        <ZipUpload 
                          eventId={event.id}
                          onUploadComplete={() => {
                            queryClient.invalidateQueries({ queryKey: ["/api/events"] });
                          }}
                        />
                      </TabsContent>
                      
                      <TabsContent value="upload" className="mt-4">
                        <PhotoUpload 
                          eventId={event.id}
                          onUploadComplete={() => {
                            queryClient.invalidateQueries({ queryKey: ["/api/events"] });
                          }}
                        />
                      </TabsContent>
                      
                      <TabsContent value="drive" className="mt-4">
                        <GoogleDriveImport 
                          eventId={event.id}
                          onImportComplete={(result) => {
                            queryClient.invalidateQueries({ queryKey: ["/api/events"] });
                          }}
                        />
                      </TabsContent>
                    </Tabs>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>

      {/* Dialog de confirmación para eliminar evento */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center">
              <Trash2 className="mr-2 h-5 w-5" />
              Eliminar Evento
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar permanentemente el evento?
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {eventToDelete && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="font-medium text-red-900">{eventToDelete.name}</p>
                <p className="text-sm text-red-700">
                  📅 {new Date(eventToDelete.date).toLocaleDateString()} • 
                  📍 {eventToDelete.location} • 
                  📸 {eventToDelete.photoCount} fotos
                </p>
              </div>
            )}
            <div className="text-red-600 font-medium">
              ⚠️ Esta acción eliminará PERMANENTEMENTE:
            </div>
            <ul className="text-sm text-red-600 list-disc list-inside ml-2 space-y-1">
              <li>El evento y toda su información</li>
              <li>Todas las fotos asociadas al evento</li>
              <li>Todos los dorsales detectados</li>
              <li>Historial de ventas del evento</li>
            </ul>
            <p className="text-sm font-medium text-gray-700">
              Para confirmar, ingresa tu contraseña de administrador:
            </p>
            <div className="space-y-2">
              <Label htmlFor="adminPassword">Contraseña de Administrador</Label>
              <Input
                id="adminPassword"
                type="password"
                placeholder="Ingresa tu contraseña de administrador"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                disabled={isDeleting}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isDeleting && adminPassword.trim()) {
                    confirmDeleteEvent();
                  }
                }}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setDeleteDialogOpen(false);
                setEventToDelete(null);
                setAdminPassword("");
              }}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmDeleteEvent}
              disabled={isDeleting || !adminPassword.trim()}
            >
              {isDeleting ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Eliminando...
                </div>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar Permanentemente
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
