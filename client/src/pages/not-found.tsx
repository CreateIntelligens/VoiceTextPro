import { useLocation } from "wouter";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <AlertCircle className="w-16 h-16 text-muted-foreground/30 mb-4" />
      <h1 className="text-4xl font-bold text-foreground mb-2">404</h1>
      <p className="text-muted-foreground mb-6">找不到頁面</p>
      <button
        onClick={() => setLocation('/')}
        className="px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        返回首頁
      </button>
    </div>
  );
}
