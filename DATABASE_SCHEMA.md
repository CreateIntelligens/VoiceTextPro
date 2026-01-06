# 智能多語言語音轉錄平台 - 資料庫架構文檔

## 概述

本文檔描述了智能多語言語音轉錄平台的完整資料庫架構，包含所有表格結構、欄位定義、關聯性和索引。

## 資料庫表格架構

### 1. 用戶管理系統

#### users 表格 - 用戶帳號
存儲用戶基本信息和權限設定。

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password TEXT NOT NULL,
  name VARCHAR(100),
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  is_first_login BOOLEAN NOT NULL DEFAULT true,
  password_reset_token VARCHAR(255),
  password_reset_expires TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login_at TIMESTAMP
);

CREATE INDEX users_email_idx ON users(email);
```

**欄位說明：**
- `id`: 用戶唯一識別碼（主鍵）
- `email`: 用戶電子郵件（唯一，登入憑證）
- `password`: 加密後的密碼
- `name`: 用戶姓名
- `role`: 用戶角色（'admin', 'user'）
- `status`: 帳號狀態（'pending', 'active', 'suspended'）
- `is_first_login`: 是否為首次登入
- `password_reset_token`: 密碼重置令牌
- `password_reset_expires`: 密碼重置令牌過期時間
- `created_at`: 帳號創建時間
- `updated_at`: 最後更新時間
- `last_login_at`: 最後登入時間

#### account_applications 表格 - 帳號申請
存儲用戶帳號申請記錄。

```sql
CREATE TABLE account_applications (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(100),
  reason TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  applied_at TIMESTAMP DEFAULT NOW(),
  reviewed_at TIMESTAMP,
  reviewed_by INTEGER REFERENCES users(id)
);
```

**欄位說明：**
- `id`: 申請記錄唯一識別碼
- `email`: 申請人電子郵件
- `name`: 申請人姓名
- `reason`: 申請理由
- `status`: 申請狀態（'pending', 'approved', 'rejected'）
- `applied_at`: 申請時間
- `reviewed_at`: 審核時間
- `reviewed_by`: 審核管理員ID

#### user_sessions 表格 - 用戶會話
管理用戶登入會話和權限驗證。

```sql
CREATE TABLE user_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX sessions_token_idx ON user_sessions(token);
CREATE INDEX sessions_user_id_idx ON user_sessions(user_id);
```

### 2. 語音轉錄系統

#### transcriptions 表格 - 轉錄記錄
存儲所有語音轉錄任務和結果。

```sql
CREATE TABLE transcriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  display_name TEXT,
  file_size INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  progress INTEGER NOT NULL DEFAULT 0,
  google_speech_operation_id TEXT,
  transcript_text TEXT,
  speakers JSONB,
  segments JSONB,
  confidence REAL,
  duration INTEGER,
  word_count INTEGER,
  error_message TEXT,
  summary TEXT,
  summary_type TEXT,
  auto_highlights JSONB,
  auto_chapters JSONB,
  topics_detection JSONB,
  sentiment_analysis JSONB,
  entity_detection JSONB,
  content_safety JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

**欄位說明：**
- `id`: 轉錄記錄唯一識別碼
- `user_id`: 轉錄所有者用戶ID
- `filename`: 存儲的檔案名稱
- `original_name`: 原始檔案名稱
- `display_name`: 用戶自定義顯示名稱
- `file_size`: 檔案大小（位元組）
- `status`: 轉錄狀態（'pending', 'processing', 'completed', 'error'）
- `progress`: 進度百分比（0-100）
- `google_speech_operation_id`: Google Cloud Speech-to-Text 作業 ID
- `transcript_text`: 轉錄文本內容
- `speakers`: 對話者信息（JSON格式）
- `segments`: 分段轉錄內容（JSON格式）
- `confidence`: 轉錄準確度（0-1）
- `duration`: 音頻時長（秒）
- `word_count`: 字數統計
- `error_message`: 錯誤訊息
- `summary`: AI生成的摘要
- `summary_type`: 摘要類型（'bullets', 'paragraph', 'headline'）
- `auto_highlights`: 自動亮點提取
- `auto_chapters`: 自動章節分段
- `topics_detection`: 主題檢測結果
- `sentiment_analysis`: 情感分析結果
- `entity_detection`: 實體識別結果
- `content_safety`: 內容安全檢測結果

#### user_keywords 表格 - 用戶關鍵字
存儲用戶自定義的關鍵字集合。

```sql
CREATE TABLE user_keywords (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  keywords TEXT NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

**欄位說明：**
- `id`: 關鍵字集合唯一識別碼
- `user_id`: 關鍵字所有者用戶ID
- `name`: 關鍵字集合名稱
- `keywords`: 關鍵字列表（逗號分隔）
- `usage_count`: 使用次數統計
- `created_at`: 創建時間
- `updated_at`: 最後更新時間

### 3. 通知系統

#### notifications 表格 - 系統通知
管理用戶通知和系統消息。

```sql
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**欄位說明：**
- `id`: 通知唯一識別碼
- `user_id`: 接收通知的用戶ID
- `type`: 通知類型（'account_application', 'system_alert'）
- `title`: 通知標題
- `message`: 通知內容
- `is_read`: 是否已讀
- `created_at`: 通知時間

