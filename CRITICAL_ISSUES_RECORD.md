# 系統關鍵問題記錄文檔

## 文檔目的
記錄所有已修復的關鍵問題和系統配置，確保在系統更新或維護時不會重新引入這些問題。

## 📋 已修復的關鍵問題

### 1. 無限API輪詢問題 (Critical) - 已再次發生
**問題描述**: 頁面自動調用API獲取轉錄列表，導致無限輪詢和頁面卡死
**修復位置**: 
- `client/src/pages/dashboard.tsx` (首次修復)
- `client/src/pages/transcription.tsx` (二次修復 - 2025/06/10)
**修復方案**: 
- 移除自動輪詢邏輯 (`setInterval`, `refetchInterval`)
- 添加手動刷新按鈕讓用戶主動控制更新
- 避免無限API調用造成的性能問題

**二次發生原因**: 在transcription.tsx中意外重新啟用了`refetchInterval: 2000`
**最新修復**: 移除`refetchInterval: 2000`設定，改為僅在處理中狀態時輪詢

**警告**: ⚠️ 絕對不要在任何頁面重新添加自動輪詢功能
**檢查點**: 搜尋所有檔案中的`refetchInterval`確保沒有自動輪詢

### 2. 前端上傳認證問題 (Critical)
**問題描述**: 錄音和檔案上傳請求缺少Authorization header，導致401錯誤
**修復位置**: 
- `client/src/components/upload-section.tsx`
- `client/src/components/audio-recorder.tsx`
**修復方案**: 
- 添加 `Authorization: Bearer ${token}` header
- 添加 `credentials: 'include'` 配置
- 確保所有上傳請求都包含認證信息

**警告**: ⚠️ 所有API請求必須包含認證header

### 3. AI分析功能資料結構問題 (Critical)
**問題描述**: AI分析無法處理segments資料結構，導致分析失败
**修復位置**: `server/gemini-analysis.ts`
**修復方案**: 
- 修改 `buildAnalysisPrompt` 函數處理segments陣列
- 移除對 `transcript_text` 欄位的依賴
- 正確提取每個segment的text、speaker、timestamp信息

**警告**: ⚠️ 不要改回使用 `transcript_text` 欄位

### 4. AI語意分段功能缺陷 (Critical)
**問題描述**: 分段功能無法找到原始講者資料，返回"沒有原始講者資料"錯誤
**修復位置**: `server/routes.ts` (分段API端點)
**修復方案**: 
- 從現有segments中自動提取講者列表
- 生成標準化的講者資料結構
- 自動保存講者資料到資料庫以供未來使用

**警告**: ⚠️ 確保講者提取邏輯不被修改

### 5. 轉錄元數據缺失問題 (High)
**問題描述**: duration和confidence字段在轉錄結果中顯示為空
**修復位置**: 
- `fast_transcription.py`
- `simple_transcription.py`
**修復方案**: 
- 從AssemblyAI響應中提取 `audio_duration` 和 `confidence`
- 在數據庫更新時包含這些字段
- 轉換duration從毫秒到秒

**警告**: ⚠️ 確保Python腳本包含duration和confidence字段

## 🛡️ 關鍵系統配置

### 認證系統配置
- 所有API端點必須使用 `requireAuth` 中間件
- Token必須在Authorization header中以 `Bearer ` 前綴傳遞
- Session管理使用PostgreSQL存儲，不可改為內存存儲

### 數據庫架構要求
- `transcriptions` 表必須包含以下字段：
  - `duration` (REAL) - 音頻長度（秒）
  - `confidence` (REAL) - 轉錄信心度
  - `segments` (JSONB) - 分段資料
  - `speakers` (JSONB) - 講者資料

### AI分析系統
- Gemini API集成正常運作
- 分析提示必須包含完整的segments資料
- 分段功能依賴講者資料的正確提取

## 🔧 Python轉錄腳本要求

### 必要字段更新
每個Python轉錄腳本在更新資料庫時必須包含：
```python
update_data = {
    'status': 'completed',
    'progress': 100,
    'text': text,
    'wordCount': word_count,
    'duration': duration_seconds,  # 必須包含
    'confidence': confidence,      # 必須包含
    'segments': formatted_segments,
    'advancedFeatures': advanced_features,
    'completedAt': datetime.now().isoformat()
}
```

### 講者資料格式
```python
# 標準講者資料結構
speaker_data = {
    'id': speaker_id,
    'label': speaker_name,
    'color': speaker_color
}
```

## 🚨 絕對禁止的操作

1. **不要重新啟用自動API輪詢** - 會導致無限輪詢和頁面卡死
   - 檢查所有檔案中的 `refetchInterval`、`setInterval`、`setTimeout` 用於API輪詢
   - 特別注意 React Query 的 `refetchInterval` 設定
2. **不要移除認證header** - 會導致所有上傳功能失效
3. **不要修改segments資料結構處理邏輯** - 會破壞AI分析功能
4. **不要移除講者自動提取邏輯** - 會破壞分段功能
5. **不要移除duration/confidence字段** - 會導致元數據顯示問題

## 🔍 部署前必檢項目

### 自動輪詢檢查
```bash
# 搜尋所有可能的自動輪詢代碼
grep -r "refetchInterval" client/src/
grep -r "setInterval.*api" client/src/
grep -r "setTimeout.*fetch" client/src/
```

### 認證檢查
```bash
# 確認所有上傳請求包含認證
grep -r "upload.*fetch" client/src/
grep -r "FormData" client/src/
```

## 📊 系統監控要點

### 性能監控
- API響應時間應保持在合理範圍
- 避免頻繁的資料庫查詢
- 監控記憶體使用情況

### 功能驗證
- 定期測試上傳功能（錄音和檔案）
- 驗證AI分析生成正確結果
- 確認分段功能正常運作
- 檢查元數據正確顯示

## 🔄 更新檢查清單

在進行任何系統更新前，請確認：

- [ ] 沒有重新引入自動API輪詢
- [ ] 所有API請求包含正確的認證header
- [ ] AI分析功能使用segments資料結構
- [ ] 分段功能能正確提取講者資料
- [ ] Python腳本包含所有必要的metadata字段
- [ ] 資料庫架構保持完整
- [ ] 所有關鍵功能都經過測試驗證

## 📝 最後更新
**日期**: 2025-06-09  
**狀態**: 所有關鍵問題已修復，系統功能正常  
**下次檢查**: 建議在每次重大更新後重新驗證所有功能

---
**重要提醒**: 這份文檔記錄了系統的關鍵修復，在進行任何代碼更改前，請仔細閱讀並確保不會重新引入這些問題。