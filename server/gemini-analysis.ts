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
你是一位專業的會議逐字稿分析專家。請將以下整理後的會議內容，根據語意邏輯和對話結構智能分配給不同講者，並創建合理的分段。

可用講者：
${originalSpeakers.map(s => `- ${s.id}: ${s.label}`).join('\n')}

整理後的會議內容：
${cleanedText}

分析指導原則：
1. 主導發言（提出問題、做決策、總結觀點）→ 講者A
2. 技術解釋和具體實施說明 → 講者B  
3. 市場分析和客戶需求討論 → 講者C
4. 專案進度和時程安排 → 講者D
5. 補充意見、回應和提問 → 講者E

分段要求：
- 每個段落50-150字，保持完整語意
- 根據話題轉換、提問回答、語氣變化分配講者
- 確保每位講者都有合理的發言機會
- 保持對話的自然流程和邏輯順序
- 分段時考慮實際會議中的發言模式

請以JSON格式回應，必須包含多個分段和多位講者：
{
  "segments": [
    {
      "text": "完整的段落內容",
      "speakerId": "A"
    },
    {
      "text": "另一段落內容", 
      "speakerId": "B"
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
    if (!transcription.segments) {
      throw new Error('Transcription must have segments data');
    }
    
    // Extract segments data
    const segments = transcription.segments as any[];
    if (!Array.isArray(segments) || segments.length === 0) {
      throw new Error('No valid segments found in transcription');
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
    // Extract segments data
    const segments = transcription.segments as any[];
    if (!Array.isArray(segments)) {
      throw new Error('Segments data is not in array format');
    }

    // Extract unique speakers from segments
    const speakersSet = new Set<string>();
    segments.forEach((segment: any) => {
      if (segment.speaker) {
        speakersSet.add(segment.speaker);
      }
    });
    const speakers = Array.from(speakersSet);

    const speakerList = speakers
      .map((speaker: string, index: number) => `- ${speaker}`)
      .join('\n');

    const conversationText = segments
      .map((segment: any) => {
        // Handle both old and new segment formats
        const startTime = segment.start || segment.timestamp || 0;
        const timeInMinutes = Math.floor(startTime / 60000);
        const timeInSeconds = Math.floor((startTime % 60000) / 1000);
        const timeFormat = `${timeInMinutes}:${timeInSeconds.toString().padStart(2, '0')}`;
        
        return `[${timeFormat}] ${segment.speaker}: ${segment.text}`;
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
      
      // Remove markdown formatting
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
      
      // Validate segments array
      if (parsed.segments && Array.isArray(parsed.segments)) {
        // Filter valid segments
        const validSegments = parsed.segments.filter(seg => 
          seg.text && typeof seg.text === 'string' && seg.text.trim().length > 0 &&
          seg.speakerId && typeof seg.speakerId === 'string'
        );
        
        console.log(`Parsed ${validSegments.length} valid segments from AI response`);
        
        return {
          segments: validSegments
        };
      }
      
      throw new Error('Invalid segments format');
    } catch (error) {
      console.error('Failed to parse segment response:', error, 'Response:', response.substring(0, 500));
      
      // Return empty segments array on error
      return {
        segments: []
      };
    }
  }
}