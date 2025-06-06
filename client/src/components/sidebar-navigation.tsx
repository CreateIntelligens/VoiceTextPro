import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Home, 
  FileText, 
  BarChart3, 
  Shield, 
  LogOut, 
  Menu, 
  X,
  Mic,
  Settings,
  User,
  MessageSquare
} from 'lucide-react';

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  badge?: string;
}

interface NavigationSection {
  title: string;
  items: NavigationItem[];
}

interface SidebarNavigationProps {
  className?: string;
}

export default function SidebarNavigation({ className }: SidebarNavigationProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const navigationSections = [
    {
      title: '主要功能',
      items: [
        {
          name: '語音轉錄',
          href: '/',
          icon: Mic,
          description: '上傳音頻文件進行轉錄'
        },
        {
          name: '轉錄結果',
          href: '/results',
          icon: FileText,
          description: '查看和管理轉錄記錄'
        }
      ]
    },
    {
      title: '分析工具',
      items: [
        {
          name: '使用儀表板',
          href: '/dashboard',
          icon: BarChart3,
          description: '查看使用統計和趨勢'
        }
      ]
    },
    ...(user?.role === 'admin' ? [{
      title: '管理功能',
      items: [
        {
          name: '管理員面板',
          href: '/admin',
          icon: Shield,
          description: '系統管理和用戶控制',
          badge: '管理員'
        }
      ]
    }] : [])
  ];

  return (
    <div className={cn(
      "flex flex-col bg-white border-r border-gray-200 transition-all duration-300",
      collapsed ? "w-16" : "w-64",
      className
    )}>
      {/* Sidebar Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        {!collapsed && (
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Mic className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">轉錄平台</h1>
              <p className="text-xs text-gray-500">智能語音分析</p>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="p-2"
        >
          {collapsed ? <Menu className="w-4 h-4" /> : <X className="w-4 h-4" />}
        </Button>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {navigationSections.map((section, sectionIndex) => (
          <div key={sectionIndex}>
            {!collapsed && (
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                {section.title}
              </h3>
            )}
            
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.href;
                
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                      isActive
                        ? "bg-blue-50 text-blue-700 border-r-2 border-blue-600"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    )}
                  >
                    <Icon className={cn(
                      "flex-shrink-0 w-5 h-5 transition-colors",
                      isActive ? "text-blue-600" : "text-gray-400 group-hover:text-gray-500"
                    )} />
                    
                    {!collapsed && (
                      <>
                        <span className="ml-3 flex-1">{item.name}</span>
                        {item.badge && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            {item.badge}
                          </Badge>
                        )}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* User Section */}
      <div className="border-t border-gray-200 p-4">
        {!collapsed ? (
          <div className="space-y-3">
            {/* User Info */}
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {(user?.name || user?.email)?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.name || user?.email?.split('@')[0]}
                </p>
                <div className="flex items-center space-x-2">
                  <p className="text-xs text-gray-500 truncate">
                    {user?.email}
                  </p>
                  {user?.role === 'admin' && (
                    <Badge variant="default" className="text-xs">
                      管理員
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
              >
                <User className="w-4 h-4 mr-2" />
                個人設定
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={logout}
                className="w-full justify-start text-red-600 hover:text-red-700"
              >
                <LogOut className="w-4 h-4 mr-2" />
                登出
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full p-2"
              title="個人設定"
            >
              <User className="w-4 h-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="w-full p-2 text-red-600 hover:text-red-700"
              title="登出"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}