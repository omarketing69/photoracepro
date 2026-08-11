import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Calendar, MapPin, Users, Images, Camera, ArrowLeft, ShoppingCart, Eye, X, ChevronRight, ChevronLeft, Search as SearchIcon, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Link } from "wouter";
import { ThumbnailImage } from "@/components/ThumbnailImage";
import { DownloadCodeInput } from "@/components/download-code-input";
import NequiPaymentInstructions from "@/components/nequi-payment-instructions";

interface Photo {
  id: number;
  filename: string;
  webPath?: string;
  thumbnailPath?: string;
  detectedDorsals?: number[];
}

interface EventWithPhotos {
  id: number;
  name: string;
  date: string;
  location: string;
  expectedParticipants: number;
  status: string;
  freePhotosEnabled: boolean;
  freePhotosEnabledAt?: string;
  photoCount: number;
}

interface FaceMatch {
  photoId: number;
  filename: string;
  originalPath: string;
  webPath?: string;
  thumbnailPath?: string;
  detectedDorsals: number[];
  similarity: number;
  isFreeEvent?: boolean;
}

interface FaceSearchResult {
  matches: FaceMatch[];
  totalMatches: number;
  photosScanned: number;
  photosWithFaceData: number;
  selfieFacesFound: number;
  isFreeEvent: boolean;
  isRelaxed?: boolean;
}

