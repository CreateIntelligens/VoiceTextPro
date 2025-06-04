#!/usr/bin/env python3
import os
import time
import requests
import json
import threading
from datetime import datetime

class TranscriptionWatcher:
    def __init__(self):
        self.api_key = os.getenv("ASSEMBLYAI_API_KEY", "0f0da6a87ee34439b8188dc991414cca")
        self.transcript_id = "24524522-0347-407c-ab44-a8d4c1a9a259"
        self.db_id = 19
        self.running = True
        
    def check_status(self):
        """Check transcription status"""
        try:
            headers = {"Authorization": self.api_key}
            response = requests.get(
                f"https://api.assemblyai.com/v2/transcript/{self.transcript_id}",
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                print(f"API error: {response.status_code}")
                return None
                
        except Exception as e:
            print(f"Error checking status: {e}")
            return None
    
    def update_database(self, data):
        """Update database with completed results"""
        try:
            speakers = []
            segments = []
            
            if data.get("utterances"):
                speaker_colors = ["hsl(220, 70%, 50%)", "hsl(120, 70%, 50%)", "hsl(0, 70%, 50%)", "hsl(280, 70%, 50%)"]
                
                for utterance in data["utterances"]:
                    speaker_id = f"Speaker {utterance['speaker']}"
                    
                    if not any(s['id'] == speaker_id for s in speakers):
                        color_index = len(speakers) % len(speaker_colors)
                        speakers.append({
                            'id': speaker_id,
                            'label': speaker_id,
                            'color': speaker_colors[color_index]
                        })
                    
                    start_ms = utterance['start']
                    minutes = start_ms // 60000
                    seconds = (start_ms % 60000) // 1000
                    timestamp = f"{minutes:02d}:{seconds:02d}"
                    
                    segments.append({
                        'text': utterance['text'],
                        'speaker': speaker_id,
                        'start': utterance['start'],
                        'end': utterance['end'],
                        'confidence': round(utterance.get('confidence', 0.95), 2),
                        'timestamp': timestamp
                    })
            
            confidence_val = data.get('confidence')
            confidence_int = int(round(confidence_val * 100)) if confidence_val else None
            
            update_data = {
                'status': 'completed',
                'progress': 100,
                'transcriptText': data.get('text', ''),
                'confidence': confidence_int,
                'duration': data.get('audio_duration'),
                'wordCount': len(data.get('text', '').split()) if data.get('text') else 0,
                'speakers': speakers,
                'segments': segments,
                'assemblyaiId': self.transcript_id
            }
            
            response = requests.patch(
                f'http://localhost:5000/api/transcriptions/{self.db_id}',
                json=update_data,
                headers={'Content-Type': 'application/json'},
                timeout=30
            )
            
            if response.status_code == 200:
                print("轉錄完成，數據庫已更新！")
                return True
            else:
                print(f"數據庫更新失敗: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"更新數據庫時發生錯誤: {e}")
            return False
    
    def update_progress(self, progress):
        """Update progress in database"""
        try:
            response = requests.patch(
                f'http://localhost:5000/api/transcriptions/{self.db_id}',
                json={'progress': progress},
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            return response.status_code == 200
        except:
            return False
    
    def watch(self):
        """Main monitoring loop"""
        check_count = 0
        start_time = time.time()
        
        while self.running and check_count < 120:  # Maximum 60 minutes
            check_count += 1
            elapsed_minutes = (time.time() - start_time) / 60
            
            print(f"檢查 #{check_count} - {datetime.now().strftime('%H:%M:%S')} (已經過 {elapsed_minutes:.1f} 分鐘)")
            
            data = self.check_status()
            if data:
                status = data.get("status")
                print(f"狀態: {status}")
                
                if status == "completed":
                    print("轉錄完成！")
                    if self.update_database(data):
                        self.running = False
                        break
                elif status == "error":
                    error_msg = data.get("error", "轉錄失敗")
                    print(f"轉錄失敗: {error_msg}")
                    requests.patch(
                        f'http://localhost:5000/api/transcriptions/{self.db_id}',
                        json={'status': 'error', 'errorMessage': error_msg},
                        headers={'Content-Type': 'application/json'},
                        timeout=10
                    )
                    self.running = False
                    break
                else:
                    # Update progress based on elapsed time
                    if elapsed_minutes < 10:
                        progress = min(50 + int(elapsed_minutes * 3), 80)
                    else:
                        progress = min(80 + int((elapsed_minutes - 10) * 1), 95)
                    
                    self.update_progress(progress)
                    print(f"進度更新至: {progress}%")
            
            if check_count < 120:
                time.sleep(30)  # Check every 30 seconds
        
        if check_count >= 120:
            print("監控超時，停止檢查")
            requests.patch(
                f'http://localhost:5000/api/transcriptions/{self.db_id}',
                json={'status': 'error', 'errorMessage': '轉錄超時'},
                headers={'Content-Type': 'application/json'},
                timeout=10
            )

def main():
    watcher = TranscriptionWatcher()
    watcher.watch()

if __name__ == "__main__":
    main()