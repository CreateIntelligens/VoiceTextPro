# 智能多語言語音轉錄平台

一個基於 Web 的企業級語音轉錄解決方案，整合 Google Cloud Speech-to-Text Chirp 模型和 Gemini AI 智能分析功能。

## 核心功能

### 語音轉錄
- **高精度轉錄**：使用 Google Cloud Speech-to-Text Chirp 模型，支援繁體中文
- **長音檔支援**：支援 1.5-2 小時的長音檔批量處理
- **對話者識別**：自動識別並標記不同對話者（最多 6 人）
- **即時處理**：支援音頻上傳和實時轉錄進度追蹤
- **音頻可視化**：錄音時提供實時音量顯示

### AI 智能分析
- **文本清理**：使用 Gemini AI 自動清理和重組轉錄內容
- **智能摘要**：生成重點摘要和關鍵信息提取
- **對話者分析**：分析對話者角色和貢獻度
- **主題檢測**：自動識別討論主題和關鍵字
- **行動項目**：自動提取待辦事項

### 用戶管理系統
- **角色權限控制**：支援管理員和一般用戶角色
- **帳號申請審核**：完整的用戶註冊和審核流程
- **密碼安全管理**：加密存儲和重置機制

## 技術架構

### 前端技術
- **React 18** + **TypeScript**
- **Vite** 高效能建構工具
- **Tailwind CSS** + **Shadcn/UI**
- **TanStack Query** 資料狀態管理

### 後端技術
- **Node.js** + **Express**
- **TypeScript**
- **PostgreSQL** + **Drizzle ORM**

### 外部服務
- **Google Cloud Speech-to-Text**：Chirp 模型語音轉錄
- **Google Cloud Storage**：音檔暫存
- **Gemini AI**：智能內容分析
- **SendGrid**：郵件通知服務

---

## 部署指南

### GCP VM 自架規格（簡易測試）

| 元件 | 建議規格 | 說明 |
|------|---------|------|
| VM | e2-small | 0.5 vCPU, 2GB RAM |
| 作業系統 | Ubuntu 22.04 LTS | 免費 |
| 硬碟 | 20GB SSD | 標準永久磁碟 |
| 資料庫 | 同一 VM 安裝 PostgreSQL | 避免 Cloud SQL 費用 |
| Region | us-central1 (Iowa) | 價格最便宜 |

### 預估月費用

| 項目 | 規格 | 月費 (USD) |
|------|------|-----------|
| VM (e2-small) | 0.5 vCPU, 2GB | ~$12.23 |
| 硬碟 | 20GB SSD | ~$3.40 |
| Cloud Storage | 5GB（暫存音檔） | 免費額度內 |
| 網路出口流量 | < 1GB/月 | 免費額度內 |
| **小計** | | **~$15-16/月** |

### API 使用費（按實際使用）

| 服務 | 費用 |
|------|------|
| Speech-to-Text (Chirp) | $0.004/分鐘（批量模式） |
| Gemini Flash | 極低，幾乎免費 |

**範例**：一次 2 小時音檔 = 120 分鐘 × $0.004 = **$0.48**

---

## 快速開始

### 環境需求
- Node.js 22+ (LTS)
- PostgreSQL 14+
- Python 3.8+
- Google Cloud 帳號（需開啟 Speech-to-Text API、Cloud Storage API、Vertex AI API）

### 方式一：Docker 部署（推薦）

詳細說明請參考 [Docker 部署指南](README.Docker.md)

1. **複製環境變數**
```bash
cp .env.example .env
```

2. **編輯 .env 填入必要配置**（參考下方環境變數說明）

3. **啟動服務**
```bash
docker-compose up -d
```

4. **初始化資料庫**
```bash
docker-compose exec app npm run db:push
```

### 方式二：本地安裝

1. **安裝依賴**
```bash
npm install
```

2. **配置環境變數**
```bash
cp .env.example .env
nano .env  # 編輯配置
```

3. **資料庫初始化**
```bash
npm run db:push
```

4. **啟動開發伺服器**
```bash
npm run dev
```

---

## 環境變數配置說明

### 📌 必要配置（Required）

