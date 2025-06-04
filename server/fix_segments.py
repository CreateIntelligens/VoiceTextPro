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
    if len(sys.argv) != 2:
        print("Usage: python fix_segments.py <transcription_id>")
        sys.exit(1)
    
    transcription_id = int(sys.argv[1])
    
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
        # Get transcription details
        cur.execute("SELECT assemblyai_id, transcript_text FROM transcriptions WHERE id = %s", (transcription_id,))
        result = cur.fetchone()
        
        if not result:
            print(f"ERROR: Transcription {transcription_id} not found")
            sys.exit(1)
        
        assemblyai_id, transcript_text = result
        
        if not assemblyai_id:
            print(f"ERROR: No AssemblyAI ID for transcription {transcription_id}")
            sys.exit(1)
        
        print(f"Fetching detailed results for AssemblyAI ID: {assemblyai_id}")
        
        # Get transcript from AssemblyAI
        transcript = aai.Transcript.get_by_id(assemblyai_id)
        
        if transcript.status != aai.TranscriptStatus.completed:
            print(f"ERROR: Transcript status is {transcript.status}")
            sys.exit(1)
        
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
        else:
            # If no utterances, create segments from words with speaker diarization
            print("No utterances found, trying words with speaker labels...")
            if hasattr(transcript, 'words') and transcript.words:
                current_speaker = None
                current_segment = []
                current_start = None
                segment_confidence_sum = 0
                word_count = 0
                speaker_count = 0
                
                for word in transcript.words:
                    if hasattr(word, 'speaker') and word.speaker is not None:
                        # If speaker changed, save previous segment
                        if current_speaker is not None and word.speaker != current_speaker:
                            if current_segment:
                                speaker_id = f"speaker_{current_speaker}"
                                if speaker_id not in speakers:
                                    speakers[speaker_id] = {
                                        "id": speaker_id,
                                        "label": f"說話者 {chr(65 + speaker_count)}",
                                        "color": get_speaker_color(speaker_count)
                                    }
                                    speaker_count += 1
                                
                                avg_confidence = segment_confidence_sum / word_count if word_count > 0 else 0
                                segments.append({
                                    "text": " ".join(current_segment),
                                    "speaker": speaker_id,
                                    "start": current_start,
                                    "end": word.end,
                                    "timestamp": format_timestamp(current_start),
                                    "confidence": avg_confidence
                                })
                                
                                current_segment = []
                                segment_confidence_sum = 0
                                word_count = 0
                        
                        # Start new segment
                        if not current_segment:
                            current_start = word.start
                        
                        current_speaker = word.speaker
                        current_segment.append(word.text)
                        segment_confidence_sum += word.confidence
                        word_count += 1
                
                # Save last segment
                if current_segment and current_speaker is not None:
                    speaker_id = f"speaker_{current_speaker}"
                    if speaker_id not in speakers:
                        speakers[speaker_id] = {
                            "id": speaker_id,
                            "label": f"說話者 {chr(65 + speaker_count)}",
                            "color": get_speaker_color(speaker_count)
                        }
                    
                    avg_confidence = segment_confidence_sum / word_count if word_count > 0 else 0
                    segments.append({
                        "text": " ".join(current_segment),
                        "speaker": speaker_id,
                        "start": current_start,
                        "end": transcript.words[-1].end,
                        "timestamp": format_timestamp(current_start),
                        "confidence": avg_confidence
                    })
        
        print(f"Generated {len(segments)} segments with {len(speakers)} speakers")
        
        # Update database
        speakers_json = json.dumps(list(speakers.values()))
        segments_json = json.dumps(segments)
        
        cur.execute("""
            UPDATE transcriptions 
            SET speakers = %s, segments = %s, updated_at = %s
            WHERE id = %s
        """, (speakers_json, segments_json, datetime.now(), transcription_id))
        
        conn.commit()
        print(f"Successfully updated transcription {transcription_id} with {len(segments)} segments")
        
    except Exception as e:
        print(f"ERROR: {e}")
        conn.rollback()
        sys.exit(1)
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    main()