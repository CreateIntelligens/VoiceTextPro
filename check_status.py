#!/usr/bin/env python3
import requests
import json
import time
import os

def check_assemblyai_status():
    """Check AssemblyAI status and update our database"""
    api_key = os.getenv("ASSEMBLYAI_API_KEY", "0f0da6a87ee34439b8188dc991414cca")
    transcript_id = "644e225b-4b31-49c4-9e24-2cbbc7ccfe16"
    
    headers = {"Authorization": api_key}
    
    try:
        # Check AssemblyAI status
        response = requests.get(
            f"https://api.assemblyai.com/v2/transcript/{transcript_id}",
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            status = data.get("status")
            print(f"AssemblyAI Status: {status}")
            
            if status == "completed":
                print("轉錄完成！正在更新數據庫...")
                
                # Format speakers and segments
                speakers = []
                segments = []
                
                if data.get("utterances"):
                    speaker_colors = ["hsl(0, 70%, 50%)", "hsl(120, 70%, 50%)", "hsl(240, 70%, 50%)", "hsl(60, 70%, 50%)"]
                    
                    for i, utterance in enumerate(data["utterances"]):
                        speaker_id = f"Speaker {utterance['speaker']}"
                        
                        # Add speaker if not exists
                        if not any(s['id'] == speaker_id for s in speakers):
                            color_index = len(speakers) % len(speaker_colors)
                            speakers.append({
                                'id': speaker_id,
                                'label': speaker_id,
                                'color': speaker_colors[color_index]
                            })
                        
                        # Add segment
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
                
                # Update our database
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
                
                # Update database via API
                update_response = requests.patch(
                    'http://localhost:5000/api/transcriptions/16',
                    json=update_data,
                    headers={'Content-Type': 'application/json'}
                )
                
                if update_response.status_code == 200:
                    print("數據庫更新成功！")
                    return True
                else:
                    print(f"數據庫更新失敗: {update_response.status_code}")
                    print(update_response.text)
                    
            elif status == "error":
                error_msg = data.get("error", "轉錄過程中發生錯誤")
                print(f"轉錄失敗: {error_msg}")
                
                # Update status to error
                requests.patch(
                    'http://localhost:5000/api/transcriptions/16',
                    json={'status': 'error', 'errorMessage': error_msg},
                    headers={'Content-Type': 'application/json'}
                )
                return False
                
        else:
            print(f"API 請求失敗: {response.status_code}")
            print(response.text)
            
    except Exception as e:
        print(f"檢查狀態時發生錯誤: {e}")
        
    return False

if __name__ == "__main__":
    if check_assemblyai_status():
        print("轉錄處理完成！")
    else:
        print("轉錄仍在進行中或失敗")