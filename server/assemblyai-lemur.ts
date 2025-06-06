import axios from 'axios';

interface LemurSummaryRequest {
  transcript_ids: string[];
  answer_format?: string;
  context?: string;
  final_model?: string;
  max_output_size?: number;
  temperature?: number;
}

interface LemurQuestionRequest {
  transcript_ids: string[];
  questions: Array<{
    question: string;
    answer_format?: string;
    answer_options?: string[];
  }>;
  context?: string;
  final_model?: string;
  max_output_size?: number;
  temperature?: number;
}

interface LemurTaskRequest {
  transcript_ids: string[];
  prompt: string;
  context?: string;
  final_model?: string;
  max_output_size?: number;
  temperature?: number;
}

interface LemurResponse {
  request_id: string;
  response: any;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export class AssemblyAILemur {
  private apiKey: string;
  private baseUrl = 'https://api.assemblyai.com/lemur/v3';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async makeRequest(endpoint: string, data: any): Promise<LemurResponse> {
    try {
      const response = await axios.post(`${this.baseUrl}${endpoint}`, data, {
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error) {
      console.error('LeMUR API error:', error);
      throw new Error(`LeMUR API 請求失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
    }
  }

  /**
   * Generate a summary of transcripts using LeMUR
   */
  async summarizeTranscript(request: LemurSummaryRequest): Promise<string> {
    const payload = {
      final_model: "anthropic/claude-3-7-sonnet-20250219",
      answer_format: request.answer_format || "清晰、簡潔的重點摘要",
      context: request.context || "這是一段音頻對話的轉錄內容",
      max_output_size: request.max_output_size || 3000,
      temperature: request.temperature || 0.1,
      transcript_ids: request.transcript_ids,
    };

    const response = await this.makeRequest('/generate/summary', payload);
    return response.response;
  }

  /**
   * Ask questions about transcripts using LeMUR
   */
  async askQuestions(request: LemurQuestionRequest): Promise<Array<{ question: string; answer: string }>> {
    const payload = {
      final_model: "anthropic/claude-3-7-sonnet-20250219",
      questions: request.questions,
      context: request.context || "這是一段音頻對話的轉錄內容",
      max_output_size: request.max_output_size || 3000,
      temperature: request.temperature || 0.1,
      transcript_ids: request.transcript_ids,
    };

    const response = await this.makeRequest('/generate/question-answer', payload);
    return response.response;
  }

  /**
   * Run custom tasks on transcripts using LeMUR
   */
  async runTask(request: LemurTaskRequest): Promise<string> {
    const payload = {
      final_model: "anthropic/claude-3-7-sonnet-20250219",
      prompt: request.prompt,
      context: request.context || "這是一段音頻對話的轉錄內容",
      max_output_size: request.max_output_size || 3000,
      temperature: request.temperature || 0.1,
      transcript_ids: request.transcript_ids,
    };

    const response = await this.makeRequest('/generate/task', payload);
    return response.response;
  }

  /**
   * Generate meeting insights
   */
  async generateMeetingInsights(transcriptIds: string[]): Promise<{
    summary: string;
    keyPoints: string[];
    actionItems: string[];
    sentiment: string;
  }> {
    const questions = [
      {
        question: "這次會議的主要議題和討論重點是什麼？",
        answer_format: "清單格式，每個重點一行"
      },
      {
        question: "會議中提到的具體行動項目和待辦事項有哪些？",
        answer_format: "清單格式，包含負責人（如果有提到）"
      },
      {
        question: "整體會議氛圍和參與者的情緒如何？",
        answer_format: "簡短描述：正面/中性/負面，並說明原因"
      }
    ];

    const [summaryResponse, qaResponse] = await Promise.all([
      this.summarizeTranscript({
        transcript_ids: transcriptIds,
        answer_format: "詳細但簡潔的會議摘要，包含主要決策和結論"
      }),
      this.askQuestions({
        transcript_ids: transcriptIds,
        questions,
        context: "這是一段商務會議的錄音轉錄"
      })
    ]);

    return {
      summary: summaryResponse,
      keyPoints: qaResponse[0]?.answer.split('\n').filter(line => line.trim()) || [],
      actionItems: qaResponse[1]?.answer.split('\n').filter(line => line.trim()) || [],
      sentiment: qaResponse[2]?.answer || "未能分析"
    };
  }

  /**
   * Generate interview analysis
   */
  async generateInterviewAnalysis(transcriptIds: string[]): Promise<{
    summary: string;
    candidateStrengths: string[];
    areasForImprovement: string[];
    keyResponses: string[];
    recommendation: string;
  }> {
    const questions = [
      {
        question: "候選人在面試中展現的主要優點和強項有哪些？",
        answer_format: "清單格式"
      },
      {
        question: "候選人需要改進或關注的領域有哪些？",
        answer_format: "清單格式"
      },
      {
        question: "候選人對關鍵問題的回答如何？請列出最重要的回答。",
        answer_format: "清單格式，包含問題和回答要點"
      },
      {
        question: "基於整體表現，你會推薦這位候選人嗎？為什麼？",
        answer_format: "推薦/不推薦，並提供具體理由"
      }
    ];

    const [summaryResponse, qaResponse] = await Promise.all([
      this.summarizeTranscript({
        transcript_ids: transcriptIds,
        answer_format: "面試整體表現摘要，包含候選人的回答品質和溝通能力"
      }),
      this.askQuestions({
        transcript_ids: transcriptIds,
        questions,
        context: "這是一段工作面試的錄音轉錄"
      })
    ]);

    return {
      summary: summaryResponse,
      candidateStrengths: qaResponse[0]?.answer.split('\n').filter(line => line.trim()) || [],
      areasForImprovement: qaResponse[1]?.answer.split('\n').filter(line => line.trim()) || [],
      keyResponses: qaResponse[2]?.answer.split('\n').filter(line => line.trim()) || [],
      recommendation: qaResponse[3]?.answer || "未能生成建議"
    };
  }

  /**
   * Generate customer service analysis
   */
  async generateCustomerServiceAnalysis(transcriptIds: string[]): Promise<{
    summary: string;
    customerSatisfaction: string;
    issueResolution: string;
    serviceQuality: string;
    improvements: string[];
  }> {
    const questions = [
      {
        question: "客戶的整體滿意度如何？客戶是否感到滿意？",
        answer_format: "滿意/不滿意/中性，並說明具體原因"
      },
      {
        question: "客戶的問題是否得到妥善解決？",
        answer_format: "已解決/部分解決/未解決，並描述解決過程"
      },
      {
        question: "服務人員的專業程度和態度如何？",
        answer_format: "評估服務品質並提供具體例子"
      },
      {
        question: "有哪些可以改進的地方？",
        answer_format: "清單格式，提供具體建議"
      }
    ];

    const [summaryResponse, qaResponse] = await Promise.all([
      this.summarizeTranscript({
        transcript_ids: transcriptIds,
        answer_format: "客戶服務對話摘要，包含問題類型和處理結果"
      }),
      this.askQuestions({
        transcript_ids: transcriptIds,
        questions,
        context: "這是一段客戶服務通話的錄音轉錄"
      })
    ]);

    return {
      summary: summaryResponse,
      customerSatisfaction: qaResponse[0]?.answer || "未能分析",
      issueResolution: qaResponse[1]?.answer || "未能分析",
      serviceQuality: qaResponse[2]?.answer || "未能分析",
      improvements: qaResponse[3]?.answer.split('\n').filter(line => line.trim()) || []
    };
  }
}