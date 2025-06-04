#!/usr/bin/env python3

import assemblyai as aai
import sys
import time

# Set the new API key
aai.settings.api_key = "0f0da6a87ee34439b8188dc991414cca"

print("PROGRESS:10", flush=True)

# Configure for Chinese transcription with speaker detection
config = aai.TranscriptionConfig(
    speech_model=aai.SpeechModel.best,
    speaker_labels=True,
    language_code="zh"
)

print("PROGRESS:30", flush=True)

transcriber = aai.Transcriber(config=config)

# Use sample audio URL for quick testing
audio_url = "https://storage.googleapis.com/aai-web-samples/5_common_sports_injuries.mp3"

print("PROGRESS:40", flush=True)
print("DEBUG: Starting transcription", flush=True)

try:
    # Submit transcription
    transcript = transcriber.submit(audio_url)
    print(f"DEBUG: Transcript ID: {transcript.id}", flush=True)
    
    # Wait for completion with progress updates
    progress = 40
    while transcript.status in ["queued", "processing"]:
        progress = min(progress + 5, 85)
        print(f"PROGRESS:{progress}", flush=True)
        print(f"DEBUG: Status: {transcript.status}", flush=True)
        time.sleep(3)
        transcript = aai.Transcript.get_by_id(transcript.id)
    
    print("PROGRESS:90", flush=True)
    
    if transcript.status == "completed":
        print("PROGRESS:100", flush=True)
        
        # Format results as JSON
        result = {
            "transcript_text": transcript.text,
            "confidence": transcript.confidence,
            "duration": transcript.audio_duration,
            "word_count": len(transcript.text.split()) if transcript.text else 0,
            "speakers": [],
            "segments": []
        }
        
        # Process speaker utterances if available
        if hasattr(transcript, 'utterances') and transcript.utterances:
            speakers = {}
            for i, utterance in enumerate(transcript.utterances):
                speaker_id = f"speaker_{utterance.speaker}"
                if speaker_id not in speakers:
                    speakers[speaker_id] = {
                        "id": speaker_id,
                        "label": f"說話者 {utterance.speaker}",
                        "color": f"hsl({(hash(speaker_id) % 360)}, 70%, 50%)"
                    }
                
                result["segments"].append({
                    "text": utterance.text,
                    "speaker": speaker_id,
                    "start": utterance.start,
                    "end": utterance.end,
                    "confidence": utterance.confidence,
                    "timestamp": f"{utterance.start//1000//60:02d}:{utterance.start//1000%60:02d}"
                })
            
            result["speakers"] = list(speakers.values())
        
        # Output final result as JSON
        import json
        print(f"RESULT:{json.dumps(result)}", flush=True)
        print("SUCCESS: Transcription completed", flush=True)
        
    else:
        print(f"ERROR: Transcription failed - {transcript.error}", flush=True)
        
except Exception as e:
    print(f"ERROR: {str(e)}", flush=True)
    sys.exit(1)