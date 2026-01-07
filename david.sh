# 1. 複製環境變數
cp .env.example .env

# 2. 編輯 .env，填入必要配置
nano .env

# 3. 啟動所有服務（包含 PostgreSQL）
docker compose up -d

# 4. 初始化資料庫
docker compose exec app npm run db:push

# 5. 查看日誌
docker compose logs -fhttps://console.cloud.google.com/billing/01B5E4-8A7ADB-4D3FDD/reports;timeRange=LAST_MONTH?authuser=0&hl=zh-tw&organizationId=309371292219&project=wonderland-nft

# Google Cloud 設定步驟

# 1. 啟用 API
gcloud services enable speech.googleapis.com
gcloud services enable storage.googleapis.com
gcloud services enable aiplatform.googleapis.com

# 2. 建立服務帳號
gcloud iam service-accounts create voicetextpro-service \
    --display-name="VoiceTextPro Service Account"

# 3. 授予權限
PROJECT_ID=$(gcloud config get-value project)
SERVICE_ACCOUNT="voicetextpro-service@${PROJECT_ID}.iam.gserviceaccount.com"

# 重要：授予專案級別的 Storage Admin 權限
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/storage.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/speech.client"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/aiplatform.user"

# 或者只為特定 Bucket 授權（如果 Bucket 已存在）
# gsutil iam ch serviceAccount:voicetextpro-service@wonderland-nft.iam.gserviceaccount.com:roles/storage.objectAdmin gs://voicetextpro-audio-temp

# 確保 Bucket 存在
gsutil ls gs://voicetextpro-audio-temp || gsutil mb -p wonderland-nft -l us-central1 gs://voicetextpro-audio-temp

# 4. 建立金鑰
gcloud iam service-accounts keys create google-credentials.json \
    --iam-account=$SERVICE_ACCOUNT

# 6. 設定自動清理（7天後刪除暫存檔）
echo '{"lifecycle":{"rule":[{"action":{"type":"Delete"},"condition":{"age":7}}]}}' > lifecycle.json
gsutil lifecycle set lifecycle.json gs://voicetextpro-audio-temp



##

# 情況一：更新代碼（保留資料庫）
# ====================================
# 停止並移除現有容器（保留 volumes/資料庫）
docker compose down

# 重新構建並啟動
docker compose up -d --build

# 查看啟動日誌
docker compose logs -f app


# 情況二：完全重置（清空資料庫）
# ====================================
# 停止並移除所有容器和 volumes（會刪除資料庫資料！）
docker compose down -v

# 重新構建並啟動
docker compose up -d --build

# 等待資料庫和應用啟動
sleep 5

# 初始化資料庫 schema（創建表結構）
docker compose exec app npm run db:push

# 重啟應用容器（讓它創建管理員帳號）
docker compose restart app

# 查看啟動日誌（應該會看到 "Admin user created"）
docker compose logs -f app


```
docker compose down -v
docker compose up -d --build     
sleep 5
docker compose exec app npm run db:push
docker compose restart app         
docker compose logs -f app
```