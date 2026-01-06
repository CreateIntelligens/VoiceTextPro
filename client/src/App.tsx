import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import BottomNavigation from "@/components/bottom-navigation";
import HomePage from "@/pages/home";
import HistoryPage from "@/pages/history";
import HistoryDetailPage from "@/pages/history-detail";
import Dashboard from "@/pages/dashboard";
import AccountPage from "@/pages/account";
import Login from "@/pages/login";
import Admin from "@/pages/admin";
import VerifyEmail from "@/pages/verify-email";
import ResetPassword from "@/pages/reset-password";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  // 公開路由（不需要登入）
  const publicRoutes = ['/verify-email', '/reset-password'];
  const isPublicRoute = publicRoutes.some(route => location.startsWith(route));

  // 公開路由不需要等待載入完成
  if (isPublicRoute) {
    return (
      <Switch>
        <Route path="/verify-email/:token" component={VerifyEmail} />
        <Route path="/reset-password/:token" component={ResetPassword} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">載入中...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Main Content Area */}
      <main className="min-h-screen">
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/record" component={HomePage} />
          <Route path="/upload" component={HomePage} />
          <Route path="/history" component={HistoryPage} />
          <Route path="/history/:id" component={HistoryDetailPage} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/account" component={AccountPage} />
          <Route path="/admin" component={Admin} />
          {/* Legacy routes - redirect to new routes */}
          <Route path="/transcriptions" component={HistoryPage} />
          <Route path="/transcription-results" component={HistoryPage} />
          <Route component={NotFound} />
        </Switch>
      </main>

      <BottomNavigation />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
