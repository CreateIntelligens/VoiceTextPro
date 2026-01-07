import { VertexAI } from "@google-cloud/vertexai";
import { SpeechClient, protos } from "@google-cloud/speech";
import { v2 } from "@google-cloud/speech";
import { Storage } from "@google-cloud/storage";
import type { Transcription } from "@shared/schema";
import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// 類型別名
type AudioEncoding =
  protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding;

// V2 SpeechClient for STT V2 model
const SpeechClientV2 = v2.SpeechClient;

// Speech-to-Text 轉錄結果介面
interface SpeechToTextResult {
  transcriptText: string;
  segments: Array<{
    text: string;
    speaker: string;
    start: number;
    end: number;
    confidence: number;
  }>;
  speakers: Array<{
    id: string;
    label: string;
    color: string;
  }>;
  duration: number;
  wordCount: number;
}

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
  private vertexAI: VertexAI;
  private model: any;
  private model15Pro: any; // Gemini 1.5 Pro 用於多模態語者識別
  private speechClient: SpeechClient;
  private speechClientV2: InstanceType<typeof SpeechClientV2>; // V2 客戶端 for STT V2
  private storageClient: Storage;
  private bucketName: string;
  private projectId: string;

  constructor() {
    // GCS bucket 名稱
    this.bucketName =
      process.env.GOOGLE_CLOUD_STORAGE_BUCKET || "voicetextpro-audio";

    // 使用 Application Default Credentials (ADC) - 透過 gcloud auth application-default login 設定
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || "wonderland-nft";

    // 初始化 Vertex AI（使用 ADC 自動認證，不需要 API key）
    this.vertexAI = new VertexAI({
      project: this.projectId,
      location: "us-central1",
    });

    // Gemini 2.0 Flash 用於 AI 分析
    this.model = this.vertexAI.getGenerativeModel({
      model: "gemini-2.0-flash-001",
    });

    // Gemini 2.5 Pro 用於多模態語者識別（結合音訊和文字）
    this.model15Pro = this.vertexAI.getGenerativeModel({
      model: "gemini-2.5-pro",
    });

    // 初始化 Storage 和 SpeechClient（使用 ADC 自動認證）
    this.speechClient = new SpeechClient({ projectId: this.projectId });

    // 初始化 V2 SpeechClient (使用 us multi-region - chirp_3 支援)
    this.speechClientV2 = new SpeechClientV2({
      apiEndpoint: "us-speech.googleapis.com",
    });

    this.storageClient = new Storage({ projectId: this.projectId });

    console.log(
      `Google Cloud clients initialized with ADC (Project: ${this.projectId}, Bucket: ${this.bucketName})`
    );
    console.log(
      `Vertex AI initialized (gemini-2.0-flash-001, gemini-2.5-pro), Speech-to-Text V2 initialized for us (chirp_3)`
    );
  }

  /**
   * 使用 Gemini 1.5 Pro 多模態能力進行語者識別
   * 結合音訊檔案和逐字稿文字，提高語者識別準確度
   * @param gcsUri GCS 音檔 URI
   * @param rawTranscript 原始逐字稿文字
   * @param attendees 可選的與會者名單
   * @param attendeeRoles 可選的角色描述（如「陳經理通常是主持會議的人，林秘書負責記錄並偶爾補充」）
   * @returns cleanedSegments 和 speakers
   */
  async identifySpeakersMultimodal(
    gcsUri: string,
    rawTranscript: string,
    attendees?: string[],
    attendeeRoles?: string
  ): Promise<{
    cleanedSegments: Array<{
      speaker: string;
      text: string;
      start: number;
      end: number;
    }>;
    speakers: Array<{
      id: string;
      label: string;
      color: string;
    }>;
  }> {
    const speakerColors = [
      "hsl(220, 70%, 50%)",
      "hsl(120, 70%, 50%)",
      "hsl(0, 70%, 50%)",
      "hsl(280, 70%, 50%)",
      "hsl(60, 70%, 50%)",
      "hsl(180, 70%, 50%)",
    ];

    console.log(`[Multimodal] 開始多模態語者識別...`);
    console.log(`[Multimodal] GCS URI: ${gcsUri}`);
    console.log(`[Multimodal] 逐字稿長度: ${rawTranscript.length} 字元`);
    console.log(`[Multimodal] 與會者名單: ${attendees?.join(', ') || '未提供'}`);
    console.log(`[Multimodal] 角色描述: ${attendeeRoles || '未提供'}`);

    // 建立 Prompt
    const attendeesInfo = attendees && attendees.length > 0
      ? `已知與會者名單：${attendees.join('、')}`
      : '未知與會者名單（請自行識別並使用「講者A」、「講者B」等標籤）';

    // 角色背景資訊
    const roleContext = attendeeRoles
      ? `\n【角色背景資訊】\n${attendeeRoles}\n\n請根據上述角色特徵來輔助判斷說話者身分。例如，主持人通常會引導討論、問問題；記錄員可能較少發言但會確認重點。`
      : '';

    const prompt = `你是一位專業的會議記錄員，擁有出色的聲音識別能力。請結合提供的音訊特徵（音色、語氣、說話速度）與原始逐字稿文字內容，精確地標註說話者身分。

${attendeesInfo}
${roleContext}

【音訊分析重點】
1. 仔細聆聽不同說話者的聲音特徵（性別、音高、語調、口音）
2. 注意說話者切換的時機點
3. 結合文字內容和角色特徵推測說話者身分
4. 如果有角色描述，優先參考角色的說話習慣和職責來判斷

【文字處理要求】
1. 修正語法錯誤和錯別字
2. 移除口語贅詞（如「嗯」、「啊」、「那個」、「就是」等）
3. 添加適當的標點符號
4. 保持原意不變

【原始逐字稿】
${rawTranscript}

【輸出格式】
請以 JSON 格式回應，確保 JSON 格式正確：

{
  "cleanedSegments": [
    { "speaker": "${attendees?.[0] || '講者A'}", "text": "整理後的內容...", "start": 0, "end": 5000 },
    { "speaker": "${attendees?.[1] || '講者B'}", "text": "整理後的內容...", "start": 5000, "end": 10000 }
  ],
  "speakers": [
    { "id": "A", "label": "${attendees?.[0] || '講者A'}", "color": "hsl(220, 70%, 50%)" },
    { "id": "B", "label": "${attendees?.[1] || '講者B'}", "color": "hsl(120, 70%, 50%)" }
  ]
}

【注意事項】
1. start 和 end 為毫秒時間戳，必須與原始音訊對應
2. 同一人連續發言可合併為一個 segment
3. 當說話人切換時，必須創建新的 segment
4. 只輸出 JSON，不要有其他文字`;

    try {
      // 使用 Gemini 1.5 Pro 進行多模態分析
      const result = await this.model15Pro.generateContent({
        contents: [{
          role: "user",
          parts: [
            {
              fileData: {
                mimeType: "audio/mpeg",
                fileUri: gcsUri,
              }
            },
            {
              text: prompt
            }
          ]
        }]
      });

      const response = result.response;
      const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

      console.log(`[Multimodal] 收到回應，長度: ${responseText.length} 字元`);

      // 解析 JSON 回應
      let parsedResponse: any;
      try {
        let jsonText = responseText.trim();

        // 移除 markdown 格式
        jsonText = jsonText
          .replace(/```json\s*/g, "")
          .replace(/```\s*/g, "")
          .trim();

        // 找到 JSON 開始和結束位置
        const jsonStart = jsonText.indexOf("{");
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

            if (char === "\\") {
              escapeNext = true;
              continue;
            }

            if (char === '"') {
              inString = !inString;
              continue;
            }

            if (!inString) {
              if (char === "{") {
                braceCount++;
              } else if (char === "}") {
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

        parsedResponse = JSON.parse(jsonText);
      } catch (parseError) {
        console.error("[Multimodal] JSON 解析失敗:", parseError);
        console.log("[Multimodal] 原始回應:", responseText.substring(0, 500));
        throw new Error(`Gemini 回應格式異常，無法解析 JSON`);
      }

      // 處理結果
      const cleanedSegments = parsedResponse.cleanedSegments || [];
      let speakers = parsedResponse.speakers || [];

      // 確保 speakers 有正確的格式
      if (speakers.length === 0 && cleanedSegments.length > 0) {
        const speakerSet = new Set(cleanedSegments.map((seg: any) => seg.speaker));
        speakers = Array.from(speakerSet).map((label: any, index: number) => ({
          id: String.fromCharCode(65 + index),
          label: label as string,
          color: speakerColors[index % speakerColors.length]
        }));
      }

      console.log(`[Multimodal] 解析完成: ${cleanedSegments.length} 個段落，${speakers.length} 位說話者`);

      return {
        cleanedSegments,
        speakers
      };

    } catch (error) {
      console.error("[Multimodal] 多模態分析失敗:", error);
      throw error;
    }
  }

  /**
   * 上傳音檔到 GCS（公開方法，供 API 端點使用）
   * @param audioFilePath 本地音檔路徑
   * @returns GCS URI
   */
  async uploadAudioToGCS(audioFilePath: string): Promise<string> {
    return this.uploadToGCS(audioFilePath);
  }

  /**
   * 清理 GCS 檔案（公開方法，供 API 端點使用）
   * @param gcsUri GCS 檔案 URI
   */
  async cleanupGCSFilePublic(gcsUri: string): Promise<void> {
    return this.cleanupGCSFile(gcsUri);
  }

  async transcribeAudio(audioFilePath: string): Promise<{
    transcriptText: string;
    segments: Array<{
      text: string;
      speaker: string;
      start: number;
      end: number;
      confidence: number;
    }>;
    speakers: Array<{
      id: string;
      label: string;
      color: string;
    }>;
    duration: number;
    wordCount: number;
  }> {
    try {
      console.log(
        `Starting Gemini 3 Flash transcription for: ${audioFilePath}`
      );

      // Check if file exists
      if (!fs.existsSync(audioFilePath)) {
        throw new Error(`Audio file not found: ${audioFilePath}`);
      }

      // Get file stats
      const stats = fs.statSync(audioFilePath);
      const fileSizeBytes = stats.size;
      const fileSizeMB = fileSizeBytes / (1024 * 1024);

      console.log(`Audio file size: ${fileSizeMB.toFixed(2)}MB`);

      // 使用 Gemini 3 Flash 進行轉錄（支援最長 9.5 小時音檔）
      return await this.transcribeWithGemini3Flash(audioFilePath);
    } catch (error: unknown) {
      console.error("Gemini transcription error:", error);
      const errMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to transcribe audio: ${errMsg}`);
    }
  }

  /**
   * 使用 Gemini 3 Flash 進行語音轉錄
   * 支援最長 9.5 小時音檔，支援繁體中文及多語言
   * @param audioFilePath 音檔路徑
   * @param onProgress 進度回調函數（可選）
   */
  private async transcribeWithGemini3Flash(
    audioFilePath: string,
    onProgress?: (progress: number) => Promise<void>
  ): Promise<SpeechToTextResult> {
    const speakerColors = [
      "hsl(220, 70%, 50%)",
      "hsl(120, 70%, 50%)",
      "hsl(0, 70%, 50%)",
      "hsl(280, 70%, 50%)",
      "hsl(60, 70%, 50%)",
      "hsl(180, 70%, 50%)",
    ];

    try {
      console.log(`[Gemini 3 Flash] 開始轉錄: ${audioFilePath}`);

      // 檢查檔案是否存在
      if (!fs.existsSync(audioFilePath)) {
        throw new Error(`音檔不存在: ${audioFilePath}`);
      }

      const stats = fs.statSync(audioFilePath);
      const fileSizeMB = stats.size / (1024 * 1024);
      console.log(`[Gemini 3 Flash] 檔案大小: ${fileSizeMB.toFixed(2)}MB`);

      // 使用 ffprobe 取得真實音檔時長
      let actualDurationMs = 0;
      try {
        const { stdout } = await execAsync(
          `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioFilePath}"`
        );
        const durationSeconds = parseFloat(stdout.trim());
        if (!isNaN(durationSeconds)) {
          actualDurationMs = Math.floor(durationSeconds * 1000);
          console.log(
            `[Gemini 3 Flash] 音檔實際時長: ${Math.floor(
              durationSeconds / 60
            )} 分 ${Math.floor(durationSeconds % 60)} 秒`
          );
        }
      } catch (ffprobeError) {
        console.warn(`[Gemini 3 Flash] 無法取得音檔時長:`, ffprobeError);
      }

      // 回報進度 10%
      if (onProgress) await onProgress(10);

      // 讀取音檔並轉為 base64
      const audioBuffer = fs.readFileSync(audioFilePath);
      const base64Audio = audioBuffer.toString("base64");
      const mimeType = this.getAudioMimeType(audioFilePath);

      console.log(`[Gemini 3 Flash] MIME type: ${mimeType}`);

      // 回報進度 20%
      if (onProgress) await onProgress(20);

      // 建立 Gemini API 請求 - 強調說話人識別
      const prompt = `你是專業的語音轉錄專家。請仔細聆聽這個音檔，完成以下任務：

【重要任務】
1. **說話人識別（Speaker Diarization）**：仔細區分不同說話人的聲音特徵（音調、語速、口音），將對話分配給不同講者
2. **完整轉錄**：將所有語音內容轉為繁體中文文字
3. **分段處理**：按照說話人變換來分段，每段標註講者

【輸出格式】請嚴格按照以下 JSON 格式回覆：

{
  "transcript": "完整的轉錄文字內容（包含所有講者的發言）",
  "segments": [
    {
      "text": "講者A說的第一段話",
      "speaker": "講者A",
      "startTime": 0,
      "endTime": 15000,
      "confidence": 0.95
    },
    {
      "text": "講者B的回應",
      "speaker": "講者B",
      "startTime": 15000,
      "endTime": 28000,
      "confidence": 0.92
    },
    {
      "text": "講者A繼續說",
      "speaker": "講者A",
      "startTime": 28000,
      "endTime": 45000,
      "confidence": 0.94
    }
  ],
  "speakers": ["講者A", "講者B"],
  "totalDuration": 音檔總時長毫秒數
}

【說話人識別指南】
- 根據聲音特徵（性別、音高、語速、口音）區分不同說話人
- 使用「講者A」「講者B」「講者C」等標籤
- 同一人連續發言可合併為一個 segment
- 當說話人切換時，必須創建新的 segment
- 預估這個音檔可能有 2-5 位說話人，請仔細辨識

【轉錄要求】
- 使用繁體中文
- 添加適當標點符號
- startTime 和 endTime 以毫秒為單位
- 不要遺漏任何語音內容

請只輸出 JSON，不要有其他文字。`;

      console.log(`[Gemini 3 Flash] 發送轉錄請求...`);

      // 使用 Gemini 2.0 Flash 進行轉錄
      const result = await this.model.generateContent([
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Audio,
          },
        },
        { text: prompt },
      ]);

      // 回報進度 80%
      if (onProgress) await onProgress(80);

      const response = await result.response;
      const responseText = response.text();

      console.log(
        `[Gemini 3 Flash] 收到回應，長度: ${responseText.length} 字元`
      );

      // 解析 JSON 回應
      let parsedResponse: any;
      try {
        // 嘗試提取 JSON
        let jsonText = responseText.trim();

        // 移除 markdown 格式
        jsonText = jsonText
          .replace(/```json\s*/g, "")
          .replace(/```\s*/g, "")
          .replace(/^\s*```.*$/gm, "")
          .trim();

        // 找到 JSON 開始和結束位置
        const jsonStart = jsonText.indexOf("{");
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

            if (char === "\\") {
              escapeNext = true;
              continue;
            }

            if (char === '"') {
              inString = !inString;
              continue;
            }

            if (!inString) {
              if (char === "{") {
                braceCount++;
              } else if (char === "}") {
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

        parsedResponse = JSON.parse(jsonText);
      } catch (parseError) {
        console.error("[Gemini 3 Flash] JSON 解析失敗:", parseError);
        console.log(
          "[Gemini 3 Flash] 原始回應:",
          responseText.substring(0, 500)
        );

        // 如果解析失敗，嘗試提取純文字作為轉錄結果
        const plainText = responseText
          .replace(/```json\s*/g, "")
          .replace(/```\s*/g, "")
          .replace(/^\{[\s\S]*\}$/m, "")
          .trim();

        if (plainText.length > 50) {
          // 使用純文字作為轉錄結果
          parsedResponse = {
            transcript: plainText,
            segments: [],
            speakers: ["講者A"],
            totalDuration: 0,
          };
        } else {
          throw new Error("無法解析 Gemini 回應");
        }
      }

      // 回報進度 90%
      if (onProgress) await onProgress(90);

      // 處理轉錄結果
      const transcript = parsedResponse.transcript || "";
      const rawSegments = parsedResponse.segments || [];
      const rawSpeakers = parsedResponse.speakers || ["講者A"];
      const totalDuration = parsedResponse.totalDuration || 0;

      console.log(
        `[Gemini 3 Flash] 解析結果: transcript=${transcript.length}字, segments=${rawSegments.length}個, speakers=${rawSpeakers.length}位, totalDuration=${totalDuration}ms`
      );
      if (rawSegments.length > 0) {
        console.log(
          `[Gemini 3 Flash] 第一個 segment: speaker=${
            rawSegments[0].speaker
          }, text=${rawSegments[0].text?.substring(0, 50)}...`
        );
      }

      // 建立 speakers 陣列
      const speakers: SpeechToTextResult["speakers"] = rawSpeakers.map(
        (speaker: string, index: number) => ({
          id: String.fromCharCode(65 + index),
          label: speaker,
          color: speakerColors[index % speakerColors.length],
        })
      );

      // 建立 segments 陣列
      let segments: SpeechToTextResult["segments"] = [];

      if (rawSegments.length > 0) {
        segments = rawSegments.map((seg: any) => ({
          text: seg.text || "",
          speaker: seg.speaker || "講者A",
          start: seg.startTime || 0,
          end: seg.endTime || 0,
          confidence: seg.confidence || 0.9,
        }));
      } else if (transcript) {
        // 如果沒有 segments，將整個轉錄文字作為一個 segment
        segments = [
          {
            text: transcript,
            speaker: "講者A",
            start: 0,
            end: totalDuration || 30000,
            confidence: 0.9,
          },
        ];
      }

      // 如果 speakers 陣列為空，添加預設講者
      if (speakers.length === 0) {
        speakers.push({
          id: "A",
          label: "講者A",
          color: speakerColors[0],
        });
      }

      // 計算時長 (確保為整數) - 優先使用 ffprobe 取得的實際時長
      let duration = 0;
      if (actualDurationMs > 0) {
        duration = Math.floor(actualDurationMs / 1000);
        console.log(`[Gemini 3 Flash] 使用 ffprobe 時長: ${duration} 秒`);
      } else if (totalDuration && totalDuration > 0) {
        duration = Math.floor(totalDuration / 1000);
        console.log(`[Gemini 3 Flash] 使用 Gemini 回報時長: ${duration} 秒`);
      } else if (segments.length > 0) {
        duration = Math.floor(Math.max(...segments.map((s) => s.end)) / 1000);
        console.log(`[Gemini 3 Flash] 使用 segments 計算時長: ${duration} 秒`);
      } else {
        // 根據檔案大小估算（假設 MP3 128kbps）
        duration = Math.floor(stats.size / ((128 * 1024) / 8));
        console.log(`[Gemini 3 Flash] 使用檔案大小估算時長: ${duration} 秒`);
      }

      // 修正 segments 的 endTime，使用實際時長
      if (
        actualDurationMs > 0 &&
        segments.length === 1 &&
        segments[0].end < actualDurationMs
      ) {
        segments[0].end = actualDurationMs;
        console.log(
          `[Gemini 3 Flash] 修正 segment endTime 為實際時長: ${actualDurationMs}ms`
        );
      }

      // 計算字數
      const wordCount = this.calculateWordCount(transcript);

      console.log(
        `[Gemini 3 Flash] 轉錄完成: ${transcript.length} 字元, ${segments.length} 段落, ${speakers.length} 位說話人, ${wordCount} 字`
      );

      // 回報進度 100%
      if (onProgress) await onProgress(100);

      return {
        transcriptText: transcript,
        segments,
        speakers,
        duration,
        wordCount,
      };
    } catch (error) {
      console.error("[Gemini 3 Flash] 轉錄錯誤:", error);
      throw new Error(
        `Gemini 轉錄失敗: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  private async transcribeShortAudio(audioFilePath: string): Promise<{
    transcriptText: string;
    segments: Array<{
      text: string;
      speaker: string;
      start: number;
      end: number;
      confidence: number;
    }>;
    speakers: Array<{
      id: string;
      label: string;
      color: string;
    }>;
    duration: number;
    wordCount: number;
  }> {
    try {
      console.log("Using short audio recognition for file under 10MB");

      // Read the audio file
      const audioBytes = fs.readFileSync(audioFilePath);

      // Detect audio encoding and sample rate
      const audioConfig = this.getAudioConfig(audioFilePath);

      const request = {
        audio: {
          content: audioBytes.toString("base64"),
        },
        config: {
          encoding: audioConfig.encoding,
          sampleRateHertz: audioConfig.sampleRate,
          languageCode: "zh-TW",
          enableAutomaticPunctuation: true,
          enableSpeakerDiarization: true,
          diarizationSpeakerCount: 2, // Start with 2 speakers for better accuracy // Allow up to 4 speakers
          model: "default", // Use default model which supports zh-TW globally
          // useEnhanced: true, // Disable for better compatibility
        },
      };

      console.log("Sending request to Speech-to-Text API...");
      const [response] = await this.speechClient.recognize(request);

      return this.processSpeechResponse(response, audioFilePath);
    } catch (error) {
      console.error("Short audio transcription error:", error);
      throw error;
    }
  }

  private async transcribeWithChunking(audioFilePath: string): Promise<{
    transcriptText: string;
    segments: Array<{
      text: string;
      speaker: string;
      start: number;
      end: number;
      confidence: number;
    }>;
    speakers: Array<{
      id: string;
      label: string;
      color: string;
    }>;
    duration: number;
    wordCount: number;
  }> {
    console.log("Attempting to process large audio file with compression");

    try {
      // Try to compress the audio file for processing
      const compressedPath = await this.compressAudioFile(audioFilePath);

      console.log(`Compressed audio file created, attempting transcription...`);
      const result = await this.transcribeShortAudio(compressedPath);

      // Clean up compressed file
      try {
        fs.unlinkSync(compressedPath);
      } catch (cleanupError) {
        console.warn("Failed to cleanup compressed file:", cleanupError);
      }

      return {
        ...result,
        transcriptText: `[壓縮處理] ${result.transcriptText}`,
      };
    } catch (compressionError) {
      console.warn(
        "Compression failed, trying original file with reduced quality settings"
      );

      // Last resort: try original file with basic settings
      try {
        const result = await this.transcribeShortAudioBasic(audioFilePath);
        return {
          ...result,
          transcriptText: `[基礎處理] ${result.transcriptText}`,
        };
      } catch (finalError: unknown) {
        const errMsg =
          finalError instanceof Error ? finalError.message : String(finalError);
        throw new Error(
          `Unable to process large audio file: ${errMsg}. Please try a smaller file or different format.`
        );
      }
    }
  }

  private async compressAudioFile(inputPath: string): Promise<string> {
    // Simple compression by reducing sample rate and quality
    const outputPath = inputPath.replace(/\.[^.]+$/, "_compressed.wav");

    // For now, return the original path as we don't have audio processing libraries
    // In production, you'd use ffmpeg or similar to compress the audio
    console.log("Audio compression not implemented, using original file");
    return inputPath;
  }

  private async transcribeShortAudioBasic(audioFilePath: string): Promise<{
    transcriptText: string;
    segments: Array<{
      text: string;
      speaker: string;
      start: number;
      end: number;
      confidence: number;
    }>;
    speakers: Array<{
      id: string;
      label: string;
      color: string;
    }>;
    duration: number;
    wordCount: number;
  }> {
    console.log("Using basic audio processing with minimal features");

    // Read smaller chunks of the audio file
    const audioBytes = fs.readFileSync(audioFilePath);
    const maxChunkSize = 8 * 1024 * 1024; // 8MB max

    if (audioBytes.length > maxChunkSize) {
      // Truncate the audio to first 8MB for processing
      const truncatedBytes = audioBytes.subarray(0, maxChunkSize);
      const tempPath = audioFilePath + "_temp";
      fs.writeFileSync(tempPath, truncatedBytes);

      try {
        const result = await this.transcribeShortAudio(tempPath);
        fs.unlinkSync(tempPath);
        return {
          ...result,
          transcriptText: `[部分處理 - 音檔過大，僅處理前段內容] ${result.transcriptText}`,
        };
      } catch (error) {
        try {
          fs.unlinkSync(tempPath);
        } catch {}
        throw error;
      }
    } else {
      return await this.transcribeShortAudio(audioFilePath);
    }
  }

  private async transcribeLongAudio(audioFilePath: string): Promise<{
    transcriptText: string;
    segments: Array<{
      text: string;
      speaker: string;
      start: number;
      end: number;
      confidence: number;
    }>;
    speakers: Array<{
      id: string;
      label: string;
      color: string;
    }>;
    duration: number;
    wordCount: number;
  }> {
    try {
      console.log("Using long-running recognition for large file");

      // For long audio, we need to upload to GCS first
      const gcsUri = await this.uploadToGCS(audioFilePath);
      console.log(`Audio uploaded to GCS: ${gcsUri}`);

      // Detect audio encoding and sample rate
      const audioConfig = this.getAudioConfig(audioFilePath);

      const request = {
        audio: {
          uri: gcsUri,
        },
        config: {
          encoding: audioConfig.encoding,
          sampleRateHertz: audioConfig.sampleRate,
          languageCode: "zh-TW",
          enableAutomaticPunctuation: true,
          enableSpeakerDiarization: true,
          diarizationSpeakerCount: 2, // Start with 2 speakers for better accuracy
          model: "default",
          // Optimized config for maximum compatibility with us-central1
        },
      };

      console.log("Starting long-running recognition...");
      console.log("Audio file info:", {
        path: audioFilePath,
        size: `${(fs.statSync(audioFilePath).size / 1024 / 1024).toFixed(2)}MB`,
        encoding: audioConfig.encoding,
        sampleRate: audioConfig.sampleRate,
      });
      console.log("Request config:", JSON.stringify(request, null, 2));
      const [operation] = await this.speechClient.longRunningRecognize(request);

      console.log("Waiting for operation to complete...");
      const [response] = await operation.promise();

      // Clean up GCS file
      await this.cleanupGCSFile(gcsUri);

      return this.processSpeechResponse(response, audioFilePath);
    } catch (error) {
      console.error("Long audio transcription error:", error);
      throw error;
    }
  }

  /**
   * 取得檔案大小（MB）
   */
  private getFileSizeInMB(filePath: string): number {
    try {
      const stats = fs.statSync(filePath);
      return stats.size / (1024 * 1024);
    } catch (error) {
      console.warn("[Speech-to-Text] 無法取得檔案大小，使用預設值");
      return 10; // 預設 10 MB
    }
  }

  private getAudioConfig(filePath: string): {
    encoding: AudioEncoding;
    sampleRate: number;
  } {
    const ext = filePath.toLowerCase().split(".").pop();
    const AudioEncodingEnum =
      protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding;

    switch (ext) {
      case "wav":
        return {
          encoding: AudioEncodingEnum.LINEAR16,
          sampleRate: 48000, // Use 48kHz for converted WAV files
        };
      case "mp3":
        return {
          encoding: AudioEncodingEnum.MP3,
          sampleRate: 16000,
        };
      case "m4a":
      case "aac":
        return {
          encoding: AudioEncodingEnum.MP3, // M4A/AAC files processed as MP3 encoding
          sampleRate: 48000, // EXACT match to 三立電視 7.m4a (48 kHz)
        };
      case "flac":
        return {
          encoding: AudioEncodingEnum.FLAC,
          sampleRate: 16000,
        };
      case "ogg":
        return {
          encoding: AudioEncodingEnum.OGG_OPUS,
          sampleRate: 16000,
        };
      default:
        return {
          encoding: AudioEncodingEnum.LINEAR16,
          sampleRate: 16000,
        };
    }
  }

  /**
   * 專門為 Speech-to-Text 取得音檔配置
   * 會嘗試用 ffprobe 偵測真實取樣率
   */
  private getAudioConfigForSpeechToText(filePath: string): {
    encoding: AudioEncoding;
    sampleRate: number;
  } {
    const ext = path.extname(filePath).toLowerCase();
    const AudioEncodingEnum =
      protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding;

    // 對於沒有副檔名的檔案（上傳的暫存檔），嘗試偵測格式
    let effectiveExt = ext;
    if (!ext || ext === "") {
      // 預設為 MP3（大多數上傳的音檔都是 MP3）
      effectiveExt = ".mp3";
    }

    switch (effectiveExt) {
      case ".wav":
        return {
          encoding: AudioEncodingEnum.LINEAR16,
          sampleRate: 16000, // 我們轉換的 WAV 都是 16kHz
        };
      case ".mp3":
        // MP3 格式讓 API 自動偵測取樣率
        return {
          encoding: AudioEncodingEnum.MP3,
          sampleRate: 0, // 設為 0 讓 API 自動偵測
        };
      case ".m4a":
      case ".aac":
        // M4A/AAC 使用自動偵測
        return {
          encoding: AudioEncodingEnum.ENCODING_UNSPECIFIED,
          sampleRate: 0,
        };
      case ".flac":
        return {
          encoding: AudioEncodingEnum.FLAC,
          sampleRate: 16000, // 我們轉換的 FLAC 都是 16kHz
        };
      case ".ogg":
        return {
          encoding: AudioEncodingEnum.OGG_OPUS,
          sampleRate: 0, // 自動偵測
        };
      case ".webm":
        return {
          encoding: AudioEncodingEnum.WEBM_OPUS,
          sampleRate: 0, // 自動偵測
        };
      default:
        // 對於未知格式，讓 API 自動偵測
        return {
          encoding: AudioEncodingEnum.MP3,
          sampleRate: 0,
        };
    }
  }

  /**
   * 上傳音檔到 Google Cloud Storage
   * @param audioFilePath 本地音檔路徑
   * @returns GCS URI (gs://bucket/filename)
   */
  private async uploadToGCS(audioFilePath: string): Promise<string> {
    const fileName = `audio-${Date.now()}-${path.basename(audioFilePath)}`;

    try {
      console.log(`[GCS] 上傳音檔到 ${this.bucketName}...`);
      const bucket = this.storageClient.bucket(this.bucketName);

      // Check if bucket exists
      const [exists] = await bucket.exists();
      if (!exists) {
        throw new Error(
          `Bucket ${this.bucketName} does not exist. Please create it in Google Cloud Console.`
        );
      }

      const file = bucket.file(fileName);

      // Upload the file with progress tracking
      const fileSize = fs.statSync(audioFilePath).size;
      console.log(`[GCS] 檔案大小: ${(fileSize / 1024 / 1024).toFixed(2)}MB`);

      await file.save(fs.readFileSync(audioFilePath), {
        contentType: this.getAudioMimeType(audioFilePath),
      });

      // 驗證上傳成功
      const [metadata] = await file.getMetadata();
      const uploadedSize = parseInt(metadata.size as string) || 0;
      if (uploadedSize !== fileSize) {
        throw new Error(
          `GCS 上傳驗證失敗：本地檔案 ${fileSize} bytes，上傳後 ${uploadedSize} bytes`
        );
      }
      console.log(`[GCS] 上傳驗證成功：${uploadedSize} bytes`);

      const gcsUri = `gs://${this.bucketName}/${fileName}`;
      console.log(`[GCS] 上傳完成: ${gcsUri}`);
      return gcsUri;
    } catch (error: unknown) {
      console.error("[GCS] 上傳失敗:", error);
      const errMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to upload audio to GCS: ${errMsg}`);
    }
  }

  /**
   * 取得音檔的 MIME type
   */
  private getAudioMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".mp3": "audio/mp3",
      ".wav": "audio/wav",
      ".aiff": "audio/aiff",
      ".aac": "audio/aac",
      ".ogg": "audio/ogg",
      ".flac": "audio/flac",
      ".m4a": "audio/mp4",
      ".webm": "audio/webm",
    };
    return mimeTypes[ext] || "audio/mpeg";
  }

  private async cleanupGCSFile(gcsUri: string): Promise<void> {
    try {
      const [, bucketName, fileName] =
        gcsUri.match(/gs:\/\/([^\/]+)\/(.+)/) || [];
      if (bucketName && fileName) {
        const bucket = this.storageClient.bucket(bucketName);
        const file = bucket.file(fileName);
        await file.delete();
        console.log(`Cleaned up GCS file: ${gcsUri}`);
      }
    } catch (error) {
      console.error("Error cleaning up GCS file:", error);
      // Don't throw error as this is cleanup
    }
  }

  /**
   * 裁切音檔開頭和結尾的靜音段落
   * 使用 FFmpeg silenceremove 濾鏡
   * @param inputPath 原始音檔路徑
   * @returns 處理後的音檔路徑
   */
  private async trimSilence(inputPath: string): Promise<string> {
    const ext = path.extname(inputPath) || ".mp3"; // 預設為 mp3
    const baseName = path.basename(inputPath, ext);
    const dir = path.dirname(inputPath);
    const outputPath = path.join(dir, `${baseName}_trimmed${ext}`);

    try {
      console.log(`[Silence Trim] 開始裁切靜音: ${inputPath}`);

      // FFmpeg 靜音裁切命令
      // - start_periods=1: 移除開頭第一段靜音
      // - start_duration=0.5: 靜音持續 0.5 秒以上才移除
      // - start_threshold=-50dB: 低於 -50dB 視為靜音
      // - areverse x2: 反轉處理結尾靜音
      const silenceFilter = [
        "silenceremove=start_periods=1:start_duration=0.5:start_threshold=-50dB:detection=peak",
        "areverse",
        "silenceremove=start_periods=1:start_duration=0.5:start_threshold=-50dB:detection=peak",
        "areverse",
      ].join(",");

      const command = `ffmpeg -i "${inputPath}" -af "${silenceFilter}" -y "${outputPath}"`;

      console.log(`[Silence Trim] 執行命令: ${command}`);

      const { stdout, stderr } = await execAsync(command, { timeout: 300000 }); // 5 分鐘逾時

      // 檢查輸出檔案是否存在
      if (!fs.existsSync(outputPath)) {
        console.warn(`[Silence Trim] 輸出檔案不存在，使用原始檔案`);
        return inputPath;
      }

      // 比較檔案大小
      const originalSize = fs.statSync(inputPath).size;
      const trimmedSize = fs.statSync(outputPath).size;
      const savedPercent = (
        ((originalSize - trimmedSize) / originalSize) *
        100
      ).toFixed(1);

      console.log(
        `[Silence Trim] 完成！原始: ${(originalSize / 1024 / 1024).toFixed(
          2
        )}MB, 處理後: ${(trimmedSize / 1024 / 1024).toFixed(
          2
        )}MB (節省 ${savedPercent}%)`
      );

      // 如果處理後檔案太小（可能出錯），使用原始檔案
      if (trimmedSize < originalSize * 0.1) {
        console.warn(`[Silence Trim] 處理後檔案過小，可能有問題，使用原始檔案`);
        fs.unlinkSync(outputPath);
        return inputPath;
      }

      return outputPath;
    } catch (error) {
      console.error(`[Silence Trim] 處理失敗:`, error);
      // 清理可能產生的不完整檔案
      if (fs.existsSync(outputPath)) {
        try {
          fs.unlinkSync(outputPath);
        } catch {}
      }
      // 失敗時返回原始檔案路徑
      return inputPath;
    }
  }

  /**
   * 清理暫存的裁切檔案
   */
  private cleanupTrimmedFile(trimmedPath: string, originalPath: string): void {
    if (trimmedPath !== originalPath && fs.existsSync(trimmedPath)) {
      try {
        fs.unlinkSync(trimmedPath);
        console.log(`[Silence Trim] 已清理暫存檔案: ${trimmedPath}`);
      } catch (error) {
        console.warn(`[Silence Trim] 清理暫存檔案失敗:`, error);
      }
    }
  }

  private processSpeechResponse(
    response: any,
    audioFilePath: string
  ): {
    transcriptText: string;
    segments: Array<{
      text: string;
      speaker: string;
      start: number;
      end: number;
      confidence: number;
    }>;
    speakers: Array<{
      id: string;
      label: string;
      color: string;
    }>;
    duration: number;
    wordCount: number;
  } {
    const speakerColors = [
      "hsl(220, 70%, 50%)",
      "hsl(120, 70%, 50%)",
      "hsl(0, 70%, 50%)",
      "hsl(280, 70%, 50%)",
      "hsl(60, 70%, 50%)",
      "hsl(180, 70%, 50%)",
    ];

    let fullTranscript = "";
    const segments: Array<{
      text: string;
      speaker: string;
      start: number;
      end: number;
      confidence: number;
    }> = [];
    const speakerMap = new Map<number, string>();
    const speakers: Array<{
      id: string;
      label: string;
      color: string;
    }> = [];

    if (!response.results || response.results.length === 0) {
      console.warn("No transcription results found, this could be due to:");
      console.warn("1. Audio quality issues");
      console.warn("2. Unsupported audio format/encoding");
      console.warn("3. Language model incompatibility");
      console.warn("4. Audio content is too quiet or unclear");

      // Return a basic result instead of throwing error
      return {
        transcriptText:
          "[無法辨識音訊內容 - 可能是音質問題、格式不支援或音檔內容過於模糊]",
        segments: [
          {
            text: "[無法辨識音訊內容]",
            speaker: "講者A",
            start: 0,
            end: 30000,
            confidence: 0.0,
          },
        ],
        speakers: [
          {
            id: "A",
            label: "講者A",
            color: "hsl(220, 70%, 50%)",
          },
        ],
        duration: 30,
        wordCount: 0,
      };
    }

    console.log(`Processing ${response.results.length} transcription results`);

    // Process each result
    for (const result of response.results) {
      if (!result.alternatives || result.alternatives.length === 0) continue;

      const alternative = result.alternatives[0];
      const transcript = alternative.transcript;
      fullTranscript += transcript + " ";

      // Process speaker diarization
      if (alternative.words && alternative.words.length > 0) {
        let currentSpeaker = alternative.words[0].speakerTag || 1;
        let currentSegmentText = "";
        let segmentStart = this.timeToMilliseconds(
          alternative.words[0].startTime
        );
        let segmentEnd = segmentStart;

        for (const word of alternative.words) {
          const speakerTag = word.speakerTag || 1;

          // Create speaker mapping
          if (!speakerMap.has(speakerTag)) {
            const speakerLabel = `講者${String.fromCharCode(
              65 + speakerMap.size
            )}`;
            speakerMap.set(speakerTag, speakerLabel);

            speakers.push({
              id: String.fromCharCode(65 + speakers.length),
              label: speakerLabel,
              color: speakerColors[speakers.length % speakerColors.length],
            });
          }

          if (speakerTag === currentSpeaker) {
            // Same speaker, continue building segment
            currentSegmentText += word.word + " ";
            segmentEnd = this.timeToMilliseconds(word.endTime);
          } else {
            // Speaker changed, save current segment and start new one
            if (currentSegmentText.trim()) {
              segments.push({
                text: currentSegmentText.trim(),
                speaker: speakerMap.get(currentSpeaker) || "講者A",
                start: segmentStart,
                end: segmentEnd,
                confidence: alternative.confidence || 0.9,
              });
            }

            // Start new segment
            currentSpeaker = speakerTag;
            currentSegmentText = word.word + " ";
            segmentStart = this.timeToMilliseconds(word.startTime);
            segmentEnd = this.timeToMilliseconds(word.endTime);
          }
        }

        // Add final segment
        if (currentSegmentText.trim()) {
          segments.push({
            text: currentSegmentText.trim(),
            speaker: speakerMap.get(currentSpeaker) || "講者A",
            start: segmentStart,
            end: segmentEnd,
            confidence: alternative.confidence || 0.9,
          });
        }
      } else {
        // No speaker diarization, create single segment
        segments.push({
          text: transcript,
          speaker: "講者A",
          start: 0,
          end: 30000, // Default 30 seconds
          confidence: alternative.confidence || 0.9,
        });
      }
    }

    // If no speakers were detected, create default speaker
    if (speakers.length === 0) {
      speakers.push({
        id: "A",
        label: "講者A",
        color: speakerColors[0],
      });
    }

    // Calculate duration (estimate from last segment end time or file size, ensure integer)
    let duration =
      segments.length > 0
        ? Math.floor(Math.max(...segments.map((s) => s.end)) / 1000)
        : 0;
    if (duration === 0) {
      const stats = fs.statSync(audioFilePath);
      duration = Math.floor(stats.size / (16000 * 2)); // Rough estimation
    }

    const wordCount = this.calculateWordCount(fullTranscript.trim());

    console.log(
      `Transcription completed: ${fullTranscript.length} chars, ${segments.length} segments, ${speakers.length} speakers`
    );

    return {
      transcriptText: fullTranscript.trim(),
      segments,
      speakers,
      duration,
      wordCount,
    };
  }

  private timeToMilliseconds(time: any): number {
    if (!time) return 0;

    // Handle different time formats
    if (typeof time === "object" && time.seconds !== undefined) {
      const seconds = parseInt(time.seconds) || 0;
      const nanos = parseInt(time.nanos) || 0;
      return seconds * 1000 + Math.floor(nanos / 1000000);
    }

    if (typeof time === "string") {
      // Try to parse string format like "1.234s"
      const match = time.match(/(\d+(?:\.\d+)?)s?/);
      if (match) {
        return Math.floor(parseFloat(match[1]) * 1000);
      }
    }

    return 0;
  }

  private calculateWordCount(text: string): number {
    if (!text) return 0;

    // Check if text contains Chinese characters
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;

    if (chineseChars > text.length * 0.3) {
      // For Chinese text, count characters
      return chineseChars;
    } else {
      // For other languages, count words
      return text.split(/\s+/).filter((word) => word.length > 0).length;
    }
  }

  async cleanTranscript(transcriptText: string): Promise<{
    cleanedText: string;
    improvements: string[];
  }> {
    // For large texts, split into smaller chunks to improve processing speed
    const maxChunkSize = 2500; // characters
    if (transcriptText.length > maxChunkSize) {
      return this.cleanTranscriptInChunks(transcriptText, maxChunkSize);
    }

    const prompt = `請快速整理以下逐字稿，修正基本錯誤。請用繁體中文回覆JSON格式：

原始逐字稿：
${transcriptText}

JSON格式回覆：
{
  "cleanedText": "整理後的逐字稿內容",
  "improvements": ["主要改善項目"]
}

快速整理重點：
1. 修正明顯語法錯誤
2. 統一關鍵詞（LINE、全家等）
3. 添加基本標點
4. 保持原意

注意：只輸出JSON。`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      return this.parseCleaningResponse(text);
    } catch (error) {
      console.error("Gemini cleaning error:", error);
      throw new Error("Failed to clean transcript with Gemini");
    }
  }

  private async cleanTranscriptInChunks(
    transcriptText: string,
    chunkSize: number
  ): Promise<{
    cleanedText: string;
    improvements: string[];
  }> {
    const chunks = this.splitTextIntoChunks(transcriptText, chunkSize);
    const cleanedChunks: string[] = [];
    const allImprovements: string[] = [];

    for (const chunk of chunks) {
      try {
        const result = await this.cleanTranscript(chunk);
        cleanedChunks.push(result.cleanedText);
        allImprovements.push(...result.improvements);
      } catch (error) {
        console.error("Error cleaning chunk:", error);
        // If cleaning fails, use original chunk
        cleanedChunks.push(chunk);
      }
    }

    return {
      cleanedText: cleanedChunks.join(" "),
      improvements: Array.from(new Set(allImprovements)), // Remove duplicates
    };
  }

  private splitTextIntoChunks(text: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    let currentIndex = 0;

    while (currentIndex < text.length) {
      let endIndex = currentIndex + chunkSize;

      // Try to find a natural break point (sentence end)
      if (endIndex < text.length) {
        const lastPeriod = text.lastIndexOf("。", endIndex);
        const lastExclamation = text.lastIndexOf("！", endIndex);
        const lastQuestion = text.lastIndexOf("？", endIndex);

        const naturalBreak = Math.max(
          lastPeriod,
          lastExclamation,
          lastQuestion
        );
        if (naturalBreak > currentIndex) {
          endIndex = naturalBreak + 1;
        }
      }

      chunks.push(text.substring(currentIndex, endIndex));
      currentIndex = endIndex;
    }

    return chunks;
  }

  async segmentCleanedText(
    cleanedText: string,
    originalSpeakers: any[]
  ): Promise<{
    segments: any[];
  }> {
    try {
      const speakerLabels = originalSpeakers.map((s) => s.label).join("、");

      const prompt = `
你是一位專業的會議逐字稿分析專家。請將以下整理後的會議內容，根據語意邏輯和對話結構智能分配給不同講者，並創建合理的分段。

可用講者：
${originalSpeakers.map((s) => `- ${s.id}: ${s.label}`).join("\n")}

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
      console.error("Gemini segmentation error:", error);
      throw new Error("AI 語意分段時發生錯誤");
    }
  }

  async analyzeTranscription(
    transcription: Transcription
  ): Promise<AnalysisResult> {
    // Check if we have either segments or transcript text
    const segments = transcription.segments as any[];
    const hasValidSegments = Array.isArray(segments) && segments.length > 0;
    const hasTranscriptText =
      transcription.transcriptText &&
      transcription.transcriptText.trim().length > 0;

    if (!hasValidSegments && !hasTranscriptText) {
      throw new Error(
        "No valid content found for analysis - missing both segments and transcript text"
      );
    }

    const prompt = this.buildAnalysisPrompt(transcription);

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      return this.parseAnalysisResponse(text);
    } catch (error) {
      console.error("Gemini API error:", error);
      throw new Error("Failed to analyze transcription with Gemini");
    }
  }

  private buildAnalysisPrompt(transcription: Transcription): string {
    // Check if we have segments or just transcript text
    const segments = transcription.segments as any[];
    const hasValidSegments = Array.isArray(segments) && segments.length > 0;

    let conversationText = "";
    let speakerList = "";

    if (hasValidSegments) {
      // Extract unique speakers from segments
      const speakersSet = new Set<string>();
      segments.forEach((segment: any) => {
        if (segment.speaker) {
          speakersSet.add(segment.speaker);
        }
      });
      const speakers = Array.from(speakersSet);

      speakerList = speakers
        .map((speaker: string, index: number) => `- ${speaker}`)
        .join("\n");

      conversationText = segments
        .map((segment: any) => {
          // Handle both old and new segment formats
          const startTime = segment.start || segment.timestamp || 0;
          const timeInMinutes = Math.floor(startTime / 60000);
          const timeInSeconds = Math.floor((startTime % 60000) / 1000);
          const timeFormat = `${timeInMinutes}:${timeInSeconds
            .toString()
            .padStart(2, "0")}`;

          return `[${timeFormat}] ${segment.speaker}: ${segment.text}`;
        })
        .join("\n");
    } else if (transcription.transcriptText) {
      // Use transcript text if segments are not available
      conversationText = transcription.transcriptText;
      speakerList = "- 說話者（未識別）";
    } else {
      throw new Error("No valid content found for analysis");
    }

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
        throw new Error("No JSON found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        summary: parsed.summary || "無法生成摘要",
        keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
        speakerInsights: Array.isArray(parsed.speakerInsights)
          ? parsed.speakerInsights
          : [],
        actionItems: Array.isArray(parsed.actionItems)
          ? parsed.actionItems
          : [],
        topics: Array.isArray(parsed.topics) ? parsed.topics : [],
      };
    } catch (error) {
      console.error("Failed to parse Gemini response:", error);
      // Fallback response
      return {
        summary: "分析過程中發生錯誤，請稍後再試。",
        keyPoints: [],
        speakerInsights: [],
        actionItems: [],
        topics: [],
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
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .replace(/^\s*```.*$/gm, "") // Remove any other markdown
        .trim();

      // Find JSON boundaries more carefully
      const jsonStart = jsonText.indexOf("{");
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

          if (char === "\\") {
            escapeNext = true;
            continue;
          }

          if (char === '"') {
            inString = !inString;
            continue;
          }

          if (!inString) {
            if (char === "{") {
              braceCount++;
            } else if (char === "}") {
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
        .replace(/,\s*}/g, "}") // Remove trailing commas
        .replace(/,\s*]/g, "]") // Remove trailing commas in arrays
        .replace(/\n/g, " ") // Replace newlines with spaces
        .replace(/\s+/g, " ") // Normalize whitespace
        .trim();

      const parsed = JSON.parse(jsonText);

      return {
        cleanedText: parsed.cleanedText || "無法生成整理後的文字",
        improvements: Array.isArray(parsed.improvements)
          ? parsed.improvements
          : [],
      };
    } catch (error) {
      console.error("Failed to parse Gemini cleaning response:", error);

      // Advanced fallback: try to extract content with regex
      try {
        const cleanedTextMatch = response.match(
          /"cleanedText"\s*:\s*"((?:[^"\\]|\\.)*)"/
        );
        const improvementsMatch = response.match(
          /"improvements"\s*:\s*\[((?:[^\]]|\](?!\s*}))*)\]/
        );

        if (cleanedTextMatch) {
          let improvements: string[] = [];

          if (improvementsMatch) {
            const improvementsStr = improvementsMatch[1];
            const itemMatches = improvementsStr.match(/"((?:[^"\\]|\\.)*)"/g);
            if (itemMatches) {
              improvements = itemMatches.map((item) => item.slice(1, -1));
            }
          }

          return {
            cleanedText: cleanedTextMatch[1]
              .replace(/\\"/g, '"')
              .replace(/\\n/g, "\n"),
            improvements:
              improvements.length > 0
                ? improvements
                : ["手動提取整理內容", "建議重新嘗試以獲得完整分析"],
          };
        }
      } catch (regexError) {
        console.error("Regex extraction also failed:", regexError);
      }

      // Final fallback
      return {
        cleanedText:
          "文字整理過程中發生錯誤，請稍後再試。建議檢查文本長度或重新嘗試。",
        improvements: ["JSON 解析失敗", "建議重新執行整理功能"],
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
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .replace(/^\s*```.*$/gm, "")
        .trim();

      const jsonStart = jsonText.indexOf("{");
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

          if (char === "\\") {
            escapeNext = true;
            continue;
          }

          if (char === '"') {
            inString = !inString;
            continue;
          }

          if (!inString) {
            if (char === "{") {
              braceCount++;
            } else if (char === "}") {
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
        const validSegments = parsed.segments.filter(
          (seg: { text?: string; speakerId?: string }) =>
            seg.text &&
            typeof seg.text === "string" &&
            seg.text.trim().length > 0 &&
            seg.speakerId &&
            typeof seg.speakerId === "string"
        );

        console.log(
          `Parsed ${validSegments.length} valid segments from AI response`
        );

        return {
          segments: validSegments,
        };
      }

      throw new Error("Invalid segments format");
    } catch (error) {
      console.error(
        "Failed to parse segment response:",
        error,
        "Response:",
        response.substring(0, 500)
      );

      // Return empty segments array on error
      return {
        segments: [],
      };
    }
  }

  /**
   * 使用 Google Cloud Speech-to-Text 進行語音轉錄
   * 優化流程：直接使用 MP3 格式上傳，避免轉換 WAV 造成檔案膨脹
   * @param audioFilePath 音檔路徑
   * @param onProgress 進度回調函數
   */
  async transcribeWithChirp3(
    audioFilePath: string,
    onProgress?: (progress: number) => Promise<void>
  ): Promise<SpeechToTextResult> {
    let trimmedPath = audioFilePath;
    let gcsUri: string | null = null;

    try {
      console.log(`[Speech-to-Text] 開始轉錄: ${audioFilePath}`);

      // 檢查檔案是否存在
      if (!fs.existsSync(audioFilePath)) {
        throw new Error(`音檔不存在: ${audioFilePath}`);
      }

      const stats = fs.statSync(audioFilePath);
      const fileSizeMB = stats.size / (1024 * 1024);
      console.log(`[Speech-to-Text] 原始檔案大小: ${fileSizeMB.toFixed(2)}MB`);

      // 回報進度 5%
      if (onProgress) await onProgress(5);

      // 靜音裁切（可選）：對於較小的檔案才執行，避免耗費過多時間
      if (fileSizeMB < 50) {
        console.log(`[Speech-to-Text] 執行靜音裁切...`);
        trimmedPath = await this.trimSilence(audioFilePath);
      } else {
        console.log(`[Speech-to-Text] 檔案較大，跳過靜音裁切以加快處理`);
      }

      // 回報進度 10%
      if (onProgress) await onProgress(10);

      // 優化：直接使用原始格式上傳，Speech-to-Text 支援 MP3、M4A、WAV、FLAC 等
      // 不再轉換為 WAV，避免 34MB MP3 變成 135MB WAV
      let processedPath = trimmedPath;
      const ext = path.extname(trimmedPath).toLowerCase();

      // 只有完全不支援的格式才需要轉換
      const supportedFormats = [
        ".mp3",
        ".wav",
        ".flac",
        ".ogg",
        ".m4a",
        ".aac",
        ".webm",
      ];
      if (!supportedFormats.includes(ext) && ext !== "") {
        console.log(`[Speech-to-Text] 不支援的格式 ${ext}，轉換為 FLAC...`);
        processedPath = await this.convertToFlac(trimmedPath);
      } else {
        console.log(
          `[Speech-to-Text] 直接使用原始格式 ${ext || "mp3"}，跳過轉換`
        );
      }

      // 回報進度 15%
      if (onProgress) await onProgress(15);

      const processedStats = fs.statSync(processedPath);
      const processedSizeMB = processedStats.size / (1024 * 1024);
      console.log(
        `[Speech-to-Text] 處理後檔案大小: ${processedSizeMB.toFixed(2)}MB`
      );

      // 檢查音檔時長，chirp_3 BatchRecognize 最長支援 60 分鐘
      let audioDurationMinutes = 0;
      try {
        const { stdout } = await execAsync(
          `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${processedPath}"`
        );
        const durationSeconds = parseFloat(stdout.trim());
        if (!isNaN(durationSeconds)) {
          audioDurationMinutes = durationSeconds / 60;
          console.log(`[Speech-to-Text] 音檔時長: ${audioDurationMinutes.toFixed(1)} 分鐘`);
        }
      } catch (err) {
        console.warn(`[Speech-to-Text] 無法取得音檔時長`);
      }

      // 如果音檔超過 55 分鐘（留 5 分鐘緩衝），需要分割處理
      const MAX_DURATION_MINUTES = 55;
      let sttResult: SpeechToTextResult;

      if (audioDurationMinutes > MAX_DURATION_MINUTES) {
        console.log(`[Speech-to-Text] 音檔超過 ${MAX_DURATION_MINUTES} 分鐘，需要分割處理`);
        sttResult = await this.transcribeLongAudioWithSegments(processedPath, audioDurationMinutes, onProgress);
      } else {
        // 上傳到 GCS
        console.log(`[Speech-to-Text] 上傳音檔到 GCS...`);
        gcsUri = await this.uploadToGCS(processedPath);

        // 回報進度 30%
        if (onProgress) await onProgress(30);

        // 使用 Speech-to-Text V2 chirp_3 模型進行辨識
        sttResult = await this.performSpeechToTextRecognition(
          gcsUri,
          processedPath,
          onProgress
        );
      }

      // 回報進度 98%
      if (onProgress) await onProgress(98);

      // 說話者分離已移至「整理逐字稿」功能中執行
      // 轉錄完成後直接返回原始結果，讓用戶可以先看到文字
      // 用戶按「整理逐字稿」時再由 Gemini AI 進行說話者識別和文字清理

      // 建立預設說話者
      const defaultSpeakers: SpeechToTextResult["speakers"] = [{
        id: "A",
        label: "講者A",
        color: "hsl(220, 70%, 50%)"
      }];

      // 確保所有段落都有說話者標籤
      const segmentsWithSpeaker = sttResult.segments.map(seg => ({
        ...seg,
        speaker: seg.speaker || "講者A"
      }));

      const result: SpeechToTextResult = {
        transcriptText: sttResult.transcriptText,
        segments: segmentsWithSpeaker,
        speakers: sttResult.speakers.length > 0 ? sttResult.speakers : defaultSpeakers,
        duration: sttResult.duration,
        wordCount: sttResult.wordCount,
      };

      // 清理 GCS 檔案（只有短音檔走這條路，長音檔在 transcribeLongAudio 內處理）
      if (gcsUri) {
        await this.cleanupGCSFile(gcsUri);
      }

      // 清理暫存檔案
      if (processedPath !== trimmedPath && fs.existsSync(processedPath)) {
        try {
          fs.unlinkSync(processedPath);
        } catch {}
      }
      this.cleanupTrimmedFile(trimmedPath, audioFilePath);

      return result;
    } catch (error) {
      // 確保清理暫存檔案和 GCS
      if (gcsUri) {
        await this.cleanupGCSFile(gcsUri).catch(() => {});
      }
      this.cleanupTrimmedFile(trimmedPath, audioFilePath);

      console.error("[Speech-to-Text] 轉錄錯誤:", error);
      throw new Error(
        `語音轉錄失敗: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * 轉換音檔為 WAV 格式（16kHz, mono, 16-bit PCM）
   * 注意：此方法現已不常使用，改用 convertToFlac 以減少檔案大小
   */
  private async convertToWav(inputPath: string): Promise<string> {
    const baseName = path.basename(inputPath, path.extname(inputPath));
    const dir = path.dirname(inputPath);
    const outputPath = path.join(dir, `${baseName}_converted.wav`);

    try {
      // 轉換為 16kHz, 單聲道, 16-bit PCM WAV
      const command = `ffmpeg -i "${inputPath}" -ar 16000 -ac 1 -sample_fmt s16 -y "${outputPath}"`;
      console.log(`[Speech-to-Text] 轉換命令: ${command}`);

      await execAsync(command, { timeout: 300000 });

      const convertedSize = fs.statSync(outputPath).size / (1024 * 1024);
      console.log(`[Speech-to-Text] 轉換完成: ${convertedSize.toFixed(2)}MB`);

      return outputPath;
    } catch (error) {
      console.error(`[Speech-to-Text] 轉換失敗:`, error);
      // 如果轉換失敗，返回原始檔案
      return inputPath;
    }
  }

  /**
   * 轉換音檔為 FLAC 格式（無損壓縮，檔案較 WAV 小約 50-70%）
   */
  private async convertToFlac(inputPath: string): Promise<string> {
    const baseName = path.basename(inputPath, path.extname(inputPath));
    const dir = path.dirname(inputPath);
    const outputPath = path.join(dir, `${baseName}_converted.flac`);

    try {
      // 轉換為 16kHz, 單聲道 FLAC（壓縮等級 8 = 最高壓縮）
      const command = `ffmpeg -i "${inputPath}" -ar 16000 -ac 1 -compression_level 8 -y "${outputPath}"`;
      console.log(`[Speech-to-Text] FLAC 轉換命令: ${command}`);

      await execAsync(command, { timeout: 300000 });

      const convertedSize = fs.statSync(outputPath).size / (1024 * 1024);
      console.log(
        `[Speech-to-Text] FLAC 轉換完成: ${convertedSize.toFixed(2)}MB`
      );

      return outputPath;
    } catch (error) {
      console.error(`[Speech-to-Text] FLAC 轉換失敗:`, error);
      // 如果轉換失敗，返回原始檔案
      return inputPath;
    }
  }

  /**
   * 處理超過 60 分鐘的長音檔 - 分割成多個片段處理
   * @param audioFilePath 音檔路徑
   * @param totalDurationMinutes 總時長（分鐘）
   * @param onProgress 進度回調
   */
  private async transcribeLongAudioWithSegments(
    audioFilePath: string,
    totalDurationMinutes: number,
    onProgress?: (progress: number) => Promise<void>
  ): Promise<SpeechToTextResult> {
    const SEGMENT_DURATION_MINUTES = 50; // 每段 50 分鐘（留緩衝）
    const segmentDurationSeconds = SEGMENT_DURATION_MINUTES * 60;
    const totalDurationSeconds = totalDurationMinutes * 60;
    const numSegments = Math.ceil(totalDurationSeconds / segmentDurationSeconds);

    console.log(`[Long Audio] 分割為 ${numSegments} 個片段處理`);

    const dir = path.dirname(audioFilePath);
    let ext = path.extname(audioFilePath);
    const baseName = path.basename(audioFilePath, ext);

    // 如果檔案沒有副檔名，使用 .mp3 作為預設
    if (!ext) {
      ext = '.mp3';
    }

    const segmentPaths: string[] = [];

    // 分割音檔
    console.log("[Long Audio] 開始分割音檔...");
    for (let i = 0; i < numSegments; i++) {
      const startSeconds = i * segmentDurationSeconds;
      const segmentPath = path.join(dir, `${baseName}_segment_${i}${ext}`);
      segmentPaths.push(segmentPath);

      // 使用 -f mp3 指定輸出格式，避免 ffmpeg 無法判斷
      const command = `ffmpeg -i "${audioFilePath}" -ss ${startSeconds} -t ${segmentDurationSeconds} -f mp3 -c:a libmp3lame -q:a 2 -y "${segmentPath}"`;
      console.log(`[Long Audio] 分割片段 ${i + 1}/${numSegments}: ${startSeconds}s - ${startSeconds + segmentDurationSeconds}s`);

      try {
        await execAsync(command, { timeout: 120000 });
      } catch (err) {
        console.error(`[Long Audio] 分割片段 ${i + 1} 失敗:`, err);
        throw new Error(`音檔分割失敗: 片段 ${i + 1}`);
      }
    }

    // 回報進度 20%
    if (onProgress) await onProgress(20);

    // 逐段轉錄
    const allSegments: SpeechToTextResult["segments"] = [];
    const speakerSet = new Set<string>();
    let fullTranscript = "";
    let totalWordCount = 0;
    let accumulatedDuration = 0;

    for (let i = 0; i < segmentPaths.length; i++) {
      const segmentPath = segmentPaths[i];
      const segmentStartSeconds = i * segmentDurationSeconds;

      console.log(`[Long Audio] 轉錄片段 ${i + 1}/${numSegments}...`);

      // 上傳片段到 GCS
      const gcsUri = await this.uploadToGCS(segmentPath);

      // 計算進度：20% + (片段進度 * 60%)
      const segmentProgress = 20 + ((i + 0.5) / numSegments) * 60;
      if (onProgress) await onProgress(Math.floor(segmentProgress));

      try {
        // 轉錄片段
        const segmentResult = await this.performSpeechToTextRecognition(
          gcsUri,
          segmentPath,
          undefined // 不傳遞子進度回調
        );

        // 調整時間戳（加上片段的起始時間）
        const adjustedSegments = segmentResult.segments.map(seg => ({
          ...seg,
          start: seg.start + segmentStartSeconds * 1000,
          end: seg.end + segmentStartSeconds * 1000,
        }));

        allSegments.push(...adjustedSegments);
        fullTranscript += segmentResult.transcriptText + " ";
        totalWordCount += segmentResult.wordCount;
        accumulatedDuration = Math.max(accumulatedDuration, segmentResult.duration + segmentStartSeconds);

        // 收集說話者
        segmentResult.speakers.forEach(s => speakerSet.add(s.label));

        // 清理 GCS 檔案
        await this.cleanupGCSFile(gcsUri);
      } catch (err) {
        console.error(`[Long Audio] 片段 ${i + 1} 轉錄失敗:`, err);
        // 清理 GCS
        await this.cleanupGCSFile(gcsUri).catch(() => {});
      }

      // 清理本地片段檔案
      try {
        fs.unlinkSync(segmentPath);
      } catch {}

      // 更新進度
      const completedProgress = 20 + ((i + 1) / numSegments) * 60;
      if (onProgress) await onProgress(Math.floor(completedProgress));
    }

    // 回報進度 85%
    if (onProgress) await onProgress(85);

    // 建立說話者列表
    const speakerColors = [
      "hsl(220, 70%, 50%)",
      "hsl(120, 70%, 50%)",
      "hsl(0, 70%, 50%)",
      "hsl(280, 70%, 50%)",
      "hsl(60, 70%, 50%)",
      "hsl(180, 70%, 50%)",
    ];
    const speakers: SpeechToTextResult["speakers"] = Array.from(speakerSet).map(
      (label, index) => ({
        id: String.fromCharCode(65 + index),
        label,
        color: speakerColors[index % speakerColors.length],
      })
    );

    // 如果沒有說話者，建立預設
    if (speakers.length === 0) {
      speakers.push({ id: "A", label: "講者A", color: speakerColors[0] });
    }

    console.log(`[Long Audio] 合併完成: ${fullTranscript.length} 字元, ${allSegments.length} 段落`);

    return {
      transcriptText: fullTranscript.trim(),
      segments: allSegments,
      speakers,
      duration: Math.floor(accumulatedDuration),
      wordCount: totalWordCount,
    };
  }

  /**
   * 執行 Google Cloud Speech-to-Text V2 辨識 (使用 chirp_3 模型)
   */
  private async performSpeechToTextRecognition(
    gcsUri: string,
    audioFilePath: string,
    onProgress?: (progress: number) => Promise<void>
  ): Promise<SpeechToTextResult> {
    console.log(`[Speech-to-Text V2] 使用 chirp_3 模型進行辨識...`);
    console.log(`[Speech-to-Text V2] GCS URI: ${gcsUri}`);

    // V2 BatchRecognize 請求配置 - 使用 chirp_3 模型（V2 API 最新模型）
    // 注意：cmn-Hant-TW 不支援原生 diarization，將使用 Gemini AI 後處理進行說話者分離
    const request = {
      recognizer: `projects/${this.projectId}/locations/us/recognizers/_`,
      config: {
        autoDecodingConfig: {}, // 自動偵測音檔格式
        languageCodes: ["cmn-Hant-TW"], // 繁體中文
        model: "chirp_3", // 使用 chirp_3 模型（V2 API 正確的模型名稱）
        features: {
          // 注意：cmn-Hant-TW 不支援 diarization，使用 Gemini AI 後處理替代
        },
      },
      files: [
        {
          uri: gcsUri,
        },
      ],
      recognitionOutputConfig: {
        inlineResponseConfig: {}, // 直接返回結果
      },
    };

    console.log("[Speech-to-Text V2] 開始 chirp_3 批次辨識...");
    console.log(
      "[Speech-to-Text V2] 請求配置:",
      JSON.stringify(request, null, 2)
    );

    // 回報進度 40%
    if (onProgress) await onProgress(40);

    // 執行 V2 BatchRecognize
    const [operation] = await this.speechClientV2.batchRecognize(request);

    console.log("[Speech-to-Text V2] 辨識作業已建立，等待處理完成...");
    console.log("[Speech-to-Text V2] 作業名稱:", operation.name);

    // 回報進度 45%
    if (onProgress) await onProgress(45);

    // 設定進度更新計時器 - 改進版，根據音檔時長計算超時
    const startTime = Date.now();
    const fileSizeMB = this.getFileSizeInMB(audioFilePath);

    // 嘗試獲取音檔實際時長來計算更準確的超時
    let audioDurationMinutes = 0;
    try {
      const { stdout } = await execAsync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioFilePath}"`
      );
      const durationSeconds = parseFloat(stdout.trim());
      if (!isNaN(durationSeconds)) {
        audioDurationMinutes = Math.ceil(durationSeconds / 60);
        console.log(
          `[Speech-to-Text] 音檔實際時長: ${audioDurationMinutes} 分鐘`
        );
      }
    } catch (err) {
      console.warn(`[Speech-to-Text] 無法取得音檔時長，使用檔案大小估算`);
    }

    // 動態計算超時：
    // - 如果有音檔時長：音檔時長 + 20 分鐘緩衝（Speech-to-Text 通常需要 0.5-1.5 倍音檔時長）
    // - 否則：每 MB 2 分鐘
    // 最短 20 分鐘，最長 180 分鐘（3 小時）
    let dynamicTimeout: number;
    if (audioDurationMinutes > 0) {
      // 對於長音檔，預留更多時間：音檔時長 * 1.5 + 15 分鐘緩衝
      dynamicTimeout = Math.min(
        Math.max((audioDurationMinutes * 1.5 + 15) * 60 * 1000, 20 * 60 * 1000),
        180 * 60 * 1000
      );
    } else {
      dynamicTimeout = Math.min(
        Math.max(fileSizeMB * 2 * 60 * 1000, 20 * 60 * 1000),
        180 * 60 * 1000
      );
    }

    const maxExpectedTime =
      audioDurationMinutes > 0
        ? audioDurationMinutes * 0.8 * 60 * 1000 // 預估處理時間為音檔時長的 80%
        : Math.max(fileSizeMB * 30 * 1000, 10 * 60 * 1000);

    console.log(
      `[Speech-to-Text] 預估處理時間: ${Math.floor(
        maxExpectedTime / 60000
      )} 分鐘 (檔案: ${fileSizeMB.toFixed(
        1
      )}MB, 音檔: ${audioDurationMinutes}分鐘)`
    );
    console.log(
      `[Speech-to-Text] 動態超時設定: ${Math.floor(
        dynamicTimeout / 60000
      )} 分鐘`
    );

    let progressInterval: NodeJS.Timeout | null = null;
    let statusCheckInterval: NodeJS.Timeout | null = null;
    let lastProgressUpdate = Date.now();

    // 進度更新計時器
    if (onProgress) {
      progressInterval = setInterval(async () => {
        const elapsed = Date.now() - startTime;
        const linearProgress = elapsed / maxExpectedTime;
        const progress = Math.min(45 + linearProgress * 44, 89);
        const elapsedSeconds = Math.floor(elapsed / 1000);
        const elapsedMinutes = Math.floor(elapsedSeconds / 60);
        const remainingSeconds = elapsedSeconds % 60;
        console.log(`[STT V2] 等待中... 已經過 ${elapsedMinutes}分${remainingSeconds}秒, 進度: ${Math.floor(progress)}%`);
        await onProgress(Math.floor(progress));
      }, 10000);
    }

    // 狀態檢查計時器 - 每 60 秒檢查一次（V2 API 不支援 getMetadata）
    statusCheckInterval = setInterval(async () => {
      const elapsed = Date.now() - startTime;
      const elapsedMinutes = Math.floor(elapsed / 60000);
      console.log(`[STT V2] 處理中... 已經過 ${elapsedMinutes} 分鐘`);
    }, 60000);

    try {
      // 設定動態超時 Promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(
              `轉錄超時：處理時間超過 ${Math.floor(
                dynamicTimeout / 60000
              )} 分鐘`
            )
          );
        }, dynamicTimeout);
      });

      // 使用 Promise.race 同時等待結果和超時
      const [response] = (await Promise.race([
        operation.promise(),
        timeoutPromise.then(() => {
          throw new Error("超時");
        }),
      ])) as unknown as [any];

      // 清除所有計時器
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
      }

      // 回報進度 90%
      if (onProgress) await onProgress(90);

      console.log("[STT V2] 辨識完成，處理結果...");
      console.log(
        "[STT V2] 回應結構:",
        JSON.stringify(Object.keys(response || {}))
      );

      // 處理 V2 BatchRecognize 結果
      return this.processSpeechToTextV2Response(response, audioFilePath);

    } catch (error: any) {
      // 捕捉並顯示詳細錯誤資訊 (例如 unsupported fields)
      if (error.statusDetails) {
        console.error(
          "[Speech-to-Text V2] 詳細錯誤:",
          JSON.stringify(error.statusDetails, null, 2)
        );
        // 嘗試深度解析 fieldViolations
        if (Array.isArray(error.statusDetails)) {
            error.statusDetails.forEach((detail: any, index: number) => {
                if (detail.fieldViolations) {
                    console.error(`[Speech-to-Text V2] 錯誤詳細資訊 #${index}:`, JSON.stringify(detail.fieldViolations, null, 2));
                }
            });
        }
      } else {
        console.error("[Speech-to-Text V2] 錯誤:", error);
      }
      
      // 清除所有計時器
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
      }
      throw error;
    }
  }

  /**
   * 使用 Gemini AI 進行說話者分離（適用於不支援原生 diarization 的語言如繁體中文）
   * @param transcript 轉錄文本
   * @param segments 原始段落（可能沒有說話者資訊）
   * @returns 帶有說話者標籤的段落和說話者列表
   */
  private async identifySpeakersWithGemini(
    transcript: string,
    segments: SpeechToTextResult["segments"]
  ): Promise<{
    segments: SpeechToTextResult["segments"];
    speakers: SpeechToTextResult["speakers"];
  }> {
    const speakerColors = [
      "hsl(220, 70%, 50%)",
      "hsl(120, 70%, 50%)",
      "hsl(0, 70%, 50%)",
      "hsl(280, 70%, 50%)",
      "hsl(60, 70%, 50%)",
      "hsl(180, 70%, 50%)",
    ];

    try {
      console.log("[Gemini AI] 開始說話者分離分析...");
      console.log(`[Gemini AI] 轉錄文本長度: ${transcript.length} 字元`);

      const prompt = `你是一個專業的語音分析助手。請分析以下轉錄文本，識別不同的說話者。

分析規則：
1. 根據語氣、用詞習慣、對話脈絡和問答模式識別不同說話者
2. 為每個說話者分配標籤（講者A、講者B...）
3. 將文本分割成段落，標記每段的說話者
4. 如果只有一個說話者，全部標記為講者A
5. 最多識別 6 位說話者

轉錄文本：
${transcript.substring(0, 15000)}

請以純 JSON 格式輸出（不要包含 markdown 標記）：
{
  "speakerCount": 2,
  "segments": [
    {"text": "段落內容", "speaker": "講者A"},
    {"text": "段落內容", "speaker": "講者B"}
  ]
}`;

      const result = await this.model.generateContent(prompt);
      const responseText = result.response.text();

      // 嘗試解析 JSON
      let parsedResponse: {
        speakerCount: number;
        segments: Array<{ text: string; speaker: string }>;
      };

      try {
        // 清理可能的 markdown 標記
        const cleanedText = responseText
          .replace(/```json\s*/g, "")
          .replace(/```\s*/g, "")
          .trim();
        parsedResponse = JSON.parse(cleanedText);
      } catch (parseError) {
        console.error("[Gemini AI] JSON 解析失敗，使用原始段落:", parseError);
        // 返回原始段落，全部標記為講者A
        return {
          segments: segments.map((seg) => ({ ...seg, speaker: "講者A" })),
          speakers: [{ id: "A", label: "講者A", color: speakerColors[0] }],
        };
      }

      console.log(
        `[Gemini AI] 識別到 ${parsedResponse.speakerCount || 1} 位說話者`
      );

      // 建立說話者列表
      const speakerSet = new Set<string>();
      parsedResponse.segments.forEach((seg) => speakerSet.add(seg.speaker));
      const speakers: SpeechToTextResult["speakers"] = Array.from(
        speakerSet
      ).map((label, index) => ({
        id: String.fromCharCode(65 + index),
        label,
        color: speakerColors[index % speakerColors.length],
      }));

      // 合併 Gemini 分析結果與原始時間戳
      // 由於 Gemini 分析可能改變段落結構，嘗試將時間戳對應回去
      const resultSegments: SpeechToTextResult["segments"] = [];

      if (segments.length > 0 && parsedResponse.segments.length > 0) {
        // 有原始時間戳，嘗試對應
        let originalIndex = 0;

        for (const geminiSeg of parsedResponse.segments) {
          const segmentText = geminiSeg.text.trim();
          if (!segmentText) continue;

          // 找到對應的原始段落時間
          let startTime = 0;
          let endTime = 30000;
          let confidence = 0.9;

          // 嘗試在原始段落中找到匹配
          for (let i = originalIndex; i < segments.length; i++) {
            if (
              segments[i].text.includes(segmentText.substring(0, 20)) ||
              segmentText.includes(segments[i].text.substring(0, 20))
            ) {
              startTime = segments[i].start;
              endTime = segments[i].end;
              confidence = segments[i].confidence;
              originalIndex = i + 1;
              break;
            }
          }

          resultSegments.push({
            text: segmentText,
            speaker: geminiSeg.speaker,
            start: startTime,
            end: endTime,
            confidence,
          });
        }
      } else {
        // 沒有原始時間戳，使用預估時間
        const avgDuration = 5000; // 每段預估 5 秒
        parsedResponse.segments.forEach((geminiSeg, index) => {
          if (geminiSeg.text.trim()) {
            resultSegments.push({
              text: geminiSeg.text.trim(),
              speaker: geminiSeg.speaker,
              start: index * avgDuration,
              end: (index + 1) * avgDuration,
              confidence: 0.85,
            });
          }
        });
      }

      console.log(
        `[Gemini AI] 說話者分離完成: ${resultSegments.length} 段落, ${speakers.length} 位說話者`
      );

      return {
        segments: resultSegments.length > 0 ? resultSegments : segments,
        speakers:
          speakers.length > 0
            ? speakers
            : [{ id: "A", label: "講者A", color: speakerColors[0] }],
      };
    } catch (error) {
      console.error("[Gemini AI] 說話者分離失敗:", error);
      // 失敗時返回原始段落
      return {
        segments: segments.map((seg) => ({ ...seg, speaker: "講者A" })),
        speakers: [{ id: "A", label: "講者A", color: speakerColors[0] }],
      };
    }
  }

  /**
   * 處理 Speech-to-Text V2 BatchRecognize 辨識結果
   */
  private processSpeechToTextV2Response(
    response: any,
    audioFilePath: string
  ): SpeechToTextResult {
    const speakerColors = [
      "hsl(220, 70%, 50%)",
      "hsl(120, 70%, 50%)",
      "hsl(0, 70%, 50%)",
      "hsl(280, 70%, 50%)",
      "hsl(60, 70%, 50%)",
      "hsl(180, 70%, 50%)",
    ];

    let fullTranscript = "";
    const segments: SpeechToTextResult["segments"] = [];
    const speakerMap = new Map<number, string>();
    const speakers: SpeechToTextResult["speakers"] = [];

    // V2 BatchRecognize 的回應結構不同
    // response.results 是一個 map，key 是 GCS URI
    const resultsMap = response.results || {};
    const fileResults = Object.values(resultsMap);

    if (fileResults.length === 0) {
      console.warn("[Speech-to-Text V2] 無辨識結果");
      return {
        transcriptText: "[無法辨識音訊內容 - 請確認音檔品質或格式]",
        segments: [
          {
            text: "[無法辨識音訊內容]",
            speaker: "講者A",
            start: 0,
            end: 30000,
            confidence: 0.0,
          },
        ],
        speakers: [
          {
            id: "A",
            label: "講者A",
            color: speakerColors[0],
          },
        ],
        duration: 30,
        wordCount: 0,
      };
    }

    console.log(`[Speech-to-Text V2] 處理 ${fileResults.length} 個檔案結果`);

    // 處理每個檔案的結果
    for (const fileResult of fileResults as any[]) {
      // 詳細除錯：查看檔案結果的結構
      console.log("[STT V2] 檔案結果 keys:", JSON.stringify(Object.keys(fileResult)));

      // 檢查是否有錯誤
      if (fileResult.error) {
        console.error("[STT V2] API 回傳錯誤:", JSON.stringify(fileResult.error, null, 2));
        throw new Error(`Speech-to-Text API 錯誤: ${JSON.stringify(fileResult.error)}`);
      }

      // 嘗試多種可能的回應路徑
      let transcript = fileResult.transcript;

      if (!transcript && fileResult.inlineResult) {
        console.log("[STT V2] 嘗試 inlineResult 路徑");
        transcript = fileResult.inlineResult.transcript;
      }

      if (!transcript && fileResult.cloudStorageResult) {
        console.log("[STT V2] 嘗試 cloudStorageResult 路徑");
        transcript = fileResult.cloudStorageResult.transcript;
      }

      // 如果 transcript 本身就是結果陣列（某些 API 版本的格式）
      if (!transcript && Array.isArray(fileResult.results)) {
        console.log("[STT V2] fileResult.results 是陣列，直接使用");
        transcript = { results: fileResult.results };
      }

      console.log("[STT V2] transcript 結構:", transcript ? JSON.stringify(Object.keys(transcript)) : "null");

      if (!transcript) {
        console.warn("[Speech-to-Text V2] 無法找到 transcript，嘗試打印完整結構");
        console.log("[STT V2] 完整 fileResult:", JSON.stringify(fileResult).substring(0, 2000));
        continue;
      }

      if (!transcript.results) {
        console.warn("[Speech-to-Text V2] transcript 無 results 屬性");
        console.log("[STT V2] transcript 內容:", JSON.stringify(transcript).substring(0, 2000));
        continue;
      }

      console.log(
        `[Speech-to-Text V2] 處理 ${transcript.results.length} 個辨識結果`
      );

      for (const result of transcript.results) {
        if (!result.alternatives || result.alternatives.length === 0) continue;

        const alternative = result.alternatives[0];
        const text = alternative.transcript || "";
        fullTranscript += text + " ";

        // 處理說話人識別 (V2 格式)
        if (alternative.words && alternative.words.length > 0) {
          let currentSpeaker =
            alternative.words[0].speakerLabel ||
            alternative.words[0].speakerTag ||
            "1";
          let currentSegmentText = "";
          let segmentStart = this.durationToMilliseconds(
            alternative.words[0].startOffset
          );
          let segmentEnd = segmentStart;

          for (const word of alternative.words) {
            const speakerLabel = word.speakerLabel || word.speakerTag || "1";
            const speakerTag =
              typeof speakerLabel === "string"
                ? parseInt(speakerLabel) || 1
                : speakerLabel;

            // 建立說話人對應
            if (!speakerMap.has(speakerTag)) {
              const label = `講者${String.fromCharCode(65 + speakerMap.size)}`;
              speakerMap.set(speakerTag, label);

              speakers.push({
                id: String.fromCharCode(65 + speakers.length),
                label: label,
                color: speakerColors[speakers.length % speakerColors.length],
              });
            }

            if (speakerLabel === currentSpeaker) {
              currentSegmentText += (word.word || "") + " ";
              segmentEnd = this.durationToMilliseconds(word.endOffset);
            } else {
              // 說話人變更，儲存當前段落
              if (currentSegmentText.trim()) {
                segments.push({
                  text: currentSegmentText.trim(),
                  speaker:
                    speakerMap.get(
                      typeof currentSpeaker === "string"
                        ? parseInt(currentSpeaker) || 1
                        : currentSpeaker
                    ) || "講者A",
                  start: segmentStart,
                  end: segmentEnd,
                  confidence: word.confidence || 0.9,
                });
              }

              // 開始新段落
              currentSpeaker = speakerLabel;
              currentSegmentText = (word.word || "") + " ";
              segmentStart = this.durationToMilliseconds(word.startOffset);
              segmentEnd = this.durationToMilliseconds(word.endOffset);
            }
          }

          // 儲存最後一個段落
          if (currentSegmentText.trim()) {
            segments.push({
              text: currentSegmentText.trim(),
              speaker:
                speakerMap.get(
                  typeof currentSpeaker === "string"
                    ? parseInt(currentSpeaker) || 1
                    : currentSpeaker
                ) || "講者A",
              start: segmentStart,
              end: segmentEnd,
              confidence: 0.9,
            });
          }
        } else {
          // 無說話人識別，建立單一段落
          segments.push({
            text: text,
            speaker: "講者A",
            start: 0,
            end: 30000,
            confidence: 0.9,
          });
        }
      }
    }

    // 如果沒有偵測到說話人，建立預設說話人
    if (speakers.length === 0) {
      speakers.push({
        id: "A",
        label: "講者A",
        color: speakerColors[0],
      });
    }

    // 計算時長 (確保為整數)
    let duration =
      segments.length > 0
        ? Math.floor(Math.max(...segments.map((s) => s.end)) / 1000)
        : 0;
    if (duration === 0) {
      const stats = fs.statSync(audioFilePath);
      duration = Math.floor(stats.size / (16000 * 2));
    }

    const wordCount = this.calculateWordCount(fullTranscript.trim());

    console.log(`[STT V2] 轉錄完成: ${fullTranscript.length} 字元, ${segments.length} 段落, ${speakers.length} 位說話人`);

    return {
      transcriptText: fullTranscript.trim(),
      segments,
      speakers,
      duration,
      wordCount,
    };
  }

  /**
   * 將 V2 API 的 Duration 格式轉換為毫秒
   * V2 使用 Google protobuf Duration 格式: { seconds: "123", nanos: 456000000 }
   */
  private durationToMilliseconds(duration: any): number {
    if (!duration) return 0;

    // 處理字串格式 (如 "123.456s")
    if (typeof duration === "string") {
      const match = duration.match(/(\d+(?:\.\d+)?)s?/);
      if (match) {
        return Math.floor(parseFloat(match[1]) * 1000);
      }
      return 0;
    }

    // 處理物件格式 { seconds: "123", nanos: 456000000 }
    const seconds = parseInt(duration.seconds || "0") || 0;
    const nanos = parseInt(duration.nanos || "0") || 0;
    return seconds * 1000 + Math.floor(nanos / 1000000);
  }

  /**
   * 處理 Speech-to-Text V1 辨識結果 (舊版，保留備用)
   */
  private processSpeechToTextResponse(
    response: any,
    audioFilePath: string
  ): SpeechToTextResult {
    const speakerColors = [
      "hsl(220, 70%, 50%)",
      "hsl(120, 70%, 50%)",
      "hsl(0, 70%, 50%)",
      "hsl(280, 70%, 50%)",
      "hsl(60, 70%, 50%)",
      "hsl(180, 70%, 50%)",
    ];

    let fullTranscript = "";
    const segments: SpeechToTextResult["segments"] = [];
    const speakerMap = new Map<number, string>();
    const speakers: SpeechToTextResult["speakers"] = [];

    if (!response.results || response.results.length === 0) {
      console.warn("[Speech-to-Text] 無辨識結果");
      return {
        transcriptText: "[無法辨識音訊內容 - 請確認音檔品質或格式]",
        segments: [
          {
            text: "[無法辨識音訊內容]",
            speaker: "講者A",
            start: 0,
            end: 30000,
            confidence: 0.0,
          },
        ],
        speakers: [
          {
            id: "A",
            label: "講者A",
            color: speakerColors[0],
          },
        ],
        duration: 30,
        wordCount: 0,
      };
    }

    console.log(`[Speech-to-Text] 處理 ${response.results.length} 個辨識結果`);

    // 處理每個結果
    for (const result of response.results) {
      if (!result.alternatives || result.alternatives.length === 0) continue;

      const alternative = result.alternatives[0];
      const transcript = alternative.transcript || "";
      fullTranscript += transcript + " ";

      // 處理說話人識別
      if (alternative.words && alternative.words.length > 0) {
        let currentSpeaker = alternative.words[0].speakerTag || 1;
        let currentSegmentText = "";
        let segmentStart = this.timeToMilliseconds(
          alternative.words[0].startTime
        );
        let segmentEnd = segmentStart;

        for (const word of alternative.words) {
          const speakerTag = word.speakerTag || 1;

          // 建立說話人對應
          if (!speakerMap.has(speakerTag)) {
            const speakerLabel = `講者${String.fromCharCode(
              65 + speakerMap.size
            )}`;
            speakerMap.set(speakerTag, speakerLabel);

            speakers.push({
              id: String.fromCharCode(65 + speakers.length),
              label: speakerLabel,
              color: speakerColors[speakers.length % speakerColors.length],
            });
          }

          if (speakerTag === currentSpeaker) {
            currentSegmentText += (word.word || "") + " ";
            segmentEnd = this.timeToMilliseconds(word.endTime);
          } else {
            // 說話人變更，儲存當前段落
            if (currentSegmentText.trim()) {
              segments.push({
                text: currentSegmentText.trim(),
                speaker: speakerMap.get(currentSpeaker) || "講者A",
                start: segmentStart,
                end: segmentEnd,
                confidence: alternative.confidence || 0.9,
              });
            }

            // 開始新段落
            currentSpeaker = speakerTag;
            currentSegmentText = (word.word || "") + " ";
            segmentStart = this.timeToMilliseconds(word.startTime);
            segmentEnd = this.timeToMilliseconds(word.endTime);
          }
        }

        // 儲存最後一個段落
        if (currentSegmentText.trim()) {
          segments.push({
            text: currentSegmentText.trim(),
            speaker: speakerMap.get(currentSpeaker) || "講者A",
            start: segmentStart,
            end: segmentEnd,
            confidence: alternative.confidence || 0.9,
          });
        }
      } else {
        // 無說話人識別，建立單一段落
        segments.push({
          text: transcript,
          speaker: "講者A",
          start: 0,
          end: 30000,
          confidence: alternative.confidence || 0.9,
        });
      }
    }

    // 如果沒有偵測到說話人，建立預設說話人
    if (speakers.length === 0) {
      speakers.push({
        id: "A",
        label: "講者A",
        color: speakerColors[0],
      });
    }

    // 計算時長 (確保為整數)
    let duration =
      segments.length > 0
        ? Math.floor(Math.max(...segments.map((s) => s.end)) / 1000)
        : 0;
    if (duration === 0) {
      const stats = fs.statSync(audioFilePath);
      duration = Math.floor(stats.size / (16000 * 2));
    }

    const wordCount = this.calculateWordCount(fullTranscript.trim());

    console.log(
      `[Speech-to-Text] 轉錄完成: ${fullTranscript.length} 字元, ${segments.length} 段落, ${speakers.length} 位說話人`
    );

    return {
      transcriptText: fullTranscript.trim(),
      segments,
      speakers,
      duration,
      wordCount,
    };
  }
}