#### 資料庫設定
```env
# Docker Compose 用
DB_USER=postgres                    # 資料庫用戶名
DB_PASSWORD=your-secure-password    # 資料庫密碼（建議使用強密碼）
DB_NAME=voicetextpro               # 資料庫名稱

# 完整連線字串（本地開發或單獨部署用）
DATABASE_URL=postgresql://postgres:password@localhost:5432/voicetextpro
```

#### Google Cloud 設定
```env
# Google Cloud 專案 ID（必填）
GOOGLE_CLOUD_PROJECT_ID=your-project-id

# 服務帳戶金鑰檔案路徑
# 本地開發：絕對路徑，如 /path/to/credentials.json
# Docker：使用 ./credentials.json，會自動掛載到容器內
GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json

# Cloud Storage 儲存桶名稱（用於暫存音檔）
GOOGLE_CLOUD_STORAGE_BUCKET=your-bucket-name
```

**Google Cloud 服務帳戶設定步驟：**

1. **啟用必要的 API**
   
   前往 [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Library
   
   啟用以下 API：
   - Cloud Speech-to-Text API
   - Cloud Storage API
   - Vertex AI API
   - Generative Language API (Gemini)

2. **建立服務帳戶**
   
   IAM & Admin → Service Accounts → Create Service Account
   
   - 服務帳戶名稱：`voicetextpro-service`
   - 服務帳戶 ID：`voicetextpro-service`（自動生成）
   - 描述：`VoiceTextPro application service account`

3. **授予 IAM 角色權限**
   
   點擊「GRANT ACCESS」，添加以下角色：

   | 角色名稱 | 角色 ID | 用途 |
   |---------|---------|------|
   | **Storage Object Admin** | `roles/storage.objectAdmin` | 上傳/下載/刪除音檔到 Cloud Storage |
   | **Cloud Speech Client** | `roles/speech.client` | 執行語音轉錄 API |
   | **Vertex AI User** | `roles/aiplatform.user` | 使用 Gemini AI 模型 |
   
   **最小權限原則（進階）**：
   ```
   # 如果只使用特定 Bucket，可用自訂權限：
   - storage.buckets.get
   - storage.objects.create
   - storage.objects.delete
   - storage.objects.get
   - storage.objects.list
   
   # Speech-to-Text 權限：
   - speech.operations.get
   - speech.recognitions.create
   
   # Vertex AI 權限：
   - aiplatform.endpoints.predict
   ```

4. **建立並下載金鑰**
   
   - 點擊服務帳戶 → Keys → Add Key → Create new key
   - 選擇 JSON 格式
   - 下載後重命名為 `google-credentials.json`
   - **重要**：妥善保管此檔案，不要提交到版本控制

5. **設定 Cloud Storage Bucket**
   
   ```bash
   # 建立儲存桶（區域建議與 VM 相同）
   gsutil mb -l us-central1 gs://your-bucket-name
   
   # 設定生命週期規則（自動刪除 7 天前的暫存檔）
   cat > lifecycle.json << EOF
   {
     "lifecycle": {
       "rule": [
         {
           "action": {"type": "Delete"},
           "condition": {"age": 7}
         }
       ]
     }
   }
   EOF
   
   gsutil lifecycle set lifecycle.json gs://your-bucket-name
   ```

6. **驗證權限**
   
   ```bash
   # 設定環境變數
   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/google-credentials.json
   
   # 測試 Storage 存取
   gsutil ls gs://your-bucket-name
   
   # 測試服務帳戶
   gcloud auth activate-service-account --key-file=$GOOGLE_APPLICATION_CREDENTIALS
   gcloud auth list
   ```

#### Gemini AI 設定
```env
# Gemini API 金鑰（用於 AI 文本分析、摘要生成）
GEMINI_API_KEY=your-gemini-api-key
```

**取得 API 金鑰：**
1. 前往 [Google AI Studio](https://makersuite.google.com/app/apikey)
2. 建立新的 API 金鑰
3. 複製並貼到 .env 檔案

#### 郵件服務設定

**Gmail SMTP（統一使用）**
```env
GMAIL_USER=your-gmail@gmail.com          # Gmail 帳號
GMAIL_PASSWORD=xxxx-xxxx-xxxx-xxxx       # 應用程式密碼（非登入密碼）
```

**Gmail 應用程式密碼設定：**
1. Google 帳號 → 安全性 → 開啟「兩步驟驗證」
2. 安全性頁面底部 → 應用程式密碼
3. 選擇「郵件」和「其他」，命名為「VoiceTextPro」
4. 複製 16 位密碼（格式：xxxx-xxxx-xxxx-xxxx）

#### Session 安全設定
```env
# Session 加密金鑰（必須使用強隨機字串）
SESSION_SECRET=your-random-session-secret-change-this-in-production
```

**生成安全的 Session Secret：**
```bash
# Linux/Mac
openssl rand -base64 32

# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 🔧 應用程式設定

```env
# 應用程式 URL（用於郵件連結、OAuth 回調）
APP_URL=http://localhost:5000            # 本地開發
# APP_URL=https://yourdomain.com         # 生產環境

# 應用程式埠號
PORT=5000                                # 預設 5000

# 執行環境
NODE_ENV=development                     # development 或 production
```

### 📱 選填配置（Optional）
```env
# OAuth 2.0 Client ID（用於日曆事件建立）
GOOGLE_CLIENT_ID=your-oauth-client-id
GOOGLE_CLIENT_SECRET=your-oauth-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/google/auth/callback

# Token 加密金鑰（必須 64 個 hex 字元）
GOOGLE_TOKEN_ENCRYPTION_KEY=your-64-hex-character-key
```

**Google OAuth 設定步驟：**
1. [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. 建立 OAuth 2.0 Client ID → Web application
3. 授權重新導向 URI：`http://localhost:5000/api/google/auth/callback`
4. 複製 Client ID 和 Client Secret

**生成 Token 加密金鑰：**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 環境變數檢查清單

部署前請確認以下必要變數已正確設定：

- [ ] `GOOGLE_CLOUD_PROJECT_ID` - Google Cloud 專案 ID
- [ ] `GOOGLE_APPLICATION_CREDENTIALS` - 服務帳戶金鑰檔案
- [ ] `GOOGLE_CLOUD_STORAGE_BUCKET` - Cloud Storage 儲存桶
- [ ] `GEMINI_API_KEY` - Gemini AI API 金鑰
- [ ] `DATABASE_URL` 或 `DB_USER/DB_PASSWORD/DB_NAME` - 資料庫連線
- [ ] `GMAIL_USER/GMAIL_PASSWORD` - Gmail 郵件服務
- [ ] `SESSION_SECRET` - Session 加密金鑰（強隨機字串）
- [ ] `APP_URL` - 應用程式 URL（正確的域名或 localhost）

---

## 專案結構

```
├── client/                 # 前端應用
│   ├── src/
│   │   ├── components/     # React 組件
│   │   ├── pages/          # 頁面組件
│   │   ├── hooks/          # 自定義 Hooks
│   │   └── lib/            # 工具函數
├── server/                 # 後端應用
│   ├── routes.ts           # API 路由
│   ├── auth.ts             # 身份驗證
│   ├── db.ts               # 資料庫連接
│   └── gemini-analysis.ts  # AI 分析 + 語音轉錄
├── shared/                 # 共享資源
│   └── schema.ts           # 資料庫架構
└── uploads/                # 文件存儲
```

---

## API 端點

### 身份驗證
```
POST /api/auth/login          # 用戶登入
POST /api/auth/logout         # 用戶登出
GET  /api/auth/me             # 獲取用戶信息
```

### 轉錄管理
```
GET    /api/transcriptions          # 轉錄列表
POST   /api/transcriptions          # 創建轉錄
GET    /api/transcriptions/:id      # 轉錄詳情
POST   /api/transcriptions/:id/analyze # AI 分析
```

### 管理員功能
```
GET    /api/admin/users             # 用戶管理
GET    /api/admin/applications      # 申請審核
GET    /api/admin/logs              # 系統日誌
```

---

## 文檔資源

- [使用者操作手冊](SYSTEM_USER_MANUAL.md)
- [API 文檔](API_DOCUMENTATION.md)
- [資料庫架構](DATABASE_SCHEMA.md)
- [變更記錄](CHANGELOG.md)

---

**智能多語言語音轉錄平台** - 提供專業級的語音轉錄和 AI 分析解決方案
