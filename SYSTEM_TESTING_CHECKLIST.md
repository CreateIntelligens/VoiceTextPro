# 系統功能測試檢查清單

## 目的
確保所有關鍵功能正常運作，並在系統更新後進行驗證測試。

## 🧪 核心功能測試

### 1. 檔案上傳功能
- [ ] 音頻檔案上傳成功 (支援格式: mp3, wav, m4a, mp4)
- [ ] 檔案大小檢查正常 (最大100MB)
- [ ] 上傳進度顯示正確
- [ ] 檔案重命名功能正常
- [ ] 認證header正確傳遞 (Authorization: Bearer token)

**測試指令**:
```bash
curl -X POST http://localhost:5000/api/transcriptions/upload \
  -H "Authorization: Bearer {token}" \
  -F "audio=@test-file.mp3"
```

### 2. 錄音功能
- [ ] 瀏覽器麥克風權限正常獲取
- [ ] 實時音量檢測顯示
- [ ] 錄音開始/停止控制正常
- [ ] 錄音檔案自動上傳
- [ ] 認證header包含在上傳請求中

### 3. 轉錄處理
- [ ] AssemblyAI API調用成功
- [ ] 進度更新正常顯示 (不是無限輪詢)
- [ ] 狀態變化: uploading → processing → completed
- [ ] 錯誤處理和重試機制正常
- [ ] Duration和confidence字段正確儲存

**檢查資料庫**:
```sql
SELECT id, duration, confidence, status FROM transcriptions WHERE id = {latest_id};
```

### 4. 轉錄結果顯示
- [ ] 逐字稿文本正確顯示
- [ ] 講者分段正確標示和顏色區分
- [ ] 時間戳格式正確 (MM:SS)
- [ ] 字數統計準確
- [ ] 信心度和時長正確顯示
- [ ] 音頻播放功能正常

### 5. AI分析功能
- [ ] 會議摘要生成正確
- [ ] 關鍵要點提取準確
- [ ] 講者洞察分析合理
- [ ] 行動項目識別正確
- [ ] 處理時間在合理範圍內 (<30秒)

**測試指令**:
```bash
curl -X POST http://localhost:5000/api/transcriptions/{id}/analyze \
  -H "Authorization: Bearer {token}"
```

### 6. 逐字稿整理功能
- [ ] Gemini AI文本清理正常
- [ ] 繁體中文處理正確
- [ ] 大文件使用基本處理模式避免超時
- [ ] 整理結果保存正確

### 7. AI語意分段功能
- [ ] 講者資料自動提取成功
- [ ] 清理後文本重新分段正確
- [ ] 講者分配合理
- [ ] 分段時間戳重新計算
- [ ] 不會出現"沒有原始講者資料"錯誤

**測試指令**:
```bash
curl -X POST http://localhost:5000/api/transcriptions/{id}/segment \
  -H "Authorization: Bearer {token}" \
  -d '{"cleanedText": "測試分段文本..."}'
```

## 🔐 認證和權限測試

### 用戶認證
- [ ] 登入功能正常
- [ ] Session管理正確
- [ ] Token驗證有效
- [ ] 未認證請求正確拒絕 (401錯誤)

### 管理員功能
- [ ] 管理員面板訪問正常
- [ ] 用戶管理功能完整
- [ ] 轉錄記錄管理正常
- [ ] 日誌系統記錄完整

## 📊 性能和穩定性測試

### 頁面性能
- [ ] 頁面載入時間 <3秒
- [ ] 無無限API輪詢問題
- [ ] 手動刷新按鈕正常工作
- [ ] 記憶體使用量穩定

### 資料庫性能
- [ ] 查詢響應時間 <500ms
- [ ] 並發處理正常
- [ ] 資料完整性保持

### API穩定性
- [ ] 錯誤處理正確
- [ ] 超時機制有效
- [ ] 重試邏輯合理

## 🛠️ 系統配置驗證

### 環境變數
- [ ] ASSEMBLYAI_API_KEY 設置正確
- [ ] GEMINI_API_KEY 配置有效
- [ ] DATABASE_URL 連接正常
- [ ] SESSION_SECRET 安全性充足

### 依賴服務
- [ ] PostgreSQL 連接正常
- [ ] AssemblyAI API 可訪問
- [ ] Gemini AI API 回應正常
- [ ] 檔案存儲系統正常

## 🚨 關鍵問題檢查

### 已修復問題驗證
- [ ] ✅ 無自動API輪詢導致頁面卡死
- [ ] ✅ 上傳請求包含認證header
- [ ] ✅ AI分析處理segments資料結構
- [ ] ✅ 分段功能提取講者資料成功
- [ ] ✅ Duration和confidence正確顯示

### 錯誤狀況測試
- [ ] 無效token處理
- [ ] 網路中斷恢復
- [ ] 大檔案處理
- [ ] API限制處理

## 📝 測試報告模板

```
測試日期: ___________
測試人員: ___________
系統版本: ___________

功能測試結果:
□ 檔案上傳: 通過/失敗
□ 錄音功能: 通過/失敗  
□ 轉錄處理: 通過/失敗
□ AI分析: 通過/失敗
□ 分段功能: 通過/失敗

問題記錄:
________________

建議改進:
________________

整體評估: 通過/需要修復
```

## 🔄 自動化測試腳本

### 快速驗證腳本
```bash
#!/bin/bash
# 系統健康檢查腳本

echo "檢查API健康狀態..."
curl -f http://localhost:5000/api/health || echo "❌ API異常"

echo "檢查認證端點..."
curl -f http://localhost:5000/api/auth/me || echo "❌ 認證異常"

echo "檢查資料庫連接..."
curl -f http://localhost:5000/api/transcriptions || echo "❌ 資料庫異常"

echo "✅ 系統檢查完成"
```

## 📋 每次更新後必須測試的項目

1. **上傳功能** - 確保認證header存在
2. **AI分析** - 驗證segments資料處理
3. **分段功能** - 檢查講者提取邏輯
4. **頁面刷新** - 確認無自動輪詢
5. **元數據顯示** - 驗證duration/confidence顯示

---
**重要**: 每次系統更新後務必執行完整測試，確保所有功能正常運作。