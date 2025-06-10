# 生產環境部署指南

## JSON解析錯誤解決方案

### 問題背景
在生產環境中可能出現"Unexpected token '<'"錯誤，通常由以下原因引起：
1. 伺服器返回HTML錯誤頁面而非JSON
2. 認證token在不同網域下失效
3. 內容類型標頭配置錯誤

### 解決方案實施

#### 1. 前端錯誤處理增強
- 實施ProductionErrorHandler專用錯誤處理器
- 安全的JSON解析機制
- HTML錯誤頁面檢測和處理
- 友善的錯誤訊息顯示

#### 2. 認證機制強化
- 自動清除無效token
- 優雅的重新登入流程
- 延遲重新導向避免阻塞

#### 3. 網路錯誤處理
- 網路連線失敗檢測
- 適當的錯誤訊息回饋
- 重試機制建議

### 部署前檢查清單

#### API配置檢查
```bash
# 確認API端點正確運作
curl -I https://your-domain.com/api/auth/me

# 檢查JSON回應格式
curl https://your-domain.com/api/transcriptions \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 內容類型檢查
- 確保所有API端點返回正確的Content-Type: application/json
- 檢查錯誤頁面配置，避免返回HTML到API端點
- 驗證CORS設定正確配置

#### 認證流程測試
- 測試token過期處理
- 驗證跨網域認證功能
- 確認登出重新導向正常

### 生產環境特殊配置

#### 1. 伺服器配置
```nginx
# Nginx配置範例
location /api/ {
    proxy_pass http://backend;
    proxy_set_header Content-Type application/json;
    
    # 錯誤頁面處理
    error_page 404 = @api_404;
    error_page 500 = @api_500;
}

location @api_404 {
    return 404 '{"message":"API端點不存在"}';
    add_header Content-Type application/json;
}

location @api_500 {
    return 500 '{"message":"伺服器內部錯誤"}';
    add_header Content-Type application/json;
}
```

#### 2. 環境變數設置
確保以下環境變數正確設置：
- NODE_ENV=production
- API基礎URL
- 認證配置
- CORS允許的網域

### 監控和調試

#### 1. 錯誤監控
- 設置錯誤日誌收集
- 監控API回應時間
- 追蹤認證失敗率

#### 2. 除錯工具
- 瀏覽器開發者工具網路標籤
- 檢查API回應標頭
- 驗證JSON格式正確性

### 常見問題解決

#### Q: 仍然出現JSON解析錯誤
A: 檢查以下項目：
1. API端點是否返回HTML錯誤頁面
2. Content-Type標頭是否正確設置
3. 認證token是否有效

#### Q: 認證在生產環境失效
A: 確認：
1. CORS配置包含生產網域
2. Token存儲機制在HTTPS下正常運作
3. Session配置適用於生產環境

#### Q: 部分功能在生產環境異常
A: 檢查：
1. 環境變數是否完整設置
2. 靜態資源路徑是否正確
3. API基礎URL配置

### 緊急修復步驟

如果在生產環境遇到緊急JSON解析錯誤：

1. **立即檢查**
```bash
# 檢查API狀態
curl -I https://your-domain.com/api/auth/me

# 檢查錯誤回應
curl https://your-domain.com/api/transcriptions
```

2. **臨時修復**
- 清除瀏覽器快取和localStorage
- 重新登入系統
- 檢查網路連線

3. **永久解決**
- 更新錯誤處理機制
- 修復伺服器配置
- 部署修復版本

### 版本更新注意事項

更新系統時務必：
1. 備份現有配置
2. 測試所有API端點
3. 驗證認證流程
4. 檢查錯誤處理機制
5. 監控部署後狀態

此指南將持續更新，確保生產環境穩定運行。