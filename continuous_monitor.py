#!/usr/bin/env python3
import os
import time
import requests
import json
import sys
from datetime import datetime

def check_and_update_transcription():
    """Check and update transcription 19"""
    api_key = os.getenv("ASSEMBLYAI_API_KEY", "0f0da6a87ee34439b8188dc991414cca")
    transcript_id = "24524522-0347-407c-ab44-a8d4c1a9a259"
    db_id = 19
    
    headers = {"Authorization": api_key}
    
    try:
        response = requests.get(
            f"https://api.assemblyai.com/v2/transcript/{transcript_id}",
            headers=headers,
            timeout=10
        )
        
        if response.status_code != 200:
            print(f"API error: {response.status_code}")
            return False
            
        data = response.json()
        status = data.get("status")
        print(f"AssemblyAI Status: {status}")
        
        if status == "completed":
            print("轉錄完成！正在更新數據庫...")
            
            # Process speakers and segments
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
            
            # Prepare update data
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
            
            response = requests.patch(
                f'http://localhost:5000/api/transcriptions/{db_id}',
                json=update_data,
                headers={'Content-Type': 'application/json'},
                timeout=30
            )
            
            if response.status_code == 200:
                print("數據庫更新成功！")
                return True
            else:
                print(f"數據庫更新失敗: {response.status_code}")
                print(f"Response: {response.text}")
                return False
                
        elif status == "error":
            error_msg = data.get("error", "轉錄過程中發生錯誤")
            print(f"轉錄失敗: {error_msg}")
            
            requests.patch(
                f'http://localhost:5000/api/transcriptions/{db_id}',
                json={'status': 'error', 'errorMessage': error_msg},
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            return False
        else:
            print(f"轉錄仍在處理中...")
            # Update progress gradually
            current_time = time.time()
            start_time = 1749027322  # Approximate start time
            elapsed_minutes = (current_time - start_time) / 60
            
            # Progressive progress update
            if elapsed_minutes < 5:
                progress = min(50 + int(elapsed_minutes * 5), 70)
            else:
                progress = min(70 + int((elapsed_minutes - 5) * 2), 90)
            
            requests.patch(
                f'http://localhost:5000/api/transcriptions/{db_id}',
                json={'progress': progress},
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            return None
            
    except Exception as e:
        print(f"檢查狀態時發生錯誤: {e}")
        return None

if __name__ == "__main__":
    print(f"開始監控轉錄 - {datetime.now().strftime('%H:%M:%S')}")
    result = check_and_update_transcription()
    
    if result is True:
        print("轉錄完成並更新成功！")
        sys.exit(0)
    elif result is False:
        print("轉錄失敗")
        sys.exit(1)
    else:
        print("轉錄仍在進行中")
        sys.exit(2)