# 智能多語言語音轉錄平台 - API 文件

## 目錄
1. [API 概覽](#api-概覽)
2. [認證機制](#認證機制)
3. [用戶管理 API](#用戶管理-api)
4. [轉錄功能 API](#轉錄功能-api)
5. [AI 分析 API](#ai-分析-api)
6. [關鍵字管理 API](#關鍵字管理-api)
7. [系統設置 API](#系統設置-api)
8. [管理員 API](#管理員-api)
9. [聊天系統 API](#聊天系統-api)
10. [通知系統 API](#通知系統-api)
11. [錯誤處理](#錯誤處理)
12. [速率限制](#速率限制)

---

## API 概覽

### 基本資訊
- **Base URL**: `https://your-domain.com/api`
- **協議**: HTTPS
- **資料格式**: JSON
- **字元編碼**: UTF-8
- **版本**: v1

### 回應格式
```json
// 成功回應
{
  "success": true,
  "data": { ... },
  "message": "操作成功"
}

// 錯誤回應
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "錯誤描述",
    "details": { ... }
  }
}

// 分頁回應
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

### 狀態碼
- `200 OK` - 請求成功
- `201 Created` - 資源創建成功
- `204 No Content` - 請求成功，無回應內容
- `400 Bad Request` - 請求參數錯誤
- `401 Unauthorized` - 未授權
- `403 Forbidden` - 權限不足
- `404 Not Found` - 資源不存在
- `422 Unprocessable Entity` - 資料驗證失敗
- `429 Too Many Requests` - 請求過於頻繁
- `500 Internal Server Error` - 服務器錯誤

---

## 認證機制

### 登入驗證

#### POST /api/auth/login
用戶登入並獲取認證令牌。

**請求參數:**
```json
{
  "email": "user@example.com",
  "password": "user_password"
}
```

**回應範例:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "name": "使用者姓名",
      "role": "user",
      "status": "active"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "message": "登入成功"
}
```

#### POST /api/auth/logout
用戶登出並撤銷認證令牌。

**請求標頭:**
```
Authorization: Bearer <token>
```

**回應範例:**
```json
{
  "success": true,
  "message": "登出成功"
}
```

#### GET /api/auth/me
獲取當前登入用戶資訊。

**請求標頭:**
```
Authorization: Bearer <token>
```

**回應範例:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "name": "使用者姓名",
      "role": "user",
      "status": "active",
      "createdAt": "2024-01-01T00:00:00Z",
      "lastLoginAt": "2024-01-15T10:30:00Z"
    }
  }
}
```

### 密碼重設

#### POST /api/auth/reset-password
發送密碼重設郵件。

**請求參數:**
```json
{
  "email": "user@example.com"
}
```

**回應範例:**
```json
{
  "success": true,
  "message": "密碼重設郵件已發送"
}
```

#### POST /api/auth/reset-password/confirm
確認密碼重設。

**請求參數:**
```json
{
  "token": "reset_token",
  "newPassword": "new_password"
}
```

---

## 用戶管理 API

### 帳號申請

#### POST /api/auth/register
提交帳號申請。

**請求參數:**
```json
{
  "email": "newuser@example.com",
  "name": "新用戶姓名",
  "reason": "申請使用原因"
}
```

**回應範例:**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "email": "newuser@example.com",
    "name": "新用戶姓名",
    "status": "pending"
  },
  "message": "申請已提交，等待審核"
}
```

---

## 轉錄功能 API

### 轉錄管理

#### GET /api/transcriptions
獲取用戶的轉錄列表。

**請求標頭:**
```
Authorization: Bearer <token>
```

**查詢參數:**
- `page` (可選): 頁碼，預設 1
- `limit` (可選): 每頁數量，預設 20
- `status` (可選): 狀態篩選 (pending, processing, completed, error)
- `search` (可選): 檔名搜尋

**回應範例:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "filename": "meeting_recording.mp3",
      "displayName": "重要會議記錄",
      "originalName": "meeting_recording.mp3",
      "fileSize": 5242880,
      "status": "completed",
      "progress": 100,
      "duration": 1800,
      "wordCount": 2500,
      "confidence": 0.94,
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-15T10:15:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "pages": 1
  }
}
```

#### GET /api/transcriptions/:id
獲取特定轉錄的詳細資訊。

**請求標頭:**
```
Authorization: Bearer <token>
```

**回應範例:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "filename": "meeting_recording.mp3",
    "displayName": "重要會議記錄",
    "status": "completed",
    "progress": 100,
    "transcriptText": "完整轉錄文本內容...",
    "speakers": [
      {
        "id": "A",
        "label": "主持人",
        "color": "#FF6B6B"
      },
      {
        "id": "B", 
        "label": "參與者",
        "color": "#4ECDC4"
      }
    ],
    "segments": [
      {
        "text": "歡迎大家參加今天的會議。",
        "speaker": "A",
        "start": 1200,
        "end": 3600,
        "confidence": 0.96
      }
    ],
    "duration": 1800,
    "wordCount": 2500,
    "confidence": 0.94,
    "summary": "會議摘要內容...",
    "autoHighlights": {
      "results": [
        {
          "text": "重要決議",
          "count": 3,
          "rank": 0.98
        }
      ]
    },
    "createdAt": "2024-01-15T10:00:00Z"
  }
}
```

### 音頻上傳

#### POST /api/transcriptions/upload
上傳音頻檔案並開始轉錄。

**請求標頭:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**請求參數:**
- `audio` (檔案): 音頻檔案
- `displayName` (可選): 自定義顯示名稱
- `notes` (可選): 備註

**回應範例:**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "filename": "generated_filename.mp3",
    "displayName": "我的錄音",
    "originalName": "original_name.mp3",
    "fileSize": 3145728,
    "status": "pending",
    "progress": 0,
    "createdAt": "2024-01-15T11:00:00Z"
  },
  "message": "檔案上傳成功，開始處理"
}
```

### 轉錄更新

#### PATCH /api/transcriptions/:id
更新轉錄資訊。

**請求標頭:**
```
Authorization: Bearer <token>
```

**請求參數:**
```json
{
  "displayName": "新的顯示名稱",
  "notes": "更新的備註"
}
```

#### PATCH /api/transcriptions/:id/speakers
更新轉錄的講者標籤。

**請求標頭:**
```
Authorization: Bearer <token>
```

**請求參數:**
```json
{
  "speakers": [
    {
      "id": "A",
      "label": "張經理",
      "color": "#FF6B6B"
    },
    {
      "id": "B",
      "label": "李專員", 
      "color": "#4ECDC4"
    }
  ]
}
```

### 檔案下載

#### GET /api/transcriptions/:id/download-audio
下載原始音頻檔案。

**請求標頭:**
```
Authorization: Bearer <token>
```

**回應**: 音頻檔案二進制資料

#### GET /api/transcriptions/:id/export
導出轉錄結果為 Word 文件。

**請求標頭:**
```
Authorization: Bearer <token>
```

**查詢參數:**
- `format` (可選): 導出格式 (word, txt)，預設 word
- `includeTimestamps` (可選): 是否包含時間戳記，預設 true

**回應**: Word 文件二進制資料

---

## AI 分析 API

### 智能分析

#### POST /api/transcriptions/:id/ai-analysis
對轉錄內容進行 AI 分析。

**請求標頭:**
```
Authorization: Bearer <token>
```

**請求參數:**
```json
{
  "analysisType": "meeting",
  "customPrompt": "請特別關注會議中的決議事項"
}
```

**分析類型:**
- `meeting`: 會議分析
- `interview`: 訪談分析
- `lecture`: 演講分析
- `conversation`: 一般對話分析

**回應範例:**
```json
{
  "success": true,
  "data": {
    "summary": "會議討論了新產品開發計劃，確定了三個關鍵里程碑...",
    "keyTopics": [
      "產品開發",
      "市場策略",
      "預算規劃"
    ],
    "actionItems": [
      "完成市場調研報告 - 負責人：張經理 - 期限：下週五",
      "制定產品規格書 - 負責人：李專員 - 期限：月底"
    ],
    "highlights": [
      "預算核准 500 萬元",
      "預計 Q2 上市",
      "目標市場擴展至東南亞"
    ],
    "speakerAnalysis": [
      {
        "speaker": "A",
        "label": "張經理",
        "totalDuration": 720,
        "wordCount": 856,
        "participationRate": 0.65,
        "speakingStyle": "專業、條理清晰",
        "mainViewpoints": [
          "強調產品品質的重要性",
          "支持進軍海外市場"
        ]
      }
    ]
  },
  "message": "AI 分析完成"
}
```

#### POST /api/transcriptions/:id/ai-cleanup
使用 AI 清理和優化轉錄文本。

**請求標頭:**
```
Authorization: Bearer <token>
```

**請求參數:**
```json
{
  "cleanupType": "standard",
  "preserveTimestamps": true,
  "removeFillers": true
}
```

**清理類型:**
- `standard`: 標準清理（移除重複詞、修正語法）
- `formal`: 正式化（轉換為正式文書語調）
- `summary`: 摘要化（濃縮內容保留要點）

**回應範例:**
```json
{
  "success": true,
  "data": {
    "originalText": "嗯...今天我們要討論的是...呃...新的專案計劃...",
    "cleanedText": "今天我們要討論新的專案計劃。",
    "changes": [
      {
        "type": "removed_filler",
        "original": "嗯...",
        "position": 0
      },
      {
        "type": "removed_hesitation", 
        "original": "呃...",
        "position": 15
      }
    ]
  },
  "message": "文本清理完成"
}
```

---

## 關鍵字管理 API

### 關鍵字集合

#### GET /api/keywords
獲取用戶的關鍵字集合列表。

**請求標頭:**
```
Authorization: Bearer <token>
```

**回應範例:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "醫療術語",
      "keywords": "血壓,心率,診斷,治療,藥物",
      "usageCount": 5,
      "createdAt": "2024-01-10T09:00:00Z",
      "updatedAt": "2024-01-15T14:30:00Z"
    },
    {
      "id": 2,
      "name": "技術術語",
      "keywords": "API,資料庫,演算法,架構,部署",
      "usageCount": 3,
      "createdAt": "2024-01-12T16:00:00Z",
      "updatedAt": "2024-01-12T16:00:00Z"
    }
  ]
}
```

#### POST /api/keywords
創建新的關鍵字集合。

**請求標頭:**
```
Authorization: Bearer <token>
```

**請求參數:**
```json
{
  "name": "法律術語",
  "keywords": "合約,條款,法規,權利,義務,爭議,仲裁"
}
```

**回應範例:**
```json
{
  "success": true,
  "data": {
    "id": 3,
    "name": "法律術語",
    "keywords": "合約,條款,法規,權利,義務,爭議,仲裁",
    "usageCount": 0,
    "createdAt": "2024-01-15T15:00:00Z",
    "updatedAt": "2024-01-15T15:00:00Z"
  },
  "message": "關鍵字集合創建成功"
}
```

#### PATCH /api/keywords/:id/use
標記關鍵字集合為已使用（增加使用計數）。

**請求標頭:**
```
Authorization: Bearer <token>
```

**回應範例:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "usageCount": 6
  },
  "message": "使用計數已更新"
}
```

#### DELETE /api/keywords/:id
刪除關鍵字集合。

**請求標頭:**
```
Authorization: Bearer <token>
```

**回應範例:**
```json
{
  "success": true,
  "message": "關鍵字集合已刪除"
}
```

---

## 系統設置 API

### 轉錄配置

#### GET /api/transcription-config
獲取用戶的轉錄配置設定。

**請求標頭:**
```
Authorization: Bearer <token>
```

**回應範例:**
```json
{
  "success": true,
  "data": {
    "speaker_labels": true,
    "speakers_expected": 4,
    "speech_threshold": 0.3,
    "language_detection": true,
    "language_code": "zh",
    "language_confidence_threshold": 0.6,
    "boost_param": "high",
    "multichannel": false,
    "punctuate": true,
    "format_text": true,
    "disfluencies": false,
    "filter_profanity": false,
    "redact_pii": false,
    "redact_pii_policies": [],
    "summarization": true,
    "auto_highlights": true,
    "iab_categories": true,
    "sentiment_analysis": false,
    "entity_detection": true,
    "content_safety": true,
    "custom_topics": true,
    "custom_keywords": "",
    "config_name": "標準配置"
  }
}
```

#### POST /api/transcription-config
更新用戶的轉錄配置設定。

**請求標頭:**
```
Authorization: Bearer <token>
```

**請求參數:**
```json
{
  "speaker_labels": true,
  "speakers_expected": 6,
  "speech_threshold": 0.4,
  "language_detection": false,
  "language_code": "zh-TW",
  "boost_param": "high",
  "punctuate": true,
  "format_text": true,
  "summarization": true,
  "auto_highlights": true,
  "entity_detection": true,
  "custom_keywords": "專案,會議,決議,行動項目",
  "config_name": "會議專用配置"
}
```

**回應範例:**
```json
{
  "success": true,
  "data": {
    "speaker_labels": true,
    "speakers_expected": 6,
    "speech_threshold": 0.4,
    "language_code": "zh-TW",
    "config_name": "會議專用配置"
  },
  "message": "配置已保存"
}
```

---

## 管理員 API

### 用戶管理

#### GET /api/admin/users
獲取所有用戶列表（管理員限定）。

**請求標頭:**
```
Authorization: Bearer <admin_token>
```

**查詢參數:**
- `page` (可選): 頁碼
- `limit` (可選): 每頁數量
- `role` (可選): 角色篩選
- `status` (可選): 狀態篩選

**回應範例:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "email": "user@example.com",
      "name": "一般用戶",
      "role": "user",
      "status": "active",
      "createdAt": "2024-01-01T00:00:00Z",
      "lastLoginAt": "2024-01-15T10:30:00Z"
    },
    {
      "id": 2,
      "email": "admin@example.com", 
      "name": "管理員",
      "role": "admin",
      "status": "active",
      "createdAt": "2024-01-01T00:00:00Z",
      "lastLoginAt": "2024-01-15T09:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 2,
    "pages": 1
  }
}
```

#### POST /api/admin/create-user
創建新用戶（管理員限定）。

**請求標頭:**
```
Authorization: Bearer <admin_token>
```

**請求參數:**
```json
{
  "email": "newuser@example.com",
  "name": "新用戶",
  "role": "user",
  "status": "active"
}
```

**回應範例:**
```json
{
  "success": true,
  "data": {
    "id": 3,
    "email": "newuser@example.com",
    "name": "新用戶",
    "role": "user",
    "status": "active",
    "password": "auto_generated_password"
  },
  "message": "用戶創建成功，密碼已發送至郵箱"
}
```

#### PATCH /api/admin/users/:id
更新用戶資訊（管理員限定）。

**請求標頭:**
```
Authorization: Bearer <admin_token>
```

**請求參數:**
```json
{
  "name": "更新的姓名",
  "role": "admin",
  "status": "suspended"
}
```

#### DELETE /api/admin/users/:id
刪除用戶（管理員限定）。

**請求標頭:**
```
Authorization: Bearer <admin_token>
```

### 申請管理

#### GET /api/admin/applications
獲取帳號申請列表（管理員限定）。

**請求標頭:**
```
Authorization: Bearer <admin_token>
```

**回應範例:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "email": "applicant@example.com",
      "name": "申請者",
      "reason": "需要使用語音轉錄功能進行會議記錄",
      "status": "pending",
      "appliedAt": "2024-01-15T12:00:00Z"
    }
  ]
}
```

#### POST /api/admin/applications/:id/approve
核准帳號申請（管理員限定）。

**請求標頭:**
```
Authorization: Bearer <admin_token>
```

**回應範例:**
```json
{
  "success": true,
  "data": {
    "applicationId": 1,
    "userId": 4,
    "password": "generated_password"
  },
  "message": "申請已核准，帳號已創建"
}
```

#### POST /api/admin/applications/:id/reject
拒絕帳號申請（管理員限定）。

**請求標頭:**
```
Authorization: Bearer <admin_token>
```

**請求參數:**
```json
{
  "reason": "申請資訊不完整"
}
```

### 轉錄管理

#### GET /api/admin/transcriptions
獲取所有轉錄記錄（管理員限定）。

**請求標頭:**
```
Authorization: Bearer <admin_token>
```

**回應範例:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "userId": 1,
      "username": "user@example.com",
      "filename": "meeting.mp3",
      "status": "completed",
      "fileSize": 5242880,
      "duration": 1800,
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ]
}
```

