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
  Upload,
  Users,
  Plus,
  Trash2,
  Edit,
  X,
  Camera,
  Calendar
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Settings {
  // Settings interface simplified - download configs moved to event pricing
}

interface CloudStats {
  connected?: boolean;
  bucketName?: string;
  projectId?: string;
  totalFiles?: number;
  totalSize?: number;
  error?: string | null;
  credentialsType?: string;
}

interface Event {
  id: number;
  name: string;
}

interface User {
  id: number;
  email: string;
  name?: string;
  role: string;
  assignedEventId?: number;
  createdAt: string;
  lastLogin?: string;
}

interface NewUser {
  email: string;
  password: string;
  name: string;
  role: 'photographer' | 'admin' | 'user';
  assignedEventId?: number;
}

export default function SettingsPage({ onLogout }: { onLogout: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [settings, setSettings] = useState<Settings>({});

  // Estados para funcionalidades de administración
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Estados para estadísticas de Google Cloud Storage
  const [cloudStorageStats, setCloudStorageStats] = useState({
    connected: false,
    bucketName: '',
    projectId: '',
    totalFiles: 0,
    totalSize: 0,
    error: null as string | null,
    credentialsType: ''
  });

  // Estados para gestión de usuarios
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<number | null>(null);
  const [newUser, setNewUser] = useState<NewUser>({
    email: '',
    password: '',
    name: '',
    role: 'user',
    assignedEventId: undefined,
  });

  // Cargar configuración desde el servidor
  const { data: serverSettings, isLoading } = useQuery({
    queryKey: ['/api/settings']
  });

  // Cargar estadísticas de Google Cloud Storage
  const { data: cloudStats } = useQuery<CloudStats>({
    queryKey: ['/api/cloud/test'],
    refetchInterval: 30000
  });

  // Efecto para actualizar estadísticas de Google Cloud Storage
  useEffect(() => {
    if (cloudStats) {
      setCloudStorageStats({
        connected: cloudStats.connected || false,
        bucketName: cloudStats.bucketName || '',
        projectId: cloudStats.projectId || '',
        totalFiles: cloudStats.totalFiles || 0,
        totalSize: cloudStats.totalSize || 0,
        error: cloudStats.error || null,
        credentialsType: cloudStats.credentialsType || ''
      });
    }
  }, [cloudStats]);

  // Settings simplified - no need to load download settings

  // No more settings mutations needed - all configs moved to event pricing

  // Queries para gestión de usuarios
  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ['/api/events'],
  });

  // Mutaciones para gestión de usuarios
  const createUserMutation = useMutation({
    mutationFn: (userData: NewUser) => 
      apiRequest('POST', '/api/users', userData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setShowCreateForm(false);
      setNewUser({
        email: '',
        password: '',
        name: '',
        role: 'user',
        assignedEventId: undefined,
      });
      toast({
        title: "Usuario creado",
        description: "El usuario ha sido creado exitosamente.",
      });
    },
    onError: (error) => {
      console.error('Error creating user:', error);
      toast({
        title: "Error",
        description: "No se pudo crear el usuario. Intenta nuevamente.",
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: number) => 
      apiRequest('DELETE', `/api/users/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: "Usuario eliminado",
        description: "El usuario ha sido eliminado exitosamente.",
      });
    },
    onError: (error) => {
      console.error('Error deleting user:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el usuario. Intenta nuevamente.",
        variant: "destructive",
      });
    },
  });

  // Mutation para cambiar contraseña
  const changePasswordMutation = useMutation({
    mutationFn: async (passwords: { currentPassword: string; newPassword: string }) => {
      const response = await apiRequest('POST', '/api/admin/change-password', passwords);
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Contraseña cambiada",
        description: "La contraseña se ha actualizado correctamente",
        variant: "default"
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error) => {
      toast({
        title: "Error al cambiar contraseña",
        description: "No se pudo cambiar la contraseña. Verifique la contraseña actual.",
        variant: "destructive"
      });
      console.error('Error changing password:', error);
    }
  });

  // Mutation para resetear contador de ventas
  const resetSalesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/admin/reset-sales');
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Contador de ventas reseteado",
        description: "El contador de ventas se ha reiniciado correctamente",
        variant: "default"
      });
    },
    onError: (error) => {
      toast({
        title: "Error al resetear contador",
        description: "No se pudo resetear el contador de ventas",
        variant: "destructive"
      });
      console.error('Error resetting sales:', error);
    }
  });

  // handleSaveSettings removed - no more general settings to save

  // Funciones de manejo para usuarios
  const handleCreateUser = () => {
    if (!newUser.email || !newUser.password || !newUser.name) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos requeridos",
        variant: "destructive",
      });
      return;
    }
    createUserMutation.mutate(newUser);
  };

  const handleDeleteUser = (userId: number) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este usuario?')) {
      deleteUserMutation.mutate(userId);
    }
  };

  const roleColors = {
    admin: 'bg-red-100 text-red-800',
    photographer: 'bg-blue-100 text-blue-800',
    user: 'bg-gray-100 text-gray-800',
  };

  const handleChangePassword = () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "Las contraseñas no coinciden",
        variant: "destructive"
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "La contraseña debe tener al menos 6 caracteres",
        variant: "destructive"
      });
      return;
    }

    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  const handleResetSales = () => {
    if (window.confirm("¿Está seguro de que desea resetear el contador de ventas mensual? Esta acción no se puede deshacer.")) {
      resetSalesMutation.mutate();
    }
  };

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


            {/* Admin Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="h-5 w-5" />
                  <span>Configuración de Administrador</span>
                </CardTitle>
                <CardDescription>
                  Cambiar contraseña y configuraciones administrativas
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label htmlFor="currentPassword">Contraseña Actual</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="mt-1"
                    placeholder="Ingrese contraseña actual"
                  />
                </div>

                <div>
                  <Label htmlFor="newPassword">Nueva Contraseña</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="mt-1"
                    placeholder="Ingrese nueva contraseña"
                  />
                </div>

                <div>
                  <Label htmlFor="confirmPassword">Confirmar Nueva Contraseña</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="mt-1"
                    placeholder="Confirme nueva contraseña"
                  />
                </div>

                <Button 
                  onClick={handleChangePassword}
                  disabled={!currentPassword || !newPassword || !confirmPassword || changePasswordMutation.isPending}
                  className="w-full"
                >
                  {changePasswordMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Cambiando...
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4 mr-2" />
                      Cambiar Contraseña
                    </>
                  )}
                </Button>

                <Separator />

                <div>
                  <Label>Resetear Contador de Ventas</Label>
                  <p className="text-sm text-gray-600 mt-1 mb-3">
                    Reinicia el contador de ventas mensual (mantiene fotos y estadísticas)
                  </p>
                  <Button 
                    onClick={handleResetSales}
                    disabled={resetSalesMutation.isPending}
                    variant="outline"
                    className="w-full"
                  >
                    {resetSalesMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                        Reseteando...
                      </>
                    ) : (
                      <>
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Resetear Contador
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Google Cloud Storage Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Cloud className="h-5 w-5" />
                  <span>Google Cloud Storage</span>
                </CardTitle>
                <CardDescription>
                  Estado de la conexión y configuración de almacenamiento en la nube
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${cloudStorageStats.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span className="text-sm font-medium">
                      {cloudStorageStats.connected ? 'Conectado' : 'Desconectado'}
                    </span>
                  </div>
                  <Badge variant={cloudStorageStats.connected ? 'default' : 'destructive'}>
                    {cloudStorageStats.connected ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>

                {cloudStorageStats.connected && (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium">Proyecto</Label>
                      <p className="text-sm text-gray-600">{cloudStorageStats.projectId}</p>
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium">Bucket</Label>
                      <p className="text-sm text-gray-600">{cloudStorageStats.bucketName}</p>
                    </div>
                    
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center space-x-2">
                        <HardDrive className="h-4 w-4 text-gray-500" />
                        <span className="text-sm text-gray-600">Almacenamiento Local + Nube</span>
                      </div>
                      <span className="text-sm font-medium text-green-600">Híbrido</span>
                    </div>
                  </div>
                )}

                {cloudStorageStats.error && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      <div className="font-medium">Error de conexión:</div>
                      <div>Proyecto: {cloudStorageStats.projectId}</div>
                      <div>Bucket: {cloudStorageStats.bucketName}</div>
                      <div>Tipo: {cloudStorageStats.credentialsType}</div>
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>


            {/* User Management */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>Gestión de Usuarios</span>
                </CardTitle>
                <CardDescription>
                  Administra usuarios, roles y permisos del sistema
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Create User Button */}
                <div className="flex justify-end">
                  <Button 
                    onClick={() => setShowCreateForm(true)}
                    disabled={createUserMutation.isPending}
                    className="flex items-center space-x-2"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Crear Usuario</span>
                  </Button>
                </div>

                {/* Create User Form */}
                {showCreateForm && (
                  <Card className="border-2 border-dashed border-gray-300">
                    <CardHeader>
                      <CardTitle className="text-lg">Crear Nuevo Usuario</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            placeholder="usuario@ejemplo.com"
                            value={newUser.email}
                            onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="name">Nombre</Label>
                          <Input
                            id="name"
                            placeholder="Nombre completo"
                            value={newUser.name}
                            onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="password">Contraseña</Label>
                          <Input
                            id="password"
                            type="password"
                            placeholder="Contraseña"
                            value={newUser.password}
                            onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="role">Rol</Label>
                          <Select 
                            value={newUser.role} 
                            onValueChange={(value) => setNewUser({...newUser, role: value as any})}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar rol" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">Usuario</SelectItem>
                              <SelectItem value="photographer">Fotógrafo</SelectItem>
                              <SelectItem value="admin">Administrador</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {newUser.role === 'photographer' && (
                        <div className="space-y-2">
                          <Label htmlFor="assignedEvent">Evento Asignado</Label>
                          <Select 
                            value={newUser.assignedEventId?.toString() || ''} 
                            onValueChange={(value) => setNewUser({...newUser, assignedEventId: value ? parseInt(value) : undefined})}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar evento" />
                            </SelectTrigger>
                            <SelectContent>
                              {events.map((event: Event) => (
                                <SelectItem key={event.id} value={event.id.toString()}>
                                  {event.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="flex justify-end space-x-2">
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setShowCreateForm(false);
                            setNewUser({
                              email: '',
                              password: '',
                              name: '',
                              role: 'user',
                              assignedEventId: undefined,
                            });
                          }}
                        >
                          <X className="h-4 w-4 mr-2" />
                          Cancelar
                        </Button>
                        <Button 
                          onClick={handleCreateUser}
                          disabled={createUserMutation.isPending}
                        >
                          {createUserMutation.isPending ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Creando...
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4 mr-2" />
                              Crear Usuario
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Users List */}
                <div className="space-y-2">
                  <h3 className="font-medium">Usuarios del Sistema</h3>
                  {usersLoading ? (
                    <div className="text-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
                      <p className="text-gray-600">Cargando usuarios...</p>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {users.map((user: User) => (
                        <Card key={user.id} className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="flex-shrink-0">
                                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                                  <Users className="h-5 w-5 text-gray-600" />
                                </div>
                              </div>
                              <div>
                                <div className="flex items-center space-x-2">
                                  <h4 className="font-medium">{user.name || 'Sin nombre'}</h4>
                                  <Badge 
                                    className={roleColors[user.role as keyof typeof roleColors]}
                                    variant="secondary"
                                  >
                                    {user.role}
                                  </Badge>
                                </div>
                                <p className="text-sm text-gray-600">{user.email}</p>
                                {user.assignedEventId && (
                                  <div className="flex items-center space-x-1 mt-1">
                                    <Calendar className="h-3 w-3 text-gray-500" />
                                    <span className="text-xs text-gray-500">
                                      Evento: {events.find((e: Event) => e.id === user.assignedEventId)?.name || 'Desconocido'}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              {user.role !== 'admin' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteUser(user.id)}
                                  disabled={deleteUserMutation.isPending}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>


        </div>
      </div>
    </div>
  );
}