import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BarChart3, FileText, Home, Shield, LogOut, Menu, X } from 'lucide-react';

export default function Navigation() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigationItems = [
    {
      name: '語音轉錄',
      href: '/',
      icon: Home
    },
    {
      name: '轉錄結果',
      href: '/results',
      icon: FileText
    },
    {
      name: '使用儀表板',
      href: '/dashboard',
      icon: BarChart3
    },
    ...(user?.role === 'admin' ? [{
      name: '管理員面板',
      href: '/admin',
      icon: Shield
    }] : [])
  ];

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">
                <span className="hidden sm:inline">智能語音轉錄平台</span>
                <span className="sm:hidden">轉錄平台</span>
              </h1>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden md:ml-6 md:flex md:space-x-8">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.href;
                
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium',
                      isActive
                        ? 'border-blue-500 text-gray-900'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    )}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    <span className="hidden lg:inline">{item.name}</span>
                    <span className="lg:hidden">
                      {item.name.replace('管理員面板', '管理').replace('使用儀表板', '儀表板')}
                    </span>
                    {item.name === '管理員面板' && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        管理員
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
          
          {/* Desktop User Info & Logout */}
          <div className="hidden md:flex md:items-center md:space-x-4">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <span className="hidden lg:inline">歡迎，{user?.name || user?.email}</span>
              <span className="lg:hidden">
                {user?.name || user?.email?.split('@')[0]}
              </span>
              {user?.role === 'admin' && (
                <Badge variant="default" className="text-xs">
                  管理員
                </Badge>
              )}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={logout}
              className="flex items-center"
            >
              <LogOut className="w-4 h-4 lg:mr-2" />
              <span className="hidden lg:inline">登出</span>
            </Button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden">
            <div className="pt-2 pb-3 space-y-1">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.href;
                
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'flex items-center px-3 py-2 text-base font-medium rounded-md',
                      isActive
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    )}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Icon className="w-5 h-5 mr-3" />
                    {item.name}
                    {item.name === '管理員面板' && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        管理員
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </div>
            
            {/* Mobile User Info */}
            <div className="pt-4 pb-3 border-t border-gray-200">
              <div className="flex items-center px-4">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">
                      {(user?.name || user?.email)?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="ml-3">
                  <div className="text-base font-medium text-gray-800">
                    {user?.name || user?.email}
                  </div>
                  {user?.role === 'admin' && (
                    <Badge variant="default" className="text-xs mt-1">
                      管理員
                    </Badge>
                  )}
                </div>
              </div>
              <div className="mt-3 px-2">
                <Button
                  variant="outline"
                  onClick={logout}
                  className="w-full flex items-center justify-center"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  登出
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}