#### DELETE /api/admin/transcriptions/:id
刪除轉錄記錄（管理員限定）。

**請求標頭:**
```
Authorization: Bearer <admin_token>
```

---

## 聊天系統 API

### 聊天會話

#### GET /api/chat/sessions
獲取用戶的聊天會話列表。

**請求標頭:**
```
Authorization: Bearer <token>
```

**回應範例:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "sessionId": "session_uuid",
      "title": "轉錄問題諮詢",
      "status": "active",
      "priority": "medium",
      "category": "technical",
      "createdAt": "2024-01-15T14:00:00Z",
      "updatedAt": "2024-01-15T14:30:00Z"
    }
  ]
}
```

#### POST /api/chat/sessions
創建新的聊天會話。

**請求標頭:**
```
Authorization: Bearer <token>
```

**請求參數:**
```json
{
  "title": "音頻上傳問題",
  "category": "technical",
  "priority": "high"
}
```

#### GET /api/chat/messages/:sessionId
獲取聊天會話的訊息列表。

**請求標頭:**
```
Authorization: Bearer <token>
```

**回應範例:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "sessionId": 1,
      "userId": 1,
      "message": "您好，我在上傳音頻時遇到問題。",
      "messageType": "user",
      "isRead": true,
      "createdAt": "2024-01-15T14:00:00Z"
    },
    {
      "id": 2,
      "sessionId": 1,
      "userId": 2,
      "message": "請問您遇到什麼具體問題？可以描述一下錯誤訊息嗎？",
      "messageType": "admin",
      "isRead": false,
      "createdAt": "2024-01-15T14:05:00Z"
    }
  ]
}
```

