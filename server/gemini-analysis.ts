import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Transcription } from '@shared/schema';

interface AnalysisResult {
  summary: string;
  keyPoints: string[];
  speakerInsights: Array<{
    speaker: string;
    role: string;
    contribution: string;
  }>;
  actionItems: string[];
  topics: string[];
}

export class GeminiAnalyzer {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is required');
    }
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
  }

  async analyzeTranscription(transcription: Transcription): Promise<AnalysisResult> {
    if (!transcription.segments || !transcription.speakers) {
      throw new Error('Transcription must have segments and speakers');
    }

    const prompt = this.buildAnalysisPrompt(transcription);
    
    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      return this.parseAnalysisResponse(text);
    } catch (error) {
      console.error('Gemini API error:', error);
      throw new Error('Failed to analyze transcription with Gemini');
    }
  }

  private buildAnalysisPrompt(transcription: Transcription): string {
    if (!transcription.speakers || !transcription.segments) {
      throw new Error('Missing speakers or segments data');
    }

    const speakers = JSON.parse(transcription.speakers as string);
    const segments = JSON.parse(transcription.segments as string);

    const speakerList = speakers
      .map((s: any) => `- ${s.id}: ${s.label}`)
      .join('\n');

    const conversationText = segments
      .map((segment: any) => {
        const speaker = speakers.find((s: any) => s.id === segment.speaker);
        return `[${segment.timestamp}] ${speaker?.label || segment.speaker}: ${segment.text}`;
      })
      .join('\n');

    return `
請分析以下會議轉錄內容，並提供詳細的分析報告。請用繁體中文回覆。

對話者列表：
${speakerList}

會議內容：
${conversationText}

請按照以下JSON格式提供分析結果：

{
  "summary": "會議的整體摘要（200-300字）",
  "keyPoints": [
    "重點1",
    "重點2",
    "重點3"
  ],
  "speakerInsights": [
    {
      "speaker": "對話者名稱",
      "role": "在討論中的角色",
      "contribution": "主要貢獻和觀點"
    }
  ],
  "actionItems": [
    "行動項目1",
    "行動項目2"
  ],
  "topics": [
    "討論主題1",
    "討論主題2"
  ]
}

請確保分析深入且具體，重點關注：
1. 會議的主要議題和決策
2. 每位對話者的觀點和貢獻
3. 重要的行動項目或後續步驟
4. 關鍵的商業洞察或策略方向
`;
  }

  private parseAnalysisResponse(response: string): AnalysisResult {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        summary: parsed.summary || '無法生成摘要',
        keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
        speakerInsights: Array.isArray(parsed.speakerInsights) ? parsed.speakerInsights : [],
        actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
        topics: Array.isArray(parsed.topics) ? parsed.topics : []
      };
    } catch (error) {
      console.error('Failed to parse Gemini response:', error);
      // Fallback response
      return {
        summary: '分析過程中發生錯誤，請稍後再試。',
        keyPoints: [],
        speakerInsights: [],
        actionItems: [],
        topics: []
      };
    }
  }
}