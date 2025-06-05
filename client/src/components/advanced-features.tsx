import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  FileText, 
  Hash, 
  BookOpen, 
  Heart, 
  User, 
  Shield, 
  ChevronDown, 
  ChevronRight,
  Clock,
  TrendingUp,
  Star,
  AlertTriangle
} from "lucide-react";
import type { Transcription } from "@shared/schema";

interface AdvancedFeaturesProps {
  transcription: Transcription;
}

export default function AdvancedFeatures({ transcription }: AdvancedFeaturesProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    summary: true,
    highlights: false,
    chapters: false,
    topics: false,
    sentiment: false,
    entities: false,
    safety: false
  });

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const formatTime = (milliseconds: number) => {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment.toLowerCase()) {
      case 'positive':
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'negative':
        return <TrendingUp className="w-4 h-4 text-red-600 transform rotate-180" />;
      default:
        return <TrendingUp className="w-4 h-4 text-gray-600" />;
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment.toLowerCase()) {
      case 'positive':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'negative':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

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

  return (
    <div className="space-y-4">
      {/* Auto Summary */}
      {transcription.summary && (
        <Card>
          <Collapsible open={openSections.summary} onOpenChange={() => toggleSection('summary')}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
                <CardTitle className="flex items-center justify-between text-lg">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <span>自動摘要</span>
                  </div>
                  {openSections.summary ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-gray-800 leading-relaxed">{transcription.summary}</p>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* Auto Highlights */}
      {transcription.autoHighlights && (
        <Card>
          <Collapsible open={openSections.highlights} onOpenChange={() => toggleSection('highlights')}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
                <CardTitle className="flex items-center justify-between text-lg">
                  <div className="flex items-center space-x-2">
                    <Star className="w-5 h-5 text-yellow-600" />
                    <span>關鍵重點</span>
                    <Badge variant="secondary">{transcription.autoHighlights.results?.length || 0}</Badge>
                  </div>
                  {openSections.highlights ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {transcription.autoHighlights.results?.map((highlight: any, index: number) => (
                    <div key={index} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-900">{highlight.text}</span>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline" className="text-xs">
                            出現 {highlight.count} 次
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            重要度 {(highlight.rank * 100).toFixed(1)}%
                          </Badge>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {highlight.timestamps?.map((ts: any, tsIndex: number) => (
                          <Badge key={tsIndex} variant="secondary" className="text-xs">
                            <Clock className="w-3 h-3 mr-1" />
                            {formatTime(ts.start)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* Auto Chapters */}
      {transcription.autoChapters && transcription.autoChapters.length > 0 && (
        <Card>
          <Collapsible open={openSections.chapters} onOpenChange={() => toggleSection('chapters')}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
                <CardTitle className="flex items-center justify-between text-lg">
                  <div className="flex items-center space-x-2">
                    <BookOpen className="w-5 h-5 text-purple-600" />
                    <span>自動章節</span>
                    <Badge variant="secondary">{transcription.autoChapters.length}</Badge>
                  </div>
                  {openSections.chapters ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="space-y-4">
                  {transcription.autoChapters.map((chapter: any, index: number) => (
                    <div key={index} className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-gray-900">{chapter.headline}</h4>
                        <Badge variant="outline" className="text-xs">
                          <Clock className="w-3 h-3 mr-1" />
                          {formatTime(chapter.start)} - {formatTime(chapter.end)}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{chapter.gist}</p>
                      {chapter.summary && (
                        <p className="text-sm text-gray-700 bg-white p-2 rounded border">{chapter.summary}</p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* Topic Detection */}
      {transcription.topicsDetection?.results && transcription.topicsDetection.results.length > 0 && (
        <Card>
          <Collapsible open={openSections.topics} onOpenChange={() => toggleSection('topics')}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
                <CardTitle className="flex items-center justify-between text-lg">
                  <div className="flex items-center space-x-2">
                    <Hash className="w-5 h-5 text-green-600" />
                    <span>主題偵測</span>
                    <Badge variant="secondary">{transcription.topicsDetection.results.length}</Badge>
                  </div>
                  {openSections.topics ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {transcription.topicsDetection.results.map((topic: any, index: number) => (
                    <div key={index} className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-900">{topic.text}</span>
                        <Badge variant="outline" className="text-xs">
                          <Clock className="w-3 h-3 mr-1" />
                          {formatTime(topic.timestamp.start)}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {topic.labels?.map((label: any, labelIndex: number) => (
                          <Badge 
                            key={labelIndex} 
                            variant="secondary" 
                            className="text-xs bg-green-100 text-green-800"
                          >
                            {label.label} ({(label.relevance * 100).toFixed(1)}%)
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* Sentiment Analysis */}
      {transcription.sentimentAnalysis && transcription.sentimentAnalysis.length > 0 && (
        <Card>
          <Collapsible open={openSections.sentiment} onOpenChange={() => toggleSection('sentiment')}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
                <CardTitle className="flex items-center justify-between text-lg">
                  <div className="flex items-center space-x-2">
                    <Heart className="w-5 h-5 text-pink-600" />
                    <span>情緒分析</span>
                    <Badge variant="secondary">{transcription.sentimentAnalysis.length}</Badge>
                  </div>
                  {openSections.sentiment ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {transcription.sentimentAnalysis.map((sentiment: any, index: number) => (
                    <div key={index} className={`border rounded-lg p-3 ${getSentimentColor(sentiment.sentiment)}`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center space-x-2">
                          {getSentimentIcon(sentiment.sentiment)}
                          <Badge variant="outline" className="text-xs capitalize">
                            {sentiment.sentiment}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            信心度 {(sentiment.confidence * 100).toFixed(1)}%
                          </Badge>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          <Clock className="w-3 h-3 mr-1" />
                          {formatTime(sentiment.start)}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed">{sentiment.text}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* Entity Detection */}
      {transcription.entityDetection && transcription.entityDetection.length > 0 && (
        <Card>
          <Collapsible open={openSections.entities} onOpenChange={() => toggleSection('entities')}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
                <CardTitle className="flex items-center justify-between text-lg">
                  <div className="flex items-center space-x-2">
                    <User className="w-5 h-5 text-indigo-600" />
                    <span>實體識別</span>
                    <Badge variant="secondary">{transcription.entityDetection.length}</Badge>
                  </div>
                  {openSections.entities ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {transcription.entityDetection.map((entity: any, index: number) => (
                    <div key={index} className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="text-xs bg-indigo-100 text-indigo-800">
                          {entity.entity_type}
                        </Badge>
                        <span className="font-medium text-gray-900">{entity.text}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        <Clock className="w-3 h-3 mr-1" />
                        {formatTime(entity.start)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* Content Safety */}
      {transcription.contentSafety?.results && transcription.contentSafety.results.length > 0 && (
        <Card>
          <Collapsible open={openSections.safety} onOpenChange={() => toggleSection('safety')}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
                <CardTitle className="flex items-center justify-between text-lg">
                  <div className="flex items-center space-x-2">
                    <Shield className="w-5 h-5 text-orange-600" />
                    <span>內容安全</span>
                    <Badge variant="secondary">{transcription.contentSafety.results.length}</Badge>
                  </div>
                  {openSections.safety ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {transcription.contentSafety.results.map((safety: any, index: number) => (
                    <div key={index} className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <AlertTriangle className="w-4 h-4 text-orange-600" />
                          <span className="font-medium text-gray-900">{safety.text}</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          <Clock className="w-3 h-3 mr-1" />
                          {formatTime(safety.timestamp.start)}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {safety.labels?.map((label: any, labelIndex: number) => (
                          <Badge 
                            key={labelIndex} 
                            variant="secondary" 
                            className="text-xs bg-orange-100 text-orange-800"
                          >
                            {label.label} ({(label.confidence * 100).toFixed(1)}%)
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}
    </div>
  );
}