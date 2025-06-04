#!/usr/bin/env python3

import sys
import json
import assemblyai as aai
import sqlite3
import os

def update_database(transcription_id, result_data):
    """Update database with completed transcription results"""
    try:
        # Connect to database
        db_url = os.environ.get('DATABASE_URL')
        if not db_url:
            print("ERROR: DATABASE_URL not found", file=sys.stderr)
            return False
            
        # For SQLite connections from DATABASE_URL
        if db_url.startswith('sqlite'):
            db_path = db_url.replace('sqlite:///', '')
            conn = sqlite3.connect(db_path)
        else:
            print("ERROR: Only SQLite connections supported in this script", file=sys.stderr)
            return False
            
        cursor = conn.cursor()
        
        # Update transcription record
        cursor.execute("""
            UPDATE transcriptions 
            SET status = 'completed',
                progress = 100,
                assemblyai_id = ?,
                transcript_text = ?,
                speakers = ?,
                segments = ?,
                confidence = ?,
                duration = ?,
                word_count = ?
            WHERE id = ?
        """, (
            result_data['assemblyai_id'],
            result_data['transcript_text'],
            json.dumps(result_data['speakers']),
            json.dumps(result_data['segments']),
            result_data['confidence'],
            result_data['duration'],
            result_data['word_count'],
            transcription_id
        ))
        
        conn.commit()
        conn.close()
        return True
        
    except Exception as e:
        print(f"ERROR: Database update failed: {e}", file=sys.stderr)
        return False

def main():
    if len(sys.argv) != 3:
        print("Usage: python check_completion.py <assemblyai_id> <transcription_id>", file=sys.stderr)
        sys.exit(1)
    
    assemblyai_id = sys.argv[1]
    transcription_id = sys.argv[2]
    
    # Set API key
    aai.settings.api_key = "0f0da6a87ee34439b8188dc991414cca"
    
    try:
        # Get transcript status
        transcript = aai.Transcript.get_by_id(assemblyai_id)
        
        if transcript.status == aai.TranscriptStatus.completed:
            print(f"SUCCESS: Transcription {assemblyai_id} completed")
            
            # Process results
            speakers = {}
            segments = []
            
            if hasattr(transcript, 'utterances') and transcript.utterances:
                speaker_count = 0
                for utterance in transcript.utterances:
                    speaker_id = f"speaker_{utterance.speaker}"
                    if speaker_id not in speakers:
                        speakers[speaker_id] = {
                            "id": speaker_id,
                            "label": f"說話者 {chr(65 + speaker_count)}",
                            "color": f"hsl({(speaker_count * 137) % 360}, 70%, 50%)"
                        }
                        speaker_count += 1
                    
                    segments.append({
                        "text": utterance.text,
                        "speaker": speaker_id,
                        "start": utterance.start,
                        "end": utterance.end,
                        "confidence": utterance.confidence if utterance.confidence else 0.95,
                        "timestamp": f"{utterance.start//1000//60:02d}:{utterance.start//1000%60:02d}"
                    })
            else:
                # No speaker detection
                segments.append({
                    "text": transcript.text,
                    "speaker": "speaker_A",
                    "start": 0,
                    "end": transcript.audio_duration if transcript.audio_duration else 0,
                    "confidence": transcript.confidence if transcript.confidence else 0.95,
                    "timestamp": "00:00"
                })
                speakers["speaker_A"] = {
                    "id": "speaker_A",
                    "label": "說話者 A",
                    "color": "hsl(200, 70%, 50%)"
                }
            
            # Create result object
            result = {
                "assemblyai_id": transcript.id,
                "transcript_text": transcript.text,
                "speakers": list(speakers.values()),
                "segments": segments,
                "confidence": transcript.confidence if transcript.confidence else 0.95,
                "duration": transcript.audio_duration,
                "word_count": len(transcript.text.split()) if transcript.text else 0
            }
            
            # Update database
            if update_database(transcription_id, result):
                print(f"SUCCESS: Database updated for transcription {transcription_id}")
                print(f"COMPLETED: {len(result['transcript_text'])} characters transcribed")
            else:
                print("ERROR: Failed to update database", file=sys.stderr)
                sys.exit(1)
                
        elif transcript.status == aai.TranscriptStatus.error:
            print(f"ERROR: Transcription failed: {transcript.error}", file=sys.stderr)
            sys.exit(1)
        else:
            print(f"INFO: Still processing, status: {transcript.status}")
            sys.exit(2)  # Not ready yet
            
    except Exception as e:
        print(f"ERROR: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()