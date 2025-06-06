import { Link, useLocation } from 'wouter';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BreadcrumbItem {
  name: string;
  href?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

const routeMap: Record<string, BreadcrumbItem[]> = {
  '/': [
    { name: '首頁', href: '/', icon: Home },
    { name: '語音轉錄' }
  ],
  '/results': [
    { name: '首頁', href: '/', icon: Home },
    { name: '轉錄結果' }
  ],
  '/dashboard': [
    { name: '首頁', href: '/', icon: Home },
    { name: '使用儀表板' }
  ],
  '/admin': [
    { name: '首頁', href: '/', icon: Home },
    { name: '管理員面板' }
  ]
};

export default function BreadcrumbNavigation() {
  const [location] = useLocation();
  
  const breadcrumbs = routeMap[location] || [
    { name: '首頁', href: '/', icon: Home },
    { name: '未知頁面' }
  ];

  return (
    <nav className="flex items-center space-x-1 text-sm text-gray-500" aria-label="麵包屑">
      {breadcrumbs.map((item, index) => {
        const isLast = index === breadcrumbs.length - 1;
        const Icon = item.icon;

        return (
          <div key={index} className="flex items-center">
            {index > 0 && (
              <ChevronRight className="w-4 h-4 mx-2 text-gray-400" />
            )}
            
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="flex items-center hover:text-gray-700 transition-colors"
              >
                {Icon && <Icon className="w-4 h-4 mr-1" />}
                {item.name}
              </Link>
            ) : (
              <span className={cn(
                "flex items-center",
                isLast ? "text-gray-900 font-medium" : "text-gray-500"
              )}>
                {Icon && <Icon className="w-4 h-4 mr-1" />}
                {item.name}
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}