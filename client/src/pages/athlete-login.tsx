import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, User, Lock, AlertCircle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface AthleteLoginProps {
  onLogin: (user: any) => void;
}

export default function AthleteLogin({ onLogin }: AthleteLoginProps) {
  const [location, navigate] = useLocation();
  const [email, setEmail] = useState('atleta@racephoto.pro');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Get return URL from query params
  const urlParams = new URLSearchParams(location.split('?')[1] || '');
  const returnTo = urlParams.get('returnTo') || '/search';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await apiRequest('POST', '/api/auth/login', {
        email: email.trim(),
        password
      });

      const data = await response.json();

      if (data.success && data.token && data.user) {
        // Store token in localStorage (same as admin login)
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Call parent onLogin callback
        onLogin(data.user);
        
        console.log('✅ [ATHLETE LOGIN] Login successful:', data.user);
        
        // Redirect to return URL or search page
        navigate(returnTo);
      } else {
        setError(data.error || 'Error de autenticación');
      }
    } catch (error) {
      console.error('❌ [ATHLETE LOGIN] Login error:', error);
      setError('Error de conexión. Inténtalo de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
            <User className="h-8 w-8 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">Acceso para Atletas</CardTitle>
          <CardDescription>
            Inicia sesión para ver y descargar todas las fotos del evento
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {error && (
            <Alert className="mb-4" variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Usuario</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  placeholder="atleta@racephoto.pro"
                  required
                  data-testid="input-athlete-email"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  placeholder="Ingresa tu contraseña"
                  required
                  data-testid="input-athlete-password"
                />
              </div>
            </div>
            
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
              data-testid="button-athlete-login"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Iniciando sesión...
                </>
              ) : (
                'Ingresar'
              )}
            </Button>
          </form>
          
          <div className="mt-6 text-center">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/search')}
              className="text-sm text-gray-600 hover:text-gray-800"
              data-testid="button-back-to-search"
            >
              ← Volver a búsqueda pública
            </Button>
          </div>
          
          {/* Info card */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>¿Eres atleta?</strong> Una vez autenticado podrás ver y descargar 
              todas las fotos del evento de forma gratuita.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}