export default function Search() {
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [selectedDorsal, setSelectedDorsal] = useState<number | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<Photo | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [showDownloadCodeModal, setShowDownloadCodeModal] = useState(false);
  const [selectedPhotoForCode, setSelectedPhotoForCode] = useState<Photo | null>(null);
  const DORSALS_PER_PAGE = 100;

  // Selfie search state
  const [selfieModalOpen, setSelfieModalOpen] = useState(false);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [faceSearchLoading, setFaceSearchLoading] = useState(false);
  const [faceSearchResult, setFaceSearchResult] = useState<FaceSearchResult | null>(null);
  const [faceSearchError, setFaceSearchError] = useState<string | null>(null);
  const [faceSearchNeedsLogin, setFaceSearchNeedsLogin] = useState(false);
  const [showFaceResults, setShowFaceResults] = useState(false);
  const selfieInputRef = useRef<HTMLInputElement>(null);

  const { data: events, isLoading: eventsLoading } = useQuery<EventWithPhotos[]>({
    queryKey: ["/api/events/all-with-photos"],
    staleTime: 0,
    gcTime: 0,
  });

  useEffect(() => {
    console.log(`🔍 [DEBUG] Events loading: ${eventsLoading}`);
    console.log(`🔍 [DEBUG] Events count: ${events?.length || 0}`);
  }, [events, eventsLoading]);

  const { data: dorsals, isLoading: dorsalsLoading, error: dorsalsError } = useQuery<number[]>({
    queryKey: [`/api/events/${selectedEventId}/dorsals/all`, selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const response = await fetch(`/api/events/${selectedEventId}/dorsals/all`);
      if (!response.ok) throw new Error('Failed to fetch dorsals');
      return response.json();
    },
    enabled: !!(selectedEventId && !isNaN(selectedEventId) && selectedEventId > 0),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
  });

  const { data: photos, isLoading: photosLoading } = useQuery<Photo[]>({
    queryKey: [`/api/events/${selectedEventId}/photos/${selectedDorsal}/all`, selectedEventId, selectedDorsal],
    enabled: !!(selectedEventId && selectedDorsal && !isNaN(selectedEventId) && !isNaN(selectedDorsal) && selectedEventId > 0 && selectedDorsal > 0),
  });

  useEffect(() => {
    if (selectedEventId) {
      setCurrentPage(1);
      setSelectedDorsal(null);
      setSelectedPhotos([]);
      setFaceSearchResult(null);
      setShowFaceResults(false);
      localStorage.removeItem('selectedPhotoIds');
      localStorage.removeItem('eventId');
      localStorage.removeItem('dorsalNumber');
      localStorage.removeItem('userInfo');
      queryClient.clear();
    }
  }, [selectedEventId]);

  const togglePhotoSelection = (photoId: number) => {
    setSelectedPhotos(prev =>
      prev.includes(photoId) ? prev.filter(id => id !== photoId) : [...prev, photoId]
    );
  };

  const selectAllPhotos = () => {
    if (photos) setSelectedPhotos(photos.map((p: Photo) => p.id));
  };

  const clearSelection = () => setSelectedPhotos([]);

  const selectedEvent = events?.find((e: EventWithPhotos) => e.id === selectedEventId);

  // Selfie modal helpers
  const openSelfieModal = () => {
    setSelfieFile(null);
    setSelfiePreview(null);
    setFaceSearchError(null);
    setFaceSearchNeedsLogin(false);
    setSelfieModalOpen(true);
  };

  const handleSelfieSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelfieFile(file);
    setFaceSearchError(null);
    setSelfiePreview(URL.createObjectURL(file));
  };

  const handleFaceSearch = async (relaxed = false) => {
    if (!selfieFile || !selectedEventId) return;
    setFaceSearchLoading(true);
    setFaceSearchError(null);
    try {
      const formData = new FormData();
      formData.append('selfie', selfieFile);
      const url = `/api/events/${selectedEventId}/search-by-face${relaxed ? '?relaxed=true' : ''}`;

      // Attach auth token if athlete or admin is logged in
      const headers: HeadersInit = {};
      try {
        const athleteToken = localStorage.getItem('authToken');
        if (athleteToken) {
          headers['Authorization'] = `Bearer ${athleteToken}`;
        } else {
          const adminStr = localStorage.getItem('race_photo_user');
          if (adminStr) {
            const admin = JSON.parse(adminStr);
            if (admin?.token) headers['Authorization'] = `Bearer ${admin.token}`;
          }
        }
      } catch { /* ignore localStorage errors */ }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });
      const data: FaceSearchResult = await response.json();
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setFaceSearchNeedsLogin(true);
          setFaceSearchError('Este evento requiere iniciar sesión para buscar fotos.');
        } else {
          setFaceSearchError((data as { error?: string }).error || 'Error al buscar por cara');
        }
      } else {
        setFaceSearchResult(data);
        if (data.totalMatches > 0) {
          setSelfieModalOpen(false);
          setShowFaceResults(true);
          setSelectedDorsal(null);
        }
      }
    } catch {
      setFaceSearchError('Error de conexión. Intenta de nuevo.');
    } finally {
      setFaceSearchLoading(false);
    }
  };

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
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Camera className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 mr-2" />
              <span className="text-lg sm:text-xl font-bold text-gray-900">photoracepro.com</span>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <Link href="/">
                <Button variant="ghost" className="text-gray-600 hover:text-gray-900 text-sm sm:text-base" data-testid="button-home">
                  <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Volver al Inicio</span>
                  <span className="sm:hidden">Inicio</span>
                </Button>
              </Link>
              <Link href="/free-photos-fixed">
                <Button variant="outline" className="text-sm sm:text-base" data-testid="button-free-photos">
                  <span className="hidden sm:inline">Fotos Gratuitas</span>
                  <span className="sm:hidden">Gratis</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div className="text-center sm:text-left">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Buscar Fotos de Carrera</h1>
              <p className="text-sm sm:text-base text-gray-600">Selecciona un evento y explora las fotos disponibles</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!events || events.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Images className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-600">No hay eventos con fotos disponibles en este momento</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Events and Dorsals */}
            <div className="space-y-6">
              {/* Events */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Calendar className="mr-2 h-5 w-5" />
                    Eventos Disponibles
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {events.map((event: EventWithPhotos) => (
                    <div
                      key={event.id}
                      className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                        selectedEventId === event.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedEventId(event.id)}
                      data-testid={`event-card-${event.id}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-gray-900">{event.name}</h3>
                        <div className="flex items-center space-x-2">
                          {event.freePhotosEnabled ? (
                            <Badge variant="secondary">GRATIS</Badge>
                          ) : (
                            <Badge variant="outline">PAGO</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center text-sm text-gray-600 space-x-4">
                        <div className="flex items-center">
                          <Calendar className="mr-1 h-3 w-3" />
                          {new Date(event.date).toLocaleDateString()}
                        </div>
                        <div className="flex items-center">
                          <MapPin className="mr-1 h-3 w-3" />
                          {event.location}
                        </div>
                        <div className="flex items-center">
                          <Images className="mr-1 h-3 w-3" />
                          {event.photoCount} fotos
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Payment Instructions for Paid Events */}
              {selectedEventId && selectedEvent && !selectedEvent.freePhotosEnabled && (
                <NequiPaymentInstructions collapsed={true} showTitle={false} className="mb-6" />
              )}

              {/* Dorsals + selfie search button */}
              {selectedEventId && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Users className="mr-2 h-5 w-5" />
                        Dorsales Disponibles
                        {selectedEvent && !selectedEvent.freePhotosEnabled && (
                          <Badge variant="outline" className="ml-2">Requiere pago</Badge>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={openSelfieModal}
                        className="flex items-center gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50"
                      >
                        <Camera className="h-4 w-4" />
                        Buscar por mi foto
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {dorsalsLoading ? (
                      <div className="text-center text-gray-600">Cargando dorsales...</div>
                    ) : dorsals && dorsals.length > 0 ? (
                      <div>
                        <div className="text-sm text-gray-600 mb-3">
                          Total de dorsales: {dorsals.length}
                        </div>
                        <div className="grid grid-cols-5 gap-2 mb-4">
                          {dorsals
                            .slice((currentPage - 1) * DORSALS_PER_PAGE, currentPage * DORSALS_PER_PAGE)
                            .map((dorsal: number | { id: number }) => {
                              const dorsalNumber = typeof dorsal === 'object' && dorsal && 'id' in dorsal ? dorsal.id : dorsal as number;
                              const dorsalDisplay = String(dorsalNumber);
                              return (
                                <button
                                  key={dorsalDisplay}
                                  onClick={() => {
                                    setSelectedDorsal(typeof dorsalNumber === 'number' ? dorsalNumber : parseInt(dorsalDisplay) || 0);
                                    setShowFaceResults(false);
                                  }}
                                  className={`p-2 rounded-md border text-sm font-medium transition-colors ${
                                    selectedDorsal === dorsalNumber
                                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                                      : 'border-gray-200 hover:border-gray-300'
                                  }`}
                                  data-testid={`dorsal-button-${dorsalDisplay}`}
                                >
                                  {dorsalDisplay}
                                </button>
                              );
                            })}
                        </div>
                        {dorsals.length > DORSALS_PER_PAGE && (
                          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                            <div className="text-xs text-gray-500">
                              Mostrando {((currentPage - 1) * DORSALS_PER_PAGE) + 1}–{Math.min(currentPage * DORSALS_PER_PAGE, dorsals.length)} de {dorsals.length}
                            </div>
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="outline" size="sm"
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="h-8 px-3"
                                data-testid="button-prev-page"
                              >
                                <ChevronLeft className="h-3 w-3 mr-1" />Anterior
                              </Button>
                              <span className="text-sm text-gray-600" data-testid="text-pagination">
                                {currentPage} de {Math.ceil(dorsals.length / DORSALS_PER_PAGE)}
                              </span>
                              <Button
                                variant="outline" size="sm"
                                onClick={() => setCurrentPage(prev => Math.min(Math.ceil(dorsals.length / DORSALS_PER_PAGE), prev + 1))}
                                disabled={currentPage === Math.ceil(dorsals.length / DORSALS_PER_PAGE)}
                                className="h-8 px-3"
                                data-testid="button-next-page"
                              >
                                Siguiente<ChevronRight className="h-3 w-3 ml-1" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center text-gray-600">
                        No hay dorsales disponibles
                        {selectedEventId && (
                          <div className="text-xs mt-2 text-red-500">
                            DEBUG: Event ID {selectedEventId}, Loading: {dorsalsLoading ? 'true' : 'false'}, Error: {dorsalsError?.message || 'none'}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Photos Grid */}
            <div className="lg:col-span-1">
              {/* Face search results */}
              {showFaceResults && faceSearchResult && faceSearchResult.matches.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Camera className="mr-2 h-5 w-5" />
                        Mis Fotos ({faceSearchResult.totalMatches})
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedPhotos.length > 0 && selectedEvent && !selectedEvent.freePhotosEnabled && (
                          <Button
                            className="bg-green-600 hover:bg-green-700 text-white"
                            size="sm"
                            onClick={() => {
                              localStorage.setItem('selectedPhotoIds', JSON.stringify(selectedPhotos));
                              localStorage.setItem('eventId', selectedEventId?.toString() || '');
                              localStorage.setItem('dorsalNumber', String(faceSearchResult.matches.find(m => selectedPhotos.includes(m.photoId))?.detectedDorsals[0] || ''));
                              localStorage.setItem('userInfo', JSON.stringify({ name: '', email: '', dorsalNumber: '' }));
                              window.location.href = `/photo-purchase?eventId=${selectedEventId}`;
                            }}
                          >
                            <ShoppingCart className="mr-1 h-3 w-3" />
                            Comprar ({selectedPhotos.length})
                          </Button>
                        )}
                        <Button
                          size="sm" variant="ghost"
                          onClick={() => setShowFaceResults(false)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500 mb-3">
                      Revisé {faceSearchResult.photosScanned.toLocaleString()} fotos — encontré {faceSearchResult.totalMatches} que parecen ser tuyas
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[32rem] overflow-y-auto">
                      {faceSearchResult.matches.map((match) => (
                        <div
                          key={match.photoId}
                          className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-colors ${
                            selectedPhotos.includes(match.photoId) && !selectedEvent?.freePhotosEnabled
                              ? 'border-green-500'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => {
                            if (selectedEvent?.freePhotosEnabled) {
                              setPreviewPhoto({ id: match.photoId, filename: match.filename, detectedDorsals: match.detectedDorsals });
                            } else {
                              togglePhotoSelection(match.photoId);
                            }
                          }}
                        >
                          <ThumbnailImage
                            filename={match.filename}
                            photoId={match.photoId}
                            alt="Foto encontrada"
                            className="w-full h-32 object-cover"
                          />
                          {/* Similarity badge */}
                          <div className="absolute top-1 right-1">
                            <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded font-bold">
                              {match.similarity}%
                            </span>
                          </div>
                          {/* Selection indicator for paid events */}
                          {selectedPhotos.includes(match.photoId) && !selectedEvent?.freePhotosEnabled && (
                            <div className="absolute top-1 left-1 bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                          {/* Watermark for paid */}
                          {!selectedEvent?.freePhotosEnabled && (
                            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                              <div className="text-white text-xs font-bold opacity-60 transform -rotate-45 bg-black bg-opacity-30 px-2 py-0.5 rounded">
                                VISTA PREVIA
                              </div>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity pointer-events-none" />
                        </div>
                      ))}
                    </div>
                    {!selectedEvent?.freePhotosEnabled && (
                      <p className="text-xs text-gray-400 mt-3 text-center">
                        Haz clic en las fotos para seleccionarlas y luego presiona Comprar
                      </p>
                    )}
                  </CardContent>
                </Card>

              ) : selectedEventId && selectedDorsal ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Images className="mr-2 h-5 w-5" />
                        Fotos del Dorsal {selectedDorsal}
                      </div>
                      {photos && photos.length > 0 && selectedEvent && (
                        <div className="flex items-center space-x-2">
                          {!selectedEvent.freePhotosEnabled && (
                            <>
                              <Button
                                variant="outline" size="sm"
                                onClick={selectAllPhotos}
                                disabled={selectedPhotos.length === photos.length}
                                data-testid="button-select-all"
                              >
                                Seleccionar Todas
                              </Button>
                              <Button
                                variant="outline" size="sm"
                                onClick={clearSelection}
                                disabled={selectedPhotos.length === 0}
                                data-testid="button-clear-selection"
                              >
                                Limpiar
                              </Button>
                              {selectedPhotos.length > 0 && (
                                <Button
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                  size="sm"
                                  onClick={() => {
                                    localStorage.setItem('selectedPhotoIds', JSON.stringify(selectedPhotos));
                                    localStorage.setItem('eventId', selectedEventId?.toString() || '');
                                    localStorage.setItem('dorsalNumber', selectedDorsal?.toString() || '');
                                    localStorage.setItem('userInfo', JSON.stringify({ name: '', email: '', dorsalNumber: selectedDorsal?.toString() || '' }));
                                    window.location.href = `/photo-purchase?dorsal=${selectedDorsal}&eventId=${selectedEventId}`;
                                  }}
                                  data-testid="button-purchase"
                                >
                                  <ShoppingCart className="mr-2 h-4 w-4" />
                                  Comprar ({selectedPhotos.length})
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {photosLoading ? (
                      <div className="text-center text-gray-600">Cargando fotos...</div>
                    ) : photos && photos.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {photos.map((photo: Photo) => (
                          <Card
                            key={photo.id}
                            className={`overflow-hidden cursor-pointer border-2 transition-colors ${
                              selectedPhotos.includes(photo.id) && !selectedEvent?.freePhotosEnabled
                                ? 'border-green-500 bg-green-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                            onClick={() => {
                              if (selectedEvent?.freePhotosEnabled) {
                                setPreviewPhoto(photo);
                              } else {
                                togglePhotoSelection(photo.id);
                              }
                            }}
                            data-testid={`photo-card-${photo.id}`}
                          >
                            <CardContent className="p-0">
                              <div className="aspect-[3/4] relative">
                                <ThumbnailImage
                                  filename={photo.filename}
                                  photoId={photo.id}
                                  alt="Foto del evento"
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.src = `/api/photos/${photo.id}/original`;
                                  }}
                                />
                                {!selectedEvent?.freePhotosEnabled && (
                                  <div className="absolute inset-0 pointer-events-none select-none">
                                    <div className="absolute inset-0 flex items-center justify-center">
                                      <div className="text-white text-xs font-bold opacity-70 transform -rotate-45 bg-black bg-opacity-40 px-2 py-1 rounded">
                                        VISTA PREVIA
                                      </div>
                                    </div>
                                  </div>
                                )}
                                {selectedPhotos.includes(photo.id) && !selectedEvent?.freePhotosEnabled && (
                                  <div className="absolute top-2 left-2 bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  </div>
                                )}
                                {selectedEvent?.freePhotosEnabled && (
                                  <div className="absolute bottom-2 right-2">
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const downloadUrl = `/api/free-photos/download/${photo.filename}`;
                                        const link = document.createElement('a');
                                        link.href = downloadUrl;
                                        link.download = photo.filename;
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                      }}
                                      className="bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-1"
                                      data-testid={`button-download-${photo.id}`}
                                    >
                                      Descargar
                                    </Button>
                                  </div>
                                )}
                                {!selectedEvent?.freePhotosEnabled && (
                                  <div className="absolute bottom-2 right-2">
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setPreviewPhoto(photo);
                                      }}
                                      className="opacity-75 hover:opacity-100"
                                      data-testid={`button-preview-${photo.id}`}
                                    >
                                      <Eye className="h-3 w-3" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                              <div className="p-2">
                                <p className="text-sm text-gray-600 truncate">{photo.filename}</p>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center text-gray-600 py-8">
                        <Images className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                        <p>No se encontraron fotos para este dorsal</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

              ) : selectedEventId ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-gray-600 mb-4">Selecciona un dorsal para ver las fotos</p>
                    <Button variant="outline" onClick={openSelfieModal} className="text-blue-600 border-blue-200">
                      <Camera className="h-4 w-4 mr-2" />
                      O busca por tu foto
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-gray-600">Selecciona un evento para comenzar</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Selfie Search Modal ── */}
      {selfieModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Buscar por mi foto</h3>
                <p className="text-sm text-gray-500">
                  {selectedEvent?.freePhotosEnabled
                    ? 'Súbete una selfie y te encontramos en las fotos gratuitas'
                    : 'Súbete una selfie y te encontramos en las fotos del evento'}
                </p>
              </div>
              <button onClick={() => setSelfieModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                  selfiePreview ? 'border-blue-300 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                }`}
                onClick={() => selfieInputRef.current?.click()}
              >
                {selfiePreview ? (
                  <div className="space-y-3">
                    <img
                      src={selfiePreview}
                      alt="Tu selfie"
                      className="mx-auto h-36 w-36 object-cover rounded-full border-4 border-blue-200 shadow"
                    />
                    <p className="text-sm text-blue-600 font-medium">Foto cargada — haz clic para cambiar</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="mx-auto h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center">
                      <Camera className="h-8 w-8 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-700">Toca para subir tu foto</p>
                      <p className="text-xs text-gray-500 mt-1">En móvil abrirá la cámara directamente</p>
                      <p className="text-xs text-gray-400">JPG, PNG o HEIC — mira de frente, sin gafas</p>
                    </div>
                  </div>
                )}
              </div>

              <input
                ref={selfieInputRef}
                type="file"
                accept="image/*,.heic,.heif"
                capture="user"
                className="hidden"
                onChange={handleSelfieSelect}
              />

              {faceSearchError && (
                <div className="flex flex-col space-y-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-red-600">{faceSearchError}</p>
                  </div>
                  {faceSearchNeedsLogin && (
                    <Link href={`/athlete-login?returnTo=/search`}>
                      <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                        Iniciar sesión como atleta
                      </Button>
                    </Link>
                  )}
                </div>
              )}

              {faceSearchResult && faceSearchResult.totalMatches === 0 && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                  <p className="font-semibold">No encontré fotos tuyas</p>
                  <p className="text-xs mt-1 opacity-75">
                    Revisé {faceSearchResult.photosScanned.toLocaleString()} fotos.
                    {faceSearchResult.photosWithFaceData === 0
                      ? ' El procesamiento facial aún no está completo para este evento.'
                      : ' Intenta con otra foto más clara o prueba la búsqueda ampliada.'}
                  </p>
                  {faceSearchResult.photosWithFaceData > 0 && !faceSearchResult.isRelaxed && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 w-full text-yellow-800 border-yellow-400 hover:bg-yellow-100"
                      onClick={() => handleFaceSearch(true)}
                      disabled={faceSearchLoading}
                    >
                      {faceSearchLoading ? (
                        <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Buscando...</>
                      ) : (
                        <>Buscar con criterio ampliado</>
                      )}
                    </Button>
                  )}
                </div>
              )}

              <Button
                onClick={() => handleFaceSearch(false)}
                disabled={!selfieFile || faceSearchLoading}
                className="w-full"
                size="lg"
              >
                {faceSearchLoading ? (
                  <><Loader2 className="h-5 w-5 mr-2 animate-spin" />Buscando tus fotos...</>
                ) : (
                  <><SearchIcon className="h-5 w-5 mr-2" />Buscar mis fotos</>
                )}
              </Button>

              <p className="text-xs text-gray-400 text-center">
                Usamos reconocimiento facial de Google para comparar tu cara con las fotos del evento.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Photo Preview Dialog */}
      {previewPhoto && (
        <Dialog open={true} onOpenChange={() => setPreviewPhoto(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto" data-testid="dialog-preview">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>Vista previa - {previewPhoto.filename}</span>
                <Button
                  variant="ghost" size="sm"
                  onClick={() => setPreviewPhoto(null)}
                  data-testid="button-close-preview"
                >
                  <X className="h-4 w-4" />
                </Button>
              </DialogTitle>
            </DialogHeader>
            <div className="flex justify-center">
              <img
                src={`/api/photos/${previewPhoto.id}/original`}
                alt="Vista previa"
                className="max-w-full max-h-[60vh] object-contain"
                data-testid="img-preview"
              />
            </div>
            <div className="flex justify-center space-x-4 pt-4">
              {selectedEvent?.freePhotosEnabled ? (
                <Button
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = `/api/free-photos/download/${previewPhoto.filename}`;
                    link.download = previewPhoto.filename;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white"
                  data-testid="button-download-preview"
                >
                  Descargar Gratis
                </Button>
              ) : (
                <>
                  <Button
                    onClick={() => {
                      setSelectedPhotoForCode(previewPhoto);
                      setShowDownloadCodeModal(true);
                      setPreviewPhoto(null);
                    }}
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                    data-testid="button-download-code-preview"
                  >
                    Descargar con Código
                  </Button>
                  <Button
                    onClick={() => {
                      togglePhotoSelection(previewPhoto.id);
                      setPreviewPhoto(null);
                    }}
                    variant={selectedPhotos.includes(previewPhoto.id) ? "destructive" : "default"}
                    data-testid="button-select-preview"
                  >
                    {selectedPhotos.includes(previewPhoto.id) ? 'Quitar de selección' : 'Añadir a selección'}
                  </Button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Download Code Modal */}
      {showDownloadCodeModal && selectedPhotoForCode && selectedEventId && selectedDorsal && (
        <DownloadCodeInput
          isOpen={showDownloadCodeModal}
          onClose={() => {
            setShowDownloadCodeModal(false);
            setSelectedPhotoForCode(null);
          }}
          eventId={selectedEventId}
          dorsalNumber={selectedDorsal}
          filename={selectedPhotoForCode.filename}
          photoName={selectedPhotoForCode.filename}
        />
      )}
    </div>
  );
}
