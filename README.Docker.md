# Docker 部署指南

## 快速開始

### 1. 準備環境變數

```bash
# 複製環境變數範本
cp .env.example .env

# 編輯 .env 檔案，填入必要的配置
nano .env
```

### 2. 準備 Google Cloud 憑證

將 Google Cloud 服務帳戶的 JSON 憑證檔案放在專案根目錄，並在 `.env` 中設定路徑：

```env
GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json
```

### 3. 啟動服務

```bash
# 使用 docker-compose 啟動所有服務
docker-compose up -d

# 查看日誌
docker-compose logs -f app

# 查看所有容器狀態
docker-compose ps
```

### 4. 初始化資料庫

```bash
# 進入應用容器
docker-compose exec app sh

# 執行資料庫遷移
npm run db:push

# 退出容器
exit
```

### 5. 存取應用

開啟瀏覽器訪問：`http://localhost:5000`

---

## 常用指令

### 啟動服務
```bash
docker-compose up -d
```

### 停止服務
```bash
docker-compose down
```

### 重啟服務
```bash
docker-compose restart
```

### 查看日誌
```bash
# 所有服務
docker-compose logs -f

# 僅應用
docker-compose logs -f app

# 僅資料庫
docker-compose logs -f db
```

### 進入容器
```bash
# 進入應用容器
docker-compose exec app sh

# 進入資料庫容器
docker-compose exec db psql -U postgres -d voicetextpro
```

### 重新構建映像
```bash
# 重新構建並啟動
docker-compose up -d --build

# 僅重新構建
docker-compose build
```

### 清理資源
```bash
# 停止並刪除容器
docker-compose down

# 停止並刪除容器、網路、卷
docker-compose down -v

# 清理未使用的映像
docker image prune -a
```

---

## 僅使用 Dockerfile（不使用 docker-compose）

### 1. 準備外部資料庫

確保有可用的 PostgreSQL 資料庫，並獲取連接字串。

### 2. 構建映像

```bash
docker build -t voicetextpro:latest .
```

### 3. 運行容器

```bash
docker run -d \
  --name voicetextpro \
  -p 5000:5000 \
  -e DATABASE_URL="postgresql://user:password@host:5432/dbname" \
  -e GOOGLE_CLOUD_PROJECT_ID="your-project-id" \
  -e GEMINI_API_KEY="your-api-key" \
  -e SENDGRID_API_KEY="your-sendgrid-key" \
  -e SESSION_SECRET="your-secret" \
  -v $(pwd)/google-credentials.json:/app/credentials/google-credentials.json:ro \
  -v voicetextpro-uploads:/app/uploads \
  voicetextpro:latest
```

---

## 生產環境部署

### GCP Cloud Run 部署

1. **構建並推送映像到 GCR**

```bash
# 設定專案
gcloud config set project YOUR_PROJECT_ID

# 構建映像
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/voicetextpro

# 或使用本地 Docker 構建
docker build -t gcr.io/YOUR_PROJECT_ID/voicetextpro .
docker push gcr.io/YOUR_PROJECT_ID/voicetextpro
```

2. **部署到 Cloud Run**

```bash
gcloud run deploy voicetextpro \
  --image gcr.io/YOUR_PROJECT_ID/voicetextpro \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "DATABASE_URL=postgresql://...,GOOGLE_CLOUD_PROJECT_ID=..." \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --max-instances 10
```

### GCP Compute Engine (VM) 部署

1. **SSH 連接到 VM**

```bash
gcloud compute ssh YOUR_VM_NAME
```

2. **安裝 Docker 和 Docker Compose**

```bash
# 安裝 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 安裝 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

3. **複製專案並部署**

```bash
# 克隆專案
git clone YOUR_REPO_URL
cd VoiceTextPro

# 配置環境變數
nano .env

# 啟動服務
docker-compose up -d
```

---

## 環境變數說明

| 變數名稱 | 必要性 | 說明 |
|---------|-------|------|
| `DATABASE_URL` | ✅ 必要 | PostgreSQL 連接字串 |
| `GOOGLE_CLOUD_PROJECT_ID` | ✅ 必要 | Google Cloud 專案 ID |
| `GOOGLE_APPLICATION_CREDENTIALS` | ✅ 必要 | Google Cloud 憑證檔案路徑 |
| `GOOGLE_CLOUD_STORAGE_BUCKET` | ✅ 必要 | Cloud Storage 儲存桶名稱 |
| `GEMINI_API_KEY` | ✅ 必要 | Gemini AI API 金鑰 |
| `SENDGRID_API_KEY` | ✅ 必要 | SendGrid 郵件服務金鑰 |
| `SESSION_SECRET` | ✅ 必要 | Session 加密密鑰 |
| `APP_URL` | 建議 | 應用程式 URL |
| `NODE_ENV` | 建議 | 運行環境 (production/development) |
| `PORT` | 選填 | 應用程式埠號 (預設: 5000) |

---

## 疑難排解

### 容器無法啟動

```bash
# 查看詳細日誌
docker-compose logs app

# 檢查容器狀態
docker-compose ps
```

### 資料庫連接失敗

1. 確認 `DATABASE_URL` 格式正確
2. 檢查資料庫容器是否正常運行：`docker-compose ps db`
3. 測試資料庫連接：
   ```bash
   docker-compose exec db psql -U postgres -d voicetextpro -c "SELECT 1;"
   ```

### Google Cloud 憑證問題

1. 確認 JSON 檔案路徑正確
2. 檢查容器內的憑證：
   ```bash
   docker-compose exec app cat /app/credentials/google-credentials.json
   ```
3. 驗證服務帳戶權限是否足夠

### Python 腳本執行失敗

```bash
# 進入容器檢查 Python 環境
docker-compose exec app python3 --version
docker-compose exec app pip3 list
```

---

## 效能優化建議

1. **使用多階段建構** - 已在 Dockerfile 中實現，減少映像大小
2. **健康檢查** - 已配置，確保服務可用性
3. **資源限制** - 根據需求調整 `docker-compose.yml` 中的資源配置
4. **持久化卷** - 使用 named volumes 儲存資料庫和上傳檔案

---

## 安全建議

1. ✅ 不要將 `.env` 檔案提交到版本控制
2. ✅ 使用強隨機字串作為 `SESSION_SECRET`
3. ✅ 定期更新基礎映像和依賴套件
4. ✅ 限制容器的網路存取
5. ✅ 使用唯讀掛載 Google Cloud 憑證
6. ✅ 定期備份資料庫卷
