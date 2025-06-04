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
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  async cleanTranscript(transcriptText: string, customKeywords?: string[]): Promise<{
    cleanedText: string;
    improvements: string[];
  }> {
    const keywordsSection = customKeywords && customKeywords.length > 0 
      ? `\n\n重要關鍵字參考：\n${customKeywords.join('、')}\n請特別注意修正逐字稿中與這些關鍵字相似但錯誤的詞彙。`
      : '';

    const prompt = `
請整理以下逐字稿內容，將破碎的語音識別結果轉換成完整、流暢、專業的文字記錄。

原始逐字稿：
${transcriptText}${keywordsSection}

請按照以下JSON格式回覆：

{
  "cleanedText": "整理後的完整逐字稿內容",
  "improvements": [
    "改善項目1（例如：修正語法錯誤）",
    "改善項目2（例如：補充不完整的語句）",
    "改善項目3（例如：統一用詞風格）"
  ]
}

重要整理原則：
1. 語句完整化：
   - 將破碎、不完整的句子重新組織成完整的語句
   - 補充缺失的主語、謂語或賓語，使句子結構完整
   - 消除重複和冗餘的詞語

2. 關鍵字優化：
   - 識別專業術語、產品名稱、公司名稱等關鍵詞
   - 統一相似詞彙的表達方式（例如：將"LINE"、"line"、"賴"統一為"LINE"）
   - 修正語音識別錯誤導致的關鍵詞誤讀（例如：將"全家"、"全佳"統一為"全家便利商店"）
   - 特別注意自定義關鍵字列表中的詞彙，修正逐字稿中發音相似但拼寫錯誤的詞語
   - 保持專業術語的準確性和一致性
   - 根據上下文判斷正確的關鍵詞用法

3. 標點符號規範：
   - 根據語句內容和語氣添加適當的標點符號
   - 使用逗號分隔並列成分和短語
   - 使用句號結束完整的陳述句
   - 使用問號標示疑問句
   - 使用冒號引入說明或列舉
   - 使用分號連接相關的獨立子句

4. 語言規範：
   - 保持商務會議的專業語調
   - 統一時態和語氣
   - 修正語法錯誤但保留原意
   - 適當使用敬語和禮貌用詞

5. 內容完整性：
   - 不添加原文中沒有提到的信息
   - 保持說話者的原始觀點和立場
   - 維持對話的邏輯順序和因果關係
`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      return this.parseCleaningResponse(text);
    } catch (error) {
      console.error('Gemini cleaning error:', error);
      throw new Error('Failed to clean transcript with Gemini');
    }
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

    // Safely extract speakers and segments data
    const speakers = transcription.speakers as any[];
    const segments = transcription.segments as any[];

    if (!Array.isArray(speakers) || !Array.isArray(segments)) {
      throw new Error('Speakers or segments data is not in array format');
    }

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

  private parseCleaningResponse(response: string): {
    cleanedText: string;
    improvements: string[];
  } {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        cleanedText: parsed.cleanedText || '無法生成整理後的文字',
        improvements: Array.isArray(parsed.improvements) ? parsed.improvements : []
      };
    } catch (error) {
      console.error('Failed to parse Gemini cleaning response:', error);
      // Fallback response
      return {
        cleanedText: '文字整理過程中發生錯誤，請稍後再試。',
        improvements: []
      };
    }
  }
}