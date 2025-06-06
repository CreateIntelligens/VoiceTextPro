import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { 
  Sparkles, 
  MessageSquare, 
  Users, 
  Briefcase, 
  Headphones,
  Plus,
  Trash2,
  Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { TranscriptionStatus } from "@/lib/types";

interface LemurAnalysisProps {
  transcription: TranscriptionStatus;
}

interface Question {
  question: string;
  answer_format?: string;
  answer_options?: string[];
}

interface MeetingInsights {
  summary: string;
  keyPoints: string[];
  actionItems: string[];
  sentiment: string;
}

interface InterviewAnalysis {
  summary: string;
  candidateStrengths: string[];
  areasForImprovement: string[];
  keyResponses: string[];
  recommendation: string;
}

interface CustomerServiceAnalysis {
  summary: string;
  customerSatisfaction: string;
  issueResolution: string;
  serviceQuality: string;
  improvements: string[];
}

export default function LemurAnalysis({ transcription }: LemurAnalysisProps) {
  const [summaryResult, setSummaryResult] = useState<string>("");
  const [qaResult, setQAResult] = useState<Array<{ question: string; answer: string }>>([]);
  const [meetingInsights, setMeetingInsights] = useState<MeetingInsights | null>(null);
  const [interviewAnalysis, setInterviewAnalysis] = useState<InterviewAnalysis | null>(null);
  const [customerServiceAnalysis, setCustomerServiceAnalysis] = useState<CustomerServiceAnalysis | null>(null);
  
  const [questions, setQuestions] = useState<Question[]>([
    { question: "這段對話的主要內容是什麼？" },
    { question: "討論了哪些重要議題？" }
  ]);

  const { toast } = useToast();

  // Summary mutation
  const summaryMutation = useMutation({
    mutationFn: async (data: { format?: string; context?: string }) => {
      const response = await apiRequest(`/api/transcriptions/${transcription.id}/lemur/summary`, "POST", data);
      return response.summary;
    },
    onSuccess: (summary) => {
      setSummaryResult(summary);
      toast({
        title: "摘要生成完成",
        description: "LeMUR 智能摘要已生成完成"
      });
    },
    onError: (error) => {
      toast({
        title: "摘要生成失敗",
        description: error instanceof Error ? error.message : "請稍後再試",
        variant: "destructive"
      });
    }
  });

  // Q&A mutation
  const qaMutation = useMutation({
    mutationFn: async (data: { questions: Question[]; context?: string }) => {
      const response = await apiRequest(`/api/transcriptions/${transcription.id}/lemur/questions`, "POST", data);
      return response.answers;
    },
    onSuccess: (answers) => {
      setQAResult(answers);
      toast({
        title: "問答分析完成",
        description: "LeMUR 智能問答已完成"
      });
    },
    onError: (error) => {
      toast({
        title: "問答分析失敗",
        description: error instanceof Error ? error.message : "請稍後再試",
        variant: "destructive"
      });
    }
  });

  // Meeting insights mutation
  const meetingMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/transcriptions/${transcription.id}/lemur/meeting-insights`, "POST");
    },
    onSuccess: (insights) => {
      setMeetingInsights(insights);
      toast({
        title: "會議分析完成",
        description: "智能會議洞察已生成"
      });
    },
    onError: (error) => {
      toast({
        title: "會議分析失敗",
        description: error instanceof Error ? error.message : "請稍後再試",
        variant: "destructive"
      });
    }
  });

  // Interview analysis mutation
  const interviewMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/transcriptions/${transcription.id}/lemur/interview-analysis`, "POST");
    },
    onSuccess: (analysis) => {
      setInterviewAnalysis(analysis);
      toast({
        title: "面試分析完成",
        description: "智能面試評估已生成"
      });
    },
    onError: (error) => {
      toast({
        title: "面試分析失敗",
        description: error instanceof Error ? error.message : "請稍後再試",
        variant: "destructive"
      });
    }
  });

  // Customer service analysis mutation
  const customerServiceMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/transcriptions/${transcription.id}/lemur/customer-service-analysis`, "POST");
    },
    onSuccess: (analysis) => {
      setCustomerServiceAnalysis(analysis);
      toast({
        title: "客服分析完成",
        description: "智能客服評估已生成"
      });
    },
    onError: (error) => {
      toast({
        title: "客服分析失敗",
        description: error instanceof Error ? error.message : "請稍後再試",
        variant: "destructive"
      });
    }
  });

  const handleAddQuestion = () => {
    setQuestions([...questions, { question: "" }]);
  };

  const handleRemoveQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleQuestionChange = (index: number, value: string) => {
    const updated = [...questions];
    updated[index].question = value;
    setQuestions(updated);
  };

  const handleGenerateSummary = () => {
    summaryMutation.mutate({
      format: "詳細且結構化的重點摘要，包含主要討論內容和結論",
      context: "這是一段重要的音頻對話記錄"
    });
  };

  const handleGenerateQA = () => {
    const validQuestions = questions.filter(q => q.question.trim());
    if (validQuestions.length === 0) {
      toast({
        title: "請新增問題",
        description: "至少需要一個有效問題才能進行分析",
        variant: "destructive"
      });
      return;
    }
    qaMutation.mutate({
      questions: validQuestions,
      context: "請根據音頻內容提供準確且詳細的回答"
    });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Sparkles className="w-5 h-5 text-blue-500" />
          <span>LeMUR 智能分析</span>
          <Badge variant="secondary">AssemblyAI</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="summary">智能摘要</TabsTrigger>
            <TabsTrigger value="qa">問答分析</TabsTrigger>
            <TabsTrigger value="meeting">會議洞察</TabsTrigger>
            <TabsTrigger value="interview">面試評估</TabsTrigger>
            <TabsTrigger value="customer">客服分析</TabsTrigger>
          </TabsList>

          {/* Summary Tab */}
          <TabsContent value="summary" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">智能摘要生成</h3>
              <Button 
                onClick={handleGenerateSummary}
                disabled={summaryMutation.isPending}
              >
                {summaryMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                生成摘要
              </Button>
            </div>
            
            {summaryResult && (
              <Card>
                <CardContent className="pt-6">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {summaryResult}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Q&A Tab */}
          <TabsContent value="qa" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">問答分析</h3>
              <Button 
                onClick={handleGenerateQA}
                disabled={qaMutation.isPending}
              >
                {qaMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <MessageSquare className="w-4 h-4 mr-2" />
                )}
                開始分析
              </Button>
            </div>

            {/* Questions Input */}
            <div className="space-y-3">
              <Label>自訂問題</Label>
              {questions.map((question, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <Input
                    placeholder="輸入您的問題..."
                    value={question.question}
                    onChange={(e) => handleQuestionChange(index, e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemoveQuestion(index)}
                    disabled={questions.length <= 1}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" onClick={handleAddQuestion}>
                <Plus className="w-4 h-4 mr-2" />
                新增問題
              </Button>
            </div>

            {/* Q&A Results */}
            {qaResult.length > 0 && (
              <div className="space-y-4">
                <Separator />
                <h4 className="font-medium">分析結果</h4>
                {qaResult.map((qa, index) => (
                  <Card key={index}>
                    <CardContent className="pt-4">
                      <div className="space-y-2">
                        <div className="font-medium text-blue-600">
                          問題：{qa.question}
                        </div>
                        <div className="text-sm leading-relaxed pl-4 border-l-2 border-slate-200">
                          {qa.answer}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Meeting Insights Tab */}
          <TabsContent value="meeting" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">會議智能洞察</h3>
              <Button 
                onClick={() => meetingMutation.mutate()}
                disabled={meetingMutation.isPending}
              >
                {meetingMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Users className="w-4 h-4 mr-2" />
                )}
                分析會議
              </Button>
            </div>

            {meetingInsights && (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">會議摘要</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed">{meetingInsights.summary}</p>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">關鍵要點</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {meetingInsights.keyPoints.map((point, index) => (
                          <li key={index} className="text-sm flex items-start">
                            <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-2 flex-shrink-0" />
                            {point}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">行動項目</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {meetingInsights.actionItems.map((item, index) => (
                          <li key={index} className="text-sm flex items-start">
                            <span className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-2 flex-shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">會議氛圍</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{meetingInsights.sentiment}</p>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Interview Analysis Tab */}
          <TabsContent value="interview" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">面試智能評估</h3>
              <Button 
                onClick={() => interviewMutation.mutate()}
                disabled={interviewMutation.isPending}
              >
                {interviewMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Briefcase className="w-4 h-4 mr-2" />
                )}
                分析面試
              </Button>
            </div>

            {interviewAnalysis && (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">面試總結</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed">{interviewAnalysis.summary}</p>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base text-green-600">候選人優勢</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {interviewAnalysis.candidateStrengths.map((strength, index) => (
                          <li key={index} className="text-sm flex items-start">
                            <span className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-2 flex-shrink-0" />
                            {strength}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base text-orange-600">改進領域</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {interviewAnalysis.areasForImprovement.map((area, index) => (
                          <li key={index} className="text-sm flex items-start">
                            <span className="w-2 h-2 bg-orange-500 rounded-full mt-2 mr-2 flex-shrink-0" />
                            {area}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">關鍵回答</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {interviewAnalysis.keyResponses.map((response, index) => (
                        <li key={index} className="text-sm flex items-start">
                          <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-2 flex-shrink-0" />
                          {response}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">推薦建議</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm font-medium">{interviewAnalysis.recommendation}</p>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Customer Service Analysis Tab */}
          <TabsContent value="customer" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">客服品質分析</h3>
              <Button 
                onClick={() => customerServiceMutation.mutate()}
                disabled={customerServiceMutation.isPending}
              >
                {customerServiceMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Headphones className="w-4 h-4 mr-2" />
                )}
                分析客服
              </Button>
            </div>

            {customerServiceAnalysis && (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">對話摘要</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed">{customerServiceAnalysis.summary}</p>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">客戶滿意度</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">{customerServiceAnalysis.customerSatisfaction}</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">問題解決</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">{customerServiceAnalysis.issueResolution}</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">服務品質</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">{customerServiceAnalysis.serviceQuality}</p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">改進建議</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {customerServiceAnalysis.improvements.map((improvement, index) => (
                        <li key={index} className="text-sm flex items-start">
                          <span className="w-2 h-2 bg-purple-500 rounded-full mt-2 mr-2 flex-shrink-0" />
                          {improvement}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}