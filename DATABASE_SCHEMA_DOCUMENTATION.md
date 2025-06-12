# 智能多語言語音轉錄平台 - 資料庫架構文件

## 目錄
1. [資料庫概覽](#資料庫概覽)
2. [資料表設計](#資料表設計)
3. [關聯架構](#關聯架構)
4. [索引策略](#索引策略)
5. [資料類型說明](#資料類型說明)
6. [架構優化](#架構優化)

---

## 資料庫概覽

### 技術棧
- **資料庫引擎**: PostgreSQL 15+
- **ORM 框架**: Drizzle ORM
- **Schema 管理**: TypeScript 型別安全
- **遷移工具**: Drizzle Kit

### 核心設計原則
- **型別安全**: 使用 TypeScript 確保編譯時型別檢查
- **關聯完整性**: 建立適當的外鍵約束
- **效能優化**: 策略性索引配置
- **擴展性**: 支援未來功能擴展
- **資料完整性**: JSONB 欄位用於複雜資料結構

---

## 資料表設計

### 1. 用戶管理 (User Management)

#### users - 用戶主檔
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

**欄位說明**:
- `id`: 用戶唯一識別碼 (Primary Key)
- `email`: 登入電子郵件 (Unique)
- `password`: 加密密碼 (bcrypt)
- `name`: 用戶姓名
- `role`: 用戶角色 ('admin', 'user')
- `status`: 帳號狀態 ('pending', 'active', 'suspended')
- `is_first_login`: 首次登入標記
- `password_reset_token`: 密碼重設令牌
- `password_reset_expires`: 令牌到期時間
- `created_at`: 建立時間
- `updated_at`: 更新時間
- `last_login_at`: 最後登入時間

#### account_applications - 帳號申請
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

**欄位說明**:
- `id`: 申請記錄 ID
- `email`: 申請者電子郵件
- `name`: 申請者姓名
- `reason`: 申請理由
- `status`: 審核狀態 ('pending', 'approved', 'rejected')
- `applied_at`: 申請時間
- `reviewed_at`: 審核時間
- `reviewed_by`: 審核者 ID (外鍵至 users)

#### user_sessions - 用戶會話
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

**欄位說明**:
- `id`: 會話 ID
- `user_id`: 用戶 ID (外鍵)
- `token`: 會話令牌 (Unique)
- `expires_at`: 到期時間
- `created_at`: 建立時間

### 2. 轉錄核心 (Transcription Core)

#### transcriptions - 轉錄主檔
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
    assemblyai_id TEXT,
    transcript_text TEXT,
    speakers JSONB,
    segments JSONB,
    confidence REAL,
    duration INTEGER,
    word_count INTEGER,
    error_message TEXT,
    -- 高級功能
    summary TEXT,
    summary_type TEXT,
    auto_highlights JSONB,
    auto_chapters JSONB,
    topics_detection JSONB,
    sentiment_analysis JSONB,
    entity_detection JSONB,
    content_safety JSONB,
    -- 錄音元資料
    recording_type TEXT,
    recording_duration INTEGER,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

**狀態流程**:
- `pending`: 等待處理
- `processing`: 處理中
- `completed`: 完成
- `error`: 錯誤

**JSONB 欄位結構**:

##### speakers (講者資訊)
```json
[
  {
    "id": "A",
    "label": "講者 A",
    "color": "#FF6B6B"
  },
  {
    "id": "B", 
    "label": "講者 B",
    "color": "#4ECDC4"
  }
]
```

##### segments (轉錄片段)
```json
[
  {
    "text": "大家好，今天我們來討論新的專案計劃。",
    "speaker": "A",
    "start": 1200,
    "end": 4800,
    "confidence": 0.95
  }
]
```

##### auto_highlights (自動重點)
```json
{
  "results": [
    {
      "text": "重要決議",
      "count": 3,
      "rank": 0.98,
      "timestamps": [
        {"start": 1200, "end": 1800}
      ]
    }
  ]
}
```

##### topics_detection (主題檢測)
```json
{
  "results": [
    {
      "text": "專案管理",
      "confidence": 0.87,
      "iab_categories": {
        "Business": 0.92,
        "Technology": 0.76
      }
    }
  ]
}
```

##### entity_detection (實體識別)
```json
{
  "results": [
    {
      "text": "台北市",
      "entity_type": "Location",
      "start": 1200,
      "end": 1500,
      "confidence": 0.95
    }
  ]
}
```

### 3. 關鍵字管理 (Keywords Management)

#### user_keywords - 用戶關鍵字
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

**欄位說明**:
- `id`: 關鍵字集 ID
- `user_id`: 擁有者 ID (外鍵)
- `name`: 關鍵字集名稱
- `keywords`: 關鍵字內容 (逗號分隔)
- `usage_count`: 使用次數
- `created_at`: 建立時間
- `updated_at`: 更新時間

### 4. 通知系統 (Notification System)

#### notifications - 系統通知
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

**通知類型**:
- `account_application`: 帳號申請相關
- `transcription_completed`: 轉錄完成
- `transcription_error`: 轉錄錯誤
- `system_alert`: 系統警告

### 5. 聊天系統 (Chat System)

#### chat_sessions - 聊天會話
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

**狀態類型**:
- `active`: 進行中
- `resolved`: 已解決
- `archived`: 已封存

**優先級**:
- `low`: 低
- `medium`: 中
- `high`: 高
- `urgent`: 緊急

#### chat_messages - 聊天訊息
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

**訊息類型**:
- `user`: 用戶訊息
- `admin`: 管理員回覆
- `system`: 系統訊息

### 6. 系統日誌 (System Logging)

#### admin_logs - 管理員日誌
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

**日誌類別**:
- `transcription`: 轉錄相關
- `ui_fix`: 介面修復
- `ai_analysis`: AI 分析
- `auth`: 認證相關
- `admin`: 管理功能
- `system`: 系統運作

**嚴重程度**:
- `info`: 資訊
- `warning`: 警告
- `error`: 錯誤
- `success`: 成功

---

## 關聯架構

### 主要關聯關係

```
users (1) ──────── (N) transcriptions
  │                     │
  │                     │
  ├── (1) ────── (N) user_keywords
  │
  ├── (1) ────── (N) notifications
  │
  ├── (1) ────── (N) chat_sessions
  │                     │
  │                     └── (1) ────── (N) chat_messages
  │
  ├── (1) ────── (N) user_sessions
  │
  └── (1) ────── (N) admin_logs
```

### 外鍵約束
- `transcriptions.user_id` → `users.id`
- `user_keywords.user_id` → `users.id`
- `notifications.user_id` → `users.id`
- `chat_sessions.user_id` → `users.id`
- `chat_sessions.assigned_to` → `users.id`
- `chat_messages.session_id` → `chat_sessions.id`
- `chat_messages.user_id` → `users.id`
- `user_sessions.user_id` → `users.id`
- `admin_logs.user_id` → `users.id`
- `admin_logs.transcription_id` → `transcriptions.id`
- `account_applications.reviewed_by` → `users.id`

---

## 索引策略

### 效能關鍵索引

#### 用戶相關
```sql
CREATE INDEX users_email_idx ON users(email);
CREATE INDEX users_role_idx ON users(role);
CREATE INDEX users_status_idx ON users(status);
```

#### 會話管理
```sql
CREATE INDEX sessions_token_idx ON user_sessions(token);
CREATE INDEX sessions_user_id_idx ON user_sessions(user_id);
CREATE INDEX sessions_expires_idx ON user_sessions(expires_at);
```

#### 轉錄查詢
```sql
CREATE INDEX transcriptions_user_id_idx ON transcriptions(user_id);
CREATE INDEX transcriptions_status_idx ON transcriptions(status);
CREATE INDEX transcriptions_created_at_idx ON transcriptions(created_at);
CREATE INDEX transcriptions_assemblyai_id_idx ON transcriptions(assemblyai_id);
```

#### 聊天系統
```sql
CREATE INDEX chat_sessions_user_id_idx ON chat_sessions(user_id);
CREATE INDEX chat_sessions_status_idx ON chat_sessions(status);
CREATE INDEX chat_messages_session_id_idx ON chat_messages(session_id);
```

#### 日誌檢索
```sql
CREATE INDEX admin_logs_category_idx ON admin_logs(category);
CREATE INDEX admin_logs_created_at_idx ON admin_logs(created_at);
CREATE INDEX admin_logs_severity_idx ON admin_logs(severity);
```

### JSONB 索引優化
```sql
-- 講者資訊索引
CREATE INDEX transcriptions_speakers_gin ON transcriptions USING GIN (speakers);

-- 片段搜尋索引
CREATE INDEX transcriptions_segments_gin ON transcriptions USING GIN (segments);

-- 主題檢測索引
CREATE INDEX transcriptions_topics_gin ON transcriptions USING GIN (topics_detection);
```

---

## 資料類型說明

### PostgreSQL 特定類型

#### JSONB 優勢
- **效能**: 二進制格式，查詢速度快
- **索引支援**: 支援 GIN 索引
- **運算子**: 豐富的 JSON 查詢運算子
- **壓縮**: 自動壓縮重複資料

#### TIMESTAMP 處理
```sql
-- 自動時間戳記
created_at TIMESTAMP DEFAULT NOW()
updated_at TIMESTAMP DEFAULT NOW()

-- 時區考量
created_at TIMESTAMPTZ DEFAULT NOW()
```

#### VARCHAR vs TEXT
- `VARCHAR(n)`: 固定長度限制，適合已知長度欄位
- `TEXT`: 無長度限制，適合內容欄位

### Drizzle ORM 型別對應

```typescript
// PostgreSQL → TypeScript
SERIAL       → number
INTEGER      → number
REAL         → number
TEXT         → string
VARCHAR(n)   → string
BOOLEAN      → boolean
TIMESTAMP    → Date
JSONB        → unknown (需要型別斷言)
```

---

## 架構優化

### 效能優化策略

#### 1. 查詢優化
```sql
-- 使用部分索引
CREATE INDEX active_users_idx ON users(id) WHERE status = 'active';

-- 複合索引
CREATE INDEX transcriptions_user_status_idx ON transcriptions(user_id, status);
```

#### 2. 分割策略
```sql
-- 按時間分割大型表格
CREATE TABLE transcriptions_2024_01 PARTITION OF transcriptions
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

#### 3. 連線池設定
```typescript
// 資料庫連線配置
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,          // 最大連線數
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### 資料清理策略

#### 定期清理作業
```sql
-- 清理過期會話
DELETE FROM user_sessions WHERE expires_at < NOW();

-- 封存舊日誌
INSERT INTO admin_logs_archive SELECT * FROM admin_logs 
WHERE created_at < NOW() - INTERVAL '1 year';
```

#### 備份策略
```bash
# 每日備份
pg_dump --host=localhost --port=5432 --username=user --dbname=transcription_db --file=backup_$(date +%Y%m%d).sql

# 增量備份
pg_basebackup -D /backup/base -Ft -z -P
```

### 安全考量

#### 資料加密
```sql
-- 敏感資料加密
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 密碼雜湊
UPDATE users SET password = crypt('new_password', gen_salt('bf', 12));
```

#### 存取控制
```sql
-- 建立應用程式專用用戶
CREATE USER transcription_app WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE transcription_db TO transcription_app;
GRANT USAGE ON SCHEMA public TO transcription_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO transcription_app;
```

### 監控與維護

#### 效能監控
```sql
-- 查詢效能統計
SELECT query, calls, total_time, mean_time 
FROM pg_stat_statements 
ORDER BY total_time DESC LIMIT 10;

-- 索引使用情況
SELECT schemaname, tablename, attname, n_distinct, correlation 
FROM pg_stats 
WHERE tablename = 'transcriptions';
```

#### 維護指令
```sql
-- 重建統計資訊
ANALYZE;

-- 重建索引
REINDEX INDEX CONCURRENTLY transcriptions_user_id_idx;

-- 清理無用空間
VACUUM (ANALYZE, VERBOSE) transcriptions;
```

---

## 資料遷移策略

### Drizzle 遷移管理
```typescript
// drizzle.config.ts
export default {
  schema: "./shared/schema.ts",
  out: "./drizzle",
  driver: "pg",
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
};
```

### 遷移檔案範例
```sql
-- 0001_create_users.sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 0002_add_user_role.sql
ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'user';
CREATE INDEX users_role_idx ON users(role);
```

### 版本控制
```bash
# 生成遷移
npx drizzle-kit generate:pg

# 執行遷移
npx drizzle-kit push:pg

# 檢查狀態
npx drizzle-kit introspect:pg
```

---

## 最佳實務建議

### 1. 設計原則
- **正規化**: 避免資料重複
- **一致性**: 統一命名規範
- **擴展性**: 考慮未來需求
- **效能**: 平衡正規化與查詢效能

### 2. 命名規範
- **表格**: 複數名詞 (users, transcriptions)
- **欄位**: 蛇形命名法 (created_at, user_id)
- **索引**: 描述性名稱 (users_email_idx)
- **外鍵**: 表格名_欄位名 (user_id)

### 3. 資料完整性
- **必要欄位**: 使用 NOT NULL
- **預設值**: 合理的預設設定
- **檢查約束**: 確保資料有效性
- **外鍵約束**: 維護關聯完整性

### 4. 效能考量
- **適當索引**: 根據查詢模式建立
- **避免過度索引**: 影響寫入效能
- **定期維護**: 更新統計資訊
- **監控查詢**: 識別慢查詢

這份資料庫架構文件提供了完整的系統資料結構設計，包含所有核心功能的資料表設計、關聯關係、效能優化策略和維護建議。