import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { 
  Save, 
  X, 
  Plus, 
  Calendar,
  Trash2,
  User,
  Mail,
  Camera
} from 'lucide-react';

interface User {
  id: number;
  email: string;
  name?: string;
  role: string;
  assignedEventId?: number;
  createdAt: string;
  lastLogin?: string;
}

interface Assignment {
  assignmentId: number;
  eventId: number;
  eventName: string;
  eventDate: string;
  eventLocation: string;
  role: string;
  assignedAt: string;
  notes?: string;
}

interface UserEditModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function UserEditModal({ user, isOpen, onClose }: UserEditModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [editedUser, setEditedUser] = useState({
    name: '',
    email: '',
    role: ''
  });
  const [showAssignEvent, setShowAssignEvent] = useState(false);
  const [newAssignment, setNewAssignment] = useState({
    eventId: '',
    role: 'photographer',
    notes: ''
  });

  // Load user data when modal opens
  useEffect(() => {
    if (user) {
      setEditedUser({
        name: user.name || '',
        email: user.email || '',
        role: user.role || ''
      });
    }
  }, [user]);

  // Fetch available events
  const { data: events = [] } = useQuery({
    queryKey: ['/api/events'],
    queryFn: async () => {
      const response = await fetch('/api/events');
      if (!response.ok) throw new Error('Error cargando eventos');
      return response.json();
    }
  });

  // Fetch photographer's assigned events (only for photographers)
  const { data: assignments = [], refetch: refetchAssignments } = useQuery({
    queryKey: ['/api/users', user?.id, 'events'],
    enabled: !!user && user.role === 'photographer'
  });

  // Update user mutation
  const updateUser = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('No user selected');
      return apiRequest('PUT', `/api/users/${user.id}`, editedUser);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: "Usuario actualizado",
        description: "La información del usuario ha sido actualizada exitosamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error actualizando el usuario",
        variant: "destructive"
      });
    }
  });

  // Assign event mutation
  const assignEvent = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('No user selected');
      return apiRequest('POST', `/api/users/${user.id}/events`, {
        eventId: parseInt(newAssignment.eventId),
        role: newAssignment.role,
        notes: newAssignment.notes || undefined
      });
    },
    onSuccess: () => {
      refetchAssignments();
      // Invalidate users list to show updated latest event
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setShowAssignEvent(false);
      setNewAssignment({ eventId: '', role: 'photographer', notes: '' });
      toast({
        title: "Evento asignado",
        description: "El evento ha sido asignado exitosamente al fotógrafo.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error asignando evento",
        variant: "destructive"
      });
    }
  });

  // Remove assignment mutation
  const removeAssignment = useMutation({
    mutationFn: async (eventId: number) => {
      if (!user) throw new Error('No user selected');
      return apiRequest('DELETE', `/api/users/${user.id}/events/${eventId}`);
    },
    onSuccess: () => {
      refetchAssignments();
      // Invalidate users list to show updated latest event
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: "Asignación eliminada",
        description: "La asignación del evento ha sido eliminada exitosamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error eliminando asignación",
        variant: "destructive"
      });
    }
  });

  const handleSaveUser = () => {
    if (!editedUser.name || !editedUser.email || !editedUser.role) {
      toast({
        title: "Error",
        description: "Todos los campos son obligatorios",
        variant: "destructive"
      });
      return;
    }
    updateUser.mutate();
  };

  const handleAssignEvent = () => {
    if (!newAssignment.eventId) {
      toast({
        title: "Error",
        description: "Debe seleccionar un evento",
        variant: "destructive"
      });
      return;
    }
    
    // Check if event is already assigned
    const assignmentList = assignments as Assignment[] || [];
    const alreadyAssigned = assignmentList.find((a: Assignment) => a.eventId === parseInt(newAssignment.eventId));
    if (alreadyAssigned) {
      toast({
        title: "Error",
        description: "Este evento ya está asignado al fotógrafo",
        variant: "destructive"
      });
      return;
    }
    
    assignEvent.mutate();
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Sin fecha';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Fecha inválida';
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>Editar Usuario: {user.name || user.email}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* User Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Mail className="h-5 w-5" />
                <span>Información del Usuario</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Nombre Completo</Label>
                <Input
                  id="edit-name"
                  value={editedUser.name}
                  onChange={(e) => setEditedUser({ ...editedUser, name: e.target.value })}
                  placeholder="Nombre completo"
                  data-testid="input-user-name"
                />
              </div>
              
              <div>
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editedUser.email}
                  onChange={(e) => setEditedUser({ ...editedUser, email: e.target.value })}
                  placeholder="email@ejemplo.com"
                  data-testid="input-user-email"
                />
              </div>
              
              <div>
                <Label htmlFor="edit-role">Rol</Label>
                <Select 
                  value={editedUser.role} 
                  onValueChange={(value) => setEditedUser({ ...editedUser, role: value })}
                >
                  <SelectTrigger data-testid="select-user-role">
                    <SelectValue placeholder="Seleccionar rol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="photographer">Fotógrafo</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="user">Usuario</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex space-x-2">
                <Button 
                  onClick={handleSaveUser}
                  disabled={updateUser.isPending}
                  className="flex-1"
                  data-testid="button-save-user"
                >
                  {updateUser.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Guardar Cambios
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Event Assignments (only for photographers) */}
          {user.role === 'photographer' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Camera className="h-5 w-5" />
                    <span>Eventos Asignados</span>
                  </div>
                  <Button 
                    size="sm"
                    onClick={() => setShowAssignEvent(true)}
                    data-testid="button-assign-event"
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    Asignar
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {showAssignEvent && (
                  <div className="border rounded-lg p-4 space-y-3 bg-blue-50">
                    <div>
                      <Label>Seleccionar Evento</Label>
                      <Select 
                        value={newAssignment.eventId} 
                        onValueChange={(value) => setNewAssignment({ ...newAssignment, eventId: value })}
                      >
                        <SelectTrigger data-testid="select-event-assign">
                          <SelectValue placeholder="Seleccionar evento" />
                        </SelectTrigger>
                        <SelectContent>
                          {events
                            .filter((event: any) => {
                              const assignmentList = assignments as Assignment[] || [];
                              return !assignmentList.find((a: Assignment) => a.eventId === event.id);
                            })
                            .map((event: any) => (
                              <SelectItem key={`event-${event.id}`} value={event.id.toString()}>
                                {event.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label>Rol en el Evento</Label>
                      <Select 
                        value={newAssignment.role} 
                        onValueChange={(value) => setNewAssignment({ ...newAssignment, role: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="photographer">Fotógrafo</SelectItem>
                          <SelectItem value="lead_photographer">Fotógrafo Principal</SelectItem>
                          <SelectItem value="assistant">Asistente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label>Notas (Opcional)</Label>
                      <Input
                        value={newAssignment.notes}
                        onChange={(e) => setNewAssignment({ ...newAssignment, notes: e.target.value })}
                        placeholder="Notas sobre la asignación"
                      />
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button 
                        onClick={handleAssignEvent}
                        disabled={assignEvent.isPending}
                        size="sm"
                        data-testid="button-confirm-assign"
                      >
                        {assignEvent.isPending ? 'Asignando...' : 'Asignar Evento'}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setShowAssignEvent(false);
                          setNewAssignment({ eventId: '', role: 'photographer', notes: '' });
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}

                {(assignments as Assignment[] || []).length === 0 ? (
                  <div className="text-center py-4 text-gray-500">
                    <p>Sin eventos asignados</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(assignments as Assignment[] || []).map((assignment: Assignment, index: number) => (
                      <div 
                        key={`assignment-${assignment.eventId || index}-${assignment.assignmentId || index}`}
                        className="border rounded-lg p-3 bg-white"
                        data-testid={`assignment-${assignment.eventId}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-medium">{assignment.eventName}</span>
                              <Badge variant="outline">{assignment.role}</Badge>
                            </div>
                            <div className="text-sm text-gray-600 mt-1">
                              {assignment.eventLocation && `📍 ${assignment.eventLocation}`}
                            </div>
                            {assignment.notes && (
                              <div className="text-sm text-gray-500 mt-1 italic">
                                💬 {assignment.notes}
                              </div>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeAssignment.mutate(assignment.eventId)}
                            disabled={removeAssignment.isPending}
                            className="text-red-600 hover:text-red-700"
                            data-testid={`button-remove-${assignment.eventId}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            <X className="mr-2 h-4 w-4" />
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}