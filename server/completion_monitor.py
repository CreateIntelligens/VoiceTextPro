#!/usr/bin/env python3
import time
import assemblyai as aai
import json
import psycopg2
import os
import sys

# Set API key
aai.settings.api_key = '0f0da6a87ee34439b8188dc991414cca'

def update_database(transcription_id, result_data):
    """Update database with completed transcription results"""
    try:
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        
        cur.execute("""
            UPDATE transcriptions 
            SET status = %s, 
                progress = %s,
                assemblyai_id = %s,
                transcript_text = %s,
                speakers = %s,
                segments = %s,
                confidence = %s,
                duration = %s,
                word_count = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
        """, (
            result_data['status'],
            result_data['progress'],
            result_data['assemblyai_id'],
            result_data['transcript_text'],
            json.dumps(result_data['speakers'], ensure_ascii=False),
            json.dumps(result_data['segments'], ensure_ascii=False),
            result_data['confidence'],
            result_data['duration'],
            result_data['word_count'],
            transcription_id
        ))
        
        conn.commit()
        cur.close()
        conn.close()
        
        print(f"✓ Database updated successfully for transcription {transcription_id}")
        return True
        
    except Exception as e:
        print(f"✗ Database update failed: {e}")
        return False

def monitor_transcription(transcription_id, assemblyai_id):
    """Monitor a single transcription until completion"""
    print(f"Starting monitor for transcription {transcription_id}, AssemblyAI ID: {assemblyai_id}")
    
    max_checks = 360  # 1 hour with 10-second intervals
    check_count = 0
    
    while check_count < max_checks:
        try:
            transcript = aai.Transcript.get_by_id(assemblyai_id)
            
            if transcript.status == 'completed':
                print(f"✓ Transcription {transcription_id} completed!")
                
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
                
                result_data = {
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
                
                print(f"Text length: {len(transcript.text)} characters")
                print(f"Speakers: {len(speakers)}, Segments: {len(segments)}")
                
                # Update database
                if update_database(transcription_id, result_data):
                    print(f"✓ Transcription {transcription_id} processing complete!")
                    return True
                else:
                    print(f"✗ Failed to update database for transcription {transcription_id}")
                    return False
                    
            elif transcript.status == 'error':
                print(f"✗ Transcription {transcription_id} failed: {transcript.error}")
                
                # Update database with error
                try:
                    conn = psycopg2.connect(os.environ['DATABASE_URL'])
                    cur = conn.cursor()
                    cur.execute("""
                        UPDATE transcriptions 
                        SET status = 'error', 
                            error_message = %s,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = %s
                    """, (str(transcript.error), transcription_id))
                    conn.commit()
                    cur.close()
                    conn.close()
                except Exception as e:
                    print(f"Failed to update error status: {e}")
                
                return False
                
            else:
                check_count += 1
                print(f"Check {check_count}/{max_checks}: Status {transcript.status}")
                time.sleep(10)  # Wait 10 seconds before next check
                
        except Exception as e:
            print(f"Error checking transcription: {e}")
            check_count += 1
            time.sleep(10)
    
    print(f"✗ Timeout: Transcription {transcription_id} did not complete within 1 hour")
    return False

def main():
    if len(sys.argv) != 3:
        print("Usage: python3 completion_monitor.py <transcription_id> <assemblyai_id>")
        sys.exit(1)
    
    transcription_id = int(sys.argv[1])
    assemblyai_id = sys.argv[2]
    
    monitor_transcription(transcription_id, assemblyai_id)

if __name__ == "__main__":
    main()