#### POST /api/chat/messages
發送聊天訊息。

**請求標頭:**
```
Authorization: Bearer <token>
```

**請求參數:**
```json
{
  "sessionId": 1,
  "message": "上傳時顯示檔案格式不支援的錯誤。",
  "attachments": []
}
```

---

## 通知系統 API

### 通知管理

#### GET /api/notifications
獲取用戶通知列表。

**請求標頭:**
```
Authorization: Bearer <token>
```

**查詢參數:**
- `unread` (可選): 只顯示未讀通知 (true/false)
- `type` (可選): 通知類型篩選

**回應範例:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "type": "transcription_completed",
      "title": "轉錄完成",
      "message": "您的音頻檔案 'meeting.mp3' 已完成轉錄處理。",
      "isRead": false,
      "createdAt": "2024-01-15T15:00:00Z"
    },
    {
      "id": 2,
      "type": "account_application",
      "title": "帳號申請通過",
      "message": "恭喜！您的帳號申請已通過審核。",
      "isRead": true,
      "createdAt": "2024-01-14T09:00:00Z"
    }
  ]
}
```

#### PATCH /api/notifications/:id/read
標記通知為已讀。

**請求標頭:**
```
Authorization: Bearer <token>
```

**回應範例:**
```json
{
  "success": true,
  "message": "通知已標記為已讀"
}
```

---

## 錯誤處理

### 錯誤代碼

#### 認證錯誤 (4xx)
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "需要有效的認證令牌"
  }
}
```

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "權限不足，需要管理員權限"
  }
}
```

#### 驗證錯誤 (422)
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "輸入資料驗證失敗",
    "details": {
      "email": ["電子郵件格式不正確"],
      "password": ["密碼長度至少需要 8 個字元"]
    }
  }
}
```

