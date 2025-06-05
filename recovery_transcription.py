#!/usr/bin/env python3
import os
import sys
import time
import requests
import json
from datetime import datetime

def format_timestamp(milliseconds):
    """Convert milliseconds to MM:SS format"""
    if milliseconds is None:
        return "00:00"
    minutes = milliseconds // 60000
    seconds = (milliseconds % 60000) // 1000
    return f"{minutes:02d}:{seconds:02d}"

def get_speaker_color(speaker_index):
    """Get color for speaker based on index"""
    colors = ["hsl(220, 70%, 50%)", "hsl(120, 70%, 50%)", "hsl(0, 70%, 50%)", "hsl(280, 70%, 50%)"]
    return colors[speaker_index % len(colors)]

def calculate_word_count(text):
    """Calculate word count for different languages"""
    if not text:
        return 0
    
    # Check if text contains Chinese characters
    chinese_chars = sum(1 for char in text if '\u4e00' <= char <= '\u9fff')
    
    if chinese_chars > len(text) * 0.3:  # If more than 30% Chinese characters
        return len([char for char in text if '\u4e00' <= char <= '\u9fff'])
    else:
        return len(text.split())

def update_progress(transcription_id, progress):
    """Update progress in database"""
    try:
        response = requests.patch(
            f'http://localhost:5000/api/transcriptions/{transcription_id}',
            json={'progress': progress},
            headers={'Content-Type': 'application/json'},
            timeout=5
        )
        if response.status_code == 200:
            print(f"Progress updated to {progress}%", flush=True)
        else:
            print(f"Failed to update progress: {response.status_code}", flush=True)
    except Exception as e:
        print(f"Error updating progress: {e}", flush=True)

def start_basic_transcription(upload_url, api_key):
    """Start basic transcription without advanced features that might cause issues"""
    print("🚀 Starting basic transcription (recovery mode)...")
    
    # Simplified configuration to avoid conflicts
    data = {
        "audio_url": upload_url,
        "speaker_labels": True,
        "language_detection": True,
        "punctuate": True,
        "format_text": True,
        "disfluencies": False
    }
    
    headers = {
        'authorization': api_key,
        'content-type': 'application/json'
    }
    
    response = requests.post('https://api.assemblyai.com/v2/transcript',
                            headers=headers,
                            json=data)
    
    if response.status_code == 200:
        transcript_data = response.json()
        transcript_id = transcript_data['id']
        print(f"🔄 Basic transcription started with ID: {transcript_id}")
        return transcript_id
    else:
        raise Exception(f"Basic transcription start failed: {response.status_code} - {response.text}")

def poll_transcription_status(transcript_id, api_key, transcription_id):
    """Poll transcription status until completion"""
    headers = {'authorization': api_key}
    start_time = time.time()
    max_wait_time = 900  # 15 minutes timeout for basic transcription
    
    while True:
        response = requests.get(f'https://api.assemblyai.com/v2/transcript/{transcript_id}',
                               headers=headers)
        
        if response.status_code != 200:
            raise Exception(f"Status check failed: {response.status_code} - {response.text}")
        
        transcript_data = response.json()
        status = transcript_data['status']
        
        elapsed_time = time.time() - start_time
        print(f"⏳ Status: {status} (elapsed: {elapsed_time:.0f}s)")
        
        if status == 'completed':
            print("✅ Basic transcription completed successfully!")
            return transcript_data
        elif status == 'error':
            error_msg = transcript_data.get('error', 'Unknown error')
            raise Exception(f"Transcription failed: {error_msg}")
        elif status == 'processing':
            # Update progress based on elapsed time
            if elapsed_time < 60:
                progress = 60
            elif elapsed_time < 300:  # 5 minutes
                progress = 75
            elif elapsed_time < 600:  # 10 minutes
                progress = 85
            else:
                progress = 95
            update_progress(transcription_id, progress)
        
        # Check for timeout
        if elapsed_time > max_wait_time:
            raise Exception(f"Basic transcription timeout after {max_wait_time/60:.0f} minutes")
        
        time.sleep(8)  # Polling interval

