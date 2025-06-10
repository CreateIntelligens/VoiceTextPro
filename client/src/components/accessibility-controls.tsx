import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, EyeOff, Type, Contrast, Volume2, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AccessibilitySettings {
  highContrast: boolean;
  fontSize: number;
  reduceMotion: boolean;
  screenReaderMode: boolean;
  focusIndicators: boolean;
  colorBlindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
  announcements: boolean;
}

export default function AccessibilityControls() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [settings, setSettings] = useState<AccessibilitySettings>({
    highContrast: false,
    fontSize: 16,
    reduceMotion: false,
    screenReaderMode: false,
    focusIndicators: true,
    colorBlindMode: 'none',
    announcements: true,
  });

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Focus the card when opened
      cardRef.current?.focus();
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Load settings from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('accessibility-settings');
    if (saved) {
      try {
        const parsedSettings = JSON.parse(saved);
        setSettings(parsedSettings);
        applySettings(parsedSettings);
      } catch (error) {
        console.error('Failed to load accessibility settings:', error);
      }
    }
  }, []);

  // Apply accessibility settings to document
  const applySettings = (newSettings: AccessibilitySettings) => {
    const root = document.documentElement;
    
    // High contrast mode
    if (newSettings.highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }

    // Font size
    root.style.fontSize = `${newSettings.fontSize}px`;

    // Reduced motion
    if (newSettings.reduceMotion) {
      root.classList.add('reduce-motion');
    } else {
      root.classList.remove('reduce-motion');
    }

    // Screen reader mode
    if (newSettings.screenReaderMode) {
      root.classList.add('screen-reader-mode');
    } else {
      root.classList.remove('screen-reader-mode');
    }

    // Enhanced focus indicators
    if (newSettings.focusIndicators) {
      root.classList.add('enhanced-focus');
    } else {
      root.classList.remove('enhanced-focus');
    }

    // Color blind mode
    root.className = root.className.replace(/colorblind-\w+/g, '');
    if (newSettings.colorBlindMode !== 'none') {
      root.classList.add(`colorblind-${newSettings.colorBlindMode}`);
    }

    // Save to localStorage
    localStorage.setItem('accessibility-settings', JSON.stringify(newSettings));
    
    // Announce changes for screen readers
    if (newSettings.announcements) {
      announceChange(newSettings);
    }
  };

  // Announce accessibility changes
  const announceChange = (newSettings: AccessibilitySettings) => {
    const announcer = document.getElementById('accessibility-announcer');
    if (announcer) {
      let message = '無障礙設定已更新：';
      if (newSettings.highContrast) message += ' 高對比模式已啟用';
      if (newSettings.screenReaderMode) message += ' 螢幕閱讀器模式已啟用';
      if (newSettings.reduceMotion) message += ' 減少動畫效果已啟用';
      
      announcer.textContent = message;
      setTimeout(() => {
        announcer.textContent = '';
      }, 3000);
    }
  };

  const updateSetting = <K extends keyof AccessibilitySettings>(
    key: K,
    value: AccessibilitySettings[K]
  ) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    applySettings(newSettings);
    
    if (settings.announcements) {
      toast({
        title: "無障礙設定已更新",
        description: getSettingDescription(key, value),
      });
    }
  };

  const getSettingDescription = (key: keyof AccessibilitySettings, value: any): string => {
    switch (key) {
      case 'highContrast':
        return value ? '高對比模式已啟用' : '高對比模式已停用';
      case 'fontSize':
        return `字體大小設為 ${value}px`;
      case 'reduceMotion':
        return value ? '減少動畫效果已啟用' : '動畫效果已恢復';
      case 'screenReaderMode':
        return value ? '螢幕閱讀器模式已啟用' : '螢幕閱讀器模式已停用';
      case 'focusIndicators':
        return value ? '增強焦點指示已啟用' : '標準焦點指示';
      case 'colorBlindMode':
        return value === 'none' ? '標準色彩模式' : `色盲友善模式：${value}`;
      case 'announcements':
        return value ? '語音提示已啟用' : '語音提示已停用';
      default:
        return '設定已更新';
    }
  };

  const resetSettings = () => {
    const defaultSettings: AccessibilitySettings = {
      highContrast: false,
      fontSize: 16,
      reduceMotion: false,
      screenReaderMode: false,
      focusIndicators: true,
      colorBlindMode: 'none',
      announcements: true,
    };
    setSettings(defaultSettings);
    applySettings(defaultSettings);
    
    toast({
      title: "無障礙設定已重置",
      description: "所有設定已恢復為預設值",
    });
  };

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50 h-12 w-12 rounded-full p-0 shadow-lg"
        aria-label="開啟無障礙設定"
        title="無障礙設定"
      >
        <Settings className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <>
      {/* Screen reader announcer */}
      <div
        id="accessibility-announcer"
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      />

      <Card 
        ref={cardRef}
        className="fixed bottom-4 right-4 z-50 w-80 max-h-96 overflow-y-auto shadow-xl"
        role="dialog"
        aria-labelledby="accessibility-settings-title"
        aria-describedby="accessibility-settings-description"
        tabIndex={-1}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle id="accessibility-settings-title" className="text-lg flex items-center gap-2">
              <Eye className="h-5 w-5" aria-hidden="true" />
              無障礙設定
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              aria-label="關閉無障礙設定"
            >
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          <p id="accessibility-settings-description" className="text-sm text-gray-600">
            調整平台的無障礙設定以改善您的使用體驗
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* High Contrast */}
          <div className="flex items-center justify-between">
            <Label htmlFor="high-contrast" className="flex items-center gap-2">
              <Contrast className="h-4 w-4" />
              高對比模式
            </Label>
            <Switch
              id="high-contrast"
              checked={settings.highContrast}
              onCheckedChange={(checked) => updateSetting('highContrast', checked)}
              aria-describedby="high-contrast-desc"
            />
          </div>
          <p id="high-contrast-desc" className="text-xs text-muted-foreground">
            提高文字和背景的對比度，改善可讀性
          </p>

          {/* Font Size */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Type className="h-4 w-4" />
              字體大小: {settings.fontSize}px
            </Label>
            <Slider
              value={[settings.fontSize]}
              onValueChange={([value]) => updateSetting('fontSize', value)}
              min={12}
              max={24}
              step={1}
              className="w-full"
              aria-label="調整字體大小"
            />
          </div>

          {/* Screen Reader Mode */}
          <div className="flex items-center justify-between">
            <Label htmlFor="screen-reader" className="flex items-center gap-2">
              <Volume2 className="h-4 w-4" />
              螢幕閱讀器模式
            </Label>
            <Switch
              id="screen-reader"
              checked={settings.screenReaderMode}
              onCheckedChange={(checked) => updateSetting('screenReaderMode', checked)}
              aria-describedby="screen-reader-desc"
            />
          </div>
          <p id="screen-reader-desc" className="text-xs text-muted-foreground">
            優化介面以配合螢幕閱讀器使用
          </p>

          {/* Reduce Motion */}
          <div className="flex items-center justify-between">
            <Label htmlFor="reduce-motion">
              減少動畫效果
            </Label>
            <Switch
              id="reduce-motion"
              checked={settings.reduceMotion}
              onCheckedChange={(checked) => updateSetting('reduceMotion', checked)}
            />
          </div>

          {/* Enhanced Focus */}
          <div className="flex items-center justify-between">
            <Label htmlFor="focus-indicators">
              增強焦點指示
            </Label>
            <Switch
              id="focus-indicators"
              checked={settings.focusIndicators}
              onCheckedChange={(checked) => updateSetting('focusIndicators', checked)}
            />
          </div>

          {/* Color Blind Mode */}
          <div className="space-y-2">
            <Label>色盲友善模式</Label>
            <Select
              value={settings.colorBlindMode}
              onValueChange={(value: any) => updateSetting('colorBlindMode', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">標準色彩</SelectItem>
                <SelectItem value="protanopia">紅色盲</SelectItem>
                <SelectItem value="deuteranopia">綠色盲</SelectItem>
                <SelectItem value="tritanopia">藍色盲</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Announcements */}
          <div className="flex items-center justify-between">
            <Label htmlFor="announcements">
              語音提示
            </Label>
            <Switch
              id="announcements"
              checked={settings.announcements}
              onCheckedChange={(checked) => updateSetting('announcements', checked)}
            />
          </div>

          {/* Reset Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={resetSettings}
            className="w-full mt-4"
            aria-label="重置所有無障礙設定為預設值"
          >
            重置為預設值
          </Button>
        </CardContent>
      </Card>
    </>
  );
}