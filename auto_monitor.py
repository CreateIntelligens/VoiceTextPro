#!/usr/bin/env python3
import os
import time
import requests
import json
from datetime import datetime

def check_and_update_transcription(transcript_id, db_id):
    """Check AssemblyAI status and update database"""
    api_key = os.getenv("ASSEMBLYAI_API_KEY", "0f0da6a87ee34439b8188dc991414cca")
    headers = {"Authorization": api_key}
    
    try:
        response = requests.get(
            f"https://api.assemblyai.com/v2/transcript/{transcript_id}",
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            status = data.get("status")
            print(f"[{db_id}] AssemblyAI Status: {status}")
            
            if status == "completed":
                print(f"[{db_id}] 轉錄完成！正在更新數據庫...")
                
                # Format speakers and segments
                speakers = []
                segments = []
                
                if data.get("utterances"):
                    speaker_colors = ["hsl(220, 70%, 50%)", "hsl(120, 70%, 50%)", "hsl(0, 70%, 50%)", "hsl(280, 70%, 50%)"]
                    
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
                        
                        # Add segment with proper timestamp
                        start_ms = utterance['start']
                        minutes = start_ms // 60000
                        seconds = (start_ms % 60000) // 1000
                        timestamp = f"{minutes:02d}:{seconds:02d}"
                        
                        segments.append({
                            'text': utterance['text'],
                            'speaker': speaker_id,
                            'start': utterance['start'],
                            'end': utterance['end'],
                            'confidence': utterance.get('confidence', 0.95),
                            'timestamp': timestamp
                        })
                
                # Update database
                update_data = {
                    'status': 'completed',
                    'progress': 100,
                    'transcriptText': data.get('text', ''),
                    'confidence': data.get('confidence'),
                    'duration': data.get('audio_duration'),
                    'wordCount': len(data.get('text', '').split()) if data.get('text') else 0,
                    'speakers': speakers,
                    'segments': segments,
                    'assemblyaiId': transcript_id
                }
                
                update_response = requests.patch(
                    f'http://localhost:5000/api/transcriptions/{db_id}',
                    json=update_data,
                    headers={'Content-Type': 'application/json'}
                )
                
                if update_response.status_code == 200:
                    print(f"[{db_id}] 數據庫更新成功！")
                    return True
                else:
                    print(f"[{db_id}] 數據庫更新失敗: {update_response.status_code}")
                    
            elif status == "error":
                error_msg = data.get("error", "轉錄過程中發生錯誤")
                print(f"[{db_id}] 轉錄失敗: {error_msg}")
                
                requests.patch(
                    f'http://localhost:5000/api/transcriptions/{db_id}',
                    json={'status': 'error', 'errorMessage': error_msg},
                    headers={'Content-Type': 'application/json'}
                )
                return False
                
    except Exception as e:
        print(f"[{db_id}] 檢查狀態時發生錯誤: {e}")
        
    return None

def monitor_all():
    """Monitor all active transcriptions"""
    transcriptions = [
        ("644e225b-4b31-49c4-9e24-2cbbc7ccfe16", 16),
        ("2a4a9804-63b6-4cfa-8f5d-5d3ea8c27199", 17)
    ]
    
    completed = 0
    
    for transcript_id, db_id in transcriptions:
        result = check_and_update_transcription(transcript_id, db_id)
        if result is True:
            completed += 1
    
    print(f"監控完成: {completed}/{len(transcriptions)} 個轉錄已完成")
    return completed == len(transcriptions)

if __name__ == "__main__":
    monitor_all()