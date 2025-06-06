import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Badge } from "@/components/ui/badge";
import { 
  Mic, 
  FileAudio, 
  Users, 
  Brain, 
  Zap, 
  Shield, 
  ArrowRight,
  PlayCircle,
  Upload,
  MessageSquare,
  Settings,
  BarChart3
} from "lucide-react";

export default function Welcome() {
  const { user } = useAuth();
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const features = [
    {
      id: "record",
      title: "即時錄音",
      description: "高品質音頻錄製，支援即時音量監控",
      icon: Mic,
      color: "bg-blue-500",
      gradient: "from-blue-500 to-blue-600",
      action: "/record",
      actionText: "開始錄音"
    },
    {
      id: "upload",
      title: "文件上傳",
      description: "支援多種音頻格式，快速批量處理",
      icon: Upload,
      color: "bg-green-500",
      gradient: "from-green-500 to-green-600",
      action: "/upload",
      actionText: "上傳文件"
    },
    {
      id: "transcriptions",
      title: "轉錄記錄",
      description: "查看所有轉錄歷史，管理音頻文件",
      icon: FileAudio,
      color: "bg-purple-500",
      gradient: "from-purple-500 to-purple-600",
      action: "/transcriptions",
      actionText: "查看記錄"
    },
    {
      id: "keywords",
      title: "關鍵字優化",
      description: "自定義關鍵字，提升轉錄準確度",
      icon: Brain,
      color: "bg-orange-500",
      gradient: "from-orange-500 to-orange-600",
      action: "/keywords",
      actionText: "管理關鍵字"
    }
  ];

  const platformFeatures = [
    { icon: Zap, text: "AI 驅動的智能轉錄" },
    { icon: Users, text: "多講者識別與分離" },
    { icon: Brain, text: "Gemini AI 內容整理" },
    { icon: Shield, text: "企業級安全保護" },
    { icon: MessageSquare, text: "即時客服支援" },
    { icon: BarChart3, text: "詳細使用統計" }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      {/* Header Section */}
      <div className="relative overflow-hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10" />
        <div className="relative max-w-7xl mx-auto px-4 py-12">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mb-6">
              <Mic className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">
              歡迎回來，{(user as any)?.firstName || (user as any)?.email}！
            </h1>
            <p className="text-xl text-slate-600 dark:text-slate-300 mb-6 max-w-2xl mx-auto">
              智能多語言語音轉錄平台為您提供專業級的音頻分析和文字轉錄服務
            </p>
            <div className="flex items-center justify-center space-x-4">
              <Badge variant="secondary" className="px-3 py-1">
                <Users className="w-4 h-4 mr-1" />
                {(user as any)?.role === 'admin' ? '管理員' : '用戶'}
              </Badge>
              <Badge variant="outline" className="px-3 py-1">
                <Shield className="w-4 h-4 mr-1" />
                已驗證帳戶
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Section */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 text-center">
            快速開始
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => {
              const Icon = feature.icon;
              const isHovered = hoveredCard === feature.id;
              
              return (
                <Card 
                  key={feature.id}
                  className={`relative overflow-hidden transition-all duration-300 cursor-pointer group border-0 shadow-lg ${
                    isHovered ? 'transform -translate-y-2 shadow-2xl' : ''
                  }`}
                  onMouseEnter={() => setHoveredCard(feature.id)}
                  onMouseLeave={() => setHoveredCard(null)}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-90`} />
                  <CardHeader className="relative text-white pb-4">
                    <div className="flex items-center justify-between">
                      <Icon className="w-8 h-8" />
                      <ArrowRight className={`w-5 h-5 transition-transform duration-300 ${
                        isHovered ? 'translate-x-1' : ''
                      }`} />
                    </div>
                    <CardTitle className="text-xl font-bold">
                      {feature.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="relative text-white">
                    <p className="text-white/90 mb-4 text-sm leading-relaxed">
                      {feature.description}
                    </p>
                    <Link href={feature.action}>
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        className="w-full bg-white/20 hover:bg-white/30 text-white border-white/30"
                      >
                        {feature.actionText}
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Platform Features */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 text-center">
            平台特色功能
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {platformFeatures.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div 
                  key={index}
                  className="flex items-center space-x-3 p-4 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow"
                >
                  <div className="flex-shrink-0">
                    <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="text-slate-700 dark:text-slate-300 font-medium">
                    {feature.text}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Getting Started */}
        <Card className="bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-800 dark:to-slate-700 border-slate-200 dark:border-slate-600">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-slate-900 dark:text-white flex items-center">
              <PlayCircle className="w-6 h-6 mr-2 text-blue-600" />
              開始使用指南
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-lg font-bold text-blue-600 dark:text-blue-400">1</span>
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-2">錄製或上傳</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  使用內建錄音功能或上傳音頻文件開始轉錄
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-lg font-bold text-green-600 dark:text-green-400">2</span>
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-2">智能分析</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  AI 自動識別講者並生成精準的文字轉錄
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-lg font-bold text-purple-600 dark:text-purple-400">3</span>
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-2">整理輸出</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  使用 Gemini AI 整理內容並輸出專業格式
                </p>
              </div>
            </div>
            <div className="mt-8 text-center">
              <Link href="/record">
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                  <Mic className="w-5 h-5 mr-2" />
                  立即開始錄音
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Admin Panel Access */}
        {(user as any)?.role === 'admin' && (
          <Card className="mt-8 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-800">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-amber-800 dark:text-amber-400 flex items-center">
                <Settings className="w-6 h-6 mr-2" />
                管理員功能
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-amber-700 dark:text-amber-300 mb-4">
                您具有管理員權限，可以存取系統管理功能
              </p>
              <div className="flex space-x-4">
                <Link href="/admin">
                  <Button variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-100">
                    管理面板
                  </Button>
                </Link>
                <Link href="/admin/logs">
                  <Button variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-100">
                    系統日誌
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}