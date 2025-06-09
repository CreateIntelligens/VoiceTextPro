# 智能多語言語音轉錄平台

一個基於 Web 的企業級語音轉錄解決方案，整合 AssemblyAI 高精度語音識別和 Gemini AI 智能分析功能。

## 🚀 核心功能

### 語音轉錄
- **高精度轉錄**：整合 AssemblyAI 提供準確的語音轉文字服務
- **多語言支援**：專為繁體中文優化，支援多國語言
- **即時處理**：支援音頻上傳和實時轉錄進度追蹤
- **對話者識別**：自動識別和標記不同對話者
- **音頻可視化**：錄音時提供實時音量顯示

### AI 智能分析
- **文本清理**：使用 Gemini AI 自動清理和重組轉錄內容
- **智能摘要**：生成重點摘要和關鍵信息提取
- **對話者分析**：分析對話者角色和貢獻度
- **主題檢測**：自動識別討論主題和關鍵字
- **情感分析**：分析對話情感傾向

### 用戶管理系統
- **角色權限控制**：支援管理員和一般用戶角色
- **帳號申請審核**：完整的用戶註冊和審核流程
- **密碼安全管理**：加密存儲和重置機制
- **會話管理**：安全的登入會話控制

### 管理員功能
- **用戶帳號管理**：創建、編輯、刪除用戶帳號
- **轉錄記錄監控**：查看所有用戶的轉錄記錄
- **系統日誌**：完整的操作記錄和調試信息
- **申請審核**：處理用戶帳號申請

## 🛠 技術架構

### 前端技術
- **React 18** + **TypeScript**：現代化用戶介面
- **Vite**：高效能建構工具
- **Tailwind CSS** + **Shadcn/UI**：美觀的響應式設計
- **TanStack Query**：高效的資料狀態管理
- **Framer Motion**：流暢的動畫效果

### 後端技術
- **Node.js** + **Express**：伺服器應用框架
- **TypeScript**：型別安全的開發環境
- **PostgreSQL**：可靠的關聯式資料庫
- **Drizzle ORM**：型別安全的資料庫操作
- **JWT**：安全的身份驗證機制

### 外部服務
- **AssemblyAI**：專業語音轉錄服務
- **Gemini AI**：智能內容分析
- **SendGrid**：郵件通知服務

## 📱 用戶介面

### 響應式設計
- **桌面端**：完整功能的管理介面
- **平板端**：優化的觸控體驗
- **手機端**：漢堡選單和簡化操作

### 核心頁面
- **歡迎頁面**：個人化首頁和快速操作
- **語音轉錄**：音頻上傳和錄音功能
- **轉錄結果**：詳細的轉錄內容和分析
- **管理員面板**：完整的系統管理功能
- **用戶儀表板**：使用統計和趨勢分析

## 🔐 安全機制

### 身份驗證
- 密碼加密存儲（Bcrypt）
- JWT Token 安全傳輸
- 會話過期管理
- 防暴力破解保護

### 資料安全
- 輸入驗證和清理
- SQL 注入防護
- XSS 攻擊防護
- 檔案上傳安全檢查

### 權限控制
- 基於角色的訪問控制（RBAC）
- API 端點權限驗證
- 前端路由保護
- 資料存取權限限制

## 📊 資料庫架構

### 主要數據表
- **users**：用戶帳號和權限管理
- **transcriptions**：轉錄記錄和結果存儲
- **account_applications**：帳號申請審核
- **user_sessions**：會話管理
- **admin_logs**：系統操作日誌
- **user_keywords**：用戶自定義關鍵字
- **chat_sessions** / **chat_messages**：聊天機器人系統

### 關聯設計
- 用戶與轉錄記錄的一對多關聯
- 完整的外鍵約束和索引優化
- JSON 欄位存儲複雜數據結構

## 🚀 快速開始

### 環境需求
- Node.js 18+
- PostgreSQL 14+
- 有效的 API 金鑰（AssemblyAI、Gemini AI、SendGrid）

### 安裝步驟

1. **安裝依賴**
```bash
npm install
```

2. **配置環境變數**
```env
DATABASE_URL=postgresql://...
ASSEMBLYAI_API_KEY=...
GEMINI_API_KEY=...
SENDGRID_API_KEY=...
GMAIL_USER=...
GMAIL_PASSWORD=...
```

3. **資料庫初始化**
```bash
npm run db:push
```

4. **啟動開發伺服器**
```bash
npm run dev
```

## 📋 API 文檔

### 身份驗證
```
POST /api/auth/login          # 用戶登入
POST /api/auth/logout         # 用戶登出
POST /api/auth/apply          # 帳號申請
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
POST   /api/admin/create-user       # 創建用戶
GET    /api/admin/applications      # 申請審核
GET    /api/admin/transcriptions    # 轉錄監控
GET    /api/admin/logs              # 系統日誌
```

## 🔧 系統特色

### 智能化功能
- **自動降級處理**：大文件自動切換到基本轉錄模式
- **進度追蹤**：實時顯示轉錄處理進度
- **錯誤恢復**：完整的錯誤處理和恢復機制
- **關鍵字優化**：用戶自定義關鍵字提升準確度

### 管理功能
- **操作日誌**：完整記錄所有系統變更
- **用戶監控**：追蹤用戶活動和使用情況
- **自動通知**：郵件通知系統事件
- **數據統計**：使用量和趨勢分析

### 用戶體驗
- **直觀介面**：清晰的操作流程和視覺設計
- **即時反饋**：操作結果的即時顯示
- **移動友好**：完整的響應式設計
- **無障礙支援**：符合網頁無障礙標準

## 📁 專案結構

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
│   └── services/           # 業務邏輯
├── shared/                 # 共享資源
│   └── schema.ts           # 資料庫架構
├── uploads/                # 文件存儲
└── docs/                   # 文檔資料
```

## 📚 文檔資源

- [資料庫架構文檔](DATABASE_SCHEMA.md)
- [系統技術文檔](SYSTEM_DOCUMENTATION.md)
- [變更記錄](CHANGELOG.md)

## 🤝 支援與維護

### 系統監控
- 完整的錯誤日誌記錄
- 性能監控和優化
- 定期安全更新
- 資料庫備份策略

### 擴展性
- 模組化架構設計
- 水平擴展支援
- 微服務遷移準備
- 第三方服務整合

---

**智能多語言語音轉錄平台** - 提供專業級的語音轉錄和 AI 分析解決方案