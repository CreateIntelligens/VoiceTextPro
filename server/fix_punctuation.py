#!/usr/bin/env python3

import sys
import os
import json
import assemblyai as aai
import psycopg2
from datetime import datetime

def format_timestamp(milliseconds):
    """Convert milliseconds to MM:SS format"""
    seconds = milliseconds / 1000
    minutes = int(seconds // 60)
    seconds = int(seconds % 60)
    return f"{minutes:02d}:{seconds:02d}"

def get_speaker_color(speaker_index):
    """Get color for speaker based on index"""
    colors = [
        "hsl(0, 70%, 50%)",
        "hsl(60, 70%, 50%)",
        "hsl(120, 70%, 50%)",
        "hsl(180, 70%, 50%)",
        "hsl(240, 70%, 50%)",
        "hsl(300, 70%, 50%)"
    ]
    return colors[speaker_index % len(colors)]

def main():
    if len(sys.argv) != 3:
        print("Usage: python fix_punctuation.py <audio_file_path> <transcription_id>")
        sys.exit(1)
    
    audio_file_path = sys.argv[1]
    transcription_id = int(sys.argv[2])
    
    # Set API key
    aai.settings.api_key = os.getenv("ASSEMBLYAI_API_KEY", "0f0da6a87ee34439b8188dc991414cca")
    
    # Connect to database
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL not found")
        sys.exit(1)
    
    conn = psycopg2.connect(database_url)
    cur = conn.cursor()
    
    try:
        print(f"Starting new transcription with punctuation for ID: {transcription_id}")
        
        # Check if file exists
        if not os.path.exists(audio_file_path):
            print(f"ERROR: File not found: {audio_file_path}")
            sys.exit(1)
        
        # Configure transcription with punctuation
        config = aai.TranscriptionConfig(
            speaker_labels=True,
            language_code="zh",
            speech_model=aai.SpeechModel.best,
            punctuate=True,
            format_text=True
        )
        
        print("Creating transcriber with punctuation enabled...")
        transcriber = aai.Transcriber(config=config)
        
        print("Submitting file for transcription...")
        transcript = transcriber.submit(audio_file_path)
        
        print(f"Submitted, transcript ID: {transcript.id}")
        print("Waiting for completion...")
        
        # Wait for completion
        max_retries = 120  # 10 minutes max
        retry_count = 0
        
        while retry_count < max_retries:
            if transcript.status == aai.TranscriptStatus.completed:
                print("Transcription completed!")
                break
            elif transcript.status == aai.TranscriptStatus.error:
                print(f"ERROR: Transcription failed: {transcript.error}")
                sys.exit(1)
            
            print(f"Status: {transcript.status}, waiting... ({retry_count + 1}/{max_retries})")
            time.sleep(5)
            retry_count += 1
            
            # Refresh transcript status
            transcript = aai.Transcript.get_by_id(transcript.id)
        
        if transcript.status != aai.TranscriptStatus.completed:
            print(f"ERROR: Transcription timed out or failed: {transcript.status}")
            sys.exit(1)
        
        print("Processing results with punctuation...")
        
        # Process speakers and segments
        speakers = {}
        segments = []
        
        print(f"Full transcript text length: {len(transcript.text) if transcript.text else 0}")
        print(f"Number of utterances: {len(transcript.utterances) if transcript.utterances else 0}")
        
        if hasattr(transcript, 'utterances') and transcript.utterances:
            speaker_count = 0
            
            for utterance in transcript.utterances:
                speaker_id = f"speaker_{utterance.speaker}"
                if speaker_id not in speakers:
                    speakers[speaker_id] = {
                        "id": speaker_id,
                        "label": f"說話者 {chr(65 + speaker_count)}",
                        "color": get_speaker_color(speaker_count)
                    }
                    speaker_count += 1
                
                segments.append({
                    "text": utterance.text,
                    "speaker": speaker_id,
                    "start": utterance.start,
                    "end": utterance.end,
                    "timestamp": format_timestamp(utterance.start),
                    "confidence": utterance.confidence
                })
        
        print(f"Generated {len(segments)} segments with {len(speakers)} speakers")
        
        # Update database with punctuated content
        speakers_json = json.dumps(list(speakers.values()))
        segments_json = json.dumps(segments)
        
        cur.execute("""
            UPDATE transcriptions 
            SET transcript_text = %s, speakers = %s, segments = %s, 
                assemblyai_id = %s, confidence = %s, duration = %s, 
                word_count = %s, updated_at = %s
            WHERE id = %s
        """, (
            transcript.text,
            speakers_json, 
            segments_json,
            transcript.id,
            transcript.confidence,
            transcript.audio_duration,
            len(transcript.text.split()) if transcript.text else 0,
            datetime.now(),
            transcription_id
        ))
        
        conn.commit()
        print(f"Successfully updated transcription {transcription_id} with punctuated content")
        print(f"New text length: {len(transcript.text) if transcript.text else 0} characters")
        print(f"Segments: {len(segments)}, Speakers: {len(speakers)}")
        
    except Exception as e:
        print(f"ERROR: {e}")
        conn.rollback()
        sys.exit(1)
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    import time
    main()