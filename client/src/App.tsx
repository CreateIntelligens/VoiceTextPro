import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Navigation from "@/components/navigation";
import TranscriptionPage from "@/pages/transcription";
import TranscriptionResultsPage from "@/pages/transcription-results";
import Dashboard from "@/pages/dashboard";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <Switch>
        <Route path="/" component={TranscriptionPage} />
        <Route path="/results" component={TranscriptionResultsPage} />
        <Route path="/dashboard" component={Dashboard} />
        <Route component={NotFound} />
      </Switch>
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
