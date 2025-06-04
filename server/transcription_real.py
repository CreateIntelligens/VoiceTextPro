#!/usr/bin/env python3

import sys
import os
import json
import time
import assemblyai as aai

def format_timestamp(milliseconds):
    """Convert milliseconds to MM:SS format"""
    seconds = milliseconds / 1000
    minutes = int(seconds // 60)
    seconds = int(seconds % 60)
    return f"{minutes:02d}:{seconds:02d}"

def get_speaker_color(speaker_index):
    """Get color for speaker based on index"""
    colors = [
        "hsl(200, 70%, 50%)",
        "hsl(120, 70%, 50%)",
        "hsl(60, 70%, 50%)",
        "hsl(300, 70%, 50%)",
        "hsl(30, 70%, 50%)",
        "hsl(270, 70%, 50%)"
    ]
    return colors[speaker_index % len(colors)]

def main():
    if len(sys.argv) < 3:
        print("ERROR: Usage: python transcription_real.py <audio_file_path> <transcription_id> [keywords]", file=sys.stderr, flush=True)
        sys.exit(1)
    
    audio_file_path = sys.argv[1]
    transcription_id = sys.argv[2]
    custom_keywords = sys.argv[3] if len(sys.argv) > 3 else ""
    
    # Set API key from environment
    import os
    aai.settings.api_key = os.getenv("ASSEMBLYAI_API_KEY", "0f0da6a87ee34439b8188dc991414cca")
    
    try:
        print("PROGRESS:10", flush=True)
        print(f"DEBUG: Starting transcription for file: {audio_file_path}", flush=True)
        
        # Check if file exists
        if not os.path.exists(audio_file_path):
            print(f"ERROR: File not found: {audio_file_path}", file=sys.stderr, flush=True)
            sys.exit(1)
        
        print("PROGRESS:20", flush=True)
        
        # Configure transcription with Best model - word boost only supports English
        # We'll filter out Chinese characters and keep only English/alphanumeric keywords
        default_keywords = ["business", "meeting", "strategy", "customer", "platform", "channel", "social", "marketing", "management", "analysis", "solution", "problem", "market", "competition", "value", "service", "product", "technology"]
        
        # Parse custom keywords if provided and filter for English-only
        keywords = default_keywords.copy()
        if custom_keywords:
            user_keywords = [k.strip() for k in custom_keywords.split(",") if k.strip()]
            # Only add keywords that contain only English letters, numbers, and basic punctuation
            english_keywords = [k for k in user_keywords if k.replace(" ", "").replace("-", "").replace("_", "").isascii()]
            keywords.extend(english_keywords)
            
            # Log all keywords for context (including Chinese ones)
            print(f"DEBUG: All provided keywords: {', '.join(user_keywords)}", flush=True)
        
        print(f"DEBUG: Using {len(keywords)} English keywords for word boost", flush=True)
        
        if keywords:
            config = aai.TranscriptionConfig(
                speaker_labels=True,
                language_code="zh",
                speech_model=aai.SpeechModel.best,
                punctuate=True,
                format_text=True,
                word_boost=keywords,
                boost_param=aai.WordBoost.high
            )
        else:
            config = aai.TranscriptionConfig(
                speaker_labels=True,
                language_code="zh",
                speech_model=aai.SpeechModel.best,
                punctuate=True,
                format_text=True
            )
        
        print("PROGRESS:30", flush=True)
        print("DEBUG: Created transcription config", flush=True)
        
        # Create transcriber
        transcriber = aai.Transcriber(config=config)
        
        print("PROGRESS:40", flush=True)
        print("DEBUG: Starting file upload and transcription", flush=True)
        
        # Submit file for transcription
        transcript = transcriber.submit(audio_file_path)
        
        print(f"DEBUG: Submitted, transcript ID: {transcript.id}", flush=True)
        print("PROGRESS:50", flush=True)
        
        # Poll for completion with longer timeout for large files
        progress = 50
        max_retries = 300  # 25 minutes max wait time (5 second intervals) 
        retry_count = 0
        
        print(f"DEBUG: Initial status: {transcript.status}", flush=True)
        
        while transcript.status in [aai.TranscriptStatus.queued, aai.TranscriptStatus.processing] and retry_count < max_retries:
            if retry_count < 60:  # First 5 minutes
                progress = min(50 + retry_count, 75)
            else:  # After 5 minutes, slower progress
                progress = min(75 + (retry_count - 60) // 4, 85)
                
            print(f"PROGRESS:{progress}", flush=True)
            print(f"DEBUG: Status check {retry_count + 1}/{max_retries}, status: {transcript.status}", flush=True)
            
            # Show estimated time remaining for large files
            if retry_count > 0 and retry_count % 12 == 0:  # Every minute
                minutes_elapsed = retry_count * 5 / 60
                print(f"DEBUG: Elapsed: {minutes_elapsed:.1f} minutes. Large files may take 10-15 minutes.", flush=True)
            
            time.sleep(5)
            retry_count += 1
            
            # Refresh transcript status
            try:
                transcript = aai.Transcript.get_by_id(transcript.id)
                print(f"DEBUG: Updated status: {transcript.status}", flush=True)
                
                if transcript.status == aai.TranscriptStatus.completed:
                    print("DEBUG: Transcription completed!", flush=True)
                    break
                elif transcript.status == aai.TranscriptStatus.error:
                    print(f"ERROR: Transcription failed: {transcript.error}", file=sys.stderr, flush=True)
                    sys.exit(1)
                    
            except Exception as e:
                print(f"ERROR: Failed to check status: {e}", file=sys.stderr, flush=True)
                if retry_count > 30:  # Give up after 30 failed attempts
                    sys.exit(1)
        
        # Check for timeout
        if retry_count >= max_retries:
            print("ERROR: Transcription timed out after 10 minutes", file=sys.stderr, flush=True)
            sys.exit(1)
        
        # Check final status
        if transcript.status != aai.TranscriptStatus.completed:
            print(f"ERROR: Transcription ended with status: {transcript.status}", file=sys.stderr, flush=True)
            sys.exit(1)
        
        print("PROGRESS:90", flush=True)
        print("DEBUG: Processing transcription results", flush=True)
        
        # Process results
        speakers = {}
        segments = []
        
        print(f"DEBUG: Transcript text length: {len(transcript.text) if transcript.text else 0}", flush=True)
        
        if hasattr(transcript, 'utterances') and transcript.utterances:
            print(f"DEBUG: Found {len(transcript.utterances)} utterances", flush=True)
            speaker_count = 0
            
            for utterance in transcript.utterances:
                speaker_id = f"speaker_{utterance.speaker}"
                if speaker_id not in speakers:
                    speakers[speaker_id] = {
                        "id": speaker_id,
                        "label": f"說話者 {chr(65 + speaker_count)}",  # A, B, C, etc.
                        "color": get_speaker_color(speaker_count)
                    }
                    speaker_count += 1
                
                segments.append({
                    "text": utterance.text,
                    "speaker": speaker_id,
                    "start": utterance.start,
                    "end": utterance.end,
                    "confidence": utterance.confidence if utterance.confidence else 0.95,
                    "timestamp": format_timestamp(utterance.start)
                })
        else:
            print("DEBUG: No utterances found, creating single segment", flush=True)
            # If no speaker detection, create a single segment
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
                "color": get_speaker_color(0)
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
        
        print("PROGRESS:95", flush=True)
        print(f"DEBUG: Created result with {len(result['transcript_text'])} chars", flush=True)
        print("PROGRESS:100", flush=True)
        
        # Output final result
        result_json = json.dumps(result, ensure_ascii=False)
        print(f"RESULT:{result_json}", flush=True)
        print("SUCCESS: Transcription completed successfully", flush=True)
        
    except Exception as e:
        print(f"ERROR: {str(e)}", file=sys.stderr, flush=True)
        sys.exit(1)

if __name__ == "__main__":
    main()