# 智能多語言語音轉錄平台 - 系統文檔

## 系統概述

智能多語言語音轉錄平台是一個基於 Web 的企業級語音轉錄解決方案，整合了 AssemblyAI 高精度語音識別技術和 Gemini AI 智能分析功能，提供完整的用戶管理、安全認證和數據恢復機制。

### 核心功能特性

- **高精度語音轉錄**：支援多種音頻格式，提供準確的語音轉文字服務
- **多語言支援**：專為繁體中文優化，同時支援多國語言
- **智能AI分析**：自動生成摘要、關鍵字提取、情感分析
- **用戶權限管理**：完整的角色權限控制和帳號管理系統
- **即時音頻處理**：支援錄音和實時音頻可視化
- **管理員監控**：完整的操作日誌和系統監控功能

## 技術架構

### 前端技術棧
- **React 18**：現代化用戶介面框架
- **TypeScript**：型別安全的開發環境
- **Vite**：高效能建構工具
- **Tailwind CSS**：實用優先的 CSS 框架
- **Shadcn/UI**：現代化 UI 組件庫
- **TanStack Query**：資料擷取和狀態管理
- **Wouter**：輕量級路由管理
- **Framer Motion**：動畫效果框架

### 後端技術棧
- **Node.js**：伺服器運行環境
- **Express.js**：Web 應用框架
- **TypeScript**：型別安全的開發環境
- **PostgreSQL**：關聯式資料庫
- **Drizzle ORM**：型別安全的資料庫查詢建構器
- **JWT**：JSON Web Token 身份驗證
- **Bcrypt**：密碼加密處理

### 外部服務整合
- **AssemblyAI**：高精度語音轉錄服務
- **Gemini AI**：智能內容分析和重組
- **SendGrid**：郵件通知服務
- **WebSocket**：即時通訊功能

## 系統架構

### 目錄結構
```
├── client/                 # 前端應用
│   ├── src/
│   │   ├── components/     # React 組件
│   │   ├── pages/          # 頁面組件
│   │   ├── hooks/          # 自定義 React Hooks
│   │   ├── lib/            # 工具函數和配置
│   │   └── styles/         # 樣式文件
├── server/                 # 後端應用
│   ├── index.ts            # 應用入口點
│   ├── routes.ts           # API 路由定義
│   ├── auth.ts             # 身份驗證邏輯
│   ├── db.ts               # 資料庫連接
│   ├── storage.ts          # 資料存取層
│   ├── email-service.ts    # 郵件服務
│   ├── gemini-analysis.ts  # AI 分析服務
│   └── admin-logger.ts     # 管理員日誌
├── shared/                 # 共享資源
│   └── schema.ts           # 資料庫架構定義
├── uploads/                # 文件上傳目錄
└── python_scripts/         # Python 處理腳本
```

### 核心模組

#### 1. 身份驗證系統 (auth.ts)
- 使用者註冊、登入、登出
- JWT Token 管理
- 密碼加密和驗證
- 會話管理
- 權限驗證中間件

#### 2. 語音轉錄系統
- 音頻文件上傳處理
- AssemblyAI API 整合
- 轉錄進度追蹤
- 結果處理和存儲
- 錯誤處理和恢復機制

#### 3. AI 分析系統 (gemini-analysis.ts)
- 文本清理和重組
- 智能摘要生成
- 關鍵字提取
- 對話者分析
- 主題檢測

#### 4. 用戶管理系統
- 用戶帳號創建和管理
- 角色權限控制
- 帳號申請審核
- 密碼重置機制

#### 5. 管理員系統
- 操作日誌記錄
- 系統監控
- 用戶管理
- 轉錄記錄管理

## API 端點

### 身份驗證 API
```
POST /api/auth/login          # 用戶登入
POST /api/auth/logout         # 用戶登出
POST /api/auth/register       # 用戶註冊
POST /api/auth/apply          # 帳號申請
POST /api/auth/reset-password # 密碼重置
GET  /api/auth/me             # 獲取當前用戶信息
```

### 轉錄 API
```
GET    /api/transcriptions          # 獲取轉錄列表
POST   /api/transcriptions          # 創建轉錄任務
GET    /api/transcriptions/:id      # 獲取轉錄詳情
PUT    /api/transcriptions/:id      # 更新轉錄記錄
DELETE /api/transcriptions/:id      # 刪除轉錄記錄
POST   /api/transcriptions/:id/analyze # AI 分析
```

### 管理員 API
```
GET    /api/admin/users             # 獲取用戶列表
POST   /api/admin/create-user       # 創建用戶帳號
PUT    /api/admin/users/:id         # 更新用戶信息
DELETE /api/admin/users/:id         # 刪除用戶
GET    /api/admin/applications      # 獲取申請列表
POST   /api/admin/applications/:id/approve # 批准申請
POST   /api/admin/applications/:id/reject  # 拒絕申請
GET    /api/admin/transcriptions    # 獲取所有轉錄記錄
GET    /api/admin/logs              # 獲取管理員日誌
POST   /api/admin/logs              # 創建日誌記錄
```

