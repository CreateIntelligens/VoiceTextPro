import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Volume2, Play, Pause, Download, Loader2, Mic, FileText, List, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface SpeechGeneratorProps {
  transcriptionId: number;
  hasTranscript?: boolean;
  hasSummary?: boolean;
  hasKeyPoints?: boolean;
}

export default function SpeechGenerator({ 
  transcriptionId, 
  hasTranscript = false, 
  hasSummary = false, 
  hasKeyPoints = false 
}: SpeechGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speechType, setSpeechType] = useState<'summary' | 'keypoints' | 'custom' | 'full'>('summary');
  const [voice, setVoice] = useState<'male' | 'female' | 'neutral'>('neutral');
  const [speed, setSpeed] = useState([1.0]);
  const [customText, setCustomText] = useState('');
  const [generatedAudio, setGeneratedAudio] = useState<{
    audioUrl: string;
    text: string;
    duration: number;
  } | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  const handleGenerateSpeech = async () => {
    if (speechType === 'custom' && !customText.trim()) {
      toast({
        title: "請輸入文字",
        description: "自定義語音生成需要提供文字內容",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    try {
      const response = await apiRequest(`/api/transcriptions/${transcriptionId}/generate-speech`, 'POST', {
        type: speechType,
        voice,
        speed: speed[0],
        text: speechType === 'custom' ? customText : undefined
      });

      const data = await response.json();
      setGeneratedAudio(data);
      
      toast({
        title: "語音生成成功",
        description: `已生成 ${Math.round(data.duration)} 秒的語音內容`,
      });
    } catch (error) {
      console.error('Speech generation error:', error);
      toast({
        title: "語音生成失敗",
        description: error instanceof Error ? error.message : "請稍後再試",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePlayPause = () => {
    if (!generatedAudio?.audioUrl) return;

    if (audioElement) {
      if (isPlaying) {
        audioElement.pause();
        setIsPlaying(false);
      } else {
        audioElement.play();
        setIsPlaying(true);
      }
    } else {
      const audio = new Audio(generatedAudio.audioUrl);
      audio.onended = () => setIsPlaying(false);
      audio.onpause = () => setIsPlaying(false);
      audio.onplay = () => setIsPlaying(true);
      
      setAudioElement(audio);
      audio.play();
      setIsPlaying(true);
    }
  };

  const handleDownload = () => {
    if (!generatedAudio?.audioUrl) return;
    
    const link = document.createElement('a');
    link.href = generatedAudio.audioUrl;
    link.download = `generated-speech-${Date.now()}.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getSpeechTypeIcon = (type: string) => {
    switch (type) {
      case 'summary': return <FileText className="w-4 h-4" />;
      case 'keypoints': return <List className="w-4 h-4" />;
      case 'custom': return <Sparkles className="w-4 h-4" />;
      case 'full': return <Mic className="w-4 h-4" />;
      default: return <Volume2 className="w-4 h-4" />;
    }
  };

  const getSpeechTypeLabel = (type: string) => {
    switch (type) {
      case 'summary': return '摘要語音';
      case 'keypoints': return '重點語音';
      case 'custom': return '自定義語音';
      case 'full': return '完整語音';
      default: return '語音';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Volume2 className="w-5 h-5 text-blue-600" />
          <span>Gemini 語音生成</span>
          <Badge variant="secondary" className="ml-2">AI驅動</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 語音類型選擇 */}
        <div className="space-y-2">
          <Label>語音類型</Label>
          <Select value={speechType} onValueChange={(value: any) => setSpeechType(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {hasSummary && (
                <SelectItem value="summary">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-4 h-4" />
                    <span>摘要語音</span>
                  </div>
                </SelectItem>
              )}
              {hasKeyPoints && (
                <SelectItem value="keypoints">
                  <div className="flex items-center space-x-2">
                    <List className="w-4 h-4" />
                    <span>重點語音</span>
                  </div>
                </SelectItem>
              )}
              <SelectItem value="custom">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4" />
                  <span>自定義語音</span>
                </div>
              </SelectItem>
              {hasTranscript && (
                <SelectItem value="full">
                  <div className="flex items-center space-x-2">
                    <Mic className="w-4 h-4" />
                    <span>完整語音</span>
                  </div>
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* 自定義文字輸入 */}
        {speechType === 'custom' && (
          <div className="space-y-2">
            <Label>自定義文字</Label>
            <Textarea
              placeholder="輸入要轉換為語音的文字內容..."
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              className="min-h-[100px]"
            />
            <div className="text-xs text-gray-500">
              {customText.length} 字符
            </div>
          </div>
        )}

        {/* 語音設定 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>語音類型</Label>
            <Select value={voice} onValueChange={(value: any) => setVoice(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="neutral">中性語音</SelectItem>
                <SelectItem value="female">女性語音</SelectItem>
                <SelectItem value="male">男性語音</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>語速: {speed[0].toFixed(1)}x</Label>
            <Slider
              value={speed}
              onValueChange={setSpeed}
              min={0.5}
              max={2.0}
              step={0.1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>慢速</span>
              <span>正常</span>
              <span>快速</span>
            </div>
          </div>
        </div>

        {/* 生成按鈕 */}
        <Button 
          onClick={handleGenerateSpeech}
          disabled={isGenerating}
          className="w-full"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              生成中...
            </>
          ) : (
            <>
              {getSpeechTypeIcon(speechType)}
              <span className="ml-2">生成 {getSpeechTypeLabel(speechType)}</span>
            </>
          )}
        </Button>

        {/* 播放控制 */}
        {generatedAudio && (
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <Volume2 className="w-4 h-4 text-green-600" />
                  <span className="font-medium text-green-800">語音已生成</span>
                  <Badge variant="outline" className="text-xs">
                    {Math.round(generatedAudio.duration)} 秒
                  </Badge>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePlayPause}
                  className="flex-shrink-0"
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  className="flex-shrink-0"
                >
                  <Download className="w-4 h-4" />
                </Button>
                
                <div className="text-xs text-gray-600 truncate">
                  {generatedAudio.text.substring(0, 50)}...
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 功能說明 */}
        <div className="bg-blue-50 rounded-lg p-3">
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Gemini 語音生成功能：</p>
            <ul className="text-xs space-y-1">
              <li>• 使用 Gemini AI 優化文字表達</li>
              <li>• 支援多種語音類型和語速調整</li>
              <li>• 自動處理標點符號和語調</li>
              <li>• 適合創建音頻摘要和語音播報</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}