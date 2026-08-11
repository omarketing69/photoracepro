import { useState, useEffect, Component, ReactNode } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

// Error Boundary to catch React errors
class ErrorBoundary extends Component<
  { children: ReactNode; onError?: () => void },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: ReactNode; onError?: () => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    console.error("ErrorBoundary caught error:", error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("ErrorBoundary componentDidCatch:", error, errorInfo);
    if (this.props.onError) {
      this.props.onError();
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-red-50 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Error de la Aplicación</h1>
            <p className="text-red-700 mb-4">Se ha detectado un error inesperado</p>
            <p className="text-sm text-red-600">{this.state.error?.message}</p>
            <button 
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded"
            >
              Recargar Página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
import Dashboard from "@/pages/dashboard";
import DashboardMinimal from "@/pages/dashboard-minimal";
import DashboardStatic from "@/pages/dashboard-static";
import Events from "@/pages/events";
import Search from "@/pages/search";
import BulkUpload from "@/pages/bulk-upload";
import Analytics from "@/pages/analytics";
import PhotoPurchasePage from "@/pages/photo-purchase";
import Settings from "@/pages/settings";

import NotFound from "@/pages/not-found";
import Download from "@/pages/download";
import FreePhotosFixed from "@/pages/free-photos-fixed";
import ParticipantFreePhotos from "@/pages/participant-free-photos";
import Landing from "@/pages/landing";
import AdminLogin from "@/pages/admin-login";
import PhotographerLogin from "@/pages/photographer-login";
import AthleteLogin from "@/pages/athlete-login";
import CloudStorageConfig from "@/pages/cloud-storage-config-simple";
import EventPricing from "@/pages/event-pricing";
import LoginForm from "@/components/auth/login-form";
import UserDashboard from "@/components/user/user-dashboard";
import PhotographerSignup from "@/pages/photographer-signup";
import PerformanceDashboard from "@/pages/performance-dashboard";
import MobileUploadTest from "@/pages/mobile-upload-test";
import UserManagement from "@/pages/user-management";
import PreflightDashboard from "@/pages/preflight-dashboard";
import AdminDownloadCodes from "@/pages/admin-download-codes";

function Router({ user, onLogout }: { user: any; onLogout: () => void }) {
  const [location] = useLocation();
  
  console.log("Router: location =", location, "user =", user);
  
  // Admin routes (require admin role)
  if (user?.role === 'admin') {
    switch (location) {
      case '/':
      case '/dashboard':
        return <Dashboard onLogout={onLogout} />;
      case '/events':
        return <Events onLogout={onLogout} />;
      case '/upload':
      case '/bulk-upload':
        return <BulkUpload onLogout={onLogout} userRole={user?.role} currentUser={user} />;
      case '/analytics':
        return <Analytics onLogout={onLogout} />;
      case '/settings':
        return <Settings onLogout={onLogout} />;
      case '/user-management':
        return <UserManagement onLogout={onLogout} />;
      case '/cloud-storage-config':
        return <CloudStorageConfig />;
      case '/event-pricing':
        return <EventPricing onLogout={onLogout} />;
      case '/purchase':
        return <PhotoPurchasePage onLogout={onLogout} />;
      case '/performance-dashboard':
        return <PerformanceDashboard onLogout={onLogout} />;
      case '/preflight':
      case '/preflight-dashboard':
        return <PreflightDashboard onLogout={onLogout} />;
      case '/admin-download-codes':
        return <AdminDownloadCodes onLogout={onLogout} />;
      default:
        return <Dashboard onLogout={onLogout} />;
    }
  }
  
  // Photographer routes (only upload access)
  if (user?.role === 'photographer') {
    // Photographers can only access upload functionality
    return <BulkUpload onLogout={onLogout} userRole={user?.role} currentUser={user} />;
  }
  
  // Athlete routes (access to all photos in paid events)
  if (user?.role === 'athlete') {
    switch (location) {
      case '/':
      case '/search':
        return <Search />;
      case '/photo-purchase':
        return <PhotoPurchasePage onLogout={onLogout} />;
      default:
        return <Search />;
    }
  }

  // User routes (for participant users)
  if (user?.role === 'user') {
    if (location === '/photo-purchase') {
      return <PhotoPurchasePage onLogout={onLogout} />;
    }
    return <UserDashboard user={user} onLogout={onLogout} />;
  }

  // Fallback for any unhandled case
  console.log("Fallback render: Dashboard");
  return <Dashboard onLogout={onLogout} />;
}

function App() {
  const [user, setUser] = useState<{ id: number; email: string; role: string; name?: string; token?: string } | null>(() => {
    // Restore user from localStorage on app start
    try {
      const saved = localStorage.getItem('race_photo_user');
      if (!saved) return null;
      const parsedUser = JSON.parse(saved);
      // Check if the JWT token has expired
      if (parsedUser?.token) {
        try {
          const payload = JSON.parse(atob(parsedUser.token.split('.')[1]));
          if (payload.exp && payload.exp * 1000 < Date.now()) {
            console.warn("App.tsx: JWT token expired, clearing session");
            localStorage.removeItem('race_photo_user');
            return null;
          }
        } catch {
          // Malformed token — clear it
          localStorage.removeItem('race_photo_user');
          return null;
        }
      }
      console.log("App.tsx: restored user from localStorage:", parsedUser);
      return parsedUser;
    } catch (error) {
      console.error("Failed to restore user from localStorage:", error);
      return null;
    }
  });
  const [location, setLocation] = useLocation();
  
  console.log("App.tsx: render - location =", location, "user =", user);

  // Save user to localStorage whenever it changes
  useEffect(() => {
    try {
      if (user) {
        localStorage.setItem('race_photo_user', JSON.stringify(user));
        console.log("App.tsx: saved user to localStorage:", user);
      } else {
        localStorage.removeItem('race_photo_user');
        console.log("App.tsx: removed user from localStorage");
      }
    } catch (error) {
      console.error("Failed to save user to localStorage:", error);
    }
  }, [user]);



  const handleLogin = (userData: { id: number; email: string; role: string; name?: string }) => {
    console.log("App.tsx: handleLogin called with:", userData);
    setUser(userData);
    // Force localStorage update immediately
    try {
      localStorage.setItem('race_photo_user', JSON.stringify(userData));
      console.log("App.tsx: user saved to localStorage immediately");
    } catch (error) {
      console.error("Failed to save user immediately:", error);
    }
    console.log("App.tsx: user state set");
  };



  const handleLogout = () => {
    setUser(null);
  };

  // Handle public pages and authentication
  const urlParams = new URLSearchParams(window.location.search);
  const hasDownloadToken = urlParams.get('token');

  // Always show these pages regardless of authentication
  if (location === '/') {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Landing />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  if (location === '/free-photos') {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <FreePhotosFixed />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  if (location.startsWith('/download') && hasDownloadToken) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Download />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  if (location === '/search') {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Search />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  // Athlete login page
  if (location === '/athlete-login') {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <AthleteLogin onLogin={handleLogin} />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  if (location === '/soy-fotografo') {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <PhotographerSignup />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  if (location === '/mobile-test') {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <MobileUploadTest />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  if (location === '/photo-purchase') {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <PhotoPurchasePage onLogout={handleLogout} />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  if (location === '/admin-login') {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <AdminLogin onLogin={handleLogin} />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  if (location === '/photographer-login') {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <PhotographerLogin onLogin={handleLogin} />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  // For all other pages, require authentication
  if (!user) {
    window.location.href = '/';
    return null;
  }

  return (
    <ErrorBoundary onError={() => setUser(null)}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router user={user} onLogout={handleLogout} />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
