import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import NavigationHeader from '@/components/navigation-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { DownloadCodeInput } from '@/components/download-code-input';
import { 
  ShoppingCart, 
  Plus, 
  Minus,
  Trash2, 
  CreditCard, 
  Download,
  User,
  Mail,
  DollarSign,
  CheckCircle,
  AlertCircle,
  ImageIcon,
  ArrowLeft
} from 'lucide-react';

interface Photo {
  id: number;
  filename: string;
  thumbnailPath: string;
  detectedDorsals: number[];
}

interface CartItem {
  photo: Photo;
  quantity: number;
  price: number;
}

interface PurchaseData {
  customerEmail: string;
  customerName: string;
  photoIds: number[];
  amount: number;
}

export default function PhotoPurchasePage({ onLogout }: { onLogout: () => void }) {
  const [location, navigate] = useLocation();
  const queryClient = useQueryClient();
  
  // Get settings for pricing
  const { data: settings } = useQuery({
    queryKey: ['/api/settings'],
    queryFn: async () => {
      const response = await fetch('/api/settings');
      if (!response.ok) throw new Error('Failed to fetch settings');
      return response.json();
    }
  });
  
  // Parse dorsal from URL or get from localStorage
  const urlParams = new URLSearchParams(location.split('?')[1] || '');
  const urlDorsalNumber = parseInt(urlParams.get('dorsal') || '0');
  
  const [dorsalNumber, setDorsalNumber] = useState(urlDorsalNumber);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<number[]>([]);
  const [eventId, setEventId] = useState<string>('');
  const [isParticipantView, setIsParticipantView] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{
    name?: string;
    email?: string;
  }>({});
  const [showDownloadCodeModal, setShowDownloadCodeModal] = useState(false);
  const [selectedPhotoForDownload, setSelectedPhotoForDownload] = useState<Photo | null>(null);

  // Validation functions
  const validateName = (name: string): string | undefined => {
    if (!name.trim()) {
      return 'El nombre es obligatorio';
    }
    
    // Check for at least two words (nombre y apellido)
    const words = name.trim().split(/\s+/);
    if (words.length < 2) {
      return 'Debe incluir nombre y apellido';
    }
    
    // Check that each word has at least 2 characters
    const hasValidWords = words.every(word => word.length >= 2);
    if (!hasValidWords) {
      return 'Nombre y apellido deben tener al menos 2 caracteres cada uno';
    }
    
    return undefined;
  };

  const validateEmail = (email: string): string | undefined => {
    if (!email.trim()) {
      return 'El correo electrónico es obligatorio';
    }
    
    // Check for @ symbol
    if (!email.includes('@')) {
      return 'El correo debe contener el símbolo @';
    }
    
    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return 'El formato del correo electrónico no es válido';
    }
    
    return undefined;
  };

  const validateForm = (): boolean => {
    const nameError = validateName(customerName);
    const emailError = validateEmail(customerEmail);
    
    setValidationErrors({
      name: nameError || undefined,
      email: emailError || undefined
    });
    
    return !nameError && !emailError;
  };

  // Load selected photos from localStorage on mount
  useEffect(() => {
    const storedPhotoIds = localStorage.getItem('selectedPhotoIds');
    const storedEventId = localStorage.getItem('eventId');
    const storedUserInfo = localStorage.getItem('userInfo');
    const storedDorsalNumber = localStorage.getItem('dorsalNumber');
    
    console.log('PhotoPurchase loading data from localStorage');
    console.log('Stored photo IDs:', storedPhotoIds);
    console.log('Stored event ID:', storedEventId);
    console.log('Stored user info:', storedUserInfo);
    console.log('Stored dorsal number:', storedDorsalNumber);
    
    if (storedPhotoIds) {
      const photoIds = JSON.parse(storedPhotoIds);
      setSelectedPhotoIds(photoIds);
      console.log('Set selected photo IDs:', photoIds);
      localStorage.removeItem('selectedPhotoIds'); // Clean up
    }
    
    if (storedEventId) {
      setEventId(storedEventId);
      localStorage.removeItem('eventId'); // Clean up
    }
    
    if (storedDorsalNumber) {
      setDorsalNumber(parseInt(storedDorsalNumber));
      localStorage.removeItem('dorsalNumber'); // Clean up
    }
    
    if (storedUserInfo) {
      const userInfo = JSON.parse(storedUserInfo);
      setCustomerEmail(userInfo.email || '');
      setCustomerName(userInfo.name || '');
      setIsParticipantView(true); // User came from participant portal
      localStorage.removeItem('userInfo'); // Clean up
    }
  }, []);

  // Fetch photos by IDs if coming from search
  const { data: selectedPhotos } = useQuery({
    queryKey: ['/api/photos/by-ids', selectedPhotoIds],
    queryFn: async () => {
      if (selectedPhotoIds.length === 0) return [];
      const response = await fetch('/api/photos/by-ids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoIds: selectedPhotoIds })
      });
      if (!response.ok) throw new Error('Error cargando fotos');
      return response.json();
    },
    enabled: selectedPhotoIds.length > 0
  });

  // Fetch ALL photos for the dorsal (always fetch to show "otras fotos")
  const { data: dorsalPhotos, isLoading } = useQuery({
    queryKey: ['/api/photos/search', dorsalNumber, eventId],
    queryFn: async () => {
      const response = await fetch(`/api/photos/search?eventId=${eventId}&dorsalNumber=${dorsalNumber}`);
      if (!response.ok) throw new Error('Error cargando fotos');
      return response.json();
    },
    enabled: Boolean(dorsalNumber > 0 && eventId)
  });

  // Use selected photos for the main display, but all dorsal photos for "otras fotos"
  const photos = selectedPhotos || (dorsalPhotos?.photos || []);
  const allDorsalPhotos = dorsalPhotos?.photos || [];
  
  // Debug log
  console.log('Photos data:', { selectedPhotos, dorsalPhotos, photos, allDorsalPhotos });

  // Auto-add selected photos to cart when they load
  useEffect(() => {
    if (selectedPhotos && selectedPhotos.length > 0 && cart.length === 0 && settings?.photoPrice) {
      const cartItems = selectedPhotos.map((photo: Photo) => ({
        photo,
        quantity: 1,
        price: settings.photoPrice
      }));
      setCart(cartItems);
    }
  }, [selectedPhotos, cart.length, settings?.photoPrice]);

  // Update cart prices when settings change
  useEffect(() => {
    if (settings?.photoPrice && cart.length > 0) {
      setCart(prevCart => 
        prevCart.map(item => ({
          ...item,
          price: settings.photoPrice
        }))
      );
    }
  }, [settings?.photoPrice]);

  // Pre-fill customer info from localStorage
  useEffect(() => {
    const storedUserInfo = localStorage.getItem('userInfo');
    if (storedUserInfo) {
      try {
        const userInfo = JSON.parse(storedUserInfo);
        if (userInfo.email && !customerEmail) {
          setCustomerEmail(userInfo.email);
        }
        if (userInfo.name && !customerName) {
          setCustomerName(userInfo.name);
        }
      } catch (error) {
        console.error('Error parsing user info:', error);
      }
    }
  }, [customerEmail, customerName]);

  // Create purchase mutation
  const createPurchase = useMutation({
    mutationFn: async (data: PurchaseData) => {
      console.log('Creating purchase with data:', data);
      const response = await fetch('/api/sales/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Purchase error:', errorText);
        throw new Error('Error creando compra');
      }
      
      const result = await response.json();
      console.log('Purchase result:', result);
      return result;
    },
    onSuccess: (data) => {
      console.log('=== MUTATION SUCCESS ===');
      console.log('Purchase successful:', data);
      if (data.paymentUrl) {
        console.log('Found payment URL, redirecting to:', data.paymentUrl);
        console.log('About to redirect...');
        window.location.href = data.paymentUrl;
      } else {
        console.error('No payment URL in response:', data);
      }
    },
    onError: (error) => {
      console.error('Purchase mutation error:', error);
    }
  });

  const photoPrice = settings?.photoPrice || 10000; // Use configured price or fallback

  const addToCart = (photo: Photo) => {
    setCart(prev => {
      const existing = prev.find(item => item.photo.id === photo.id);
      if (existing) {
        // For digital photos, don't add duplicates
        return prev;
      }
      return [...prev, { photo, quantity: 1, price: photoPrice }];
    });
  };

  const removeFromCart = (photoId: number) => {
    setCart(prev => prev.filter(item => item.photo.id !== photoId));
  };

  const updateQuantity = (photoId: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(photoId);
      return;
    }
    
    setCart(prev => 
      prev.map(item => 
        item.photo.id === photoId 
          ? { ...item, quantity }
          : item
      )
    );
  };

  // Helper functions for promotional pricing
  const getPromotionalPrice = (photoCount: number) => {
    const basePrice = settings?.photoPrice || 10000;
    
    // Check if user has all photos for their dorsal AND has more than 1 photo
    const totalDorsalPhotos = dorsalPhotos?.totalFound || 0;
    const isAllPhotos = photoCount === totalDorsalPhotos && totalDorsalPhotos > 1;
    
    if (isAllPhotos) {
      return 50000; // Fixed price for all dorsal photos
    } else if (photoCount >= 5) {
      return 30000; // Fixed price for 5+ photos
    } else if (photoCount >= 3) {
      return 20000; // Fixed price for 3+ photos
    } else {
      return basePrice * photoCount; // Regular pricing per photo
    }
  };

  const getTotalAmount = () => {
    const totalPhotos = cart.reduce((total, item) => total + item.quantity, 0);
    return getPromotionalPrice(totalPhotos);
  };

  const handlePurchase = () => {
    console.log('=== HANDLE PURCHASE CLICKED ===');
    console.log('customerEmail:', customerEmail);
    console.log('customerName:', customerName);
    console.log('cart:', cart);
    
    // Validate form data
    if (!validateForm()) {
      console.log('Form validation failed');
      return;
    }
    
    if (cart.length === 0) {
      console.log('Cart is empty');
      return;
    }

    const purchaseData: PurchaseData = {
      customerEmail: customerEmail.trim(),
      customerName: customerName.trim(),
      photoIds: cart.map(item => item.photo.id),
      amount: getTotalAmount()
    };

    console.log('About to call createPurchase.mutate with:', purchaseData);
    createPurchase.mutate(purchaseData);
    console.log('createPurchase.mutate called');
  };

  // Debug information
  console.log('PhotoPurchase render check:');
  console.log('dorsalNumber:', dorsalNumber);
  console.log('selectedPhotoIds:', selectedPhotoIds);
  console.log('selectedPhotoIds.length:', selectedPhotoIds.length);
  
  // Only show dorsal error if we don't have selected photos AND no dorsal
  if (dorsalNumber === 0 && selectedPhotoIds.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <NavigationHeader onLogout={onLogout} />
        <div className="max-w-2xl mx-auto px-4 py-16">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No se ha especificado un número de dorsal válido. 
              <Button 
                variant="link" 
                onClick={() => navigate('/search')}
                className="ml-2"
              >
                Buscar fotos
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        {isParticipantView ? (
          <div className="bg-white border-b">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center py-4">
                <Button
                  variant="ghost"
                  onClick={() => navigate('/')}
                  className="flex items-center"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Volver al Portal
                </Button>
                <h1 className="text-xl font-semibold">Comprar Fotos</h1>
                <div />
              </div>
            </div>
          </div>
        ) : (
          <NavigationHeader onLogout={onLogout} />
        )}
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2 text-gray-600">Cargando fotos...</span>
          </div>
        </div>
      </div>
    );
  }

  const availablePhotos = Array.isArray(photos) ? photos : (photos?.photos || []);

  return (
    <div className="min-h-screen bg-gray-50">
      {isParticipantView ? (
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <Button
                variant="ghost"
                onClick={() => navigate('/')}
                className="flex items-center"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver al Portal
              </Button>
              <h1 className="text-xl font-semibold">Comprar Fotos</h1>
              <div />
            </div>
          </div>
        </div>
      ) : (
        <NavigationHeader onLogout={onLogout} />
      )}
      
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Comprar Fotos - Dorsal {dorsalNumber}
          </h1>
          <p className="text-gray-600 mt-2">
            Selecciona las fotos que deseas comprar y procede al pago
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Photos Gallery */}
          <div className="lg:col-span-2 space-y-8">
            {/* Fotos Escogidas */}
            {(selectedPhotos || []).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    Fotos Escogidas ({(selectedPhotos || []).length})
                  </CardTitle>
                  <CardDescription>
                    Estas son las fotos que has seleccionado para comprar
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {(selectedPhotos || []).map((photo: Photo) => {
                      const inCart = cart.find(item => item.photo.id === photo.id);
                      
                      return (
                        <div key={photo.id} className="relative group">
                          <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden relative">
                            <img
                              src={`/api/thumbnails/${photo.filename}`}
                              alt="Foto del evento"
                              className="w-full h-full object-cover"
                            />
                            {/* Marca de agua múltiple */}
                            <div className="absolute inset-0 pointer-events-none select-none">
                              {/* Marca central */}
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="text-white text-sm font-bold opacity-60 transform -rotate-45 bg-black bg-opacity-30 px-3 py-1 rounded">
                                  VISTA PREVIA
                                </div>
                              </div>
                              {/* Marcas en esquinas */}
                              <div className="absolute top-2 left-2 text-white text-xs font-bold opacity-50 transform -rotate-12">
                                DEMO
                              </div>
                              <div className="absolute top-2 right-2 text-white text-xs font-bold opacity-50 transform rotate-12">
                                DEMO
                              </div>
                              <div className="absolute bottom-2 left-2 text-white text-xs font-bold opacity-50 transform rotate-12">
                                DEMO
                              </div>
                              <div className="absolute bottom-2 right-2 text-white text-xs font-bold opacity-50 transform -rotate-12">
                                DEMO
                              </div>
                              {/* Overlay semitransparente */}
                              <div className="absolute inset-0 bg-gray-900 bg-opacity-10"></div>
                            </div>
                          </div>
                          
                          <div className="mt-2 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">
                                ${photoPrice.toLocaleString('es-CO')}
                              </span>
                              {inCart && (
                                <Badge variant="secondary">
                                  En carrito ({inCart.quantity})
                                </Badge>
                              )}
                            </div>
                            
                            <Button
                              onClick={() => addToCart(photo)}
                              size="sm"
                              className="w-full"
                              variant={inCart ? "outline" : "default"}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              {inCart ? 'Ya seleccionada' : 'Seleccionar foto'}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Otras fotos tuyas */}
            {((allDorsalPhotos || []).filter((photo: Photo) => 
              !(selectedPhotos || []).find((sp: Photo) => sp.id === photo.id)
            )).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="h-5 w-5" />
                    Otras fotos tuyas ({((allDorsalPhotos || []).filter((photo: Photo) => 
                      !(selectedPhotos || []).find((sp: Photo) => sp.id === photo.id)
                    )).length})
                  </CardTitle>
                  <CardDescription>
                    Precio por foto: ${photoPrice.toLocaleString('es-CO')} COP
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                    {((allDorsalPhotos || []).filter((photo: Photo) => 
                      !(selectedPhotos || []).find((sp: Photo) => sp.id === photo.id)
                    )).map((photo: Photo) => {
                      const inCart = cart.find(item => item.photo.id === photo.id);
                      
                      return (
                        <div key={photo.id} className="relative group cursor-pointer" onClick={() => addToCart(photo)}>
                          <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden relative hover:ring-2 hover:ring-blue-500 transition-all">
                            <img
                              src={`/api/thumbnails/${photo.filename}`}
                              alt="Foto del evento"
                              className="w-full h-full object-cover"
                            />
                            {/* Marca de agua simplificada para miniaturas */}
                            <div className="absolute inset-0 pointer-events-none select-none">
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="text-white text-xs font-bold opacity-50 transform -rotate-45 bg-black bg-opacity-30 px-1 py-0.5 rounded">
                                  DEMO
                                </div>
                              </div>
                              <div className="absolute inset-0 bg-gray-900 bg-opacity-5"></div>
                            </div>
                            
                            {/* Botón de agregar al carrito */}
                            {!inCart && (
                              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center">
                                <div className="opacity-0 group-hover:opacity-100 transition-all">
                                  <Plus className="h-6 w-6 text-white bg-blue-600 rounded-full p-1" />
                                </div>
                              </div>
                            )}
                            
                            {/* Badge si está en carrito */}
                            {inCart && (
                              <div className="absolute top-1 right-1">
                                <Badge variant="secondary" className="text-xs">
                                  ✓
                                </Badge>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Mensaje si no hay fotos */}
            {(availablePhotos || []).length === 0 && (
              <Card>
                <CardContent className="text-center py-12">
                  <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">
                    No se encontraron fotos para el dorsal {dorsalNumber}
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={() => navigate('/search')}
                    className="mt-4"
                  >
                    Buscar otro dorsal
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Shopping Cart */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Carrito de Compras ({cart.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {cart.length > 0 ? (
                  <div className="space-y-4">
                    {/* Cart Items */}
                    <div className="space-y-3">
                      {cart.map((item) => (
                        <div key={item.photo.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                          <img
                            src={`/api/thumbnails/${item.photo.filename}`}
                            alt="Foto del evento"
                            className="w-12 h-12 object-cover rounded"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium">
                              Foto seleccionada
                            </p>
                            <p className="text-xs text-gray-600">
                              $COP {item.price.toLocaleString('es-CO')} c/u
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedPhotoForDownload(item.photo);
                                setShowDownloadCodeModal(true);
                              }}
                              title="Descargar con código"
                            >
                              <Download className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => removeFromCart(item.photo.id)}
                              title="Quitar del carrito"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <Separator />

                    {/* Total */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-lg font-semibold">
                        <span>Total:</span>
                        <span>$COP {getTotalAmount().toLocaleString('es-CO')}</span>
                      </div>
                    </div>

                    <Separator />

                    {/* Customer Info */}
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="customerName">Nombre completo</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            id="customerName"
                            type="text"
                            placeholder="Ejemplo: Juan Pérez"
                            value={customerName}
                            onChange={(e) => {
                              setCustomerName(e.target.value);
                              // Clear validation error when user starts typing
                              if (validationErrors.name) {
                                setValidationErrors(prev => ({ ...prev, name: undefined }));
                              }
                            }}
                            className={`pl-10 ${validationErrors.name ? 'border-red-500' : ''}`}
                          />
                        </div>
                        {validationErrors.name && (
                          <p className="text-sm text-red-600 mt-1">{validationErrors.name}</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="customerEmail">Correo electrónico</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            id="customerEmail"
                            type="email"
                            placeholder="ejemplo@email.com"
                            value={customerEmail}
                            onChange={(e) => {
                              setCustomerEmail(e.target.value);
                              // Clear validation error when user starts typing
                              if (validationErrors.email) {
                                setValidationErrors(prev => ({ ...prev, email: undefined }));
                              }
                            }}
                            className={`pl-10 ${validationErrors.email ? 'border-red-500' : ''}`}
                          />
                        </div>
                        {validationErrors.email && (
                          <p className="text-sm text-red-600 mt-1">{validationErrors.email}</p>
                        )}
                      </div>
                    </div>

                    {/* Purchase Button */}
                    <Button
                      onClick={handlePurchase}
                      disabled={!customerEmail.trim() || !customerName.trim() || createPurchase.isPending || cart.length === 0}
                      className="w-full"
                      size="lg"
                    >
                      {createPurchase.isPending ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                          Procesando...
                        </>
                      ) : (
                        <>
                          <CreditCard className="h-4 w-4 mr-2" />
                          Procesar Compra
                        </>
                      )}
                    </Button>

                    {createPurchase.isError && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Error: No se pudo conectar con la pasarela de pagos. 
                          {createPurchase.error?.message && ` (${createPurchase.error.message})`}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-4">
                      Tu carrito está vacío
                    </p>
                    <p className="text-sm text-gray-500">
                      Selecciona las fotos que deseas comprar
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      
      {/* Download Code Modal */}
      {selectedPhotoForDownload && (
        <DownloadCodeInput
          isOpen={showDownloadCodeModal}
          onClose={() => {
            setShowDownloadCodeModal(false);
            setSelectedPhotoForDownload(null);
          }}
          eventId={parseInt(eventId) || 5}
          dorsalNumber={dorsalNumber}
          filename={selectedPhotoForDownload.filename}
          photoName={`Foto ${selectedPhotoForDownload.id}`}
        />
      )}
    </div>
  );
}