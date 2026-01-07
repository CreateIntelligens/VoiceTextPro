import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import { Button } from "@/components/ui/button";
import { Copy, Download, Check, RefreshCw, AlertCircle } from "lucide-react";

// Initialize mermaid with dark theme - 深色主題配淺色文字和線條
mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  securityLevel: "loose",
  fontFamily: "ui-sans-serif, system-ui, sans-serif",
  themeVariables: {
    // 深色背景
    background: "#0f172a",
    mainBkg: "#1e293b",

    // 主要顏色 - 藍色節點
    primaryColor: "#3b82f6",
    primaryTextColor: "#ffffff",
    primaryBorderColor: "#60a5fa",

    // 次要顏色
    secondaryColor: "#8b5cf6",
    secondaryTextColor: "#ffffff",
    secondaryBorderColor: "#a78bfa",

    // 第三顏色
    tertiaryColor: "#10b981",
    tertiaryTextColor: "#ffffff",
    tertiaryBorderColor: "#34d399",

    // 線條和邊框 - 使用亮色
    lineColor: "#94a3b8",

    // 節點顏色
    nodeBorder: "#60a5fa",
    clusterBkg: "#1e293b",
    clusterBorder: "#475569",

    // 文字顏色 - 亮色
    textColor: "#e2e8f0",
    titleColor: "#f1f5f9",

    // 流程圖特定
    edgeLabelBackground: "#1e293b",

    // 序列圖特定 - 亮色線條和文字
    actorBkg: "#3b82f6",
    actorBorder: "#60a5fa",
    actorTextColor: "#ffffff",
    actorLineColor: "#94a3b8",
    signalColor: "#e2e8f0",
    signalTextColor: "#e2e8f0",
    labelBoxBkgColor: "#1e293b",
    labelBoxBorderColor: "#475569",
    labelTextColor: "#e2e8f0",
    loopTextColor: "#e2e8f0",
    noteBorderColor: "#fbbf24",
    noteBkgColor: "#422006",
    noteTextColor: "#fef3c7",
    activationBorderColor: "#60a5fa",
    activationBkgColor: "#1e3a8a",
    sequenceNumberColor: "#ffffff",

    // ER 圖特定
    entityBorder: "#60a5fa",
    entityBkg: "#1e293b",
    entityTextColor: "#e2e8f0",
    relationColor: "#94a3b8",
    relationLabelBackground: "#1e293b",
    relationLabelColor: "#e2e8f0",

    // 額外的文字顏色設定
    labelColor: "#e2e8f0",
    attributeBackgroundColorEven: "#1e293b",
    attributeBackgroundColorOdd: "#0f172a",
  },
  flowchart: {
    htmlLabels: true,
    useMaxWidth: true,
    curve: "basis",
    padding: 15,
  },
  sequence: {
    useMaxWidth: true,
    diagramMarginX: 50,
    diagramMarginY: 10,
    actorMargin: 50,
    width: 150,
    height: 65,
    boxMargin: 10,
    boxTextMargin: 5,
    noteMargin: 10,
    messageMargin: 35,
  },
  er: {
    useMaxWidth: true,
    entityPadding: 15,
  },
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
    let isMounted = true;
    let timeoutId: NodeJS.Timeout | null = null;

    const renderDiagram = async () => {
      if (!code) {
        setIsRendering(false);
        return;
      }

      setIsRendering(true);
      setError(null);

      // 設定 10 秒超時
      timeoutId = setTimeout(() => {
        if (isMounted) {
          setIsRendering(false);
          setError("圖表渲染超時，可能是語法錯誤或圖表過於複雜");
        }
      }, 10000);

      try {
        // Clean up the code - replace escaped newlines with actual newlines
        let cleanedCode = code.replace(/\\n/g, "\n").trim();

        // 移除可能導致問題的字元
        cleanedCode = cleanedCode.replace(/[\u200B-\u200D\uFEFF]/g, "");

        // 驗證基本語法
        if (!cleanedCode.match(/^(graph|flowchart|sequenceDiagram|classDiagram|erDiagram|stateDiagram|gantt|pie|journey|gitGraph)/)) {
          throw new Error("無效的 Mermaid 圖表語法");
        }

        // Generate unique ID for the diagram
        const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Render the diagram
        const { svg: renderedSvg } = await mermaid.render(id, cleanedCode);

        if (isMounted) {
          if (timeoutId) clearTimeout(timeoutId);
          setSvg(renderedSvg);
          setIsRendering(false);
        }
      } catch (err) {
        if (isMounted) {
          if (timeoutId) clearTimeout(timeoutId);
          console.error("[Mermaid] Render error:", err);
          setError(err instanceof Error ? err.message : "圖表渲染失敗");
          setIsRendering(false);
        }
      }
    };

    renderDiagram();

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
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
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleRetry}>
                <RefreshCw className="w-4 h-4 mr-2" />
                重試
              </Button>
              <Button variant="outline" size="sm" onClick={handleCopyCode}>
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    已複製
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    複製代碼
                  </>
                )}
              </Button>
            </div>
            {/* 顯示原始 Mermaid 代碼供除錯 */}
            <details className="mt-4 w-full max-w-lg text-left">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                查看 Mermaid 原始碼
              </summary>
              <pre className="mt-2 p-3 bg-muted/50 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                {code.replace(/\\n/g, "\n")}
              </pre>
            </details>
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
