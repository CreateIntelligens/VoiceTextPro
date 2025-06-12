import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { Settings, Mic, Brain, Shield, Globe, Save, RotateCcw, Info } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface TranscriptionConfig {
  // 基本設置
  speaker_labels: boolean;
  speakers_expected: number;
  speech_threshold: number;
  
  // 語言設置
  language_detection: boolean;
  language_code: string;
  language_confidence_threshold: number;
  
  // 音頻處理
  boost_param: string;
  multichannel: boolean;
  
  // 文本處理
  punctuate: boolean;
  format_text: boolean;
  disfluencies: boolean;
  filter_profanity: boolean;
  
  // 隱私保護
  redact_pii: boolean;
  redact_pii_policies: string[];
  
  // AI 功能
  summarization: boolean;
  auto_highlights: boolean;
  iab_categories: boolean;
  sentiment_analysis: boolean;
  entity_detection: boolean;
  content_safety: boolean;
  custom_topics: boolean;
  
  // 自定義設置
  custom_keywords: string;
  config_name: string;
}

const DEFAULT_CONFIG: TranscriptionConfig = {
  // 基本設置
  speaker_labels: true,
  speakers_expected: 4,
  speech_threshold: 0.3,
  
  // 語言設置
  language_detection: true,
  language_code: "auto",
  language_confidence_threshold: 0.6,
  
  // 音頻處理
  boost_param: "high",
  multichannel: false,
  
  // 文本處理
  punctuate: true,
  format_text: true,
  disfluencies: false,
  filter_profanity: false,
  
  // 隱私保護
  redact_pii: false,
  redact_pii_policies: [],
  
  // AI 功能
  summarization: true,
  auto_highlights: true,
  iab_categories: true,
  sentiment_analysis: false,
  entity_detection: true,
  content_safety: true,
  custom_topics: true,
  
  // 自定義設置
  custom_keywords: "",
  config_name: "標準配置"
};

const PRESET_CONFIGS = {
  standard: {
    ...DEFAULT_CONFIG,
    config_name: "標準配置",
    speech_threshold: 0.3,
    boost_param: "high",
    speakers_expected: 4
  },
  fast: {
    ...DEFAULT_CONFIG,
    config_name: "快速模式",
    speech_threshold: 0.4,
    boost_param: "default",
    speakers_expected: 3,
    summarization: false,
    iab_categories: false,
    sentiment_analysis: false,
    entity_detection: false,
    content_safety: false,
    custom_topics: false
  },
  high_quality: {
    ...DEFAULT_CONFIG,
    config_name: "高品質模式",
    speech_threshold: 0.2,
    boost_param: "high",
    speakers_expected: 6,
    multichannel: true,
    disfluencies: true
  },
  privacy: {
    ...DEFAULT_CONFIG,
    config_name: "隱私保護模式",
    redact_pii: true,
    redact_pii_policies: ["phone_number", "email_address", "credit_card_number"],
    filter_profanity: true,
    iab_categories: false,
    sentiment_analysis: false
  },
  chinese: {
    ...DEFAULT_CONFIG,
    config_name: "中文優化模式",
    language_detection: false,
    language_code: "zh",
    speech_threshold: 0.25,
    language_confidence_threshold: 0.8
  }
};

