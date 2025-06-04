#!/usr/bin/env python3

import assemblyai as aai
import time
import json

# Set API key
aai.settings.api_key = "0f0da6a87ee34439b8188dc991414cca"

print("[TEST] Starting direct API test...")

# Simple config
config = aai.TranscriptionConfig(
    speech_model=aai.SpeechModel.nano,  # Use fastest model for testing
    speaker_labels=False,  # Disable speaker detection for speed
    language_detection=True  # Auto-detect language
)

transcriber = aai.Transcriber(config=config)

# Test with a very short sample
audio_url = "https://github.com/AssemblyAI-Examples/audio-examples/raw/main/20230607_me_canadian_oil_exports.mp3"

print("[TEST] Submitting test audio...")
transcript = transcriber.submit(audio_url)
print(f"[TEST] Transcript ID: {transcript.id}")

# Wait for completion with timeout
max_wait = 30  # 30 seconds max
waited = 0
while transcript.status in ["queued", "processing"] and waited < max_wait:
    print(f"[TEST] Status: {transcript.status}, waited: {waited}s")
    time.sleep(2)
    waited += 2
    transcript = aai.Transcript.get_by_id(transcript.id)

print(f"[TEST] Final status: {transcript.status}")

if transcript.status == "completed":
    print(f"[TEST] SUCCESS - Text: {transcript.text[:100]}...")
    print(f"[TEST] Duration: {transcript.audio_duration}ms")
    print(f"[TEST] Confidence: {transcript.confidence}")
elif transcript.status == "error":
    print(f"[TEST] ERROR: {transcript.error}")
else:
    print(f"[TEST] TIMEOUT or UNKNOWN STATUS: {transcript.status}")