def update_database_with_basic_results(transcription_id, transcript_data):
    """Update database with basic transcription results"""
    try:
        # Process speakers and segments
        speakers = []
        segments = []
        
        if transcript_data.get('utterances'):
            for utterance in transcript_data['utterances']:
                speaker_id = f"Speaker {utterance.get('speaker', 'Unknown')}"
                
                # Add speaker if not exists
                if not any(s['id'] == speaker_id for s in speakers):
                    speaker_index = len(speakers)
                    speakers.append({
                        'id': speaker_id,
                        'label': speaker_id,
                        'color': get_speaker_color(speaker_index)
                    })
                
                # Add segment
                segments.append({
                    'text': utterance.get('text', ''),
                    'speaker': speaker_id,
                    'start': utterance.get('start', 0),
                    'end': utterance.get('end', 0),
                    'confidence': utterance.get('confidence', 0)
                })
        
        # Calculate word count
        text = transcript_data.get('text', '')
        word_count = calculate_word_count(text)
        
        # Prepare update data (basic transcription without advanced features)
        update_data = {
            'status': 'completed',
            'progress': 100,
            'transcriptText': text,
            'speakers': speakers,
            'segments': segments,
            'confidence': transcript_data.get('confidence', 0),
            'duration': transcript_data.get('audio_duration', 0),
            'wordCount': word_count,
            'assemblyaiId': transcript_data.get('id'),
            'summary': f"基本轉錄完成。識別到 {len(speakers)} 位講者，共 {word_count} 字。",
            'summaryType': 'basic'
        }
        
        # Update database
        response = requests.patch(
            f'http://localhost:5000/api/transcriptions/{transcription_id}',
            json=update_data,
            headers={'Content-Type': 'application/json'},
            timeout=30
        )
        
        if response.status_code == 200:
            print(f"✓ Basic transcription completed successfully")
            print(f"✓ Word count: {word_count}")
            print(f"✓ Duration: {transcript_data.get('audio_duration', 0)}s")
            print(f"✓ Confidence: {transcript_data.get('confidence', 0):.2%}")
            print(f"✓ Speakers: {len(speakers)}")
        else:
            print(f"✗ Failed to update database: {response.status_code} - {response.text}")
            
    except Exception as e:
        print(f"✗ Error updating database: {e}")

def main():
    if len(sys.argv) < 3:
        print("Usage: python3 recovery_transcription.py <audio_file_path> <transcription_id>")
        sys.exit(1)
    
    audio_file_path = sys.argv[1]
    transcription_id = sys.argv[2]
    
    # Get API key
    api_key = os.getenv('ASSEMBLYAI_API_KEY')
    if not api_key:
        print("✗ ASSEMBLYAI_API_KEY environment variable not set")
        sys.exit(1)
    
    print(f"🎤 Starting recovery transcription for ID: {transcription_id}")
    print(f"📁 File: {audio_file_path}")
    
    try:
        # Step 1: Upload audio file
        update_progress(transcription_id, 10)
        print(f"⏳ Uploading audio file: {audio_file_path}")
        
        def read_file(filename, chunk_size=5242880):
            with open(filename, 'rb') as _file:
                while True:
                    data = _file.read(chunk_size)
                    if not data:
                        break
                    yield data

        headers = {'authorization': api_key}
        response = requests.post('https://api.assemblyai.com/v2/upload',
                                headers=headers,
                                data=read_file(audio_file_path))
        
        if response.status_code == 200:
            upload_url = response.json()['upload_url']
            print(f"✅ Audio uploaded successfully: {upload_url}")
        else:
            raise Exception(f"Upload failed: {response.status_code} - {response.text}")
        
        # Step 2: Start basic transcription
        update_progress(transcription_id, 30)
        transcript_id = start_basic_transcription(upload_url, api_key)
        
        # Step 3: Poll for completion
        update_progress(transcription_id, 50)
        transcript_data = poll_transcription_status(transcript_id, api_key, transcription_id)
        
        # Step 4: Update database
        update_progress(transcription_id, 90)
        update_database_with_basic_results(transcription_id, transcript_data)
        
        print("🎉 Recovery transcription completed successfully!")
        
    except Exception as e:
        print(f"✗ Error during recovery transcription: {e}")
        # Update database with error
        try:
            requests.patch(
                f'http://localhost:5000/api/transcriptions/{transcription_id}',
                json={'status': 'error', 'errorMessage': f"Recovery transcription failed: {str(e)}"},
                headers={'Content-Type': 'application/json'}
            )
        except:
            pass
        sys.exit(1)

if __name__ == "__main__":
    main()