export default function TranscriptionSettings() {
  const [config, setConfig] = useState<TranscriptionConfig>(DEFAULT_CONFIG);
  const [selectedPreset, setSelectedPreset] = useState<string>("standard");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 載入當前配置
  const { data: currentConfig } = useQuery({
    queryKey: ["/api/transcription-config"],
  });

  // 保存配置
  const saveConfigMutation = useMutation({
    mutationFn: (newConfig: TranscriptionConfig) => 
      apiRequest("/api/transcription-config", "POST", newConfig),
    onSuccess: () => {
      toast({
        title: "配置已保存",
        description: "轉錄調教設置已成功更新",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/transcription-config"] });
    },
    onError: () => {
      toast({
        title: "保存失敗",
        description: "無法保存配置設置，請稍後再試",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (currentConfig) {
      setConfig(currentConfig as TranscriptionConfig);
    }
  }, [currentConfig]);

  const handlePresetChange = (preset: string) => {
    setSelectedPreset(preset);
    setConfig(PRESET_CONFIGS[preset as keyof typeof PRESET_CONFIGS]);
  };

  const handleConfigChange = (key: keyof TranscriptionConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    saveConfigMutation.mutate(config);
  };

  const handleReset = () => {
    setConfig(DEFAULT_CONFIG);
    setSelectedPreset("standard");
  };

  const piiPolicies = [
    { value: "phone_number", label: "電話號碼" },
    { value: "email_address", label: "電子郵件" },
    { value: "credit_card_number", label: "信用卡號碼" },
    { value: "us_social_security_number", label: "社會安全號碼" },
    { value: "date_of_birth", label: "出生日期" },
    { value: "person_name", label: "人名" }
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* 頁面標題 */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center">
              <Settings className="w-8 h-8 mr-3 text-blue-600" />
              轉錄調教設置
            </h1>
            <p className="text-slate-600">自定義 AssemblyAI 語音識別參數，優化轉錄品質和功能</p>
          </div>

          {/* 預設配置選擇 */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                <RotateCcw className="w-5 h-5 mr-2" />
                預設配置
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {Object.entries(PRESET_CONFIGS).map(([key, preset]) => (
                  <Button
                    key={key}
                    variant={selectedPreset === key ? "default" : "outline"}
                    onClick={() => handlePresetChange(key)}
                    className="h-auto p-4 flex flex-col items-start"
                  >
                    <div className="font-medium">{preset.config_name}</div>
                    <div className="text-xs opacity-70 mt-1">
                      {key === "fast" && "優化處理速度"}
                      {key === "high_quality" && "最佳準確度"}
                      {key === "privacy" && "隱私保護"}
                      {key === "chinese" && "中文優化"}
                      {key === "standard" && "平衡設置"}
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 詳細配置選項 */}
          <Tabs defaultValue="basic" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="basic" className="flex items-center">
                <Mic className="w-4 h-4 mr-2" />
                基本設置
              </TabsTrigger>
              <TabsTrigger value="language" className="flex items-center">
                <Globe className="w-4 h-4 mr-2" />
                語言設置
              </TabsTrigger>
              <TabsTrigger value="ai" className="flex items-center">
                <Brain className="w-4 h-4 mr-2" />
                AI 功能
              </TabsTrigger>
              <TabsTrigger value="privacy" className="flex items-center">
                <Shield className="w-4 h-4 mr-2" />
                隱私保護
              </TabsTrigger>
              <TabsTrigger value="advanced" className="flex items-center">
                <Settings className="w-4 h-4 mr-2" />
                進階設置
              </TabsTrigger>
            </TabsList>

            {/* 基本設置 */}
            <TabsContent value="basic">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>講者識別</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="speaker_labels">啟用講者標籤</Label>
                      <Switch
                        id="speaker_labels"
                        checked={config.speaker_labels}
                        onCheckedChange={(checked) => handleConfigChange('speaker_labels', checked)}
                      />
                    </div>
                    
                    <div>
                      <Label>預期講者數量: {config.speakers_expected}</Label>
                      <Slider
                        value={[config.speakers_expected]}
                        onValueChange={([value]) => handleConfigChange('speakers_expected', value)}
                        max={10}
                        min={1}
                        step={1}
                        className="mt-2"
                      />
                    </div>

                    <div>
                      <Label>語音檢測閾值: {config.speech_threshold}</Label>
                      <Slider
                        value={[config.speech_threshold]}
                        onValueChange={([value]) => handleConfigChange('speech_threshold', value)}
                        max={1}
                        min={0.1}
                        step={0.1}
                        className="mt-2"
                      />
                      <p className="text-xs text-slate-500 mt-1">較低值提高靈敏度，較高值減少誤判</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>音頻處理</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>音頻增強級別</Label>
                      <Select value={config.boost_param} onValueChange={(value) => handleConfigChange('boost_param', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">低</SelectItem>
                          <SelectItem value="default">預設</SelectItem>
                          <SelectItem value="high">高</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="multichannel">多聲道處理</Label>
                      <Switch
                        id="multichannel"
                        checked={config.multichannel}
                        onCheckedChange={(checked) => handleConfigChange('multichannel', checked)}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* 語言設置 */}
            <TabsContent value="language">
              <Card>
                <CardHeader>
                  <CardTitle>語言識別設置</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="language_detection">自動語言檢測</Label>
                        <Switch
                          id="language_detection"
                          checked={config.language_detection}
                          onCheckedChange={(checked) => handleConfigChange('language_detection', checked)}
                        />
                      </div>

                      {!config.language_detection && (
                        <div>
                          <Label>指定語言</Label>
                          <Select value={config.language_code} onValueChange={(value) => handleConfigChange('language_code', value)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="zh">中文</SelectItem>
                              <SelectItem value="en_us">英文 (美國)</SelectItem>
                              <SelectItem value="ja">日文</SelectItem>
                              <SelectItem value="ko">韓文</SelectItem>
                              <SelectItem value="auto">自動檢測</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>

                    <div>
                      <Label>語言信心度閾值: {config.language_confidence_threshold}</Label>
                      <Slider
                        value={[config.language_confidence_threshold]}
                        onValueChange={([value]) => handleConfigChange('language_confidence_threshold', value)}
                        max={1}
                        min={0.1}
                        step={0.1}
                        className="mt-2"
                      />
                      <p className="text-xs text-slate-500 mt-1">較低值接受更多語言變化</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* AI 功能 */}
            <TabsContent value="ai">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>AI 分析功能</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {[
                      { key: 'summarization', label: '自動摘要' },
                      { key: 'auto_highlights', label: '重點標記' },
                      { key: 'sentiment_analysis', label: '情感分析' },
                      { key: 'entity_detection', label: '實體識別' },
                      { key: 'iab_categories', label: '主題分類' },
                      { key: 'custom_topics', label: '自定義主題' }
                    ].map(({ key, label }) => (
                      <div key={key} className="flex items-center justify-between">
                        <Label htmlFor={key}>{label}</Label>
                        <Switch
                          id={key}
                          checked={config[key as keyof TranscriptionConfig] as boolean}
                          onCheckedChange={(checked) => handleConfigChange(key as keyof TranscriptionConfig, checked)}
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>文本處理</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {[
                      { key: 'punctuate', label: '自動標點符號' },
                      { key: 'format_text', label: '文本格式化' },
                      { key: 'disfluencies', label: '保留語言不流暢' },
                      { key: 'filter_profanity', label: '過濾不當言論' },
                      { key: 'content_safety', label: '內容安全檢測' }
                    ].map(({ key, label }) => (
                      <div key={key} className="flex items-center justify-between">
                        <Label htmlFor={key}>{label}</Label>
                        <Switch
                          id={key}
                          checked={config[key as keyof TranscriptionConfig] as boolean}
                          onCheckedChange={(checked) => handleConfigChange(key as keyof TranscriptionConfig, checked)}
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* 隱私保護 */}
            <TabsContent value="privacy">
              <Card>
                <CardHeader>
                  <CardTitle>隱私保護設置</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="redact_pii">啟用個人信息移除</Label>
                      <p className="text-sm text-slate-500">自動檢測並移除個人識別信息</p>
                    </div>
                    <Switch
                      id="redact_pii"
                      checked={config.redact_pii}
                      onCheckedChange={(checked) => handleConfigChange('redact_pii', checked)}
                    />
                  </div>

                  {config.redact_pii && (
                    <div>
                      <Label>選擇要移除的信息類型</Label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                        {piiPolicies.map(({ value, label }) => (
                          <div key={value} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={value}
                              checked={config.redact_pii_policies.includes(value)}
                              onChange={(e) => {
                                const policies = e.target.checked
                                  ? [...config.redact_pii_policies, value]
                                  : config.redact_pii_policies.filter(p => p !== value);
                                handleConfigChange('redact_pii_policies', policies);
                              }}
                              className="rounded"
                            />
                            <Label htmlFor={value} className="text-sm">{label}</Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* 進階設置 */}
            <TabsContent value="advanced">
              <Card>
                <CardHeader>
                  <CardTitle>進階自定義設置</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label htmlFor="config_name">配置名稱</Label>
                    <Input
                      id="config_name"
                      value={config.config_name}
                      onChange={(e) => handleConfigChange('config_name', e.target.value)}
                      placeholder="為此配置命名"
                    />
                  </div>

                  <div>
                    <Label htmlFor="custom_keywords">自定義關鍵字</Label>
                    <Textarea
                      id="custom_keywords"
                      value={config.custom_keywords}
                      onChange={(e) => handleConfigChange('custom_keywords', e.target.value)}
                      placeholder="輸入關鍵字，用逗號分隔（例如：會議,討論,決策）"
                      rows={3}
                    />
                    <p className="text-sm text-slate-500 mt-1">這些關鍵字將獲得更高的識別優先級</p>
                  </div>

                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex items-start">
                      <Info className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
                      <div className="text-sm text-blue-800">
                        <p className="font-medium mb-1">配置建議</p>
                        <ul className="space-y-1 text-xs">
                          <li>• 一般會議：使用標準配置</li>
                          <li>• 快速轉錄：關閉部分 AI 功能</li>
                          <li>• 重要會議：啟用高品質模式</li>
                          <li>• 敏感內容：啟用隱私保護</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* 操作按鈕 */}
          <div className="flex justify-between mt-8">
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="w-4 h-4 mr-2" />
              重置為預設
            </Button>
            
            <Button 
              onClick={handleSave} 
              disabled={saveConfigMutation.isPending}
              className="min-w-[120px]"
            >
              <Save className="w-4 h-4 mr-2" />
              {saveConfigMutation.isPending ? "保存中..." : "保存配置"}
            </Button>
          </div>

          {/* 當前配置摘要 */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>當前配置摘要</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">配置名稱: </span>
                  <Badge variant="secondary">{config.config_name}</Badge>
                </div>
                <div>
                  <span className="text-slate-500">講者數量: </span>
                  <Badge variant="secondary">{config.speakers_expected}</Badge>
                </div>
                <div>
                  <span className="text-slate-500">音頻增強: </span>
                  <Badge variant="secondary">{config.boost_param}</Badge>
                </div>
                <div>
                  <span className="text-slate-500">AI 功能: </span>
                  <Badge variant="secondary">
                    {[config.summarization, config.auto_highlights, config.entity_detection].filter(Boolean).length}/3
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}