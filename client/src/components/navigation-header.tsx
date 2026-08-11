import { Link, useLocation } from "wouter";
import { Camera, Plus, User, LogOut, Users, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface NavigationHeaderProps {
  onLogout?: () => void;
}

export default function NavigationHeader({ onLogout }: NavigationHeaderProps) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { path: "/dashboard", label: "Dashboard" },
    { path: "/events", label: "Eventos" },
    { path: "/upload", label: "📸 Subir" },
    { path: "/search", label: "🔍 Buscar" },
    { path: "/analytics", label: "📊 Stats" },
    { path: "/admin-download-codes", label: "📱 Códigos" },
    { path: "/performance-dashboard", label: "⚡ Performance" },
    { path: "/event-pricing", label: "💰 Precios" },
    { path: "/user-management", label: "👥 Usuarios" },
    { path: "/settings", label: "⚙️ Config" },
  ];

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Camera className="text-primary text-2xl" />
              <h1 className="text-xl font-bold text-gray-900">photoracepro.com</h1>
            </div>
            
            {/* Desktop Navigation */}
            <nav className="hidden xl:flex space-x-1 ml-4 max-w-4xl overflow-x-auto">
              {navItems.map((item) => (
                <Link key={item.path} href={item.path}>
                  <span
                    className={`cursor-pointer text-xs px-2 py-1.5 rounded-md transition-colors whitespace-nowrap ${
                      location === item.path
                        ? "bg-primary text-white font-medium"
                        : "text-gray-600 hover:text-primary hover:bg-gray-100"
                    }`}
                  >
                    {item.label}
                  </span>
                </Link>
              ))}
            </nav>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="hidden xl:flex items-center space-x-2 text-xs text-gray-600">
              <User className="text-sm" />
              <span>Admin</span>
            </div>

            <Button className="hidden xl:flex bg-primary text-white hover:bg-blue-700 text-xs px-2 py-1">
              <Plus className="mr-1 h-3 w-3" />
              Nuevo
            </Button>
            
            {onLogout && (
              <Button variant="outline" onClick={onLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Salir
              </Button>
            )}
            
            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="sm"
              className="xl:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="xl:hidden bg-white border-t border-gray-200 shadow-lg">
          <nav className="px-4 py-2 space-y-1 max-h-96 overflow-y-auto">
            {navItems.map((item) => (
              <Link key={item.path} href={item.path}>
                <span
                  className={`block px-3 py-2 rounded-md text-sm font-medium cursor-pointer ${
                    location === item.path
                      ? "bg-primary text-white"
                      : "text-gray-600 hover:text-primary hover:bg-gray-100"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </span>
              </Link>
            ))}
            
            {/* Additional mobile-only items */}
            <div className="border-t border-gray-200 mt-2 pt-2">
              <div className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600">
                <User className="text-lg" />
                <span>Organizador Admin</span>
              </div>
              
              <Button className="w-full bg-primary text-white hover:bg-blue-700 mt-2">
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Evento
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
