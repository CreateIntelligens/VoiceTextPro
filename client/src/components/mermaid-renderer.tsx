import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import { Button } from "@/components/ui/button";
import { Copy, Download, Check, RefreshCw, AlertCircle } from "lucide-react";

// Initialize mermaid with proper settings
mermaid.initialize({
  startOnLoad: false,
  theme: "default",
  securityLevel: "loose",
  fontFamily: "inherit",
});

interface MermaidRendererProps {
  code: string;
  title?: string;
  description?: string;
  className?: string;
}

export default function MermaidRenderer({
  code,
  title,
  description,
  className = "",
}: MermaidRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isRendering, setIsRendering] = useState(true);

  useEffect(() => {
    const renderDiagram = async () => {
      if (!code || !containerRef.current) return;

      setIsRendering(true);
      setError(null);

      try {
        // Clean up the code - replace escaped newlines with actual newlines
        const cleanedCode = code.replace(/\\n/g, "\n").trim();

        // Generate unique ID for the diagram
        const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Render the diagram
        const { svg: renderedSvg } = await mermaid.render(id, cleanedCode);
        setSvg(renderedSvg);
      } catch (err) {
        console.error("[Mermaid] Render error:", err);
        setError(err instanceof Error ? err.message : "圖表渲染失敗");
      } finally {
        setIsRendering(false);
      }
    };

    renderDiagram();
  }, [code]);

  const handleCopyCode = async () => {
    const cleanedCode = code.replace(/\\n/g, "\n").trim();
    await navigator.clipboard.writeText(cleanedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSVG = () => {
    if (!svg) return;

    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title || "diagram"}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPNG = async () => {
    if (!svg) return;

    // Create canvas to convert SVG to PNG
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    // Convert SVG to data URL
    const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      // Set canvas size with higher resolution for better quality
      const scale = 2;
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      ctx.scale(scale, scale);

      // Fill white background
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw image
      ctx.drawImage(img, 0, 0);

      // Download PNG
      const pngUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = pngUrl;
      a.download = `${title || "diagram"}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    img.src = url;
  };

  const handleRetry = () => {
    setError(null);
    setIsRendering(true);
    // Trigger re-render by updating a dummy state or just recall effect
    setSvg("");
    setTimeout(() => {
      const event = new Event("mermaid-retry");
      window.dispatchEvent(event);
    }, 100);
  };

  return (
    <div className={`rounded-xl border border-border bg-card ${className}`}>
      {/* Header */}
      {(title || description) && (
        <div className="px-4 py-3 border-b border-border">
          {title && (
            <h4 className="font-medium text-foreground">{title}</h4>
          )}
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>
      )}

      {/* Diagram Container */}
      <div className="p-4">
        {isRendering && !error && (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">渲染中...</span>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="w-8 h-8 text-destructive mb-2" />
            <p className="text-sm text-destructive mb-2">圖表渲染失敗</p>
            <p className="text-xs text-muted-foreground mb-4 max-w-md">{error}</p>
            <Button variant="outline" size="sm" onClick={handleRetry}>
              <RefreshCw className="w-4 h-4 mr-2" />
              重試
            </Button>
          </div>
        )}

        {!isRendering && !error && svg && (
          <div
            ref={containerRef}
            className="overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        )}
      </div>

      {/* Actions */}
      {svg && !error && (
        <div className="px-4 py-3 border-t border-border flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyCode}
            className="text-xs"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 mr-1" />
                已複製
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 mr-1" />
                複製代碼
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadSVG}
            className="text-xs"
          >
            <Download className="w-3 h-3 mr-1" />
            SVG
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadPNG}
            className="text-xs"
          >
            <Download className="w-3 h-3 mr-1" />
            PNG
          </Button>
        </div>
      )}
    </div>
  );
}
