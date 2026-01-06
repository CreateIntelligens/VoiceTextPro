import { useLocation, Link } from 'wouter';
import { cn } from '@/lib/utils';
import { Mic, FileText, BarChart3, User } from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  activeRoutes?: string[];
}

const navItems: NavItem[] = [
  { name: '錄製', href: '/', icon: Mic, activeRoutes: ['/', '/record', '/upload'] },
  { name: '記錄', href: '/history', icon: FileText, activeRoutes: ['/history'] },
  { name: '統計', href: '/dashboard', icon: BarChart3, activeRoutes: ['/dashboard'] },
  { name: '帳戶', href: '/account', icon: User, activeRoutes: ['/account', '/admin'] },
];

export default function BottomNavigation() {
  const [location] = useLocation();

  const isActive = (item: NavItem) => {
    if (item.activeRoutes) {
      return item.activeRoutes.some(route => {
        if (route === '/') return location === '/';
        return location.startsWith(route);
      });
    }
    return location === item.href;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50">
      {/* 背景 */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-xl border-t border-border/50" />

      {/* 導航內容 */}
      <div className="relative flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center w-16 h-14 rounded-xl transition-all duration-200',
                active
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <div className={cn(
                'flex items-center justify-center w-10 h-10 rounded-xl mb-0.5 transition-all duration-200',
                active && 'bg-primary/10'
              )}>
                <Icon className={cn(
                  'w-5 h-5 transition-transform duration-200',
                  active && 'scale-105'
                )} />
              </div>
              <span className={cn(
                'text-[10px] transition-all duration-200',
                active ? 'font-semibold' : 'font-medium'
              )}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>

      {/* iOS 安全區域 */}
      <div className="h-safe-area-inset-bottom bg-background/80" />
    </nav>
  );
}
