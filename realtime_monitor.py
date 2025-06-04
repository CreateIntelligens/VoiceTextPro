#!/usr/bin/env python3
import os
import time
import requests
import json
from datetime import datetime
import threading

class RealtimeMonitor:
    def __init__(self):
        self.api_key = os.getenv("ASSEMBLYAI_API_KEY", "0f0da6a87ee34439b8188dc991414cca")
        self.transcript_id = "24524522-0347-407c-ab44-a8d4c1a9a259"
        self.db_id = 19
        self.running = True
        
    def check_status(self):
        """Check transcription status every 15 seconds"""
        while self.running:
            try:
                headers = {"Authorization": self.api_key}
                response = requests.get(
                    f"https://api.assemblyai.com/v2/transcript/{self.transcript_id}",
                    headers=headers,
                    timeout=10
                )
                
                if response.status_code == 200:
                    data = response.json()
                    status = data.get("status")
                    
                    current_time = datetime.now().strftime('%H:%M:%S')
                    print(f"[{current_time}] AssemblyAI Status: {status}")
                    
                    if status == "completed":
                        print("轉錄完成！正在處理結果...")
                        self.process_completed_transcription(data)
                        self.running = False
                        break
                    elif status == "error":
                        error_msg = data.get("error", "轉錄失敗")
                        print(f"轉錄失敗: {error_msg}")
                        self.update_error_status(error_msg)
                        self.running = False
                        break
                    else:
                        # Update progress
                        progress = min(70 + (time.time() % 30), 95)
                        self.update_progress(int(progress))
                
            except Exception as e:
                print(f"監控錯誤: {e}")
            
            time.sleep(15)  # Check every 15 seconds
    
    def process_completed_transcription(self, data):
        """Process completed transcription and update database"""
        try:
            speakers = []
            segments = []
            
            # Process speakers and segments
            if data.get("utterances"):
                speaker_colors = [
                    "hsl(220, 70%, 50%)",  # Blue
                    "hsl(120, 70%, 50%)",  # Green  
                    "hsl(0, 70%, 50%)",    # Red
                    "hsl(280, 70%, 50%)",  # Purple
                    "hsl(45, 70%, 50%)",   # Orange
                    "hsl(180, 70%, 50%)"   # Cyan
                ]
                
                for utterance in data["utterances"]:
                    speaker_id = f"Speaker {utterance['speaker']}"
                    
                    # Add speaker if not exists
                    if not any(s['id'] == speaker_id for s in speakers):
                        color_index = len(speakers) % len(speaker_colors)
                        speakers.append({
                            'id': speaker_id,
                            'label': speaker_id,
                            'color': speaker_colors[color_index]
                        })
                    
                    # Format timestamp
                    start_ms = utterance['start']
                    minutes = start_ms // 60000
                    seconds = (start_ms % 60000) // 1000
                    timestamp = f"{minutes:02d}:{seconds:02d}"
                    
                    # Add segment
                    segments.append({
                        'text': utterance['text'],
                        'speaker': speaker_id,
                        'start': utterance['start'],
                        'end': utterance['end'],
                        'confidence': round(utterance.get('confidence', 0.95), 2),
                        'timestamp': timestamp
                    })
            
            # Prepare update data
            confidence_val = data.get('confidence')
            confidence_int = int(round(confidence_val * 100)) if confidence_val else None
            
            text_content = data.get('text', '')
            word_count = len(text_content.split()) if text_content else 0
            
            update_data = {
                'status': 'completed',
                'progress': 100,
                'transcriptText': text_content,
                'confidence': confidence_int,
                'duration': data.get('audio_duration'),
                'wordCount': word_count,
                'speakers': speakers,
                'segments': segments,
                'assemblyaiId': self.transcript_id
            }
            
            # Update database
            update_response = requests.patch(
                f'http://localhost:5000/api/transcriptions/{self.db_id}',
                json=update_data,
                headers={'Content-Type': 'application/json'},
                timeout=30
            )
            
            if update_response.status_code == 200:
                print("✅ 轉錄完成並成功更新到資料庫！")
                print(f"📊 文字長度: {len(text_content)} 字元")
                print(f"🎯 識別信心度: {confidence_int}%")
                print(f"👥 說話者數量: {len(speakers)}")
                print(f"📝 總字數: {word_count}")
                return True
            else:
                print(f"❌ 資料庫更新失敗: {update_response.status_code}")
                print(update_response.text)
                return False
                
        except Exception as e:
            print(f"❌ 處理完成轉錄時發生錯誤: {e}")
            return False
    
    def update_progress(self, progress):
        """Update progress in database"""
        try:
            requests.patch(
                f'http://localhost:5000/api/transcriptions/{self.db_id}',
                json={'progress': progress},
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
        except Exception as e:
            print(f"進度更新錯誤: {e}")
    
    def update_error_status(self, error_msg):
        """Update error status in database"""
        try:
            requests.patch(
                f'http://localhost:5000/api/transcriptions/{self.db_id}',
                json={'status': 'error', 'errorMessage': error_msg},
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
        except Exception as e:
            print(f"錯誤狀態更新失敗: {e}")

def main():
    print("🚀 啟動即時轉錄監控系統...")
    monitor = RealtimeMonitor()
    
    try:
        monitor.check_status()
    except KeyboardInterrupt:
        print("\n⏹️ 監控系統已停止")
        monitor.running = False

if __name__ == "__main__":
    main()