### 關鍵字 API
```
GET    /api/keywords                # 獲取用戶關鍵字
POST   /api/keywords                # 創建關鍵字集合
PUT    /api/keywords/:id            # 更新關鍵字集合
DELETE /api/keywords/:id            # 刪除關鍵字集合
```

## 用戶角色與權限

### 用戶角色
1. **一般用戶 (user)**
   - 上傳和轉錄音頻文件
   - 查看自己的轉錄記錄
   - 管理個人關鍵字集合
   - 使用 AI 分析功能

2. **管理員 (admin)**
   - 所有一般用戶權限
   - 管理用戶帳號
   - 審核帳號申請
   - 查看所有轉錄記錄
   - 訪問管理員面板
   - 查看系統日誌

### 權限控制機制
- 基於角色的訪問控制 (RBAC)
- API 端點權限驗證
- 前端路由權限保護
- 資料存取權限限制

## 資料流程

### 語音轉錄流程
1. **文件上傳**：用戶上傳音頻文件到伺服器
2. **預處理**：驗證文件格式和大小
3. **轉錄請求**：發送到 AssemblyAI 進行處理
4. **進度追蹤**：定期查詢轉錄狀態
5. **結果處理**：接收並處理轉錄結果
6. **AI 分析**：使用 Gemini AI 進行內容分析
7. **資料存儲**：保存到資料庫
8. **用戶通知**：更新前端狀態

### 用戶管理流程
1. **帳號申請**：用戶提交申請表單
2. **管理員審核**：管理員查看並處理申請
3. **帳號創建**：自動生成用戶帳號和密碼
4. **郵件通知**：發送登入憑證
5. **首次登入**：用戶使用臨時密碼登入
6. **密碼修改**：強制修改密碼

## 安全措施

### 身份驗證安全
- 密碼 Bcrypt 加密存儲
- JWT Token 安全傳輸
- 會話過期管理
- 防止暴力破解攻擊

### 資料安全
- 輸入驗證和清理
- SQL 注入防護
- XSS 攻擊防護
- CSRF 保護機制

### 文件安全
- 文件類型驗證
- 文件大小限制
- 安全文件名處理
- 上傳目錄保護

## 監控與日誌

### 管理員日誌系統
- 操作記錄追蹤
- 系統變更日誌
- 錯誤事件記錄
- 性能監控數據

### 日誌類別
- `system`: 系統初始化和配置
- `auth`: 身份驗證相關操作
- `transcription`: 轉錄處理過程
- `ui_fix`: 用戶介面修復
- `feature`: 新功能實現
- `error`: 錯誤事件記錄

## 部署配置

### 環境變數
```env
DATABASE_URL=postgresql://...          # 資料庫連接
ASSEMBLYAI_API_KEY=...                # AssemblyAI API 金鑰
GEMINI_API_KEY=...                    # Gemini AI API 金鑰
SENDGRID_API_KEY=...                  # SendGrid 郵件服務
GMAIL_USER=...                        # Gmail 帳號
GMAIL_PASSWORD=...                    # Gmail 應用程式密碼
NODE_ENV=production                   # 運行環境
```

### 系統需求
- Node.js 18+
- PostgreSQL 14+
- 至少 2GB RAM
- 10GB 磁碟空間

### 部署步驟
1. 安裝依賴：`npm install`
2. 資料庫遷移：`npm run db:push`
3. 建構應用：`npm run build`
4. 啟動服務：`npm run start`

## 維護指南

### 定期維護任務
1. **資料庫備份**：每日自動備份
2. **日誌清理**：定期清理舊日誌記錄
3. **文件清理**：清理過期上傳文件
4. **安全更新**：定期更新依賴套件

### 故障排除
1. **轉錄失敗**：檢查 AssemblyAI API 狀態
2. **登入問題**：檢查資料庫連接和 JWT 配置
3. **文件上傳失敗**：檢查磁碟空間和權限
4. **AI 分析失敗**：檢查 Gemini API 金鑰

### 性能優化
1. **資料庫索引優化**
2. **查詢效能調優**
3. **文件快取策略**
4. **前端資源優化**

## 擴展性考量

### 水平擴展
- 負載均衡器配置
- 資料庫讀寫分離
- 文件存儲分散化
- 微服務架構遷移

### 功能擴展
- 多租戶支援
- 實時協作功能
- 行動應用 API
- 第三方整合介面

## 支援與聯絡

如需技術支援或有任何問題，請聯絡系統管理員或查看相關文檔。

---

*本文檔版本：v1.0*  
*最後更新：2025-06-06*