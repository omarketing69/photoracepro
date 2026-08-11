import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, MapPin, Users, Images, Download, Eye, ChevronRight, X, ChevronLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
// Remove admin navigation since this page should be public

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

export default function FreePhotos() {
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [selectedDorsal, setSelectedDorsal] = useState<number | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<FreePhoto | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const DORSALS_PER_PAGE = 20;
  
  console.log('FreePhotos render - previewPhoto:', previewPhoto);

  const { data: freeEvents, isLoading: eventsLoading } = useQuery<FreeEvent[]>({
    queryKey: ["/api/free-events"],
  });

  const { data: dorsals, isLoading: dorsalsLoading } = useQuery<number[]>({
    queryKey: [`/api/free-events/${selectedEventId}/dorsals`],
    enabled: !!selectedEventId,
  });

  // Reset pagination when selectedEventId changes
  useEffect(() => {
    if (selectedEventId) {
      setCurrentPage(1);
      setSelectedDorsal(null);
    }
  }, [selectedEventId]);

  // Debug logging
  console.log('Pagination debug:', {
    dorsalsLength: dorsals?.length,
    currentPage,
    DORSALS_PER_PAGE,
    shouldShowPagination: dorsals && dorsals.length > DORSALS_PER_PAGE
  });

  const { data: photos, isLoading: photosLoading } = useQuery<FreePhoto[]>({
    queryKey: [`/api/free-events/${selectedEventId}/photos/${selectedDorsal}`],
    enabled: !!(selectedEventId && selectedDorsal),
  });

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
      {/* Simple header for public access */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">photoracepro.com - Fotos Gratuitas</h2>
            <Button variant="outline" onClick={() => window.location.href = '/user-portal'}>
              Volver al Portal
            </Button>
          </div>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Fotos Gratuitas</h1>
          <p className="text-gray-600 mt-2">
            Explora las fotos de eventos pasados disponibles de forma gratuita
          </p>
        </div>

        {!freeEvents || freeEvents.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Images className="mx-auto h-16 w-16 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No hay eventos con fotos gratuitas
              </h3>
              <p className="text-gray-600">
                Cuando los organizadores liberen fotos de eventos pasados, aparecerán aquí.
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
                        onClick={() => {
                          setSelectedEventId(event.id === selectedEventId ? null : event.id);
                          setSelectedDorsal(null);
                        }}
                        className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                          selectedEventId === event.id
                            ? 'border-primary bg-primary/5'
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-gray-900">{event.name}</h4>
                            <div className="flex items-center text-sm text-gray-600 mt-1">
                              <Calendar className="mr-1 h-3 w-3" />
                              {new Date(event.date).toLocaleDateString()}
                            </div>
                            <div className="flex items-center text-sm text-gray-600">
                              <MapPin className="mr-1 h-3 w-3" />
                              {event.location}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant="default" className="bg-green-100 text-green-800">
                              Gratis
                            </Badge>
                            <ChevronRight 
                              className={`h-4 w-4 text-gray-400 transition-transform ${
                                selectedEventId === event.id ? 'rotate-90' : ''
                              }`}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Dorsals List */}
            <div className="lg:col-span-1">
              {selectedEventId ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Users className="mr-2 h-5 w-5" />
                      Dorsales Disponibles
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    {dorsalsLoading ? (
                      <div className="text-center text-gray-600">Cargando dorsales...</div>
                    ) : dorsals && dorsals.length > 0 ? (
                      <div>
                        <div className="text-sm text-gray-600 mb-3 bg-blue-100 p-2 rounded">
                          Total de dorsales: {dorsals.length}
                          <br/>
                          Mostrando dorsales: {((currentPage - 1) * DORSALS_PER_PAGE) + 1} - {Math.min(currentPage * DORSALS_PER_PAGE, dorsals.length)}
                        </div>
                        
                        {/* Dorsals Grid with Pagination */}
                        <div className="grid grid-cols-4 gap-1 min-h-[240px]">
                          {dorsals
                            .slice((currentPage - 1) * DORSALS_PER_PAGE, currentPage * DORSALS_PER_PAGE)
                            .map((dorsal) => (
                              <Button
                                key={dorsal}
                                variant={selectedDorsal === dorsal ? "default" : "outline"}
                                size="sm"
                                onClick={() => setSelectedDorsal(dorsal === selectedDorsal ? null : dorsal)}
                                className="h-8 text-xs"
                              >
                                {dorsal}
                              </Button>
                            ))}
                        </div>
                        
                        {/* Pagination Controls - Debug Info */}
                        <div className="text-xs text-red-600 mt-2 mb-2 bg-yellow-100 p-2 rounded">
                          Debug: dorsals.length={dorsals?.length || 'undefined'}, DORSALS_PER_PAGE={DORSALS_PER_PAGE}, show={dorsals && dorsals.length > DORSALS_PER_PAGE ? 'true' : 'false'}
                        </div>
                        
                        {/* Pagination Controls - Always Show for Testing */}
                        {dorsals && dorsals.length > 0 && (
                          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 bg-gray-50 p-3 rounded">
                            <div className="text-xs text-gray-500">
                              Mostrando {((currentPage - 1) * DORSALS_PER_PAGE) + 1} - {Math.min(currentPage * DORSALS_PER_PAGE, dorsals.length)} de {dorsals.length}
                            </div>
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="h-8 px-2"
                              >
                                <ChevronLeft className="h-3 w-3" />
                                Anterior
                              </Button>
                              <span className="text-sm text-gray-600">
                                {currentPage} de {Math.ceil(dorsals.length / DORSALS_PER_PAGE)}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(prev => Math.min(Math.ceil(dorsals.length / DORSALS_PER_PAGE), prev + 1))}
                                disabled={currentPage === Math.ceil(dorsals.length / DORSALS_PER_PAGE)}
                                className="h-8 px-2"
                              >
                                Siguiente
                                <ChevronRight className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center text-gray-600">
                        No hay dorsales detectados para este evento
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
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
                      <div className="grid grid-cols-4 gap-3 max-h-96 overflow-y-auto">
                        {photos.map((photo) => (
                          <div key={photo.id} className="relative group">
                            <img
                              src={photo.thumbnailPath ? `/api/thumbnails/${photo.filename}` : `/api/images/${photo.filename}`}
                              alt="Foto gratuita"
                              className="w-full h-48 object-cover rounded-lg border border-gray-200 cursor-pointer"
                              onClick={() => {
                                console.log('Free photo clicked!', photo);
                                setPreviewPhoto(photo);
                              }}
                            />
                            {/* Overlay con icono de ojo */}
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity rounded-lg flex items-center justify-center">
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity text-white">
                                <Eye className="h-8 w-8" />
                              </div>
                            </div>
                            {/* Marca de agua para protección - SOLO GRATIS */}
                            <div className="absolute inset-0 pointer-events-none select-none">
                              {/* Marca central */}
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="text-white text-xs font-bold opacity-70 transform -rotate-45 bg-black bg-opacity-40 px-2 py-1 rounded">
                                  GRATIS
                                </div>
                              </div>
                              {/* Marcas en esquinas */}
                              <div className="absolute top-1 left-1 text-white text-xs font-bold opacity-50 transform -rotate-12 bg-black bg-opacity-30 px-1 rounded">
                                DEMO
                              </div>
                              <div className="absolute top-1 right-1 text-white text-xs font-bold opacity-50 transform rotate-12 bg-black bg-opacity-30 px-1 rounded">
                                DEMO
                              </div>
                              <div className="absolute bottom-1 left-1 text-white text-xs font-bold opacity-50 transform rotate-12 bg-black bg-opacity-30 px-1 rounded">
                                DEMO
                              </div>
                              <div className="absolute bottom-1 right-1 text-white text-xs font-bold opacity-50 transform -rotate-12 bg-black bg-opacity-30 px-1 rounded">
                                DEMO
                              </div>
                              {/* Overlay semitransparente */}
                              <div className="absolute inset-0 bg-gray-900 bg-opacity-5"></div>
                            </div>
                          </div>
                        ))}
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
                    <Images className="mx-auto h-12 w-12 text-gray-400 mb-4" />
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

      {/* Modal de previsualización - COPIADO DE SEARCH.TSX */}
      {previewPhoto && (
        <Dialog open={true} onOpenChange={() => setPreviewPhoto(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] p-0" aria-describedby="preview-description">
            <DialogHeader className="p-6 pb-0">
              <DialogTitle>Foto Gratuita</DialogTitle>
            </DialogHeader>
            <div className="p-6 pt-0">
              <div id="preview-description" className="sr-only">
                Modal de previsualización para fotos gratis
              </div>
              <div className="relative">
                <img
                  src={`/api/photos/${previewPhoto.id}/original`}
                  alt="Foto gratuita"
                  className="w-full h-auto max-h-[60vh] object-contain rounded-lg"
                  onError={(e) => {
                    console.error("Error loading original photo:", previewPhoto.id);
                    e.currentTarget.src = `/api/thumbnails/${previewPhoto.filename}`;
                  }}
                />
                {/* Marca de agua para previsualización */}
                <div className="absolute inset-0 pointer-events-none select-none">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-white text-2xl font-bold opacity-60 transform -rotate-45 bg-black bg-opacity-40 px-4 py-2 rounded-lg">
                      GRATIS
                    </div>
                  </div>
                  <div className="absolute top-4 left-4 text-white text-lg font-bold opacity-50 transform -rotate-12 bg-black bg-opacity-30 px-2 py-1 rounded">
                    DEMO
                  </div>
                  <div className="absolute top-4 right-4 text-white text-lg font-bold opacity-50 transform rotate-12 bg-black bg-opacity-30 px-2 py-1 rounded">
                    DEMO
                  </div>
                  <div className="absolute bottom-4 left-4 text-white text-lg font-bold opacity-50 transform rotate-12 bg-black bg-opacity-30 px-2 py-1 rounded">
                    DEMO
                  </div>
                  <div className="absolute bottom-4 right-4 text-white text-lg font-bold opacity-50 transform -rotate-12 bg-black bg-opacity-30 px-2 py-1 rounded">
                    DEMO
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}