# 智能多語言語音轉錄平台 - 系統開發文件

## 目錄
1. [系統架構](#系統架構)
2. [技術棧](#技術棧)
3. [開發環境設置](#開發環境設置)
4. [API 設計規範](#api-設計規範)
5. [前端架構](#前端架構)
6. [後端架構](#後端架構)
7. [AI 服務整合](#ai-服務整合)
8. [部署指南](#部署指南)
9. [測試策略](#測試策略)
10. [效能優化](#效能優化)
11. [安全考量](#安全考量)
12. [維護指南](#維護指南)

---

## 系統架構

### 整體架構圖
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend UI   │    │   Backend API   │    │   External AI   │
│    (React)      │◄──►│   (Express)     │◄──►│    Services     │
│                 │    │                 │    │                 │
│ • 用戶界面      │    │ • RESTful API   │    │ • AssemblyAI    │
│ • 狀態管理      │    │ • 業務邏輯      │    │ • Gemini AI     │
│ • 即時更新      │    │ • 數據處理      │    │ • SendGrid      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Client Storage │    │   PostgreSQL    │    │   File Storage  │
│                 │    │    Database     │    │                 │
│ • Local State   │    │                 │    │ • 音頻檔案      │
│ • Session Data  │    │ • 用戶資料      │    │ • 暫存處理      │
│ • Cache         │    │ • 轉錄記錄      │    │ • 備份檔案      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 核心模組

#### 1. 用戶管理模組 (User Management)
- **功能**: 註冊、登入、權限控制
- **組件**: Authentication, Authorization, User Profile
- **技術**: JWT Token, bcrypt, Session Management

#### 2. 轉錄處理模組 (Transcription Engine)
- **功能**: 音頻上傳、格式轉換、語音識別
- **組件**: File Upload, Audio Processing, AssemblyAI Integration
- **技術**: Multer, FFmpeg, WebSocket

#### 3. AI 分析模組 (AI Analysis)
- **功能**: 內容分析、摘要生成、實體識別
- **組件**: Content Analysis, Summarization, Entity Detection
- **技術**: Gemini AI, Natural Language Processing

#### 4. 即時通訊模組 (Real-time Communication)
- **功能**: 聊天機器人、進度更新、通知
- **組件**: Chat Bot, Progress Tracking, Notifications
- **技術**: WebSocket, Server-Sent Events

---

## 技術棧

### 前端技術
```typescript
// 核心框架
"react": "^18.2.0"           // UI 框架
"typescript": "^5.0.0"       // 型別安全
"vite": "^4.4.0"            // 建置工具

// 路由與狀態
"wouter": "^2.8.0"          // 輕量路由
"@tanstack/react-query": "^4.29.0"  // 資料狀態管理

// UI 組件庫
"@radix-ui/react-*": "^1.0.0"  // 無障礙 UI 組件
"tailwindcss": "^3.3.0"      // CSS 框架
"lucide-react": "^0.263.0"   // 圖標庫

// 表單處理
"react-hook-form": "^7.45.0" // 表單管理
"@hookform/resolvers": "^3.1.0"  // 表單驗證
"zod": "^3.21.0"            // Schema 驗證

// 音頻處理
"wavesurfer.js": "^7.0.0"    // 音頻可視化
"web-audio-api": "native"    // 音頻錄製
```

### 後端技術
```typescript
// 核心框架
"express": "^4.18.0"        // Web 框架
"typescript": "^5.0.0"      // 型別安全
"tsx": "^3.12.0"           // TypeScript 執行器

// 資料庫
"drizzle-orm": "^0.28.0"    // ORM 框架
"drizzle-zod": "^0.5.0"     // Schema 驗證
"@neondatabase/serverless": "^0.4.0"  // 資料庫連線

// 認證與安全
"bcryptjs": "^2.4.0"        // 密碼加密
"express-session": "^1.17.0" // 會話管理
"passport": "^0.6.0"        // 認證策略

// 檔案處理
"multer": "^1.4.0"          // 檔案上傳
"fluent-ffmpeg": "^2.1.0"   // 音頻轉換

// 外部服務
"assemblyai": "^4.0.0"      // 語音識別
"@google/generative-ai": "^0.2.0"  // AI 分析
"@sendgrid/mail": "^7.7.0"  // 郵件服務
```

### AI 服務
```typescript
// AssemblyAI - 語音轉錄
{
  endpoint: "https://api.assemblyai.com/v2",
  features: [
    "speaker_labels",      // 講者識別
    "auto_highlights",     // 自動重點
    "summarization",       // 摘要生成
    "sentiment_analysis",  // 情感分析
    "entity_detection",    // 實體識別
    "content_safety"       // 內容安全
  ]
}

// Google Gemini - 內容分析
{
  model: "gemini-1.5-pro",
  features: [
    "text_generation",     // 文本生成
    "content_analysis",    // 內容分析
    "summarization",       // 智能摘要
    "speaker_analysis"     // 講者分析
  ]
}
```

---

## 開發環境設置

### 本地開發環境

#### 1. 系統需求
```bash
# Node.js 版本
node >= 18.0.0
npm >= 9.0.0

# 資料庫
PostgreSQL >= 14.0

# 系統工具
ffmpeg >= 4.4.0  # 音頻處理
git >= 2.30.0    # 版本控制
```

#### 2. 環境變數設置
```env
# .env.local
# 資料庫連線
DATABASE_URL="postgresql://user:password@localhost:5432/transcription_db"

# AssemblyAI API
ASSEMBLYAI_API_KEY="your_assemblyai_api_key"

# Google Gemini AI
GEMINI_API_KEY="your_gemini_api_key"

# SendGrid 郵件服務
SENDGRID_API_KEY="your_sendgrid_api_key"
GMAIL_USER="your_gmail_address"
GMAIL_PASSWORD="your_app_password"

# 會話密鑰
SESSION_SECRET="your_session_secret_key"

# 開發環境
NODE_ENV="development"
PORT=5000
```

#### 3. 安裝與啟動
```bash
# 克隆專案
git clone <repository_url>
cd transcription-platform

# 安裝依賴
npm install

# 資料庫遷移
npx drizzle-kit push:pg

# 啟動開發服務器
npm run dev
```

### 開發工具配置

#### VSCode 推薦擴展
```json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-eslint",
    "ms-vscode-remote.remote-containers"
  ]
}
```

#### TypeScript 配置
```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "strict": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "paths": {
      "@/*": ["./client/src/*"],
      "@shared/*": ["./shared/*"],
      "@assets/*": ["./attached_assets/*"]
    }
  }
}
```

---

## API 設計規範

### RESTful API 設計原則

#### 1. URL 命名規範
```typescript
// 資源命名 - 使用複數名詞
/api/transcriptions          // 轉錄資源
/api/users                   // 用戶資源
/api/keywords               // 關鍵字資源

// 層級關係
/api/transcriptions/:id/speakers    // 轉錄的講者
/api/users/:id/keywords             // 用戶的關鍵字

// 動作資源
/api/transcriptions/:id/analyze     // 分析動作
/api/transcriptions/:id/export      // 導出動作
```

#### 2. HTTP 狀態碼
```typescript
// 成功回應
200 OK          // 獲取成功
201 Created     // 創建成功
204 No Content  // 刪除成功

// 客戶端錯誤
400 Bad Request         // 請求參數錯誤
401 Unauthorized        // 未授權
403 Forbidden          // 權限不足
404 Not Found          // 資源不存在
422 Unprocessable Entity // 驗證失敗

// 服務端錯誤
500 Internal Server Error // 服務器錯誤
502 Bad Gateway          // 外部服務錯誤
503 Service Unavailable  // 服務不可用
```

#### 3. 回應格式標準
```typescript
// 成功回應
interface SuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
}

// 錯誤回應
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

// 分頁回應
interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}
```

### 核心 API 端點

#### 認證相關
```typescript
// 用戶認證
POST   /api/auth/login           // 登入
POST   /api/auth/logout          // 登出
GET    /api/auth/me              // 獲取當前用戶
POST   /api/auth/register        // 註冊申請
POST   /api/auth/reset-password  // 重設密碼

// 會話管理
GET    /api/auth/sessions        // 獲取活躍會話
DELETE /api/auth/sessions/:id    // 刪除會話
```

#### 轉錄相關
```typescript
// 轉錄 CRUD
GET    /api/transcriptions           // 獲取轉錄列表
POST   /api/transcriptions/upload    // 上傳音頻檔案
GET    /api/transcriptions/:id       // 獲取轉錄詳情
PATCH  /api/transcriptions/:id       // 更新轉錄
DELETE /api/transcriptions/:id       // 刪除轉錄

// 轉錄功能
POST   /api/transcriptions/:id/analyze    // AI 分析
POST   /api/transcriptions/:id/cleanup    // AI 清理
GET    /api/transcriptions/:id/export     // 導出文件
PATCH  /api/transcriptions/:id/speakers   // 更新講者
GET    /api/transcriptions/:id/download-audio  // 下載音頻
```

#### 系統管理
```typescript
// 管理員功能
GET    /api/admin/users              // 用戶管理
POST   /api/admin/create-user        // 創建用戶
PATCH  /api/admin/users/:id          // 更新用戶
DELETE /api/admin/users/:id          // 刪除用戶

// 申請管理
GET    /api/admin/applications       // 獲取申請列表
POST   /api/admin/applications/:id/approve  // 核准申請
POST   /api/admin/applications/:id/reject   // 拒絕申請

// 系統監控
GET    /api/admin/logs               // 系統日誌
GET    /api/admin/stats              // 系統統計
```

---

## 前端架構

### 組件架構設計

#### 1. 目錄結構
```
client/src/
├── components/          # 可重用組件
│   ├── ui/             # 基礎 UI 組件
│   ├── forms/          # 表單組件
│   ├── layout/         # 布局組件
│   └── features/       # 功能組件
├── pages/              # 頁面組件
├── hooks/              # 自定義 Hooks
├── lib/                # 工具函數
├── types/              # 型別定義
└── styles/             # 樣式檔案
```

#### 2. 狀態管理策略
```typescript
// React Query 用於服務端狀態
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// 轉錄列表查詢
export function useTranscriptions() {
  return useQuery({
    queryKey: ['/api/transcriptions'],
    staleTime: 5 * 60 * 1000, // 5 分鐘
  });
}

// 轉錄更新變異
export function useUpdateTranscription() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: UpdateTranscriptionData) => 
      apiRequest(`/api/transcriptions/${data.id}`, 'PATCH', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/transcriptions'] });
    },
  });
}
```

#### 3. 組件設計模式
```typescript
// 複合組件模式
interface TranscriptionCardProps {
  transcription: Transcription;
  onEdit?: (id: number) => void;
  onDelete?: (id: number) => void;
}

export function TranscriptionCard({ transcription, onEdit, onDelete }: TranscriptionCardProps) {
  return (
    <Card className="relative">
      <CardHeader>
        <CardTitle>{transcription.displayName || transcription.originalName}</CardTitle>
        <CardDescription>
          <TranscriptionStatus status={transcription.status} />
          <TranscriptionMeta transcription={transcription} />
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <TranscriptionProgress 
          status={transcription.status}
          progress={transcription.progress}
        />
      </CardContent>
      
      <CardActions>
        {onEdit && <Button onClick={() => onEdit(transcription.id)}>編輯</Button>}
        {onDelete && <Button variant="destructive" onClick={() => onDelete(transcription.id)}>刪除</Button>}
      </CardActions>
    </Card>
  );
}
```

#### 4. 自定義 Hooks
```typescript
// 認證 Hook
export function useAuth() {
  const { data: user, isLoading } = useQuery({
    queryKey: ['/api/auth/me'],
    retry: false,
  });

  const logout = useMutation({
    mutationFn: () => apiRequest('/api/auth/logout', 'POST'),
    onSuccess: () => {
      queryClient.clear();
      window.location.href = '/login';
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout: logout.mutate,
  };
}

// 音頻錄製 Hook
export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      
      mediaRecorder.start();
    } catch (error) {
      console.error('錄音啟動失敗:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return {
    isRecording,
    audioBlob,
    startRecording,
    stopRecording,
  };
}
```

---

## 後端架構

### 服務架構設計

#### 1. 目錄結構
```
server/
├── controllers/        # 控制器層
├── services/          # 業務邏輯層
├── middleware/        # 中間件
├── utils/             # 工具函數
├── types/             # 型別定義
└── routes.ts          # 路由定義
```

#### 2. 分層架構
```typescript
// Controller Layer - 處理 HTTP 請求
export class TranscriptionController {
  constructor(private transcriptionService: TranscriptionService) {}

  async createTranscription(req: AuthenticatedRequest, res: Response) {
    try {
      const data = validateTranscriptionInput(req.body);
      const transcription = await this.transcriptionService.create(req.user.id, data);
      
      res.status(201).json({
        success: true,
        data: transcription,
      });
    } catch (error) {
      handleControllerError(res, error);
    }
  }
}

// Service Layer - 業務邏輯
export class TranscriptionService {
  constructor(
    private storage: IStorage,
    private assemblyAIService: AssemblyAIService,
    private aiAnalysisService: AIAnalysisService
  ) {}

  async create(userId: number, data: CreateTranscriptionData): Promise<Transcription> {
    // 1. 驗證輸入
    this.validateTranscriptionData(data);
    
    // 2. 創建記錄
    const transcription = await this.storage.createTranscription({
      userId,
      ...data,
      status: 'pending',
    });
    
    // 3. 啟動背景處理
    this.processTranscriptionAsync(transcription.id);
    
    return transcription;
  }
}
```

#### 3. 中間件設計
```typescript
// 認證中間件
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: '需要認證' }
    });
  }

  try {
    const session = validateSessionToken(token);
    req.user = session.user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: '無效的認證令牌' }
    });
  }
}

// 管理員權限中間件
export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: '需要管理員權限' }
    });
  }
  next();
}

// 錯誤處理中間件
export function errorHandler(error: Error, req: Request, res: Response, next: NextFunction) {
  console.error('API Error:', error);

  if (error instanceof ValidationError) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: error.message,
        details: error.details,
      }
    });
  }

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: '服務器內部錯誤',
    }
  });
}
```

#### 4. 背景任務處理
```typescript
// 轉錄處理服務
export class TranscriptionProcessor {
  async processTranscription(transcriptionId: number) {
    try {
      // 1. 更新狀態為處理中
      await this.updateStatus(transcriptionId, 'processing', 0);

      // 2. 上傳到 AssemblyAI
      const uploadUrl = await this.uploadToAssemblyAI(transcriptionId);
      await this.updateProgress(transcriptionId, 20);

      // 3. 啟動轉錄
      const assemblyAIId = await this.startTranscription(uploadUrl);
      await this.updateProgress(transcriptionId, 30);

      // 4. 輪詢轉錄狀態
      const result = await this.pollTranscriptionStatus(assemblyAIId, transcriptionId);
      await this.updateProgress(transcriptionId, 80);

      // 5. 處理結果並保存
      await this.saveTranscriptionResult(transcriptionId, result);
      await this.updateStatus(transcriptionId, 'completed', 100);

      // 6. 觸發 AI 分析
      await this.triggerAIAnalysis(transcriptionId);

    } catch (error) {
      await this.handleTranscriptionError(transcriptionId, error);
    }
  }

  private async pollTranscriptionStatus(assemblyAIId: string, transcriptionId: number) {
    let attempts = 0;
    const maxAttempts = 300; // 最多 5 分鐘

    while (attempts < maxAttempts) {
      const status = await this.assemblyAI.getTranscriptionStatus(assemblyAIId);
      
      if (status.status === 'completed') {
        return status;
      } else if (status.status === 'error') {
        throw new Error(`AssemblyAI 轉錄失敗: ${status.error}`);
      }

      // 更新進度
      const progress = Math.min(30 + (attempts / maxAttempts) * 50, 80);
      await this.updateProgress(transcriptionId, progress);

      // 等待後重試
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }

    throw new Error('轉錄處理超時');
  }
}
```

---

## AI 服務整合

### AssemblyAI 整合

#### 1. 服務封裝
```typescript
export class AssemblyAIService {
  private apiKey: string;
  private baseURL = 'https://api.assemblyai.com/v2';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async uploadAudio(filePath: string): Promise<string> {
    const response = await fetch(`${this.baseURL}/upload`, {
      method: 'POST',
      headers: {
        'authorization': this.apiKey,
        'content-type': 'application/octet-stream',
      },
      body: fs.createReadStream(filePath),
    });

    const { upload_url } = await response.json();
    return upload_url;
  }

  async startTranscription(uploadUrl: string, config: TranscriptionConfig): Promise<string> {
    const response = await fetch(`${this.baseURL}/transcript`, {
      method: 'POST',
      headers: {
        'authorization': this.apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: uploadUrl,
        ...this.buildAssemblyAIConfig(config),
      }),
    });

    const { id } = await response.json();
    return id;
  }

  private buildAssemblyAIConfig(config: TranscriptionConfig) {
    return {
      // 基本設置
      speaker_labels: config.speaker_labels,
      speakers_expected: config.speakers_expected,
      speech_threshold: config.speech_threshold,
      
      // 語言設置
      language_detection: config.language_detection,
      language_code: config.language_code,
      language_confidence_threshold: config.language_confidence_threshold,
      
      // 音頻處理
      boost_param: config.boost_param,
      multichannel: config.multichannel,
      
      // 文本處理
      punctuate: config.punctuate,
      format_text: config.format_text,
      disfluencies: config.disfluencies,
      filter_profanity: config.filter_profanity,
      
      // 隱私保護
      redact_pii: config.redact_pii,
      redact_pii_policies: config.redact_pii_policies,
      
      // AI 功能
      summarization: config.summarization,
      auto_highlights: config.auto_highlights,
      iab_categories: config.iab_categories,
      sentiment_analysis: config.sentiment_analysis,
      entity_detection: config.entity_detection,
      content_safety: config.content_safety,
      
      // 自定義關鍵字
      word_boost: config.custom_keywords ? 
        config.custom_keywords.split(',').map(word => word.trim()) : undefined,
    };
  }
}
```

### Gemini AI 整合

#### 1. 內容分析服務
```typescript
export class GeminiAIService {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
  }

  async analyzeTranscription(text: string, analysisType: string): Promise<AIAnalysisResult> {
    const prompt = this.buildAnalysisPrompt(text, analysisType);
    
    try {
      const result = await this.model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.3,
        },
      });

      const response = result.response.text();
      return JSON.parse(response);
    } catch (error) {
      console.error('Gemini AI 分析失敗:', error);
      throw new Error('AI 分析服務暫時不可用');
    }
  }

  async analyzeSpeakers(segments: TranscriptSegment[]): Promise<SpeakerAnalysis[]> {
    const speakerTexts = this.groupBySpeaker(segments);
    const analyses: SpeakerAnalysis[] = [];

    for (const [speakerId, texts] of Object.entries(speakerTexts)) {
      const analysis = await this.analyzeSingleSpeaker(speakerId, texts);
      analyses.push(analysis);
    }

    return analyses;
  }

  private buildAnalysisPrompt(text: string, type: string): string {
    const basePrompt = `
      請分析以下轉錄文本，並以 JSON 格式回應。
      
      轉錄內容：
      ${text}
      
      請提供以下分析結果：
    `;

    switch (type) {
      case 'meeting':
        return basePrompt + `
        {
          "summary": "會議整體摘要",
          "key_topics": ["主要議題1", "主要議題2"],
          "action_items": ["行動項目1", "行動項目2"],
          "decisions": ["決議1", "決議2"],
          "highlights": ["重點1", "重點2"]
        }`;
        
      case 'interview':
        return basePrompt + `
        {
          "summary": "訪談整體摘要",
          "main_insights": ["主要見解1", "主要見解2"],
          "key_quotes": ["重要引述1", "重要引述2"],
          "themes": ["主題1", "主題2"]
        }`;
        
      default:
        return basePrompt + `
        {
          "summary": "內容摘要",
          "key_topics": ["主要話題"],
          "highlights": ["重要內容"]
        }`;
    }
  }
}
```

---

## 部署指南

### 生產環境部署

#### 1. 環境準備
```bash
# 服務器配置
- CPU: 4 核心或以上
- RAM: 8GB 或以上
- Storage: 100GB SSD
- OS: Ubuntu 20.04 LTS

# 必要軟件
sudo apt update
sudo apt install -y nodejs npm postgresql nginx certbot
sudo npm install -g pm2

# 安裝 FFmpeg
sudo apt install -y ffmpeg
```

#### 2. 資料庫設置
```sql
-- 創建資料庫
CREATE DATABASE transcription_db;
CREATE USER transcription_user WITH ENCRYPTED PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE transcription_db TO transcription_user;

-- 配置連線限制
ALTER USER transcription_user CONNECTION LIMIT 50;
```

#### 3. 應用程式部署
```bash
# 1. 部署代碼
git clone <repository_url> /var/www/transcription-platform
cd /var/www/transcription-platform

# 2. 安裝依賴
npm ci --production

# 3. 建置前端
npm run build

# 4. 設置環境變數
cp .env.example .env.production
# 編輯 .env.production 設置生產環境變數

# 5. 資料庫遷移
npx drizzle-kit push:pg --config=drizzle.config.production.ts

# 6. 啟動服務
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

#### 4. Nginx 配置
```nginx
# /etc/nginx/sites-available/transcription-platform
server {
    listen 80;
    server_name yourdomain.com;
    
    # 靜態檔案
    location / {
        root /var/www/transcription-platform/dist;
        try_files $uri $uri/ /index.html;
    }
    
    # API 代理
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # 檔案上傳限制
    client_max_body_size 500M;
}
```

#### 5. SSL 憑證設置
```bash
# 獲取 Let's Encrypt 憑證
sudo certbot --nginx -d yourdomain.com

# 自動續約
sudo crontab -e
# 添加：0 12 * * * /usr/bin/certbot renew --quiet
```

### Docker 部署

#### 1. Dockerfile
```dockerfile
# Frontend Build Stage
FROM node:18-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Backend Runtime Stage
FROM node:18-alpine AS runtime
WORKDIR /app

# 安裝系統依賴
RUN apk add --no-cache ffmpeg

# 複製依賴檔案
COPY package*.json ./
RUN npm ci --only=production

# 複製後端代碼
COPY server ./server
COPY shared ./shared
COPY --from=frontend-builder /app/dist ./dist

# 設置用戶
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

EXPOSE 5000
CMD ["npm", "start"]
```

#### 2. Docker Compose
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:password@db:5432/transcription_db
    depends_on:
      - db
      - redis
    volumes:
      - uploads:/app/uploads

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=transcription_db
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
      - ./ssl:/etc/ssl
    depends_on:
      - app

volumes:
  postgres_data:
  redis_data:
  uploads:
```

---

## 測試策略

### 測試架構

#### 1. 單元測試
```typescript
// 使用 Jest + Testing Library
import { render, screen, fireEvent } from '@testing-library/react';
import { TranscriptionCard } from '../TranscriptionCard';

describe('TranscriptionCard', () => {
  const mockTranscription = {
    id: 1,
    filename: 'test.mp3',
    status: 'completed',
    progress: 100,
  };

  it('should render transcription information', () => {
    render(<TranscriptionCard transcription={mockTranscription} />);
    
    expect(screen.getByText('test.mp3')).toBeInTheDocument();
    expect(screen.getByText('已完成')).toBeInTheDocument();
  });

  it('should call onEdit when edit button is clicked', () => {
    const onEdit = jest.fn();
    render(
      <TranscriptionCard 
        transcription={mockTranscription} 
        onEdit={onEdit} 
      />
    );
    
    fireEvent.click(screen.getByText('編輯'));
    expect(onEdit).toHaveBeenCalledWith(1);
  });
});
```

#### 2. 整合測試
```typescript
// API 整合測試
import request from 'supertest';
import { app } from '../server/app';

describe('Transcription API', () => {
  let authToken: string;

  beforeAll(async () => {
    // 設置測試資料庫
    await setupTestDatabase();
    
    // 獲取測試用戶認證
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'testpassword'
      });
    
    authToken = response.body.token;
  });

  describe('POST /api/transcriptions/upload', () => {
    it('should upload and create transcription', async () => {
      const response = await request(app)
        .post('/api/transcriptions/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('audio', 'test/fixtures/sample.mp3')
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.status).toBe('pending');
    });
  });
});
```

#### 3. E2E 測試
```typescript
// 使用 Playwright
import { test, expect } from '@playwright/test';

test.describe('Transcription Workflow', () => {
  test('complete transcription workflow', async ({ page }) => {
    // 1. 登入
    await page.goto('/login');
    await page.fill('[data-testid=email]', 'test@example.com');
    await page.fill('[data-testid=password]', 'testpassword');
    await page.click('[data-testid=login-button]');
    
    // 2. 上傳檔案
    await page.goto('/upload');
    await page.setInputFiles('[data-testid=file-input]', 'test/fixtures/sample.mp3');
    await page.click('[data-testid=upload-button]');
    
    // 3. 等待處理完成
    await expect(page.locator('[data-testid=status]')).toHaveText('已完成', { timeout: 30000 });
    
    // 4. 檢查結果
    await page.click('[data-testid=view-result]');
    await expect(page.locator('[data-testid=transcript-text]')).toBeVisible();
  });
});
```

### 測試資料管理

#### 1. 測試資料工廠
```typescript
export class TestDataFactory {
  static createUser(overrides?: Partial<User>): User {
    return {
      id: 1,
      email: 'test@example.com',
      name: 'Test User',
      role: 'user',
      status: 'active',
      createdAt: new Date(),
      ...overrides,
    };
  }

  static createTranscription(overrides?: Partial<Transcription>): Transcription {
    return {
      id: 1,
      userId: 1,
      filename: 'test.mp3',
      originalName: 'test.mp3',
      fileSize: 1024000,
      status: 'completed',
      progress: 100,
      createdAt: new Date(),
      ...overrides,
    };
  }
}
```

#### 2. 測試環境設置
```typescript
// 測試資料庫設置
export async function setupTestDatabase() {
  const testDb = drizzle(testClient);
  
  // 清理現有資料
  await testDb.delete(transcriptions);
  await testDb.delete(users);
  
  // 插入測試資料
  await testDb.insert(users).values([
    TestDataFactory.createUser({ email: 'test@example.com' }),
    TestDataFactory.createUser({ email: 'admin@example.com', role: 'admin' }),
  ]);
}
```

---

## 效能優化

### 前端效能優化

#### 1. 代碼分割
```typescript
// 路由層級代碼分割
import { lazy, Suspense } from 'react';

const TranscriptionPage = lazy(() => import('./pages/TranscriptionPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));

function App() {
  return (
    <Router>
      <Suspense fallback={<LoadingSpinner />}>
        <Route path="/transcription" component={TranscriptionPage} />
        <Route path="/admin" component={AdminPage} />
      </Suspense>
    </Router>
  );
}
```

#### 2. 圖片與資源優化
```typescript
// 圖片懶載入
import { useState, useEffect, useRef } from 'react';

function LazyImage({ src, alt, className }: ImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsLoaded(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <img
      ref={imgRef}
      src={isLoaded ? src : '/placeholder.svg'}
      alt={alt}
      className={className}
    />
  );
}
```

#### 3. 虛擬滾動
```typescript
// 大量資料虛擬滾動
import { FixedSizeList as List } from 'react-window';

function TranscriptionList({ transcriptions }: { transcriptions: Transcription[] }) {
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style}>
      <TranscriptionCard transcription={transcriptions[index]} />
    </div>
  );

  return (
    <List
      height={600}
      itemCount={transcriptions.length}
      itemSize={120}
      width="100%"
    >
      {Row}
    </List>
  );
}
```

### 後端效能優化

#### 1. 資料庫查詢優化
```typescript
// 使用索引和查詢優化
export class OptimizedTranscriptionService {
  async getTranscriptionsByUser(userId: number, page: number = 1, limit: number = 20) {
    // 分頁查詢with索引
    const offset = (page - 1) * limit;
    
    const transcriptions = await db
      .select()
      .from(transcriptions)
      .where(eq(transcriptions.userId, userId))
      .orderBy(desc(transcriptions.createdAt))
      .limit(limit)
      .offset(offset);

    // 計算總數 (使用 COUNT 查詢)
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(transcriptions)
      .where(eq(transcriptions.userId, userId));

    return {
      data: transcriptions,
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.ceil(count / limit),
      },
    };
  }

  // 批量操作優化
  async updateMultipleTranscriptions(updates: TranscriptionUpdate[]) {
    return await db.transaction(async (tx) => {
      const results = [];
      
      for (const update of updates) {
        const result = await tx
          .update(transcriptions)
          .set(update.data)
          .where(eq(transcriptions.id, update.id))
          .returning();
        
        results.push(result[0]);
      }
      
      return results;
    });
  }
}
```

#### 2. 快取策略
```typescript
// Redis 快取實現
export class CacheService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('快取讀取失敗:', error);
      return null;
    }
  }

  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    try {
      await this.redis.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      console.error('快取寫入失敗:', error);
    }
  }

  async invalidate(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error('快取清理失敗:', error);
    }
  }
}

// 使用快取的服務
export class CachedTranscriptionService extends TranscriptionService {
  constructor(
    storage: IStorage,
    private cache: CacheService
  ) {
    super(storage);
  }

  async getTranscription(id: number): Promise<Transcription | null> {
    const cacheKey = `transcription:${id}`;
    
    // 嘗試從快取獲取
    let transcription = await this.cache.get<Transcription>(cacheKey);
    
    if (!transcription) {
      // 從資料庫獲取
      transcription = await super.getTranscription(id);
      
      if (transcription) {
        // 快取 1 小時
        await this.cache.set(cacheKey, transcription, 3600);
      }
    }
    
    return transcription;
  }
}
```

#### 3. API 回應優化
```typescript
// 回應壓縮和優化
import compression from 'compression';
import { Response } from 'express';

// 全域壓縮中間件
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6,
  threshold: 1024,
}));

// 分頁回應優化
export function paginatedResponse<T>(
  res: Response,
  data: T[],
  pagination: PaginationInfo
) {
  res.json({
    success: true,
    data,
    pagination,
    meta: {
      timestamp: new Date().toISOString(),
      version: process.env.API_VERSION,
    },
  });
}

// 串流回應 (大型檔案)
export function streamResponse(res: Response, filePath: string) {
  const stat = fs.statSync(filePath);
  
  res.writeHead(200, {
    'Content-Type': 'application/octet-stream',
    'Content-Length': stat.size,
    'Content-Disposition': `attachment; filename="${path.basename(filePath)}"`,
  });

  const readStream = fs.createReadStream(filePath);
  readStream.pipe(res);
}
```

---

## 安全考量

### 認證與授權安全

#### 1. 密碼安全
```typescript
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export class PasswordService {
  private static readonly SALT_ROUNDS = 12;
  private static readonly MIN_PASSWORD_LENGTH = 8;

  static async hashPassword(password: string): Promise<string> {
    // 驗證密碼強度
    this.validatePasswordStrength(password);
    
    return await bcrypt.hash(password, this.SALT_ROUNDS);
  }

  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }

  static generateSecurePassword(length: number = 12): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    
    for (let i = 0; i < length; i++) {
      password += charset.charAt(crypto.randomInt(0, charset.length));
    }
    
    return password;
  }

  private static validatePasswordStrength(password: string): void {
    if (password.length < this.MIN_PASSWORD_LENGTH) {
      throw new Error('密碼長度至少需要 8 個字元');
    }

    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

    const strengthScore = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChar]
      .filter(Boolean).length;

    if (strengthScore < 3) {
      throw new Error('密碼強度不足，需包含大小寫字母、數字和特殊字元');
    }
  }
}
```

#### 2. 會話管理
```typescript
export class SessionService {
  private static readonly SESSION_EXPIRY = 24 * 60 * 60 * 1000; // 24 小時
  private static readonly CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 小時

  constructor(private storage: IStorage) {
    // 定期清理過期會話
    setInterval(() => this.cleanupExpiredSessions(), this.CLEANUP_INTERVAL);
  }

  async createSession(userId: number): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SessionService.SESSION_EXPIRY);

    await this.storage.createSession({
      userId,
      token,
      expiresAt,
    });

    return token;
  }

  async validateSession(token: string): Promise<{ userId: number } | null> {
    const session = await this.storage.getSessionByToken(token);
    
    if (!session || session.expiresAt < new Date()) {
      // 清理過期會話
      if (session) {
        await this.storage.deleteSession(session.id);
      }
      return null;
    }

    return { userId: session.userId };
  }

  async revokeSession(token: string): Promise<void> {
    await this.storage.deleteSessionByToken(token);
  }

  private async cleanupExpiredSessions(): Promise<void> {
    try {
      await this.storage.deleteExpiredSessions();
    } catch (error) {
      console.error('清理過期會話失敗:', error);
    }
  }
}
```

### 資料保護

#### 1. 輸入驗證與清理
```typescript
import { z } from 'zod';
import DOMPurify from 'dompurify';

// 嚴格的輸入驗證
export const CreateTranscriptionSchema = z.object({
  filename: z.string()
    .min(1, '檔案名稱不能為空')
    .max(255, '檔案名稱過長')
    .regex(/^[a-zA-Z0-9._-]+$/, '檔案名稱包含無效字元'),
  
  fileSize: z.number()
    .positive('檔案大小必須為正數')
    .max(500 * 1024 * 1024, '檔案大小超過限制'),
  
  notes: z.string()
    .max(1000, '備註過長')
    .optional()
    .transform(val => val ? DOMPurify.sanitize(val) : undefined),
});

// SQL 注入防護
export class SecureDatabase {
  // 使用參數化查詢
  async getUserByEmail(email: string): Promise<User | null> {
    // Drizzle ORM 自動防護 SQL 注入
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    
    return user || null;
  }

  // 防止 NoSQL 注入 (JSON 欄位)
  async searchTranscriptions(query: unknown): Promise<Transcription[]> {
    // 驗證和清理查詢參數
    if (typeof query !== 'string' || query.length > 100) {
      throw new Error('無效的搜尋查詢');
    }

    const sanitizedQuery = query.replace(/['"\\]/g, '');
    
    return await db
      .select()
      .from(transcriptions)
      .where(sql`transcript_text ILIKE ${`%${sanitizedQuery}%`}`);
  }
}
```

#### 2. 檔案安全
```typescript
export class SecureFileService {
  private static readonly ALLOWED_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.webm', '.flac'];
  private static readonly MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
  private static readonly UPLOAD_DIR = '/secure/uploads';

  static validateFile(file: Express.Multer.File): void {
    // 檢查檔案大小
    if (file.size > this.MAX_FILE_SIZE) {
      throw new Error('檔案大小超過限制');
    }

    // 檢查副檔名
    const ext = path.extname(file.originalname).toLowerCase();
    if (!this.ALLOWED_EXTENSIONS.includes(ext)) {
      throw new Error('不支援的檔案格式');
    }

    // 檢查 MIME 類型
    if (!file.mimetype.startsWith('audio/')) {
      throw new Error('檔案類型不正確');
    }
  }

  static generateSecureFilename(originalName: string): string {
    const ext = path.extname(originalName);
    const name = crypto.randomUUID();
    return `${name}${ext}`;
  }

  static async scanFileForMalware(filePath: string): Promise<boolean> {
    // 整合病毒掃描服務 (例如 ClamAV)
    try {
      // 實際實現會呼叫病毒掃描 API
      return true; // 檔案安全
    } catch (error) {
      console.error('病毒掃描失敗:', error);
      return false; // 為安全起見，預設為不安全
    }
  }
}
```

### API 安全

#### 1. 速率限制
```typescript
import rateLimit from 'express-rate-limit';

// 一般 API 速率限制
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分鐘
  max: 100, // 每個 IP 最多 100 次請求
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: '請求過於頻繁，請稍後再試',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 登入 API 嚴格限制
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分鐘
  max: 5, // 最多 5 次登入嘗試
  skipSuccessfulRequests: true,
  message: {
    success: false,
    error: {
      code: 'LOGIN_RATE_LIMIT_EXCEEDED',
      message: '登入嘗試過於頻繁，請 15 分鐘後再試',
    },
  },
});

// 檔案上傳限制
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 小時
  max: 10, // 每小時最多上傳 10 個檔案
  message: {
    success: false,
    error: {
      code: 'UPLOAD_RATE_LIMIT_EXCEEDED',
      message: '上傳過於頻繁，請稍後再試',
    },
  },
});
```

#### 2. CORS 與安全標頭
```typescript
import cors from 'cors';
import helmet from 'helmet';

// CORS 配置
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com', 'https://www.yourdomain.com']
    : ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));

// 安全標頭
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.assemblyai.com"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

// 隱藏服務器資訊
app.disable('x-powered-by');
```

---

## 維護指南

### 日常維護任務

#### 1. 資料庫維護
```sql
-- 每日執行
-- 更新統計資訊
ANALYZE;

-- 清理無用空間
VACUUM (ANALYZE, VERBOSE);

-- 檢查資料庫大小
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 檢查慢查詢
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  rows
FROM pg_stat_statements 
ORDER BY total_time DESC 
LIMIT 10;
```

#### 2. 檔案系統清理
```bash
#!/bin/bash
# cleanup.sh - 定期清理腳本

# 清理 30 天前的暫存檔案
find /tmp -name "*.tmp" -mtime +30 -delete

# 清理失敗的上傳檔案
find /uploads -name "*.partial" -mtime +1 -delete

# 清理舊的日誌檔案
find /var/log/transcription -name "*.log" -mtime +7 -gzip

# 檢查磁碟空間
DISK_USAGE=$(df /uploads | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
  echo "警告: 磁碟使用率超過 80%" | mail -s "磁碟空間警告" admin@yourdomain.com
fi
```

#### 3. 效能監控
```typescript
// 系統監控服務
export class MonitoringService {
  async checkSystemHealth(): Promise<HealthReport> {
    const report: HealthReport = {
      timestamp: new Date(),
      services: {},
      metrics: {},
    };

    // 檢查資料庫連線
    try {
      await db.select().from(users).limit(1);
      report.services.database = { status: 'healthy', responseTime: 0 };
    } catch (error) {
      report.services.database = { status: 'error', error: error.message };
    }

    // 檢查 AssemblyAI 服務
    try {
      const start = Date.now();
      await fetch('https://api.assemblyai.com/v2/transcript', {
        method: 'GET',
        headers: { authorization: process.env.ASSEMBLYAI_API_KEY! },
      });
      const responseTime = Date.now() - start;
      report.services.assemblyai = { status: 'healthy', responseTime };
    } catch (error) {
      report.services.assemblyai = { status: 'error', error: error.message };
    }

    // 收集系統指標
    report.metrics.memoryUsage = process.memoryUsage();
    report.metrics.uptime = process.uptime();
    report.metrics.cpuUsage = process.cpuUsage();

    return report;
  }

  async logMetrics(): Promise<void> {
    const metrics = await this.collectMetrics();
    
    // 記錄到資料庫
    await db.insert(systemMetrics).values({
      timestamp: new Date(),
      metrics: JSON.stringify(metrics),
    });

    // 檢查異常指標
    this.checkAlerts(metrics);
  }

  private async checkAlerts(metrics: SystemMetrics): Promise<void> {
    // 記憶體使用率過高
    if (metrics.memoryUsage.heapUsed / metrics.memoryUsage.heapTotal > 0.9) {
      await this.sendAlert('HIGH_MEMORY_USAGE', '記憶體使用率超過 90%');
    }

    // 回應時間過長
    if (metrics.averageResponseTime > 5000) {
      await this.sendAlert('SLOW_RESPONSE', '平均回應時間超過 5 秒');
    }
  }
}
```

### 備份與復原

#### 1. 自動備份腳本
```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="transcription_db"

# 建立備份目錄
mkdir -p $BACKUP_DIR/$DATE

# 資料庫備份
pg_dump -h localhost -U transcription_user -d $DB_NAME \
  -f $BACKUP_DIR/$DATE/database.sql

# 檔案備份
tar -czf $BACKUP_DIR/$DATE/uploads.tar.gz /uploads

# 設定檔備份
cp .env.production $BACKUP_DIR/$DATE/
cp nginx.conf $BACKUP_DIR/$DATE/

# 清理 30 天前的備份
find $BACKUP_DIR -type d -mtime +30 -exec rm -rf {} \;

# 上傳到雲端儲存 (例如 AWS S3)
aws s3 sync $BACKUP_DIR s3://your-backup-bucket/transcription-platform/

echo "備份完成: $DATE"
```

#### 2. 復原程序
```bash
#!/bin/bash
# restore.sh

BACKUP_DATE=$1
BACKUP_DIR="/backups/$BACKUP_DATE"

if [ -z "$BACKUP_DATE" ]; then
  echo "使用方式: ./restore.sh <backup_date>"
  exit 1
fi

if [ ! -d "$BACKUP_DIR" ]; then
  echo "備份目錄不存在: $BACKUP_DIR"
  exit 1
fi

# 停止服務
pm2 stop all
systemctl stop nginx

# 復原資料庫
psql -h localhost -U transcription_user -d transcription_db \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
psql -h localhost -U transcription_user -d transcription_db \
  -f $BACKUP_DIR/database.sql

# 復原檔案
rm -rf /uploads/*
tar -xzf $BACKUP_DIR/uploads.tar.gz -C /

# 復原設定
cp $BACKUP_DIR/.env.production ./
cp $BACKUP_DIR/nginx.conf /etc/nginx/conf.d/

# 重新啟動服務
systemctl start nginx
pm2 start all

echo "復原完成"
```

### 故障排除

#### 1. 常見問題診斷
```typescript
// 診斷工具
export class DiagnosticService {
  async runDiagnostics(): Promise<DiagnosticReport> {
    const report: DiagnosticReport = {
      timestamp: new Date(),
      issues: [],
      recommendations: [],
    };

    // 檢查資料庫連線
    try {
      await this.checkDatabaseConnection();
    } catch (error) {
      report.issues.push({
        category: 'database',
        severity: 'high',
        description: '資料庫連線失敗',
        error: error.message,
      });
      report.recommendations.push('檢查資料庫服務狀態和連線設定');
    }

    // 檢查磁碟空間
    const diskUsage = await this.checkDiskSpace();
    if (diskUsage > 90) {
      report.issues.push({
        category: 'system',
        severity: 'high',
        description: `磁碟使用率過高: ${diskUsage}%`,
      });
      report.recommendations.push('清理舊檔案或增加儲存空間');
    }

    // 檢查外部服務
    await this.checkExternalServices(report);

    return report;
  }

  private async checkExternalServices(report: DiagnosticReport): Promise<void> {
    // 檢查 AssemblyAI
    try {
      await fetch('https://api.assemblyai.com/v2/transcript', {
        headers: { authorization: process.env.ASSEMBLYAI_API_KEY! },
      });
    } catch (error) {
      report.issues.push({
        category: 'external_service',
        severity: 'medium',
        description: 'AssemblyAI 服務無法連線',
        error: error.message,
      });
    }

    // 檢查 Gemini AI
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
      await genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    } catch (error) {
      report.issues.push({
        category: 'external_service',
        severity: 'medium',
        description: 'Gemini AI 服務無法連線',
        error: error.message,
      });
    }
  }
}
```

#### 2. 日誌分析工具
```typescript
// 日誌分析服務
export class LogAnalysisService {
  async analyzeErrorLogs(timeRange: TimeRange): Promise<ErrorAnalysis> {
    const logs = await this.getErrorLogs(timeRange);
    
    const analysis: ErrorAnalysis = {
      totalErrors: logs.length,
      errorsByCategory: {},
      topErrors: [],
      trends: {},
    };

    // 按類別分組
    logs.forEach(log => {
      const category = log.category || 'unknown';
      analysis.errorsByCategory[category] = (analysis.errorsByCategory[category] || 0) + 1;
    });

    // 找出最常見的錯誤
    const errorCounts = logs.reduce((acc, log) => {
      acc[log.message] = (acc[log.message] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    analysis.topErrors = Object.entries(errorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([message, count]) => ({ message, count }));

    return analysis;
  }

  async generateHealthReport(): Promise<HealthReport> {
    const report: HealthReport = {
      timestamp: new Date(),
      services: await this.checkAllServices(),
      metrics: await this.collectSystemMetrics(),
      recommendations: [],
    };

    // 生成建議
    if (report.metrics.errorRate > 0.05) {
      report.recommendations.push('錯誤率過高，建議檢查系統日誌');
    }

    if (report.metrics.averageResponseTime > 2000) {
      report.recommendations.push('回應時間過長，建議檢查效能瓶頸');
    }

    return report;
  }
}
```

這份系統開發文件提供了完整的開發指南，包含架構設計、技術實現、部署策略、測試方法、效能優化、安全考量和維護指南。開發團隊可以依照此文件進行系統開發、部署和維護工作。