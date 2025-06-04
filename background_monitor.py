#!/usr/bin/env python3
import os
import time
import requests
import json
import threading
from datetime import datetime

class TranscriptionMonitor:
    def __init__(self):
        self.api_key = os.getenv("ASSEMBLYAI_API_KEY", "0f0da6a87ee34439b8188dc991414cca")
        self.running = False
        
    def check_transcription_status(self, transcript_id, db_id):
        """Check single transcription status"""
        headers = {"Authorization": self.api_key}
        
        try:
            response = requests.get(
                f"https://api.assemblyai.com/v2/transcript/{transcript_id}",
                headers=headers,
                timeout=10
            )
            
            if response.status_code != 200:
                print(f"[{db_id}] API error: {response.status_code}")
                return False
                
            data = response.json()
            status = data.get("status")
            
            if status == "completed":
                print(f"[{db_id}] Transcription completed! Updating database...")
                return self.update_database(data, transcript_id, db_id)
            elif status == "error":
                error_msg = data.get("error", "Unknown error")
                print(f"[{db_id}] Transcription failed: {error_msg}")
                self.update_error_status(db_id, error_msg)
                return False
            else:
                print(f"[{db_id}] Status: {status}")
                return None
                
        except Exception as e:
            print(f"[{db_id}] Error checking status: {e}")
            return None
    
    def update_database(self, data, transcript_id, db_id):
        """Update database with completed transcription"""
        try:
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
            transcript_text = data.get('text', '')
            confidence_val = data.get('confidence')
            confidence_int = int(round(confidence_val * 100)) if confidence_val else None
            
            update_data = {
                'status': 'completed',
                'progress': 100,
                'transcriptText': transcript_text,
                'confidence': confidence_int,
                'duration': data.get('audio_duration'),
                'wordCount': len(transcript_text.split()) if transcript_text else 0,
                'speakers': speakers,
                'segments': segments,
                'assemblyaiId': transcript_id
            }
            
            # Update via API
            response = requests.patch(
                f'http://localhost:5000/api/transcriptions/{db_id}',
                json=update_data,
                headers={'Content-Type': 'application/json'},
                timeout=30
            )
            
            if response.status_code == 200:
                print(f"[{db_id}] Database updated successfully!")
                return True
            else:
                print(f"[{db_id}] Database update failed: {response.status_code}")
                print(f"Response: {response.text}")
                return False
                
        except Exception as e:
            print(f"[{db_id}] Error updating database: {e}")
            return False
    
    def update_error_status(self, db_id, error_msg):
        """Update transcription status to error"""
        try:
            requests.patch(
                f'http://localhost:5000/api/transcriptions/{db_id}',
                json={'status': 'error', 'errorMessage': error_msg},
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
        except Exception as e:
            print(f"[{db_id}] Error updating error status: {e}")
    
    def monitor_active_transcriptions(self):
        """Monitor all active transcriptions"""
        transcriptions = [
            ("2a4a9804-63b6-4cfa-8f5d-5d3ea8c27199", 17)
        ]
        
        self.running = True
        check_count = 0
        
        while self.running and check_count < 60:  # Max 30 minutes
            check_count += 1
            print(f"\n--- Check #{check_count} at {datetime.now().strftime('%H:%M:%S')} ---")
            
            completed_count = 0
            for transcript_id, db_id in transcriptions:
                result = self.check_transcription_status(transcript_id, db_id)
                if result is True:
                    completed_count += 1
            
            if completed_count == len(transcriptions):
                print("All transcriptions completed!")
                break
                
            if check_count < 60:
                time.sleep(30)  # Check every 30 seconds
        
        self.running = False
        print("Monitoring stopped.")

def main():
    monitor = TranscriptionMonitor()
    monitor.monitor_active_transcriptions()

if __name__ == "__main__":
    main()