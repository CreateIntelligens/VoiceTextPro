#!/usr/bin/env python3

import sys
import os
import json
import time
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
    assemblyai_id = "647e5ded-e8e0-4862-b606-5040a17aa6e3"
    transcription_id = 13
    
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
        print(f"Monitoring AssemblyAI transcript: {assemblyai_id}")
        
        max_retries = 240  # 20 minutes max
        retry_count = 0
        
        while retry_count < max_retries:
            try:
                transcript = aai.Transcript.get_by_id(assemblyai_id)
                
                print(f"Check {retry_count + 1}: Status = {transcript.status}")
                
                if transcript.status == aai.TranscriptStatus.completed:
                    print("Transcription completed! Processing results...")
                    
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
                    print(f"Successfully updated transcription {transcription_id} with punctuated content!")
                    print(f"Text sample: {transcript.text[:200] if transcript.text else 'No text'}...")
                    break
                    
                elif transcript.status == aai.TranscriptStatus.error:
                    print(f"ERROR: Transcription failed: {transcript.error}")
                    sys.exit(1)
                
                time.sleep(5)
                retry_count += 1
                
            except Exception as e:
                print(f"Error checking status: {e}")
                time.sleep(10)
                retry_count += 1
        
        if retry_count >= max_retries:
            print("ERROR: Monitoring timed out")
            sys.exit(1)
        
    except Exception as e:
        print(f"ERROR: {e}")
        conn.rollback()
        sys.exit(1)
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    main()