#!/usr/bin/env python3
import time
import assemblyai as aai
import json
import os
import sys
from datetime import datetime

# Set API key
aai.settings.api_key = '0f0da6a87ee34439b8188dc991414cca'

def main():
    transcription_id = 13
    assemblyai_id = '74b89908-2d4e-46fc-9835-9c1a5bb509ff'
    
    print(f"[UPDATER] Monitoring transcription {transcription_id}")
    
    max_attempts = 240  # 1 hour with 15-second intervals
    attempt = 0
    
    while attempt < max_attempts:
        try:
            transcript = aai.Transcript.get_by_id(assemblyai_id)
            current_time = datetime.now().strftime("%H:%M:%S")
            
            if transcript.status == 'completed':
                print(f"[{current_time}] TRANSCRIPTION COMPLETED!")
                
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
                
                print(f"Text length: {len(transcript.text)} characters")
                print(f"Speakers: {len(speakers)}, Segments: {len(segments)}")
                
                # Output for database update
                result = {
                    'status': 'completed',
                    'progress': 100,
                    'assemblyai_id': transcript.id,
                    'transcript_text': transcript.text,
                    'speakers': speakers,
                    'segments': segments,
                    'confidence': round(transcript.confidence, 3) if transcript.confidence else 0.9,
                    'duration': transcript.audio_duration,
                    'word_count': len(transcript.text.split()) if transcript.text else 0
                }
                
                print("UPDATE_READY")
                print(json.dumps(result, ensure_ascii=False))
                break
                
            elif transcript.status == 'error':
                print(f"[{current_time}] TRANSCRIPTION FAILED: {transcript.error}")
                break
                
            else:
                attempt += 1
                print(f"[{current_time}] Check {attempt}/{max_attempts}: Status {transcript.status}")
                time.sleep(15)
                
        except Exception as e:
            print(f"Error: {e}")
            attempt += 1
            time.sleep(15)
    
    if attempt >= max_attempts:
        print("TIMEOUT: Transcription did not complete within 1 hour")

if __name__ == "__main__":
    main()