import { GoogleGenerativeAI } from '@google/generative-ai';

export interface SpeechGenerationOptions {
  text: string;
  voice?: 'male' | 'female' | 'neutral';
  speed?: number; // 0.5 - 2.0
  language?: string;
}

export interface GeneratedSpeech {
  audioUrl: string;
  duration: number;
  text: string;
  metadata: {
    voice: string;
    speed: number;
    language: string;
    generatedAt: Date;
  };
}

export class GeminiSpeechGenerator {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is required for speech generation');
    }
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  async generateSpeech(options: SpeechGenerationOptions): Promise<GeneratedSpeech> {
    try {
      // 使用Gemini生成優化的語音文本
      const optimizedText = await this.optimizeTextForSpeech(options.text);
      
      // 這裡我們整合Google Cloud Text-to-Speech API
      // 因為Gemini本身不直接支持語音生成
      const audioData = await this.generateAudioWithGoogleTTS(optimizedText, options);
      
      return {
        audioUrl: audioData.url,
        duration: audioData.duration,
        text: optimizedText,
        metadata: {
          voice: options.voice || 'neutral',
          speed: options.speed || 1.0,
          language: options.language || 'zh-TW',
          generatedAt: new Date()
        }
      };
    } catch (error) {
      console.error('Speech generation error:', error);
      throw new Error(`語音生成失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
    }
  }

  private async optimizeTextForSpeech(text: string): Promise<string> {
    const prompt = `請將以下文字優化為適合語音播報的格式：

原始文字：
${text}

請按照以下要求優化：
1. 確保句子結構清晰，適合朗讀
2. 添加適當的標點符號來控制語調和停頓
3. 將複雜的句子分解為較短的片段
4. 確保數字和專業術語的讀音清楚
5. 保持原意不變，只優化語音表達效果

請直接回覆優化後的文字，不要包含任何說明或標記。`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text().trim();
    } catch (error) {
      console.error('Text optimization error:', error);
      return text; // 如果優化失敗，返回原文
    }
  }

  private async generateAudioWithGoogleTTS(
    text: string, 
    options: SpeechGenerationOptions
  ): Promise<{ url: string; duration: number }> {
    // 暫時返回模擬結果，實際實現需要Google Cloud TTS API
    // 在生產環境中，這裡會調用真實的Google Cloud Text-to-Speech API
    
    const simulatedDuration = Math.ceil(text.length / 10); // 估算時長（秒）
    
    // 這裡應該整合真實的Google Cloud TTS API
    // 目前返回一個占位符URL
    return {
      url: `/api/generated-speech/placeholder-${Date.now()}.mp3`,
      duration: simulatedDuration
    };
  }

  async generateSummaryAudio(transcriptionId: number, summary: string): Promise<GeneratedSpeech> {
    const optimizedSummary = await this.optimizeTextForSpeech(
      `以下是轉錄內容的智能摘要：${summary}`
    );

    return this.generateSpeech({
      text: optimizedSummary,
      voice: 'neutral',
      speed: 1.0,
      language: 'zh-TW'
    });
  }

  async generateKeyPointsAudio(keyPoints: string[]): Promise<GeneratedSpeech> {
    const keyPointsText = `重點整理：${keyPoints.map((point, index) => 
      `第${index + 1}點：${point}`
    ).join('。')}`;

    return this.generateSpeech({
      text: keyPointsText,
      voice: 'neutral',
      speed: 0.9,
      language: 'zh-TW'
    });
  }
}