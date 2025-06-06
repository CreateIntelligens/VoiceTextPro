import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Settings, Mic, Volume2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export interface AudioSettings {
  sensitivity: number;
  autoGainControl: boolean;
  noiseSuppression: boolean;
  echoCancellation: boolean;
  minDecibels: number;
  maxDecibels: number;
  smoothingTimeConstant: number;
  fftSize: number;
}

interface AudioSettingsPanelProps {
  settings: AudioSettings;
  onSettingsChange: (settings: AudioSettings) => void;
  isRecording?: boolean;
}

export default function AudioSettingsPanel({ 
  settings, 
  onSettingsChange, 
  isRecording = false 
}: AudioSettingsPanelProps) {
  const [localSettings, setLocalSettings] = useState<AudioSettings>(settings);

  const handleSettingChange = (key: keyof AudioSettings, value: any) => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
    onSettingsChange(newSettings);
  };

  const resetToDefaults = () => {
    const defaultSettings: AudioSettings = {
      sensitivity: 1000,
      autoGainControl: true,
      noiseSuppression: false,
      echoCancellation: true,
      minDecibels: -120,
      maxDecibels: 0,
      smoothingTimeConstant: 0.1,
      fftSize: 256
    };
    setLocalSettings(defaultSettings);
    onSettingsChange(defaultSettings);
  };

  const presets = {
    會議室環境: {
      sensitivity: 1000,
      autoGainControl: true,
      noiseSuppression: false,
      echoCancellation: true,
      minDecibels: -120,
      maxDecibels: 0,
      smoothingTimeConstant: 0.1,
      fftSize: 256
    },
    安靜環境: {
      sensitivity: 2000,
      autoGainControl: true,
      noiseSuppression: true,
      echoCancellation: true,
      minDecibels: -100,
      maxDecibels: 0,
      smoothingTimeConstant: 0.3,
      fftSize: 512
    },
    嘈雜環境: {
      sensitivity: 500,
      autoGainControl: false,
      noiseSuppression: true,
      echoCancellation: true,
      minDecibels: -80,
      maxDecibels: 0,
      smoothingTimeConstant: 0.5,
      fftSize: 1024
    }
  };

  const applyPreset = (presetName: keyof typeof presets) => {
    const preset = presets[presetName];
    setLocalSettings(preset);
    onSettingsChange(preset);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          disabled={isRecording}
          className="gap-2"
        >
          <Settings className="h-4 w-4" />
          音頻設定
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            音頻錄製設定
          </DialogTitle>
          <DialogDescription>
            調整麥克風靈敏度和音頻處理參數以獲得最佳錄音效果
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* 預設模式 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">快速預設</CardTitle>
              <CardDescription>
                根據不同環境選擇最佳設定
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {Object.keys(presets).map((presetName) => (
                  <Button
                    key={presetName}
                    variant="outline"
                    onClick={() => applyPreset(presetName as keyof typeof presets)}
                    disabled={isRecording}
                    className="h-auto p-3 text-left"
                  >
                    <div>
                      <div className="font-medium">{presetName}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {presetName === "會議室環境" && "適合會議室和小組討論"}
                        {presetName === "安靜環境" && "適合圖書館或安靜辦公室"}
                        {presetName === "嘈雜環境" && "適合咖啡廳或開放空間"}
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 靈敏度設定 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Volume2 className="h-5 w-5" />
                音量靈敏度
              </CardTitle>
              <CardDescription>
                調整音量檢測的靈敏度，數值越高越容易偵測小聲講話
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium">
                  靈敏度倍數: {localSettings.sensitivity}x
                </Label>
                <Slider
                  value={[localSettings.sensitivity]}
                  onValueChange={(value) => handleSettingChange('sensitivity', value[0])}
                  min={100}
                  max={3000}
                  step={100}
                  disabled={isRecording}
                  className="mt-2"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>低靈敏度</span>
                  <span>高靈敏度</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 音頻處理設定 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">音頻處理</CardTitle>
              <CardDescription>
                啟用或停用各種音頻處理功能
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">自動增益控制</Label>
                  <p className="text-sm text-muted-foreground">
                    自動調整音量以保持一致的錄音水準
                  </p>
                </div>
                <Switch
                  checked={localSettings.autoGainControl}
                  onCheckedChange={(checked) => handleSettingChange('autoGainControl', checked)}
                  disabled={isRecording}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">回音消除</Label>
                  <p className="text-sm text-muted-foreground">
                    減少錄音中的回音和反響
                  </p>
                </div>
                <Switch
                  checked={localSettings.echoCancellation}
                  onCheckedChange={(checked) => handleSettingChange('echoCancellation', checked)}
                  disabled={isRecording}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">噪音抑制</Label>
                  <p className="text-sm text-muted-foreground">
                    減少背景噪音，但可能影響音質
                  </p>
                </div>
                <Switch
                  checked={localSettings.noiseSuppression}
                  onCheckedChange={(checked) => handleSettingChange('noiseSuppression', checked)}
                  disabled={isRecording}
                />
              </div>
            </CardContent>
          </Card>

          {/* 進階設定 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">進階設定</CardTitle>
              <CardDescription>
                音頻分析器的詳細參數設定
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium">
                  最小音量閾值: {localSettings.minDecibels}dB
                </Label>
                <Slider
                  value={[localSettings.minDecibels]}
                  onValueChange={(value) => handleSettingChange('minDecibels', value[0])}
                  min={-150}
                  max={-50}
                  step={10}
                  disabled={isRecording}
                  className="mt-2"
                />
              </div>

              <div>
                <Label className="text-sm font-medium">
                  平滑常數: {localSettings.smoothingTimeConstant.toFixed(1)}
                </Label>
                <Slider
                  value={[localSettings.smoothingTimeConstant]}
                  onValueChange={(value) => handleSettingChange('smoothingTimeConstant', value[0])}
                  min={0.0}
                  max={1.0}
                  step={0.1}
                  disabled={isRecording}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  較低值反應更快，較高值更穩定
                </p>
              </div>

              <div>
                <Label className="text-sm font-medium">
                  FFT 大小: {localSettings.fftSize}
                </Label>
                <Slider
                  value={[Math.log2(localSettings.fftSize)]}
                  onValueChange={(value) => handleSettingChange('fftSize', Math.pow(2, value[0]))}
                  min={7} // 2^7 = 128
                  max={12} // 2^12 = 4096
                  step={1}
                  disabled={isRecording}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  較小值反應更快，較大值精度更高
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 重設按鈕 */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={resetToDefaults}
              disabled={isRecording}
            >
              重設為預設值
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}