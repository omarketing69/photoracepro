import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import NavigationHeader from '@/components/navigation-header';
import UserEditModal from '@/components/user-edit-modal';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Users, 
  Plus, 
  Trash2, 
  Edit,
  Save,
  X,
  CheckCircle,
  Camera,
  Calendar,
  Settings
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

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

export default function UserManagementPage({ onLogout }: { onLogout: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newUser, setNewUser] = useState<NewUser>({
    email: '',
    password: '',
    name: '',
    role: 'photographer',
    assignedEventId: undefined
  });

  // Fetch users
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const response = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${JSON.parse(localStorage.getItem('race_photo_user') || '{}').token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Error cargando usuarios');
      return response.json();
    }
  });

  // Fetch events for photographer assignment
  const { data: events = [] } = useQuery({
    queryKey: ['/api/events'],
    queryFn: async () => {
      const response = await fetch('/api/events');
      if (!response.ok) throw new Error('Error cargando eventos');
      return response.json();
    }
  });

  // Create user mutation
  const createUser = useMutation({
    mutationFn: async (userData: NewUser) => {
      const response = await apiRequest('POST', '/api/users', userData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setShowCreateForm(false);
      setNewUser({ email: '', password: '', name: '', role: 'photographer', assignedEventId: undefined });
      toast({
        title: "Usuario creado",
        description: "El usuario fotógrafo ha sido creado exitosamente.",
        variant: "default"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error creando el usuario",
        variant: "destructive"
      });
    }
  });

  // Delete user mutation
  const deleteUser = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest('DELETE', `/api/users/${userId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: "Usuario eliminado",
        description: "El usuario ha sido eliminado exitosamente.",
        variant: "default"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error eliminando el usuario",
        variant: "destructive"
      });
    }
  });

  const handleCreateUser = () => {
    if (!newUser.email || !newUser.password || !newUser.name) {
      toast({
        title: "Error",
        description: "Todos los campos son obligatorios",
        variant: "destructive"
      });
      return;
    }
    
    if (newUser.role === 'photographer' && !newUser.assignedEventId) {
      toast({
        title: "Error",
        description: "Debe asignar un evento específico al fotógrafo",
        variant: "destructive"
      });
      return;
    }
    
    createUser.mutate(newUser);
  };

  const getRoleBadge = (role: string) => {
    const config = {
      admin: { label: 'Admin', variant: 'destructive' as const },
      photographer: { label: 'Fotógrafo', variant: 'default' as const },
      user: { label: 'Usuario', variant: 'secondary' as const }
    };
    
    const { label, variant } = config[role as keyof typeof config] || config.user;
    return <Badge variant={variant}>{label}</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <NavigationHeader onLogout={onLogout} />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-gray-600">Cargando usuarios...</p>
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
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-3">
              <div className="bg-primary/10 p-2 rounded-lg">
                <Users className="text-primary h-6 w-6" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Gestión de Usuarios</h1>
                <p className="text-gray-600">Administra fotógrafos y usuarios del sistema</p>
              </div>
            </div>
            <Button 
              onClick={() => setShowCreateForm(true)}
              className="bg-primary text-white hover:bg-primary/90"
            >
              <Plus className="mr-2 h-4 w-4" />
              Crear Usuario Fotógrafo
            </Button>
          </div>

          {/* Create User Form */}
          {showCreateForm && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Camera className="h-5 w-5" />
                  <span>Crear Nuevo Usuario Fotógrafo</span>
                </CardTitle>
                <CardDescription>
                  Los fotógrafos solo tendrán acceso al módulo de subida de fotos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Nombre Completo</Label>
                    <Input
                      id="name"
                      value={newUser.name}
                      onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                      placeholder="Ej: Juan Pérez"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      placeholder="fotografo@ejemplo.com"
                      className="mt-1"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="password">Contraseña</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    placeholder="Contraseña segura"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="event">Evento Asignado</Label>
                  <Select 
                    value={newUser.assignedEventId?.toString() || ''} 
                    onValueChange={(value) => setNewUser({ 
                      ...newUser, 
                      assignedEventId: value ? parseInt(value) : undefined 
                    })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Seleccionar evento para el fotógrafo" />
                    </SelectTrigger>
                    <SelectContent>
                      {events.map((event: any) => (
                        <SelectItem key={event.id} value={event.id.toString()}>
                          {event.name} - {new Date(event.date).toLocaleDateString('es-ES')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-gray-600 mt-1">
                    El fotógrafo solo podrá subir fotos a este evento específico
                  </p>
                </div>

                <Alert>
                  <Camera className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Permisos de fotógrafo:</strong> Solo podrá acceder al módulo de subida de fotos. 
                    No tendrá acceso a estadísticas, configuración o gestión de eventos.
                  </AlertDescription>
                </Alert>

                <div className="flex space-x-2">
                  <Button 
                    onClick={handleCreateUser}
                    disabled={createUser.isPending}
                    className="bg-primary text-white hover:bg-primary/90"
                  >
                    {createUser.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Creando...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Crear Usuario
                      </>
                    )}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowCreateForm(false);
                      setNewUser({ email: '', password: '', name: '', role: 'photographer', assignedEventId: undefined });
                    }}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Users List */}
          <Card>
            <CardHeader>
              <CardTitle>Usuarios del Sistema</CardTitle>
              <CardDescription>
                Lista de todos los usuarios registrados en el sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              {Array.isArray(users) && users.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No hay usuarios</h3>
                  <p className="text-gray-600">Crea el primer usuario fotógrafo para comenzar</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Usuario</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Rol</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Evento Asignado</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Creado</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Último Login</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.isArray(users) && users.map((user: User) => (
                        <tr key={user.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <div>
                              <div className="font-medium text-gray-900">{user.name || 'Sin nombre'}</div>
                              <div className="text-sm text-gray-600">{user.email}</div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {getRoleBadge(user.role)}
                          </td>
                          <td className="py-3 px-4">
                            {user.role === 'photographer' && (user as any).latestEventName ? (
                              <div className="flex items-center space-x-1">
                                <Calendar className="h-4 w-4 text-blue-500" />
                                <span className="text-sm text-blue-600">
                                  {(user as any).latestEventName}
                                </span>
                              </div>
                            ) : user.role === 'photographer' ? (
                              <span className="text-sm text-gray-400">Sin eventos asignados</span>
                            ) : (
                              <span className="text-sm text-gray-400">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {formatDate(user.createdAt)}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {user.lastLogin ? formatDate(user.lastLogin) : 'Nunca'}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingUser(user);
                                  setShowEditModal(true);
                                }}
                                data-testid={`button-edit-user-${user.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              {user.role !== 'admin' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => deleteUser.mutate(user.id)}
                                  disabled={deleteUser.isPending}
                                  className="text-red-600 hover:text-red-700"
                                  data-testid={`button-delete-user-${user.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* User Edit Modal */}
          <UserEditModal 
            user={editingUser}
            isOpen={showEditModal}
            onClose={() => {
              setShowEditModal(false);
              setEditingUser(null);
            }}
          />
        </div>
      </div>
    </div>
  );
}