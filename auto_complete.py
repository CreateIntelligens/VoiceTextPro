#!/usr/bin/env python3
import os
import time
import requests
import threading
from datetime import datetime

def monitor_and_complete():
    """Monitor transcription and auto-complete when ready"""
    api_key = os.getenv("ASSEMBLYAI_API_KEY", "0f0da6a87ee34439b8188dc991414cca")
    transcript_id = "24524522-0347-407c-ab44-a8d4c1a9a259"
    db_id = 19
    
    for attempt in range(60):  # Check for 30 minutes
        try:
            headers = {"Authorization": api_key}
            response = requests.get(
                f"https://api.assemblyai.com/v2/transcript/{transcript_id}",
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                status = data.get("status")
                
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Status: {status}")
                
                if status == "completed":
                    print("轉錄完成，正在處理結果...")
                    
                    # Process results
                    speakers = []
                    segments = []
                    
                    if data.get("utterances"):
                        speaker_colors = ["hsl(220, 70%, 50%)", "hsl(120, 70%, 50%)", 
                                        "hsl(0, 70%, 50%)", "hsl(280, 70%, 50%)"]
                        
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
                    
                    # Update database
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
                        'assemblyaiId': transcript_id
                    }
                    
                    update_response = requests.patch(
                        f'http://localhost:5000/api/transcriptions/{db_id}',
                        json=update_data,
                        headers={'Content-Type': 'application/json'},
                        timeout=30
                    )
                    
                    if update_response.status_code == 200:
                        print("轉錄完成並成功更新到資料庫！")
                        return True
                    else:
                        print(f"資料庫更新失敗: {update_response.status_code}")
                        
                elif status == "error":
                    error_msg = data.get("error", "轉錄失敗")
                    print(f"轉錄失敗: {error_msg}")
                    
                    requests.patch(
                        f'http://localhost:5000/api/transcriptions/{db_id}',
                        json={'status': 'error', 'errorMessage': error_msg},
                        headers={'Content-Type': 'application/json'},
                        timeout=10
                    )
                    return False
                else:
                    # Update progress
                    progress = min(50 + (attempt * 2), 95)
                    requests.patch(
                        f'http://localhost:5000/api/transcriptions/{db_id}',
                        json={'progress': progress},
                        headers={'Content-Type': 'application/json'},
                        timeout=10
                    )
            
        except Exception as e:
            print(f"檢查錯誤: {e}")
        
        time.sleep(30)  # Wait 30 seconds between checks
    
    return False

if __name__ == "__main__":
    monitor_and_complete()