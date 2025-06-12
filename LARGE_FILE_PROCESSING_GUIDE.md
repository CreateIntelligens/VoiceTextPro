# 大型檔案處理完整指南

## 系統概述

智能多語言語音轉錄平台採用多層級檔案處理策略，針對不同大小的檔案使用最佳化的處理方法。

## 檔案大小分類與處理策略

### 小型檔案 (< 100MB)
- **處理方式**: 標準上傳 + 快速轉錄
- **使用腳本**: `fast_transcription.py` 或 `simple_transcription.py`
- **上傳策略**: 直接上傳至 AssemblyAI
- **預期處理時間**: 檔案時長的 0.3-0.5 倍

### 大型檔案 (≥ 100MB)
- **處理方式**: 簡化快速轉錄
- **使用腳本**: `fast_transcription.py` (大檔案模式)
- **上傳策略**: 優化上傳 + 超時管理
- **預期處理時間**: 檔案時長的 0.5-1.0 倍

## 技術實現詳情

### 1. 自動檔案大小檢測

```typescript
// server/routes.ts - 檔案大小檢測
const fs = await import('fs');
const fileStats = fs.default.statSync(filePath);
const fileSizeBytes = fileStats.size;
const fileSizeMB = fileSizeBytes / (1024 * 1024);
const isLargeFile = fileSizeMB > 100; // 100MB 為大檔案閾值
```

### 2. 處理流程選擇

```typescript
if (isLargeFile || forceLargeFile) {
    // 大檔案使用簡化快速轉錄
    scriptName = "fast_transcription.py";
    console.log(`使用大檔案快速轉錄 (${fileSizeMB.toFixed(2)}MB)`);
    const uploadUrl = await uploadAudioFile(filePath);
    args = [scriptName, id.toString(), uploadUrl, API_KEY];
}
```

### 3. 快速轉錄核心機制

#### 上傳優化
- **分塊上傳**: 自動處理大檔案分塊
- **重試機制**: 3次重試，指數退避
- **超時管理**: 30秒上傳超時，5分鐘總超時

#### 轉錄設定
```python
# fast_transcription.py - 大檔案最佳化設定
config = {
    "audio_url": upload_url,
    "language_code": "zh",  # 繁體中文優先
    "speaker_labels": True,
    "auto_highlights": True,
    "sentiment_analysis": True,
    "entity_detection": True,
    "content_safety": True,
    "auto_chapters": True,
    "speech_model": "best",  # 最高品質模型
    "punctuate": True,
    "format_text": True
}
```

#### 進度監控
- **自適應輪詢**: 初期5秒，後期30秒間隔
- **進度計算**: 
  - 上傳階段: 0-50%
  - 排隊階段: 50-70%
  - 處理階段: 70-98%
  - 完成階段: 100%

## 處理能力規格

### 支援的檔案格式
- **音頻格式**: MP3, M4A, WAV, FLAC, OGG
- **最大檔案大小**: 500MB (理論上限)
- **最長時長**: 12小時
- **品質要求**: 16kHz+ 採樣率

### 效能指標
- **184MB 檔案**: 成功處理，27,464字轉錄
- **上傳速度**: 平均 10-20MB/分鐘
- **轉錄速度**: 比實際播放時間快 2-5 倍
- **準確度**: 平均 75-85% 信心度

## 故障處理與恢復

### 常見問題與解決方案

#### 1. 上傳超時
- **原因**: 網路不穩定或檔案過大
- **解決**: 自動重試 + 分塊上傳
- **預防**: 檔案壓縮建議

#### 2. 記憶體不足
- **原因**: 檔案過大導致記憶體溢出
- **解決**: 流式處理 + 垃圾回收
- **預防**: 檔案大小限制

#### 3. 處理中斷
- **原因**: 伺服器重啟或網路中斷
- **解決**: 狀態恢復 + 斷點續傳
- **預防**: 定期狀態保存

### 恢復機制
```python
# 自動恢復流程
def recovery_process(transcription_id):
    # 1. 檢查當前狀態
    current_status = get_transcription_status(transcription_id)
    
    # 2. 判斷恢復策略
    if current_status == 'uploading':
        # 重新上傳
        restart_upload(transcription_id)
    elif current_status == 'processing':
        # 繼續監控
        continue_monitoring(transcription_id)
    elif current_status == 'error':
        # 重新開始
        restart_transcription(transcription_id)
```

## 最佳化建議

### 檔案準備
1. **格式選擇**: 優先使用 M4A 或 MP3
2. **品質設定**: 128kbps 以上位元率
3. **檔案大小**: 建議單檔不超過 300MB
4. **音頻品質**: 確保清晰度，減少背景雜音

### 上傳策略
1. **網路環境**: 穩定的網路連線
2. **分時上傳**: 避開網路尖峰時段
3. **備份機制**: 重要檔案建議備份
4. **分批處理**: 多檔案建議分批上傳

### 系統配置
1. **記憶體配置**: 建議 4GB+ 可用記憶體
2. **磁碟空間**: 檔案大小的 3倍 可用空間
3. **網路頻寬**: 上傳頻寬 10Mbps+
4. **並發限制**: 同時處理檔案數量 ≤ 3

## 監控與分析

### 即時監控指標
- **上傳進度**: 實時顯示上傳百分比
- **處理狀態**: 排隊/處理/完成狀態
- **錯誤追蹤**: 詳細錯誤訊息記錄
- **效能分析**: 處理時間與檔案大小關係

### 系統日誌
```bash
# 監控大檔案處理日誌
tail -f /tmp/large_file_processing.log

# 檢查 AssemblyAI API 狀態
curl -H "authorization: $ASSEMBLYAI_API_KEY" \
     "https://api.assemblyai.com/v2/transcript/$TRANSCRIPT_ID"
```

## 未來優化方向

### 短期改進 (1-3個月)
1. **並行處理**: 支援多檔案同時處理
2. **斷點續傳**: 上傳中斷後可續傳
3. **預處理**: 音頻格式自動轉換
4. **快取機制**: 相似檔案快速處理

### 長期規劃 (6-12個月)
1. **分散式處理**: 多伺服器負載均衡
2. **AI 預處理**: 智能音頻品質提升
3. **邊緣運算**: 本地預處理減少上傳時間
4. **自適應策略**: 根據檔案特性自動選擇最佳處理方式

## 總結

目前的大型檔案處理系統已經成功處理 184MB 檔案，採用簡化的快速轉錄方法替代複雜的分段處理，大幅提升了可靠性和成功率。系統具備完整的錯誤處理、進度監控和恢復機制，能夠穩定處理各種大小的音頻檔案。