### 4. 聊天機器人系統

#### chat_sessions 表格 - 聊天會話
管理用戶與聊天機器人的對話會話。

```sql
CREATE TABLE chat_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  session_id VARCHAR(100) NOT NULL,
  title VARCHAR(200),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  priority VARCHAR(20) NOT NULL DEFAULT 'medium',
  category VARCHAR(50) NOT NULL DEFAULT 'general',
  assigned_to INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP
);
```

**欄位說明：**
- `id`: 會話唯一識別碼
- `user_id`: 用戶ID
- `session_id`: 會話識別碼
- `title`: 會話標題
- `status`: 會話狀態（'active', 'resolved', 'archived'）
- `priority`: 優先級（'low', 'medium', 'high', 'urgent'）
- `category`: 類別（'general', 'bug', 'feature', 'question'）
- `assigned_to`: 指派的管理員ID
- `created_at`: 創建時間
- `updated_at`: 更新時間
- `resolved_at`: 解決時間

#### chat_messages 表格 - 聊天訊息
存儲聊天會話中的所有訊息。

```sql
CREATE TABLE chat_messages (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES chat_sessions(id),
  user_id INTEGER REFERENCES users(id),
  message TEXT NOT NULL,
  message_type VARCHAR(20) NOT NULL DEFAULT 'user',
  attachments JSONB,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**欄位說明：**
- `id`: 訊息唯一識別碼
- `session_id`: 所屬會話ID
- `user_id`: 發送者用戶ID
- `message`: 訊息內容
- `message_type`: 訊息類型（'user', 'admin', 'system'）
- `attachments`: 附件信息（JSON格式）
- `is_read`: 是否已讀
- `created_at`: 發送時間

### 5. 管理員日誌系統

#### admin_logs 表格 - 管理員操作日誌
記錄系統變更、調試信息和管理員操作。

```sql
CREATE TABLE admin_logs (
  id SERIAL PRIMARY KEY,
  category VARCHAR(50) NOT NULL,
  action VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  details JSONB,
  user_id INTEGER REFERENCES users(id),
  transcription_id INTEGER REFERENCES transcriptions(id),
  severity VARCHAR(20) NOT NULL DEFAULT 'info',
  created_at TIMESTAMP DEFAULT NOW()
);
```

**欄位說明：**
- `id`: 日誌記錄唯一識別碼
- `category`: 日誌類別（'transcription', 'ui_fix', 'color_fix', 'ai_analysis'等）
- `action`: 操作動作
- `description`: 操作描述
- `details`: 詳細信息（JSON格式）
- `user_id`: 操作者用戶ID
- `transcription_id`: 相關轉錄記錄ID
- `severity`: 嚴重程度（'info', 'warning', 'error', 'success'）
- `created_at`: 記錄時間

## 資料關聯性

### 主要外鍵關聯
1. `transcriptions.user_id` → `users.id`
2. `account_applications.reviewed_by` → `users.id`
3. `user_sessions.user_id` → `users.id`
4. `notifications.user_id` → `users.id`
5. `chat_sessions.user_id` → `users.id`
6. `chat_sessions.assigned_to` → `users.id`
7. `chat_messages.session_id` → `chat_sessions.id`
8. `chat_messages.user_id` → `users.id`
9. `user_keywords.user_id` → `users.id`
10. `admin_logs.user_id` → `users.id`
11. `admin_logs.transcription_id` → `transcriptions.id`

### 索引設計
- `users_email_idx`: 用戶電子郵件索引（提升登入性能）
- `sessions_token_idx`: 會話令牌索引（提升認證性能）
- `sessions_user_id_idx`: 會話用戶ID索引

## JSON 欄位結構

### speakers 欄位結構
```json
[
  {
    "id": "A",
    "label": "對話者 A",
    "color": "#3B82F6"
  },
  {
    "id": "B", 
    "label": "對話者 B",
    "color": "#10B981"
  }
]
```

### segments 欄位結構
```json
[
  {
    "text": "轉錄文本內容",
    "speaker": "A",
    "start": 1000,
    "end": 5000,
    "confidence": 0.95
  }
]
```

### auto_highlights 欄位結構
```json
{
  "results": [
    {
      "text": "重要內容",
      "rank": 0.95,
      "timestamps": [
        {"start": 1000, "end": 2000}
      ]
    }
  ]
}
```

### topics_detection 欄位結構
```json
{
  "results": [
    {
      "text": "商業討論",
      "labels": ["Business", "Technology"],
      "confidence": 0.87
    }
  ]
}
```

## 資料完整性規則

1. **用戶相關**：
   - 電子郵件必須唯一
   - 密碼必須經過加密處理
   - 帳號狀態控制訪問權限

2. **轉錄相關**：
   - 每個轉錄記錄必須有所有者
   - 檔案大小必須為正整數
   - 進度值範圍 0-100

3. **會話相關**：
   - 會話令牌必須唯一
   - 會話過期時間控制訪問

4. **聊天相關**：
   - 每個訊息必須屬於特定會話
   - 會話狀態控制可見性

此架構支援完整的用戶管理、語音轉錄處理、AI分析、通知系統和管理員監控功能。