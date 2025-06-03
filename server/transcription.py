#!/usr/bin/env python3
import sys
import os
import json
import assemblyai as aai
from datetime import timedelta

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
    
    # Get API key from environment variables
    api_key = os.getenv("ASSEMBLYAI_API_KEY") or os.getenv("ASSEMBLY_AI_API_KEY") or "0f0da6a87ee34439b8188dc991414cca"
    
    if not api_key:
        print("ERROR: AssemblyAI API key not found in environment variables", file=sys.stderr)
        sys.exit(1)
    
    # Set API key
    aai.settings.api_key = api_key
    
    try:
        print("PROGRESS:10")
        
        # Configure transcription with best model and speaker labels
        config = aai.TranscriptionConfig(
            speech_model=aai.SpeechModel.best,
            speaker_labels=True,
            language_code="zh"  # Chinese language
        )
        
        print("PROGRESS:20")
        
        # Create transcriber and start transcription
        transcriber = aai.Transcriber(config=config)
        
        print("PROGRESS:30")
        
        # Submit for transcription
        transcript = transcriber.transcribe(audio_file_path)
        
        print("PROGRESS:50")
        
        # Wait for completion
        if transcript.status == "error":
            print(f"ERROR: Transcription failed: {transcript.error}", file=sys.stderr)
            sys.exit(1)
        
        print("PROGRESS:80")
        
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
        
        print("PROGRESS:95")
        
        # Calculate overall confidence
        total_confidence = 0
        confidence_count = 0
        if transcript.utterances:
            for utterance in transcript.utterances:
                if utterance.confidence:
                    total_confidence += utterance.confidence
                    confidence_count += 1
        
        overall_confidence = round(total_confidence / confidence_count * 100) if confidence_count > 0 else 95
        
        # Prepare result
        result = {
            "id": transcript.id,
            "text": transcript.text,
            "speakers": list(speakers.values()),
            "segments": segments,
            "confidence": overall_confidence,
            "audio_duration": transcript.audio_duration,
            "words": transcript.words
        }
        
        print("PROGRESS:100")
        print(f"RESULT:{json.dumps(result)}")
        
    except Exception as e:
        print(f"ERROR: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
