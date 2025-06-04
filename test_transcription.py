import assemblyai as aai
import os
import sys

# Set API key
aai.settings.api_key = os.environ.get('ASSEMBLYAI_API_KEY')

print('Testing AssemblyAI with sample audio...', flush=True)

config = aai.TranscriptionConfig(
    speech_model=aai.SpeechModel.best,
    speaker_labels=True,
    language_code='zh'
)

transcriber = aai.Transcriber(config=config)

# Use a small sample audio URL for quick testing
audio_url = 'https://storage.googleapis.com/aai-web-samples/5_common_sports_injuries.mp3'

print('Starting transcription...', flush=True)
transcript = transcriber.submit(audio_url)
print(f'Transcript ID: {transcript.id}', flush=True)

# Poll for completion
import time
while transcript.status in ["queued", "processing"]:
    print(f'Status: {transcript.status}', flush=True)
    time.sleep(2)
    transcript = aai.Transcript.get_by_id(transcript.id)

print(f'Final status: {transcript.status}', flush=True)

if transcript.status == 'completed':
    print('SUCCESS: Transcription completed')
    print(f'Text preview: {transcript.text[:200]}...')
    
    # Test speaker detection
    if hasattr(transcript, 'utterances') and transcript.utterances:
        print(f'Found {len(transcript.utterances)} speaker segments')
    else:
        print('No speaker segments found')
else:
    print(f'ERROR: {transcript.error}')