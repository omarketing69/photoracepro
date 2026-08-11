import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, MapPin, Users, Images, Download, Eye, ChevronRight, ArrowLeft, User, ChevronLeft, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface FreeEvent {
  id: number;
  name: string;
  date: string;
  location: string;
  expectedParticipants: number;
  freePhotosEnabled: boolean;
  freePhotosEnabledAt: string;
}

interface FreePhoto {
  id: number;
  filename: string;
  originalPath: string;
  webPath?: string;
  thumbnailPath?: string;
  detectedDorsals: number[];
}

export default function ParticipantFreePhotos() {
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [selectedDorsal, setSelectedDorsal] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [dorsalsPage, setDorsalsPage] = useState(1);
  const [viewModalPhoto, setViewModalPhoto] = useState<FreePhoto | null>(null);
  const photosPerPage = 6;
  const dorsalsPerPage = 40; // Mostrar 40 dorsales por página (10x4 grid)

  const { data: freeEvents, isLoading: eventsLoading } = useQuery<FreeEvent[]>({
    queryKey: ["/api/free-events"],
  });

  const { data: dorsals, isLoading: dorsalsLoading } = useQuery<number[]>({
    queryKey: [`/api/free-events/${selectedEventId}/dorsals`],
    enabled: !!selectedEventId,
  });

  const { data: photos, isLoading: photosLoading } = useQuery<FreePhoto[]>({
    queryKey: [`/api/free-events/${selectedEventId}/photos/${selectedDorsal}`],
    enabled: !!(selectedEventId && selectedDorsal),
  });

  // Debug logging (simplified)
  if (photos && photos.length > 0) {
    console.log(`Found ${photos.length} photos for dorsal ${selectedDorsal}`);
  }

  // Reset pagination when dorsal changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDorsal]);

  // Reset dorsals pagination when event changes
  useEffect(() => {
    setDorsalsPage(1);
    setSelectedDorsal(null);
  }, [selectedEventId]);

  if (eventsLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">Cargando eventos...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header for participants */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Fotos Gratuitas</h2>
            <Button variant="outline" onClick={() => window.location.href = '/'}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al Inicio
            </Button>
          </div>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Explora Fotos de Eventos Anteriores</h1>
          <p className="text-gray-600 mt-2">
            Descarga fotos de eventos pasados de forma completamente gratuita
          </p>
        </div>

        {/* No events available */}
        {!freeEvents || freeEvents.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Images className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No hay eventos con fotos gratuitas disponibles
              </h3>
              <p className="text-gray-600">
                Cuando haya eventos con fotos liberadas, aparecerán aquí para que las puedas descargar gratis.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Events List */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Calendar className="mr-2 h-5 w-5" />
                    Eventos Disponibles
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {freeEvents.map((event) => (
                      <div
                        key={event.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedEventId === event.id
                            ? 'border-blue-300 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => {
                          setSelectedEventId(event.id);
                          setSelectedDorsal(null);
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-gray-900">{event.name}</h4>
                            <div className="flex items-center text-sm text-gray-600 mt-1">
                              <MapPin className="mr-1 h-3 w-3" />
                              {event.location}
                            </div>
                            <div className="flex items-center text-sm text-gray-600">
                              <Calendar className="mr-1 h-3 w-3" />
                              {new Date(event.date).toLocaleDateString('es-ES')}
                            </div>
                          </div>
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            GRATIS
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Dorsals Grid */}
            <div className="lg:col-span-1">
              {selectedEventId ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Users className="mr-2 h-5 w-5" />
                        Dorsales Disponibles
                      </div>
                      {dorsals && dorsals.length > 0 && (
                        <Badge variant="secondary">
                          {dorsals.length} dorsales
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    {dorsalsLoading ? (
                      <div className="text-center text-gray-600">Cargando dorsales...</div>
                    ) : dorsals && dorsals.length > 0 ? (
                      <div>
                        {/* Información de paginación de dorsales */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                          <div className="flex justify-between items-center">
                            <div className="text-sm font-medium text-blue-800">
                              Mostrando {((dorsalsPage - 1) * dorsalsPerPage) + 1} - {Math.min(dorsalsPage * dorsalsPerPage, dorsals.length)} de {dorsals.length} dorsales
                            </div>
                            <div className="text-sm font-medium text-blue-800">
                              Página {dorsalsPage} de {Math.ceil(dorsals.length / dorsalsPerPage)}
                            </div>
                          </div>
                        </div>

                        {/* Grid de dorsales con paginación */}
                        <div className="grid grid-cols-10 gap-2 mb-4">
                          {dorsals
                            .slice((dorsalsPage - 1) * dorsalsPerPage, dorsalsPage * dorsalsPerPage)
                            .map((dorsal) => (
                            <button
                              key={dorsal}
                              onClick={() => setSelectedDorsal(dorsal)}
                              className={`p-2 text-xs rounded border transition-colors ${
                                selectedDorsal === dorsal
                                  ? 'border-blue-300 bg-blue-50 text-blue-700 font-bold'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              {dorsal}
                            </button>
                          ))}
                        </div>

                        {/* Controles de paginación de dorsales */}
                        {Math.ceil(dorsals.length / dorsalsPerPage) > 1 && (
                          <div className="bg-white border border-gray-300 rounded-lg p-4">
                            <div className="flex justify-center items-center space-x-3">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setDorsalsPage(prev => Math.max(prev - 1, 1))}
                                disabled={dorsalsPage === 1}
                                className="bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300"
                              >
                                <ChevronLeft className="h-4 w-4 mr-1" />
                                Anterior
                              </Button>
                            
                              <span className="text-sm text-gray-600">
                                {dorsalsPage} de {Math.ceil(dorsals.length / dorsalsPerPage)}
                              </span>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setDorsalsPage(prev => Math.min(prev + 1, Math.ceil(dorsals.length / dorsalsPerPage)))}
                                disabled={dorsalsPage === Math.ceil(dorsals.length / dorsalsPerPage)}
                                className="bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300"
                              >
                                Siguiente
                                <ChevronRight className="h-4 w-4 ml-1" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center text-gray-600">
                        No hay dorsales disponibles para este evento
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Users className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                    <p className="text-gray-600">
                      Selecciona un evento para ver los dorsales disponibles
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Photos Grid */}
            <div className="lg:col-span-1">
              {selectedEventId && selectedDorsal ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Images className="mr-2 h-5 w-5" />
                        Fotos del Dorsal {selectedDorsal}
                      </div>
                      {photos && photos.length > 0 && (
                        <Button size="sm" variant="outline">
                          <Download className="mr-1 h-3 w-3" />
                          Descargar Todas
                        </Button>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    {photosLoading ? (
                      <div className="text-center text-gray-600">Cargando fotos...</div>
                    ) : photos && photos.length > 0 ? (
                      <div>
                        {/* Información de paginación */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                          <div className="flex justify-between items-center">
                            <div className="text-sm font-medium text-blue-800">
                              📄 Mostrando {((currentPage - 1) * photosPerPage) + 1} - {Math.min(currentPage * photosPerPage, photos.length)} de {photos.length} fotos
                            </div>
                            <div className="text-sm font-medium text-blue-800">
                              Página {currentPage} de {Math.ceil(photos.length / photosPerPage)}
                            </div>
                          </div>
                        </div>

                        {/* Grid de fotos con paginación */}
                        <div className="grid grid-cols-3 gap-3 mb-4">
                          {photos
                            .slice((currentPage - 1) * photosPerPage, currentPage * photosPerPage)
                            .map((photo) => (
                            <div key={photo.id} className="relative group">
                              <img
                                src={photo.thumbnailPath ? `/api/thumbnails/${photo.filename}` : `/api/images/${photo.filename}`}
                                alt="Foto gratuita"
                                className="w-full h-24 object-cover rounded-lg border border-gray-200"
                              />
                              {/* Marca de agua para protección */}
                              <div className="absolute inset-0 pointer-events-none select-none">
                                {/* Marca central */}
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="text-white text-xs font-bold opacity-60 transform -rotate-45 bg-black bg-opacity-30 px-1 py-0.5 rounded">
                                    GRATIS
                                  </div>
                                </div>
                                {/* Marcas en esquinas */}
                                <div className="absolute top-0.5 left-0.5 text-white text-xs font-bold opacity-40 transform -rotate-12 bg-black bg-opacity-25 px-0.5 rounded">
                                  DEMO
                                </div>
                                <div className="absolute top-0.5 right-0.5 text-white text-xs font-bold opacity-40 transform rotate-12 bg-black bg-opacity-25 px-0.5 rounded">
                                  DEMO
                                </div>
                                <div className="absolute bottom-0.5 left-0.5 text-white text-xs font-bold opacity-40 transform rotate-12 bg-black bg-opacity-25 px-0.5 rounded">
                                  DEMO
                                </div>
                                <div className="absolute bottom-0.5 right-0.5 text-white text-xs font-bold opacity-40 transform -rotate-12 bg-black bg-opacity-25 px-0.5 rounded">
                                  DEMO
                                </div>
                              </div>
                              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity rounded-lg flex items-center justify-center">
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity space-x-2">
                                  <Button 
                                    size="sm" 
                                    variant="secondary"
                                    onClick={() => setViewModalPhoto(photo)}
                                  >
                                    <Eye className="h-3 w-3" />
                                  </Button>
                                  <Button size="sm" variant="secondary">
                                    <Download className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Controles de paginación */}
                        {photos.length > photosPerPage && (
                          <div className="bg-white border border-gray-300 rounded-lg p-4 mt-4">
                            <div className="flex justify-center items-center space-x-3">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300"
                              >
                                <ChevronLeft className="h-4 w-4 mr-1" />
                                Anterior
                              </Button>
                            
                              <span className="text-sm text-gray-600">
                                {currentPage} de {Math.ceil(photos.length / photosPerPage)}
                              </span>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(photos.length / photosPerPage)))}
                                disabled={currentPage === Math.ceil(photos.length / photosPerPage)}
                                className="bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300"
                              >
                                Siguiente
                                <ChevronRight className="h-4 w-4 ml-1" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center text-gray-600">
                        No hay fotos disponibles para este dorsal
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Images className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                    <p className="text-gray-600">
                      Selecciona un evento y dorsal para ver las fotos
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal para ver foto en tamaño grande */}
      <Dialog open={!!viewModalPhoto} onOpenChange={() => setViewModalPhoto(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          {viewModalPhoto && (
            <div className="relative">
              <DialogHeader className="p-4 pb-2">
                <DialogTitle className="flex items-center justify-between">
                  <span>Vista previa</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewModalPhoto(null)}
                    className="p-1 h-auto"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </DialogTitle>
              </DialogHeader>
              
              <div className="p-4">
                <div className="relative max-h-[70vh] overflow-hidden rounded-lg">
                  <img
                    src={`/api/photos/${viewModalPhoto.id}/original`}
                    alt="Foto gratuita"
                    className="w-full h-auto object-contain max-h-[70vh]"
                    onError={(e) => {
                      console.error('Error loading original photo:', viewModalPhoto.id);
                      // Show error message if image fails to load
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  
                  {/* Botones de navegación */}
                  {photos && photos.length > 1 && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                        onClick={() => {
                          const currentIndex = photos.findIndex(p => p.id === viewModalPhoto.id);
                          const prevIndex = currentIndex > 0 ? currentIndex - 1 : photos.length - 1;
                          setViewModalPhoto(photos[prevIndex]);
                        }}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                        onClick={() => {
                          const currentIndex = photos.findIndex(p => p.id === viewModalPhoto.id);
                          const nextIndex = currentIndex < photos.length - 1 ? currentIndex + 1 : 0;
                          setViewModalPhoto(photos[nextIndex]);
                        }}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
                
                <div className="mt-4 flex justify-between items-center">
                  <div className="text-sm text-gray-600">
                    <Badge variant="outline" className="mr-2">
                      Dorsal {selectedDorsal}
                    </Badge>
                    Dorsales detectados: {viewModalPhoto.detectedDorsals.join(', ')}
                    {photos && photos.length > 1 && (
                      <span className="ml-2 text-blue-600 font-medium">
                        • Foto {photos.findIndex(p => p.id === viewModalPhoto.id) + 1} de {photos.length}
                      </span>
                    )}
                  </div>
                  
                  <div className="space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setViewModalPhoto(null)}
                    >
                      Cerrar
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Descargar
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}