#!/usr/bin/env python3
"""
完整大檔案轉錄監控和處理系統
"""

import os
import time
import requests
import psycopg2
import subprocess
from datetime import datetime

class CompleteLargeFileProcessor:
    def __init__(self, transcription_id):
        self.transcription_id = transcription_id
        self.api_key = os.environ.get('ASSEMBLYAI_API_KEY')
        self.db_url = os.environ.get('DATABASE_URL')
        self.headers = {'authorization': self.api_key, 'content-type': 'application/json'}
        self.upload_headers = {'authorization': self.api_key}
        
    def log(self, message):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] [ID-{self.transcription_id}] {message}")
        
    def update_progress(self, progress, status=None):
        try:
            conn = psycopg2.connect(self.db_url)
            cur = conn.cursor()
            if status:
                cur.execute(
                    "UPDATE transcriptions SET progress = %s, status = %s, updated_at = NOW() WHERE id = %s",
                    (progress, status, self.transcription_id)
                )
            else:
                cur.execute(
                    "UPDATE transcriptions SET progress = %s, updated_at = NOW() WHERE id = %s",
                    (progress, self.transcription_id)
                )
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            self.log(f"進度更新失敗: {e}")
            return False
            
    def update_assemblyai_id(self, assemblyai_id):
        try:
            conn = psycopg2.connect(self.db_url)
            cur = conn.cursor()
            cur.execute(
                "UPDATE transcriptions SET assemblyai_id = %s WHERE id = %s",
                (assemblyai_id, self.transcription_id)
            )
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            self.log(f"AssemblyAI ID更新失敗: {e}")
            return False
            
    def upload_file(self, file_path):
        self.log(f"上傳檔案: {file_path}")
        
        # 檢查檔案大小
        file_size = os.path.getsize(file_path)
        file_size_mb = file_size / (1024 * 1024)
        self.log(f"檔案大小: {file_size_mb:.1f}MB")
        
        try:
            with open(file_path, 'rb') as f:
                response = requests.post(
                    'https://api.assemblyai.com/v2/upload',
                    headers=self.upload_headers,
                    files={'file': f},
                    timeout=3600  # 1小時超時
                )
            
            if response.status_code == 200:
                upload_url = response.json()['upload_url']
                self.log("檔案上傳成功")
                return upload_url
            else:
                self.log(f"上傳失敗: {response.status_code}")
                return None
                
        except Exception as e:
            self.log(f"上傳錯誤: {e}")
            return None
    
    def start_transcription(self, audio_url):
        self.log("啟動轉錄任務")
        
        config = {
            'audio_url': audio_url,
            'language_code': 'zh',
            'speaker_labels': True,
            'speakers_expected': 2,
            'punctuate': True,
            'format_text': True,
            'disfluencies': False
        }
        
        try:
            response = requests.post(
                'https://api.assemblyai.com/v2/transcript',
                json=config,
                headers=self.headers,
                timeout=120
            )
            
            if response.status_code == 200:
                data = response.json()
                assemblyai_id = data['id']
                self.log(f"轉錄已啟動: {assemblyai_id}")
                return assemblyai_id
            else:
                self.log(f"轉錄啟動失敗: {response.status_code}")
                self.log(f"錯誤詳情: {response.text}")
                return None
                
        except Exception as e:
            self.log(f"轉錄啟動錯誤: {e}")
            return None
    
    def monitor_transcription(self, assemblyai_id):
        self.log(f"開始監控轉錄: {assemblyai_id}")
        
        start_time = time.time()
        max_wait_time = 7200  # 2小時最大等待時間
        check_interval = 30   # 30秒檢查間隔
        
        while time.time() - start_time < max_wait_time:
            try:
                response = requests.get(
                    f'https://api.assemblyai.com/v2/transcript/{assemblyai_id}',
                    headers=self.headers,
                    timeout=30
                )
                
                if response.status_code == 200:
                    data = response.json()
                    status = data.get('status')
                    
                    self.log(f"轉錄狀態: {status}")
                    
                    if status == 'completed':
                        self.log("轉錄完成！")
                        return data
                    elif status == 'error':
                        error_msg = data.get('error', 'Unknown error')
                        self.log(f"轉錄失敗: {error_msg}")
                        return None
                    else:
                        # 根據狀態更新進度
                        if status == 'queued':
                            progress = 85
                        elif status == 'processing':
                            progress = 90
                        else:
                            progress = 85
                        
                        self.update_progress(progress)
                
            except Exception as e:
                self.log(f"狀態檢查錯誤: {e}")
            
            time.sleep(check_interval)
        
        self.log("轉錄監控超時")
        return None
    
    def save_transcription_result(self, transcript_data):
        self.log("保存轉錄結果")
        
        try:
            # 提取基本信息
            text = transcript_data.get('text', '')
            word_count = len(text.split()) if text else 0
            duration = transcript_data.get('audio_duration', 0)
            
            # 處理對話者標籤
            utterances = transcript_data.get('utterances', [])
            segments_data = []
            
            for utterance in utterances:
                segment = {
                    'speaker': utterance.get('speaker', 'Unknown'),
                    'text': utterance.get('text', ''),
                    'start': utterance.get('start', 0),
                    'end': utterance.get('end', 0),
                    'confidence': utterance.get('confidence', 0)
                }
                segments_data.append(segment)
            
            # 更新資料庫
            conn = psycopg2.connect(self.db_url)
            cur = conn.cursor()
            
            cur.execute("""
                UPDATE transcriptions 
                SET text = %s, 
                    word_count = %s, 
                    duration = %s,
                    segments = %s,
                    status = 'completed',
                    progress = 100,
                    completed_at = NOW(),
                    updated_at = NOW()
                WHERE id = %s
            """, (text, word_count, duration, str(segments_data), self.transcription_id))
            
            conn.commit()
            conn.close()
            
            self.log(f"轉錄結果已保存: {word_count} 詞, {duration/1000:.1f}秒, {len(segments_data)} 段落")
            return True
            
        except Exception as e:
            self.log(f"結果保存錯誤: {e}")
            return False
    
    def process_complete_file(self, file_path):
        self.log("開始完整檔案轉錄處理")
        
        # 步驟1: 上傳檔案
        self.update_progress(75)
        upload_url = self.upload_file(file_path)
        if not upload_url:
            self.update_progress(0, 'error')
            return False
        
        # 步驟2: 啟動轉錄
        self.update_progress(80)
        assemblyai_id = self.start_transcription(upload_url)
        if not assemblyai_id:
            self.update_progress(0, 'error')
            return False
        
        # 步驟3: 更新AssemblyAI ID
        self.update_assemblyai_id(assemblyai_id)
        self.update_progress(85)
        
        # 步驟4: 監控轉錄完成
        result = self.monitor_transcription(assemblyai_id)
        if not result:
            self.update_progress(0, 'error')
            return False
        
        # 步驟5: 保存結果
        self.update_progress(95)
        if self.save_transcription_result(result):
            self.log("大檔案轉錄處理完成")
            return True
        else:
            self.update_progress(90, 'error')
            return False

def main():
    processor = CompleteLargeFileProcessor(49)
    file_path = 'uploads/60dffd46d694231e4c071c8d334d808f'
    
    success = processor.process_complete_file(file_path)
    
    if success:
        print("大檔案轉錄成功完成")
    else:
        print("大檔案轉錄處理失敗")

if __name__ == "__main__":
    main()