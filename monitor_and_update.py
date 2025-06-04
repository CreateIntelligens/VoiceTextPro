#!/usr/bin/env python3
import time
import assemblyai as aai
import json
import requests
import sys
from datetime import datetime

# Set API key
aai.settings.api_key = '0f0da6a87ee34439b8188dc991414cca'

def update_via_api(transcription_id, update_data):
    """Update transcription via API endpoint"""
    try:
        response = requests.patch(
            f'http://localhost:5000/api/transcriptions/{transcription_id}',
            json=update_data,
            headers={'Content-Type': 'application/json'}
        )
        
        if response.status_code == 200:
            print(f"✓ Successfully updated transcription {transcription_id}")
            return True
        else:
            print(f"✗ API update failed: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print(f"✗ API update error: {e}")
        return False

def monitor_transcription():
    """Monitor transcription completion and update database"""
    transcription_id = 13
    assemblyai_id = '74b89908-2d4e-46fc-9835-9c1a5bb509ff'
    
    print(f"Monitoring transcription {transcription_id} with AssemblyAI ID: {assemblyai_id}")
    
    max_checks = 300  # 75 minutes with 15-second intervals
    check_count = 0
    
    while check_count < max_checks:
        try:
            current_time = datetime.now().strftime("%H:%M:%S")
            transcript = aai.Transcript.get_by_id(assemblyai_id)
            
            if transcript.status == 'completed':
                print(f"[{current_time}] Transcription completed! Processing results...")
                
                # Process speakers and segments
                speakers = []
                segments = []
                
                if hasattr(transcript, 'utterances') and transcript.utterances:
                    speaker_map = {}
                    speaker_count = 0
                    
                    for utterance in transcript.utterances:
                        speaker_key = utterance.speaker
                        if speaker_key not in speaker_map:
                            speaker_id = f'speaker_{speaker_key}'
                            speaker_map[speaker_key] = {
                                'id': speaker_id,
                                'label': f'說話者 {chr(65 + speaker_count)}',
                                'color': f'hsl({(speaker_count * 60) % 360}, 70%, 50%)'
                            }
                            speakers.append(speaker_map[speaker_key])
                            speaker_count += 1
                        
                        segments.append({
                            'text': utterance.text,
                            'speaker': speaker_map[speaker_key]['id'],
                            'start': utterance.start,
                            'end': utterance.end,
                            'confidence': round(utterance.confidence, 3) if utterance.confidence else 0.9,
                            'timestamp': f'{utterance.start//60000:02d}:{(utterance.start//1000)%60:02d}'
                        })
                else:
                    # Single speaker fallback
                    speakers = [{
                        'id': 'speaker_A',
                        'label': '說話者 A',
                        'color': 'hsl(200, 70%, 50%)'
                    }]
                    segments = [{
                        'text': transcript.text,
                        'speaker': 'speaker_A',
                        'start': 0,
                        'end': transcript.audio_duration or 0,
                        'confidence': round(transcript.confidence, 3) if transcript.confidence else 0.9,
                        'timestamp': '00:00'
                    }]
                
                # Prepare update data
                update_data = {
                    'status': 'completed',
                    'progress': 100,
                    'assemblyaiId': transcript.id,
                    'transcriptText': transcript.text,
                    'speakers': speakers,
                    'segments': segments,
                    'confidence': round(transcript.confidence, 3) if transcript.confidence else 0.9,
                    'duration': transcript.audio_duration,
                    'wordCount': len(transcript.text.split()) if transcript.text else 0
                }
                
                print(f"Text length: {len(transcript.text)} characters")
                print(f"Speakers: {len(speakers)}, Segments: {len(segments)}")
                
                # Update via API
                if update_via_api(transcription_id, update_data):
                    print("✓ Transcription processing complete!")
                    return True
                else:
                    print("✗ Failed to update database")
                    return False
                    
            elif transcript.status == 'error':
                print(f"[{current_time}] Transcription failed: {transcript.error}")
                
                # Update with error status
                error_data = {
                    'status': 'error',
                    'errorMessage': str(transcript.error)
                }
                update_via_api(transcription_id, error_data)
                return False
                
            else:
                check_count += 1
                print(f"[{current_time}] Check {check_count}/{max_checks}: Status {transcript.status}")
                time.sleep(15)
                
        except Exception as e:
            print(f"Error checking transcription: {e}")
            check_count += 1
            time.sleep(15)
    
    print("Timeout: Transcription did not complete within monitoring period")
    return False

if __name__ == "__main__":
    monitor_transcription()