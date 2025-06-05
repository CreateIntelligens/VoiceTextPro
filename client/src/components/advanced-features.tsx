import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  FileText, 
  Zap, 
  BookOpen, 
  Hash, 
  Heart, 
  Eye, 
  Shield, 
  ChevronDown,
  Clock,
  TrendingUp
} from "lucide-react";
import type { TranscriptionStatus } from "@/lib/types";

interface AdvancedFeaturesProps {
  transcription: TranscriptionStatus;
}

function formatTimestamp(milliseconds: number): string {
  const minutes = Math.floor(milliseconds / 60000);
  const seconds = Math.floor((milliseconds % 60000) / 1000);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function getSentimentColor(sentiment: string): string {
  switch (sentiment.toLowerCase()) {
    case 'positive': return 'text-green-600 bg-green-50 border-green-200';
    case 'negative': return 'text-red-600 bg-red-50 border-red-200';
    case 'neutral': return 'text-gray-600 bg-gray-50 border-gray-200';
    default: return 'text-gray-600 bg-gray-50 border-gray-200';
  }
}

function getSentimentIcon(sentiment: string): JSX.Element {
  switch (sentiment.toLowerCase()) {
    case 'positive': return <span className="text-green-500">😊</span>;
    case 'negative': return <span className="text-red-500">😞</span>;
    case 'neutral': return <span className="text-gray-500">😐</span>;
    default: return <span className="text-gray-500">🤔</span>;
  }
}

export default function AdvancedFeatures({ transcription }: AdvancedFeaturesProps) {
  if (!transcription || transcription.status !== 'completed') {
    return (
      <Card className="w-full">
        <CardContent className="p-6 text-center text-gray-500">
          <FileText className="w-12 h-12 mx-auto mb-2 text-gray-400" />
          <p>轉錄完成後將顯示進階分析結果</p>
        </CardContent>
      </Card>
    );
  }

  const features: JSX.Element[] = [];

  // Summary section
  if (transcription.summary) {
    features.push(
      <Card key="summary" className="w-full">
        <Collapsible>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">AI 智能摘要</CardTitle>
                    <p className="text-sm text-gray-600">自動生成的內容摘要</p>
                  </div>
                </div>
                <ChevronDown className="w-5 h-5 text-gray-400" />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                <p className="text-gray-800 leading-relaxed">{transcription.summary}</p>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  }

  // Auto Highlights section
  const autoHighlights = transcription.autoHighlights as any;
  if (autoHighlights && typeof autoHighlights === 'object' && autoHighlights.status === 'success') {
    const highlights = autoHighlights.results || [];
    if (Array.isArray(highlights) && highlights.length > 0) {
      features.push(
        <Card key="highlights" className="w-full">
          <Collapsible>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
                      <Zap className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">自動重點摘要</CardTitle>
                      <p className="text-sm text-gray-600">
                        發現 {highlights.length} 個重要關鍵詞
                      </p>
                    </div>
                  </div>
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {highlights.map((highlight: any, index: number) => (
                    <div key={index} className="p-4 bg-orange-50 rounded-lg border-l-4 border-orange-500">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-orange-900">{highlight.text}</span>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs px-2 py-1 bg-orange-100 text-orange-800 rounded-full">
                            提及 {highlight.count} 次
                          </span>
                          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                            重要度 #{highlight.rank}
                          </span>
                        </div>
                      </div>
                      {highlight.timestamps && Array.isArray(highlight.timestamps) && highlight.timestamps.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {highlight.timestamps.slice(0, 3).map((timestamp: any, i: number) => (
                            <span key={i} className="text-xs px-2 py-1 bg-white text-orange-700 rounded border">
                              {formatTimestamp(timestamp.start)} - {formatTimestamp(timestamp.end)}
                            </span>
                          ))}
                          {highlight.timestamps.length > 3 && (
                            <span className="text-xs text-orange-600">
                              +{highlight.timestamps.length - 3} 更多
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      );
    }
  }

  // Auto Chapters section
  const autoChapters = transcription.autoChapters as any;
  if (Array.isArray(autoChapters) && autoChapters.length > 0) {
    features.push(
      <Card key="chapters" className="w-full">
        <Collapsible>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">自動章節劃分</CardTitle>
                    <p className="text-sm text-gray-600">
                      識別出 {autoChapters.length} 個章節
                    </p>
                  </div>
                </div>
                <ChevronDown className="w-5 h-5 text-gray-400" />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="space-y-4">
                {autoChapters.map((chapter: any, index: number) => (
                  <div key={index} className="p-4 bg-purple-50 rounded-lg border-l-4 border-purple-500">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-purple-900">
                        第 {index + 1} 章: {chapter.headline}
                      </h4>
                      <div className="flex items-center text-xs text-purple-600 space-x-2">
                        <Clock className="w-3 h-3" />
                        <span>
                          {formatTimestamp(chapter.start)} - {formatTimestamp(chapter.end)}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{chapter.gist}</p>
                    <p className="text-sm text-gray-700">{chapter.summary}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  }

  // Topics Detection section
  const topicsDetection = transcription.topicsDetection as any;
  if (topicsDetection && typeof topicsDetection === 'object' && topicsDetection.status === 'success') {
    const topics = topicsDetection.results || [];
    if (Array.isArray(topics) && topics.length > 0) {
      features.push(
        <Card key="topics" className="w-full">
          <Collapsible>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center">
                      <Hash className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">主題檢測</CardTitle>
                      <p className="text-sm text-gray-600">
                        識別出 {topics.length} 個主題標籤
                      </p>
                    </div>
                  </div>
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {topics.map((topic: any, index: number) => (
                    <div key={index} className="p-4 bg-indigo-50 rounded-lg border-l-4 border-indigo-500">
                      <p className="text-sm text-gray-700 mb-2">{topic.text}</p>
                      <div className="flex flex-wrap gap-2">
                        {topic.labels && Array.isArray(topic.labels) && topic.labels.map((label: any, i: number) => (
                          <span 
                            key={i}
                            className="text-xs px-2 py-1 bg-indigo-100 text-indigo-800 rounded-full"
                          >
                            {label.label} ({(label.relevance * 100).toFixed(1)}%)
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      );
    }
  }

  // Sentiment Analysis section
  const sentimentAnalysis = transcription.sentimentAnalysis as any;
  if (Array.isArray(sentimentAnalysis) && sentimentAnalysis.length > 0) {
    features.push(
      <Card key="sentiment" className="w-full">
        <Collapsible>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-pink-500 rounded-full flex items-center justify-center">
                    <Heart className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">情感分析</CardTitle>
                    <p className="text-sm text-gray-600">
                      分析了 {sentimentAnalysis.length} 個語句段落
                    </p>
                  </div>
                </div>
                <ChevronDown className="w-5 h-5 text-gray-400" />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="space-y-3">
                {sentimentAnalysis.slice(0, 10).map((sentiment: any, index: number) => (
                  <div 
                    key={index} 
                    className={`p-4 rounded-lg border-l-4 ${getSentimentColor(sentiment.sentiment)}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {getSentimentIcon(sentiment.sentiment)}
                        <span className="font-medium capitalize">
                          {sentiment.sentiment === 'positive' ? '正面' : sentiment.sentiment === 'negative' ? '負面' : '中性'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs px-2 py-1 bg-white rounded-full border">
                          信心度 {(sentiment.confidence * 100).toFixed(1)}%
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatTimestamp(sentiment.start)}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700">{sentiment.text}</p>
                  </div>
                ))}
                {sentimentAnalysis.length > 10 && (
                  <p className="text-sm text-gray-500 text-center">
                    還有 {sentimentAnalysis.length - 10} 個情感分析結果...
                  </p>
                )}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  }

  // Entity Detection section
  const entityDetection = transcription.entityDetection as any;
  if (Array.isArray(entityDetection) && entityDetection.length > 0) {
    features.push(
      <Card key="entities" className="w-full">
        <Collapsible>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-teal-500 rounded-full flex items-center justify-center">
                    <Eye className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">實體識別</CardTitle>
                    <p className="text-sm text-gray-600">
                      識別出 {entityDetection.length} 個命名實體
                    </p>
                  </div>
                </div>
                <ChevronDown className="w-5 h-5 text-gray-400" />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="space-y-3">
                {entityDetection.map((entity: any, index: number) => (
                  <div key={index} className="p-4 bg-teal-50 rounded-lg border-l-4 border-teal-500">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-teal-900">{entity.text}</span>
                        <span className="text-xs px-2 py-1 bg-teal-100 text-teal-800 rounded-full">
                          {entity.entity_type}
                        </span>
                      </div>
                      <span className="text-xs text-teal-600">
                        {formatTimestamp(entity.start)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  }

  // Content Safety section
  const contentSafety = transcription.contentSafety as any;
  if (contentSafety && typeof contentSafety === 'object' && contentSafety.status === 'success') {
    const safetyResults = contentSafety.results || [];
    if (Array.isArray(safetyResults) && safetyResults.length > 0) {
      features.push(
        <Card key="safety" className="w-full">
          <Collapsible>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center">
                      <Shield className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">內容安全檢測</CardTitle>
                      <p className="text-sm text-gray-600">
                        檢測到 {safetyResults.length} 個內容標籤
                      </p>
                    </div>
                  </div>
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {safetyResults.map((result: any, index: number) => (
                    <div key={index} className="p-4 bg-emerald-50 rounded-lg border-l-4 border-emerald-500">
                      <p className="text-sm text-gray-700 mb-2">{result.text}</p>
                      <div className="flex flex-wrap gap-2">
                        {result.labels && Array.isArray(result.labels) && result.labels.map((label: any, i: number) => (
                          <span 
                            key={i}
                            className="text-xs px-2 py-1 bg-emerald-100 text-emerald-800 rounded-full"
                          >
                            {label.label} ({(label.confidence * 100).toFixed(1)}%)
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      );
    }
  }

  if (features.length === 0) {
    return (
      <Card className="w-full">
        <CardContent className="p-6 text-center text-gray-500">
          <TrendingUp className="w-12 h-12 mx-auto mb-2 text-gray-400" />
          <p>未檢測到進階分析結果</p>
          <p className="text-sm mt-1">轉錄可能未啟用進階功能</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2 mb-4">
        <TrendingUp className="w-5 h-5 text-blue-500" />
        <h3 className="text-lg font-semibold text-gray-900">進階 AI 分析結果</h3>
        <span className="text-sm px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
          {features.length} 項功能
        </span>
      </div>
      {features}
    </div>
  );
}