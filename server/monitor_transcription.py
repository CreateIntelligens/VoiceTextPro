#!/usr/bin/env python3

import sys
import time
import assemblyai as aai
import json

def check_transcription_status(transcript_id, transcription_db_id):
    """Check AssemblyAI transcription status and update database if completed"""
    
    # Set API key
    aai.settings.api_key = "0f0da6a87ee34439b8188dc991414cca"
    
    try:
        # Get transcript status
        transcript = aai.Transcript.get_by_id(transcript_id)
        print(f"DEBUG: Checking transcript {transcript_id}, status: {transcript.status}", flush=True)
        
        if transcript.status == aai.TranscriptStatus.completed:
            print("DEBUG: Transcription completed! Processing results...", flush=True)
            
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
                # No speaker detection, create single segment
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
            
            print("PROGRESS:100", flush=True)
            print(f"RESULT:{json.dumps(result, ensure_ascii=False)}", flush=True)
            print("SUCCESS: Transcription completed successfully", flush=True)
            return True
            
        elif transcript.status == aai.TranscriptStatus.error:
            print(f"ERROR: Transcription failed: {transcript.error}", flush=True)
            return False
        else:
            print(f"DEBUG: Still processing, status: {transcript.status}", flush=True)
            return None
            
    except Exception as e:
        print(f"ERROR: Failed to check status: {e}", flush=True)
        return False

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python monitor_transcription.py <transcript_id> <transcription_db_id>", file=sys.stderr)
        sys.exit(1)
    
    transcript_id = sys.argv[1]
    transcription_db_id = sys.argv[2]
    
    # Monitor for up to 20 minutes
    max_checks = 240  # 20 minutes at 5-second intervals
    check_count = 0
    
    while check_count < max_checks:
        result = check_transcription_status(transcript_id, transcription_db_id)
        
        if result is True:
            # Completed successfully
            break
        elif result is False:
            # Error occurred
            sys.exit(1)
        
        # Still processing, wait and try again
        check_count += 1
        progress = min(50 + check_count, 85)
        print(f"PROGRESS:{progress}", flush=True)
        time.sleep(5)
    
    if check_count >= max_checks:
        print("ERROR: Transcription timed out after 20 minutes", file=sys.stderr, flush=True)
        sys.exit(1)