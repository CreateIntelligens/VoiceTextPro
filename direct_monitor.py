#!/usr/bin/env python3
import os
import time
import requests
import assemblyai as aai
from datetime import datetime

# Set API key
aai.settings.api_key = os.getenv("ASSEMBLYAI_API_KEY", "0f0da6a87ee34439b8188dc991414cca")

def check_and_update():
    """Check AssemblyAI status and update database directly"""
    transcript_id = "644e225b-4b31-49c4-9e24-2cbbc7ccfe16"
    transcription_id = 16
    
    try:
        print(f"Checking transcript {transcript_id}")
        transcript = aai.Transcript.get_by_id(transcript_id)
        print(f"Status: {transcript.status}")
        
        if transcript.status == aai.TranscriptStatus.completed:
            print("Transcription completed! Updating database...")
            
            # Format speakers
            speakers = []
            segments = []
            if transcript.utterances:
                for i, utterance in enumerate(transcript.utterances):
                    speaker_id = f"Speaker {utterance.speaker}"
                    if not any(s['id'] == speaker_id for s in speakers):
                        speakers.append({
                            'id': speaker_id,
                            'label': speaker_id,
                            'color': f"hsl({(i * 137) % 360}, 70%, 50%)"
                        })
                    
                    segments.append({
                        'text': utterance.text,
                        'speaker': speaker_id,
                        'start': utterance.start,
                        'end': utterance.end,
                        'confidence': utterance.confidence or 0.95,
                        'timestamp': f"{utterance.start // 60000:02d}:{(utterance.start % 60000) // 1000:02d}"
                    })
            
            # Update database via API
            update_data = {
                'status': 'completed',
                'progress': 100,
                'transcriptText': transcript.text,
                'confidence': transcript.confidence,
                'duration': transcript.audio_duration,
                'wordCount': len(transcript.text.split()) if transcript.text else 0,
                'speakers': speakers,
                'segments': segments,
                'assemblyaiId': transcript_id
            }
            
            response = requests.patch(
                f'http://localhost:5000/api/transcriptions/{transcription_id}',
                json=update_data,
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 200:
                print("Database updated successfully!")
                return True
            else:
                print(f"Failed to update database: {response.status_code}")
                
        elif transcript.status == aai.TranscriptStatus.error:
            print(f"Transcription failed: {transcript.error}")
            requests.patch(
                f'http://localhost:5000/api/transcriptions/{transcription_id}',
                json={'status': 'error', 'errorMessage': transcript.error},
                headers={'Content-Type': 'application/json'}
            )
            return False
            
    except Exception as e:
        print(f"Error checking transcript: {e}")
        return False
    
    return False

if __name__ == "__main__":
    if check_and_update():
        print("Transcription completed successfully!")
    else:
        print("Transcription still in progress or failed")