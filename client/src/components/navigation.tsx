import { Link, useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { BarChart3, FileText, Home } from 'lucide-react';

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
  }
];

export default function Navigation() {
  const [location] = useLocation();

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <h1 className="text-xl font-bold text-gray-900">智能語音轉錄平台</h1>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
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
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}