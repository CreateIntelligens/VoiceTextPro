#!/usr/bin/env python3
import assemblyai as aai
import json
import psycopg2
import os

# Set API key
aai.settings.api_key = '0f0da6a87ee34439b8188dc991414cca'

def check_and_update_transcription():
    """Check current transcription and update if completed"""
    try:
        # Check current transcription status
        transcript = aai.Transcript.get_by_id('74b89908-2d4e-46fc-9835-9c1a5bb509ff')
        print(f"Current status: {transcript.status}")
        
        if transcript.status == 'completed':
            print("Transcription completed! Processing results...")
            
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
            
            # Update database
            conn = psycopg2.connect(os.environ['DATABASE_URL'])
            cur = conn.cursor()
            
            cur.execute("""
                UPDATE transcriptions 
                SET status = 'completed',
                    progress = 100,
                    assemblyai_id = %s,
                    transcript_text = %s,
                    speakers = %s,
                    segments = %s,
                    confidence = %s,
                    duration = %s,
                    word_count = %s,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = 13
            """, (
                transcript.id,
                transcript.text,
                json.dumps(speakers, ensure_ascii=False),
                json.dumps(segments, ensure_ascii=False),
                round(transcript.confidence, 3) if transcript.confidence else 0.9,
                transcript.audio_duration,
                len(transcript.text.split()) if transcript.text else 0
            ))
            
            conn.commit()
            cur.close()
            conn.close()
            
            print(f"✓ Database updated successfully!")
            print(f"Text length: {len(transcript.text)} characters")
            print(f"Speakers: {len(speakers)}, Segments: {len(segments)}")
            return True
            
        elif transcript.status == 'error':
            print(f"Transcription failed: {transcript.error}")
            return False
            
        else:
            print(f"Still processing: {transcript.status}")
            return False
            
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    check_and_update_transcription()