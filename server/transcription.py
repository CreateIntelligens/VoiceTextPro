#!/usr/bin/env python3
import sys
import os
import json
import assemblyai as aai
from datetime import timedelta

# Ensure unbuffered output
import sys
import os
sys.stdout.flush()

def format_timestamp(milliseconds):
    """Convert milliseconds to MM:SS format"""
    seconds = milliseconds / 1000
    return str(timedelta(seconds=int(seconds)))[2:7]  # Remove hours, keep MM:SS

def get_speaker_color(speaker_index):
    """Get color for speaker based on index"""
    colors = ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EF4444", "#06B6D4"]
    return colors[speaker_index % len(colors)]

def main():
    if len(sys.argv) != 3:
        print("Usage: python transcription.py <audio_file_path> <transcription_id>", file=sys.stderr)
        sys.exit(1)
    
    audio_file_path = sys.argv[1]
    transcription_id = sys.argv[2]
    
    # Set API key
    aai.settings.api_key = "0f0da6a87ee34439b8188dc991414cca"
    
    try:
        print("PROGRESS:10", flush=True)
        
        # Configure transcription with best model and speaker labels
        config = aai.TranscriptionConfig(
            speech_model=aai.SpeechModel.best,
            speaker_labels=True,
            language_code="zh"  # Chinese language
        )
        
        print("PROGRESS:20", flush=True)
        
        # Create transcriber and start transcription
        transcriber = aai.Transcriber(config=config)
        
        print("PROGRESS:30", flush=True)
        
        # Submit for transcription
        print("DEBUG: Starting transcription submission", flush=True)
        transcript = transcriber.submit(audio_file_path)
        
        print(f"DEBUG: Submitted, transcript ID: {transcript.id}", flush=True)
        print("PROGRESS:40", flush=True)
        
        # Poll for completion with progress updates
        import time
        progress = 40
        max_retries = 60  # 5 minutes max wait time
        retry_count = 0
        
        print(f"DEBUG: Initial status: {transcript.status}", flush=True)
        
        while transcript.status in ["queued", "processing"] and retry_count < max_retries:
            progress = min(progress + 2, 80)
            print(f"PROGRESS:{progress}", flush=True)
            print(f"DEBUG: Status check {retry_count + 1}, current status: {transcript.status}", flush=True)
            time.sleep(5)  # Wait 5 seconds before checking again
            retry_count += 1
            
            # Refresh transcript status
            try:
                if transcript.id:
                    # Use the correct method to refresh transcript
                    transcript = transcript.get_by_id(transcript.id)
                    print(f"DEBUG: Updated status: {transcript.status}", flush=True)
                else:
                    print("ERROR: No transcript ID available", file=sys.stderr, flush=True)
                    sys.exit(1)
            except Exception as e:
                print(f"ERROR: Failed to get transcript status: {e}", file=sys.stderr, flush=True)
                sys.exit(1)
        
        # Check for timeout
        if retry_count >= max_retries:
            print("ERROR: Transcription timed out after 5 minutes", file=sys.stderr, flush=True)
            sys.exit(1)
        
        # Check final status
        if transcript.status == "error":
            print(f"ERROR: Transcription failed: {transcript.error}", file=sys.stderr, flush=True)
            sys.exit(1)
        
        print("PROGRESS:80", flush=True)
        
        # Process results
        speakers = {}
        segments = []
        
        if transcript.utterances:
            speaker_count = 0
            for utterance in transcript.utterances:
                speaker_id = utterance.speaker
                if speaker_id not in speakers:
                    speakers[speaker_id] = {
                        "id": speaker_id,
                        "label": f"講者 {chr(65 + speaker_count)}",  # A, B, C, etc.
                        "color": get_speaker_color(speaker_count)
                    }
                    speaker_count += 1
                
                segments.append({
                    "text": utterance.text,
                    "speaker": speaker_id,
                    "start": utterance.start,
                    "end": utterance.end,
                    "confidence": round(utterance.confidence * 100) if utterance.confidence else 95,
                    "timestamp": format_timestamp(utterance.start)
                })
        
        print("PROGRESS:95", flush=True)
        
        # Calculate overall confidence
        total_confidence = 0
        confidence_count = 0
        if transcript.utterances:
            for utterance in transcript.utterances:
                if utterance.confidence:
                    total_confidence += utterance.confidence
                    confidence_count += 1
        
        overall_confidence = round(total_confidence / confidence_count * 100) if confidence_count > 0 else 95
        
        # Prepare result with correct field names for backend
        result = {
            "assemblyai_id": transcript.id,
            "transcript_text": transcript.text,
            "speakers": list(speakers.values()),
            "segments": segments,
            "confidence": overall_confidence / 100,  # Convert to decimal
            "duration": transcript.audio_duration,
            "word_count": len(transcript.text.split()) if transcript.text else 0
        }
        
        print("PROGRESS:95", flush=True)
        print(f"DEBUG: Final result created with {len(result['transcript_text'])} chars", flush=True)
        print("PROGRESS:100", flush=True)
        print(f"RESULT:{json.dumps(result, ensure_ascii=False)}", flush=True)
        print("SUCCESS: Transcription completed and result sent", flush=True)
        
    except Exception as e:
        print(f"ERROR: {str(e)}", file=sys.stderr, flush=True)
        sys.exit(1)

if __name__ == "__main__":
    main()
