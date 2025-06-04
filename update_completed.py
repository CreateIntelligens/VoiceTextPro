#!/usr/bin/env python3
import os
import requests
import json

def update_transcription_16():
    """Update transcription 16 with completed data from AssemblyAI"""
    api_key = os.getenv("ASSEMBLYAI_API_KEY", "0f0da6a87ee34439b8188dc991414cca")
    transcript_id = "644e225b-4b31-49c4-9e24-2cbbc7ccfe16"
    db_id = 16
    
    headers = {"Authorization": api_key}
    
    try:
        # Get data from AssemblyAI
        response = requests.get(
            f"https://api.assemblyai.com/v2/transcript/{transcript_id}",
            headers=headers
        )
        
        if response.status_code != 200:
            print(f"Failed to get transcript: {response.status_code}")
            return False
            
        data = response.json()
        
        if data.get("status") != "completed":
            print(f"Transcript not completed: {data.get('status')}")
            return False
        
        print("Processing completed transcription...")
        
        # Format speakers with simpler structure
        speakers = []
        segments = []
        
        if data.get("utterances"):
            speaker_colors = ["hsl(220, 70%, 50%)", "hsl(120, 70%, 50%)", "hsl(0, 70%, 50%)", "hsl(280, 70%, 50%)"]
            
            # Process first 100 utterances to avoid payload issues
            utterances = data["utterances"][:100] if len(data["utterances"]) > 100 else data["utterances"]
            
            for utterance in utterances:
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
                    'confidence': round(utterance.get('confidence', 0.95), 2),
                    'timestamp': timestamp
                })
        
        # Prepare update data with truncated text if needed
        transcript_text = data.get('text', '')
        if len(transcript_text) > 50000:  # Limit text size
            transcript_text = transcript_text[:50000] + "... (truncated)"
        
        update_data = {
            'status': 'completed',
            'progress': 100,
            'transcriptText': transcript_text,
            'confidence': int(round(data.get('confidence', 0.0) * 100)) if data.get('confidence') else None,
            'duration': data.get('audio_duration'),
            'wordCount': len(transcript_text.split()) if transcript_text else 0,
            'speakers': speakers,
            'segments': segments,
            'assemblyaiId': transcript_id
        }
        
        print(f"Updating database with {len(segments)} segments...")
        
        # Update database
        update_response = requests.patch(
            f'http://localhost:5000/api/transcriptions/{db_id}',
            json=update_data,
            headers={'Content-Type': 'application/json'}
        )
        
        if update_response.status_code == 200:
            print("Database updated successfully!")
            return True
        else:
            print(f"Database update failed: {update_response.status_code}")
            print(f"Response: {update_response.text}")
            return False
            
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    if update_transcription_16():
        print("轉錄16更新完成！")
    else:
        print("轉錄16更新失敗")