#### 資源錯誤 (404)
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "請求的轉錄記錄不存在"
  }
}
```

#### 業務邏輯錯誤 (400)
```json
{
  "success": false,
  "error": {
    "code": "FILE_TOO_LARGE",
    "message": "檔案大小超過限制（最大 500MB）"
  }
}
```

```json
{
  "success": false,
  "error": {
    "code": "UNSUPPORTED_FORMAT",
    "message": "不支援的檔案格式，請上傳 MP3、WAV、M4A 或 WebM 格式"
  }
}
```

#### 外部服務錯誤 (502)
```json
{
  "success": false,
  "error": {
    "code": "EXTERNAL_SERVICE_ERROR",
    "message": "AssemblyAI 服務暫時不可用，請稍後再試"
  }
}
```

#### 服務器錯誤 (500)
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "服務器內部錯誤，請聯繫技術支援"
  }
}
```

---

## 速率限制

### 限制政策

#### 一般 API 限制
- **視窗**: 15 分鐘
- **限制**: 每個 IP 100 次請求
- **標頭**: 
  - `X-RateLimit-Limit`: 限制總數
  - `X-RateLimit-Remaining`: 剩餘請求數
  - `X-RateLimit-Reset`: 重設時間

#### 登入 API 限制
- **視窗**: 15 分鐘
- **限制**: 每個 IP 5 次登入嘗試
- **政策**: 只計算失敗的登入嘗試

