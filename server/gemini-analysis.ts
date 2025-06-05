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

  async cleanTranscript(transcriptText: string): Promise<{
    cleanedText: string;
    improvements: string[];
  }> {
    const prompt = `請整理以下逐字稿內容，將破碎的語音識別結果轉換成完整、流暢、專業的文字記錄。

原始逐字稿：
${transcriptText}

請嚴格按照以下JSON格式回覆，不要包含任何其他文字或說明：

{
  "cleanedText": "整理後的完整逐字稿內容",
  "improvements": [
    "改善項目1（例如：修正語法錯誤）",
    "改善項目2（例如：補充不完整的語句）",
    "改善項目3（例如：統一用詞風格）"
  ]
}

注意：回覆時只輸出JSON，不要包含任何標記或其他文字。

重要整理原則：
1. 語句完整化：
   - 將破碎、不完整的句子重新組織成完整的語句
   - 補充缺失的主語、謂語或賓語，使句子結構完整
   - 消除重複和冗餘的詞語

2. 關鍵字優化：
   - 識別專業術語、產品名稱、公司名稱等關鍵詞
   - 統一相似詞彙的表達方式（例如：將LINE、line、賴統一為LINE）
   - 修正語音識別錯誤導致的關鍵詞誤讀（例如：將全家、全佳統一為全家便利商店）
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
   - 維持對話的邏輯順序和因果關係`;

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

  async segmentCleanedText(cleanedText: string, originalSpeakers: any[]): Promise<{
    segments: any[];
  }> {
    try {
      const speakerLabels = originalSpeakers.map(s => s.label).join('、');
      
      const prompt = `
你是一位專業的對話分析專家。請將以下整理後的文字，根據語意和邏輯智能分配給不同的講者。

原始講者：${speakerLabels}

整理後文字：
${cleanedText}

請分析文字內容，根據語意轉換、話題變化、語氣變化等線索，將文字分配給不同講者。

要求：
1. 根據語意邏輯分段，每個段落分配給一個講者
2. 保持文字的完整性和連貫性
3. 合理分配給不同講者，避免某個講者說話時間過長
4. 段落應該具有完整的語意
5. 分析語氣、話題轉換、提問等線索來判斷講者變化

請以 JSON 格式回應：
{
  "segments": [
    {
      "text": "段落文字內容",
      "speakerId": "講者ID（如A、B、C等）",
      "reasoning": "分配理由"
    }
  ]
}
`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      return this.parseSegmentResponse(text);
    } catch (error) {
      console.error('Gemini segmentation error:', error);
      throw new Error('AI 語意分段時發生錯誤');
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
      // Try to find and extract the JSON block
      let jsonText = response.trim();
      
      // Remove any markdown formatting
      jsonText = jsonText
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .replace(/^\s*```.*$/gm, '') // Remove any other markdown
        .trim();
      
      // Find JSON boundaries more carefully
      const jsonStart = jsonText.indexOf('{');
      let jsonEnd = -1;
      
      if (jsonStart !== -1) {
        let braceCount = 0;
        let inString = false;
        let escapeNext = false;
        
        for (let i = jsonStart; i < jsonText.length; i++) {
          const char = jsonText[i];
          
          if (escapeNext) {
            escapeNext = false;
            continue;
          }
          
          if (char === '\\') {
            escapeNext = true;
            continue;
          }
          
          if (char === '"') {
            inString = !inString;
            continue;
          }
          
          if (!inString) {
            if (char === '{') {
              braceCount++;
            } else if (char === '}') {
              braceCount--;
              if (braceCount === 0) {
                jsonEnd = i;
                break;
              }
            }
          }
        }
        
        if (jsonEnd !== -1) {
          jsonText = jsonText.substring(jsonStart, jsonEnd + 1);
        }
      }
      
      // Clean up common JSON formatting issues
      jsonText = jsonText
        .replace(/,\s*}/g, '}') // Remove trailing commas
        .replace(/,\s*]/g, ']') // Remove trailing commas in arrays
        .replace(/\n/g, ' ') // Replace newlines with spaces
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();

      const parsed = JSON.parse(jsonText);
      
      return {
        cleanedText: parsed.cleanedText || '無法生成整理後的文字',
        improvements: Array.isArray(parsed.improvements) ? parsed.improvements : []
      };
    } catch (error) {
      console.error('Failed to parse Gemini cleaning response:', error);
      
      // Advanced fallback: try to extract content with regex
      try {
        const cleanedTextMatch = response.match(/"cleanedText"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        const improvementsMatch = response.match(/"improvements"\s*:\s*\[((?:[^\]]|\](?!\s*}))*)\]/);
        
        if (cleanedTextMatch) {
          let improvements: string[] = [];
          
          if (improvementsMatch) {
            const improvementsStr = improvementsMatch[1];
            const itemMatches = improvementsStr.match(/"((?:[^"\\]|\\.)*)"/g);
            if (itemMatches) {
              improvements = itemMatches.map(item => item.slice(1, -1));
            }
          }
          
          return {
            cleanedText: cleanedTextMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n'),
            improvements: improvements.length > 0 ? improvements : ['手動提取整理內容', '建議重新嘗試以獲得完整分析']
          };
        }
      } catch (regexError) {
        console.error('Regex extraction also failed:', regexError);
      }
      
      // Final fallback
      return {
        cleanedText: '文字整理過程中發生錯誤，請稍後再試。建議檢查文本長度或重新嘗試。',
        improvements: ['JSON 解析失敗', '建議重新執行整理功能']
      };
    }
  }

  private parseSegmentResponse(response: string): {
    segments: any[];
  } {
    try {
      let jsonText = response.trim();
      
      jsonText = jsonText
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .replace(/^\s*```.*$/gm, '')
        .trim();
      
      const jsonStart = jsonText.indexOf('{');
      let jsonEnd = -1;
      
      if (jsonStart !== -1) {
        let braceCount = 0;
        let inString = false;
        let escapeNext = false;
        
        for (let i = jsonStart; i < jsonText.length; i++) {
          const char = jsonText[i];
          
          if (escapeNext) {
            escapeNext = false;
            continue;
          }
          
          if (char === '\\') {
            escapeNext = true;
            continue;
          }
          
          if (char === '"') {
            inString = !inString;
            continue;
          }
          
          if (!inString) {
            if (char === '{') {
              braceCount++;
            } else if (char === '}') {
              braceCount--;
              if (braceCount === 0) {
                jsonEnd = i + 1;
                break;
              }
            }
          }
        }
        
        if (jsonEnd !== -1) {
          jsonText = jsonText.substring(jsonStart, jsonEnd);
        }
      }
      
      const parsed = JSON.parse(jsonText);
      
      return {
        segments: parsed.segments || []
      };
    } catch (error) {
      console.error('Failed to parse segment response:', error);
      return {
        segments: []
      };
    }
  }
}