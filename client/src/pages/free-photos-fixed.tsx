import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, MapPin, Images, Download, Eye, ChevronRight, X, ChevronLeft, Camera, Search, Loader2, AlertCircle, Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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

interface FaceSearchMatch {
  photoId: number;
  filename: string;
  originalPath: string;
  webPath?: string;
  thumbnailPath?: string;
  detectedDorsals: number[];
  similarity: number;
}

interface FaceSearchResult {
  matches: FaceSearchMatch[];
  totalMatches: number;
  photosScanned: number;
  photosWithFaceData: number;
  selfieFacesFound: number;
  isRelaxed?: boolean;
}

type PreviewPhoto = { id: number; filename: string; detectedDorsals: number[]; similarity?: number };

export default function FreePhotosFixed() {
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [selectedDorsal, setSelectedDorsal] = useState<number | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<PreviewPhoto | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Selfie modal state
  const [selfieModalOpen, setSelfieModalOpen] = useState(false);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [faceSearchLoading, setFaceSearchLoading] = useState(false);
  const [relaxedSearchLoading, setRelaxedSearchLoading] = useState(false);
  const [faceSearchResult, setFaceSearchResult] = useState<FaceSearchResult | null>(null);
  const [faceSearchError, setFaceSearchError] = useState<string | null>(null);
  const [relaxedSearchError, setRelaxedSearchError] = useState<string | null>(null);
  const [showFaceResults, setShowFaceResults] = useState(false);
  const [showNoResults, setShowNoResults] = useState(false);
  const selfieInputRef = useRef<HTMLInputElement>(null);

  const DORSALS_PER_PAGE = 100;

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

  useEffect(() => {
    if (selectedEventId) {
      setCurrentPage(1);
      setSelectedDorsal(null);
      setFaceSearchResult(null);
      setShowFaceResults(false);
      setShowNoResults(false);
      setRelaxedSearchError(null);
    }
  }, [selectedEventId]);

  const openSelfieModal = () => {
    setSelfieFile(null);
    setSelfiePreview(null);
    setFaceSearchError(null);
    setSelfieModalOpen(true);
  };

  const closeSelfieModal = () => {
    setSelfieModalOpen(false);
  };

  const handleSelfieSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelfieFile(file);
    setFaceSearchError(null);
    const url = URL.createObjectURL(file);
    setSelfiePreview(url);
  };

  const handleFaceSearch = async () => {
    if (!selfieFile || !selectedEventId) return;
    setFaceSearchLoading(true);
    setFaceSearchError(null);
    setShowNoResults(false);
    try {
      const formData = new FormData();
      formData.append('selfie', selfieFile);
      const response = await fetch(`/api/free-events/${selectedEventId}/search-by-face`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        setFaceSearchError(data.error || 'Error al buscar por cara');
      } else {
        setFaceSearchResult(data);
        if (data.totalMatches > 0) {
          setSelfieModalOpen(false);
          setShowFaceResults(true);
          setShowNoResults(false);
          setSelectedDorsal(null);
        } else {
          // Close modal and show no-results panel with tips
          setSelfieModalOpen(false);
          setShowNoResults(true);
          setShowFaceResults(false);
        }
      }
    } catch {
      setFaceSearchError('Error de conexión. Intenta de nuevo.');
    } finally {
      setFaceSearchLoading(false);
    }
  };

  const handleRelaxedSearch = async () => {
    if (!selfieFile || !selectedEventId) return;
    setRelaxedSearchLoading(true);
    setRelaxedSearchError(null);
    try {
      const formData = new FormData();
      formData.append('selfie', selfieFile);
      const response = await fetch(`/api/free-events/${selectedEventId}/search-by-face?relaxed=true`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        setRelaxedSearchError(data.error || 'Error al ampliar la búsqueda. Intenta de nuevo.');
      } else {
        setFaceSearchResult(data);
        if (data.totalMatches > 0) {
          setShowFaceResults(true);
          setShowNoResults(false);
          setSelectedDorsal(null);
        }
        // If still 0, leave the no-results panel visible — isRelaxed flag on result
        // drives the "también probé con criterios más amplios" message
      }
    } catch {
      setRelaxedSearchError('Error de conexión. Intenta de nuevo.');
    } finally {
      setRelaxedSearchLoading(false);
    }
  };

  if (eventsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-gray-600">Cargando eventos...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div className="text-center sm:text-left">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Fotos Gratuitas</h1>
              <p className="text-sm sm:text-base text-gray-600">Descubre fotos de eventos anteriores disponibles sin costo</p>
            </div>
            <Button variant="outline" onClick={() => window.location.href = '/'} className="w-full sm:w-auto">
              Volver al Inicio
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!freeEvents || freeEvents.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Images className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-600">No hay eventos con fotos gratuitas disponibles en este momento</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left: Events + Dorsals */}
            <div className="space-y-6">
              {/* Events list */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Calendar className="mr-2 h-5 w-5" />
                    Eventos Disponibles
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {freeEvents.map((event) => (
                    <div
                      key={event.id}
                      className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                        selectedEventId === event.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => {
                        setSelectedEventId(event.id);
                        setSelectedDorsal(null);
                        setShowFaceResults(false);
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-gray-900">{event.name}</h3>
                        <Badge variant="secondary">GRATIS</Badge>
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
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Dorsals + selfie search trigger */}
              {selectedEventId && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center text-base">
                        Dorsales Disponibles
                      </span>
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
                      <div className="text-center text-gray-600 py-4">Cargando dorsales...</div>
                    ) : dorsals && dorsals.length > 0 ? (
                      <div>
                        <div className="text-sm text-gray-600 mb-3">
                          Total: <span className="font-semibold">{dorsals.length}</span> dorsales
                        </div>
                        <div className="grid grid-cols-5 gap-2 mb-4">
                          {dorsals
                            .slice((currentPage - 1) * DORSALS_PER_PAGE, currentPage * DORSALS_PER_PAGE)
                            .map((dorsal) => (
                              <button
                                key={dorsal}
                                onClick={() => {
                                  setSelectedDorsal(dorsal);
                                  setShowFaceResults(false);
                                  setShowNoResults(false);
                                }}
                                className={`p-2 rounded-md border text-sm font-medium transition-colors ${
                                  selectedDorsal === dorsal
                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                {dorsal}
                              </button>
                            ))}
                        </div>
                        {dorsals.length > DORSALS_PER_PAGE && (
                          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                            <div className="text-xs text-gray-500">
                              {((currentPage - 1) * DORSALS_PER_PAGE) + 1}–{Math.min(currentPage * DORSALS_PER_PAGE, dorsals.length)} de {dorsals.length}
                            </div>
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="outline" size="sm"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="h-8 px-3"
                              >
                                <ChevronLeft className="h-3 w-3 mr-1" />Anterior
                              </Button>
                              <span className="text-sm text-gray-600">
                                {currentPage} / {Math.ceil(dorsals.length / DORSALS_PER_PAGE)}
                              </span>
                              <Button
                                variant="outline" size="sm"
                                onClick={() => setCurrentPage(p => Math.min(Math.ceil(dorsals.length / DORSALS_PER_PAGE), p + 1))}
                                disabled={currentPage === Math.ceil(dorsals.length / DORSALS_PER_PAGE)}
                                className="h-8 px-3"
                              >
                                Siguiente<ChevronRight className="h-3 w-3 ml-1" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center text-gray-600 py-4">No hay dorsales disponibles</div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right: Photo results */}
            <div className="lg:col-span-1">
              {showFaceResults && faceSearchResult && faceSearchResult.matches.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Camera className="mr-2 h-5 w-5" />
                        Mis Fotos ({faceSearchResult.totalMatches})
                        {faceSearchResult.isRelaxed && (
                          <span className="ml-2 text-xs font-normal text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">búsqueda ampliada</span>
                        )}
                      </div>
                      <Button
                        size="sm" variant="ghost"
                        onClick={() => setShowFaceResults(false)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500 mb-3">
                      Revisé {faceSearchResult.photosScanned.toLocaleString()} fotos — encontré {faceSearchResult.totalMatches} que parecen ser tuyas
                    </p>
                    <div className="grid grid-cols-3 gap-3 max-h-[32rem] overflow-y-auto">
                      {faceSearchResult.matches.map((match) => (
                        <div
                          key={match.photoId}
                          className="relative group cursor-pointer"
                          onClick={() => setPreviewPhoto({ id: match.photoId, filename: match.filename, detectedDorsals: match.detectedDorsals, similarity: match.similarity })}
                        >
                          <img
                            src={match.thumbnailPath ? `/api/thumbnails/${match.filename}` : `/api/images/${match.filename}`}
                            alt="Foto encontrada"
                            className="w-full h-32 object-cover rounded-lg border border-gray-200"
                          />
                          <div className="absolute top-1 right-1">
                            <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded font-bold">
                              {match.similarity}%
                            </span>
                          </div>
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-opacity rounded-lg flex items-center justify-center pointer-events-none">
                            <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <div className="absolute inset-0 pointer-events-none select-none flex items-center justify-center">
                            <div className="text-white text-xs font-bold opacity-60 transform -rotate-45 bg-black bg-opacity-30 px-2 py-0.5 rounded">
                              GRATIS
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

              ) : showNoResults && faceSearchResult ? (
                <Card className="border-amber-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between text-amber-700">
                      <div className="flex items-center">
                        <Camera className="mr-2 h-5 w-5" />
                        No encontré fotos tuyas
                      </div>
                      <Button
                        size="sm" variant="ghost"
                        onClick={() => setShowNoResults(false)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-gray-600">
                      Revisé <span className="font-semibold">{faceSearchResult.photosScanned.toLocaleString()}</span> fotos.{" "}
                      {faceSearchResult.photosWithFaceData === 0
                        ? 'El procesamiento facial aún no está completo para este evento.'
                        : 'No encontré una coincidencia suficientemente cercana con tu foto.'}
                    </p>

                    {/* Tips box */}
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
                      <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm mb-1">
                        <Lightbulb className="h-4 w-4" />
                        Consejos para mejores resultados
                      </div>
                      <ul className="text-sm text-amber-700 space-y-1.5 list-none">
                        <li className="flex items-start gap-1.5"><span>📷</span> Usa una foto donde tu cara esté de frente y bien iluminada</li>
                        <li className="flex items-start gap-1.5"><span>🕶️</span> Quítate las gafas de sol antes de tomarte la selfie</li>
                        <li className="flex items-start gap-1.5"><span>🏃</span> Las fotos de carrera pueden tener ángulos difíciles — intenta con varias selfies</li>
                        <li className="flex items-start gap-1.5"><span>💡</span> Busca buena iluminación, evita contraluz o sombras fuertes</li>
                        <li className="flex items-start gap-1.5"><span>🔢</span> También puedes buscar por tu número de dorsal en la lista de la izquierda</li>
                      </ul>
                    </div>

                    <div className="flex flex-col gap-2">
                      {relaxedSearchError && (
                        <div className="flex items-start space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-red-600">{relaxedSearchError}</p>
                        </div>
                      )}
                      {!faceSearchResult.isRelaxed && (
                        <Button
                          onClick={handleRelaxedSearch}
                          disabled={relaxedSearchLoading || !selfieFile}
                          variant="outline"
                          className="w-full border-blue-300 text-blue-700 hover:bg-blue-50"
                        >
                          {relaxedSearchLoading ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Buscando con criterios más amplios...</>
                          ) : (
                            <><Search className="h-4 w-4 mr-2" />Mostrar más resultados (búsqueda ampliada)</>
                          )}
                        </Button>
                      )}
                      {faceSearchResult.isRelaxed && faceSearchResult.totalMatches === 0 && (
                        <p className="text-xs text-center text-gray-500">
                          También probé con criterios más amplios y no encontré coincidencias.
                        </p>
                      )}
                      <Button
                        onClick={openSelfieModal}
                        className="w-full"
                      >
                        <Camera className="h-4 w-4 mr-2" />
                        Intentar con otra foto
                      </Button>
                    </div>
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
                      {photos && photos.length > 0 && (
                        <Button
                          size="sm" variant="outline"
                          onClick={async () => {
                            for (const photo of photos) {
                              const link = document.createElement('a');
                              link.href = `/api/free-photos/download/${photo.filename}`;
                              link.download = photo.filename;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                              await new Promise(r => setTimeout(r, 800));
                            }
                          }}
                        >
                          <Download className="mr-1 h-3 w-3" />Descargar Todas
                        </Button>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    {photosLoading ? (
                      <div className="text-center text-gray-600 py-8">Cargando fotos...</div>
                    ) : photos && photos.length > 0 ? (
                      <div className="grid grid-cols-3 gap-3 max-h-[32rem] overflow-y-auto">
                        {photos.map((photo) => (
                          <div
                            key={photo.id}
                            className="relative group cursor-pointer"
                            onClick={() => setPreviewPhoto({ id: photo.id, filename: photo.filename, detectedDorsals: photo.detectedDorsals })}
                          >
                            <img
                              src={photo.thumbnailPath ? `/api/thumbnails/${photo.filename}` : `/api/images/${photo.filename}`}
                              alt="Foto gratuita"
                              className="w-full h-32 object-cover rounded-lg border border-gray-200"
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-opacity rounded-lg flex items-center justify-center pointer-events-none">
                              <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <div className="absolute inset-0 pointer-events-none select-none flex items-center justify-center">
                              <div className="text-white text-xs font-bold opacity-60 transform -rotate-45 bg-black bg-opacity-30 px-2 py-0.5 rounded">
                                GRATIS
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center text-gray-600 py-8">No hay fotos disponibles para este dorsal</div>
                    )}
                  </CardContent>
                </Card>

              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Images className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-gray-600 mb-4">
                      {!selectedEventId
                        ? 'Selecciona un evento para comenzar'
                        : 'Selecciona un dorsal para ver las fotos'}
                    </p>
                    {selectedEventId && (
                      <Button variant="outline" onClick={openSelfieModal} className="text-blue-600 border-blue-200">
                        <Camera className="h-4 w-4 mr-2" />
                        Buscar por mi foto
                      </Button>
                    )}
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
            {/* Modal header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Buscar por mi foto</h3>
                <p className="text-sm text-gray-500">Súbete una selfie y te encontramos en las fotos</p>
              </div>
              <button onClick={closeSelfieModal} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal body */}
            <div className="p-6 space-y-4">
              {/* Selfie upload zone */}
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

              {/* Hidden file input — capture="user" for selfie camera on mobile */}
              <input
                ref={selfieInputRef}
                type="file"
                accept="image/*,.heic,.heif"
                capture="user"
                className="hidden"
                onChange={handleSelfieSelect}
              />

              {faceSearchError && (
                <div className="flex items-start space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-600">{faceSearchError}</p>
                </div>
              )}

              <Button
                onClick={handleFaceSearch}
                disabled={!selfieFile || faceSearchLoading}
                className="w-full"
                size="lg"
              >
                {faceSearchLoading ? (
                  <><Loader2 className="h-5 w-5 mr-2 animate-spin" />Buscando tus fotos...</>
                ) : (
                  <><Search className="h-5 w-5 mr-2" />Buscar mis fotos</>
                )}
              </Button>

              <p className="text-xs text-gray-400 text-center">
                Usamos reconocimiento facial de Google para comparar tu cara con las fotos del evento.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Photo Preview Modal ── */}
      {previewPhoto && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Foto Gratuita</h3>
                {previewPhoto.similarity !== undefined && (
                  <p className="text-sm text-blue-600">{previewPhoto.similarity}% de similitud facial</p>
                )}
              </div>
              <button onClick={() => setPreviewPhoto(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 max-h-[65vh] overflow-auto">
              <div className="relative">
                <img
                  src={`/api/photos/${previewPhoto.id}/original`}
                  alt="Foto gratuita"
                  className="w-full h-auto max-h-[55vh] object-contain rounded-lg"
                  onError={(e) => {
                    e.currentTarget.src = `/api/thumbnails/${previewPhoto.filename}`;
                  }}
                />
                <div className="absolute inset-0 pointer-events-none select-none flex items-center justify-center">
                  <div className="text-white text-3xl font-bold opacity-60 transform -rotate-45 bg-black bg-opacity-40 px-6 py-3 rounded-lg">
                    GRATIS
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                {previewPhoto.detectedDorsals?.length > 0 && (
                  <span>Dorsal: {previewPhoto.detectedDorsals.join(', ')}</span>
                )}
              </div>
              <div className="flex space-x-3">
                <Button variant="outline" onClick={() => setPreviewPhoto(null)}>Cerrar</Button>
                <Button
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = `/api/free-photos/download/${previewPhoto.filename}`;
                    link.download = previewPhoto.filename;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />Descargar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