#### 檔案上傳限制
- **視窗**: 1 小時
- **限制**: 每個用戶 10 個檔案
- **檔案大小**: 最大 500MB

### 超出限制回應
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "請求過於頻繁，請稍後再試",
    "retryAfter": 900
  }
}
```

### WebSocket 連線限制
- **同時連線**: 每個用戶最多 3 個連線
- **訊息頻率**: 每秒最多 10 條訊息
- **連線時長**: 最長 24 小時自動斷線

---

## API 測試範例

### 使用 cURL 測試

#### 登入獲取令牌
```bash
curl -X POST https://your-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "your_password"
  }'
```

#### 上傳音頻檔案
```bash
curl -X POST https://your-domain.com/api/transcriptions/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "audio=@path/to/audio.mp3" \
  -F "displayName=測試錄音"
```

#### 獲取轉錄列表
```bash
curl -X GET https://your-domain.com/api/transcriptions \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 更新講者標籤
```bash
curl -X PATCH https://your-domain.com/api/transcriptions/1/speakers \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "speakers": [
      {"id": "A", "label": "張經理", "color": "#FF6B6B"},
      {"id": "B", "label": "李專員", "color": "#4ECDC4"}
    ]
  }'
```

### 使用 JavaScript 測試

#### 封裝 API 請求函數
```javascript
class TranscriptionAPI {
  constructor(baseURL, token) {
    this.baseURL = baseURL;
    this.token = token;
  }

  async request(endpoint, method = 'GET', data = null) {
    const config = {
      method,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
    };

    if (data) {
      config.body = JSON.stringify(data);
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, config);
    return await response.json();
  }

  async getTranscriptions(page = 1, limit = 20) {
    return await this.request(`/transcriptions?page=${page}&limit=${limit}`);
  }

  async uploadAudio(audioFile, displayName) {
    const formData = new FormData();
    formData.append('audio', audioFile);
    formData.append('displayName', displayName);

    const response = await fetch(`${this.baseURL}/transcriptions/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
      body: formData,
    });

    return await response.json();
  }

  async updateSpeakers(transcriptionId, speakers) {
    return await this.request(
      `/transcriptions/${transcriptionId}/speakers`,
      'PATCH',
      { speakers }
    );
  }
}

// 使用範例
const api = new TranscriptionAPI('https://your-domain.com/api', 'your_token');

// 獲取轉錄列表
api.getTranscriptions()
  .then(result => console.log(result))
  .catch(error => console.error(error));
```

這份 API 文件提供了完整的 REST API 介面說明，包含所有端點的詳細參數、回應格式、錯誤處理和測試範例，供前端開發者和第三方整合使用。