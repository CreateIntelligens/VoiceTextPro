import { useState } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Menu, X } from "lucide-react";
import SidebarNavigation from "@/components/sidebar-navigation";
import BreadcrumbNavigation from "@/components/breadcrumb-navigation";
import ChatBot from "@/components/chat-bot";
import Welcome from "@/pages/welcome";
import TranscriptionPage from "@/pages/transcription";
import TranscriptionResultsPage from "@/pages/transcription-results";
import Dashboard from "@/pages/dashboard";
import Login from "@/pages/login";
import Admin from "@/pages/admin";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    <div className="min-h-screen bg-gray-50 flex">
      <SidebarNavigation className="hidden lg:flex" />
      
      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Mobile Sidebar */}
          <div className="fixed top-0 left-0 h-full w-64 bg-white z-50 transform transition-transform duration-300 ease-in-out">
            <SidebarNavigation onMobileClose={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navigation Bar for Mobile/Tablet */}
        <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="mr-2"
              >
                {mobileMenuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </Button>
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-sm font-bold">轉</span>
              </div>
              <h1 className="text-lg font-bold text-gray-900">智能轉錄平台</h1>
            </div>
            <BreadcrumbNavigation />
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Breadcrumb for Desktop */}
          <div className="hidden lg:block bg-white border-b border-gray-200 px-6 py-4">
            <BreadcrumbNavigation />
          </div>
          
          {/* Page Content */}
          <main className="flex-1 overflow-y-auto bg-gray-50">
            <Switch>
              <Route path="/" component={Welcome} />
              <Route path="/record" component={TranscriptionPage} />
              <Route path="/upload" component={TranscriptionPage} />
              <Route path="/transcriptions" component={TranscriptionResultsPage} />
              <Route path="/keywords" component={Dashboard} />
              <Route path="/dashboard" component={Dashboard} />
              <Route path="/admin" component={Admin} />
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
      
      <ChatBot />
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
