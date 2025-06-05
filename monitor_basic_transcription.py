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

def update_database_with_results(transcription_id, transcript_data):
    """Update database with completed transcription results"""
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
        
        # Prepare update data
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
            'summary': f"基本轉錄完成。識別到 {len(speakers)} 位講者，共 {word_count} 字。處理時間較短，適合快速查看內容。",
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
            print(f"Basic transcription completed successfully")
            print(f"Word count: {word_count}")
            print(f"Duration: {transcript_data.get('audio_duration', 0)}s")
            print(f"Confidence: {transcript_data.get('confidence', 0):.2%}")
            print(f"Speakers: {len(speakers)}")
            return True
        else:
            print(f"Failed to update database: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print(f"Error updating database: {e}")
        return False

def monitor_transcription(assemblyai_id, transcription_id):
    """Monitor basic transcription until completion"""
    api_key = os.getenv('ASSEMBLYAI_API_KEY')
    if not api_key:
        print("ASSEMBLYAI_API_KEY environment variable not set")
        return False
    
    headers = {'authorization': api_key}
    start_time = time.time()
    max_wait_time = 600  # 10 minutes timeout for basic transcription
    
    print(f"Monitoring basic transcription {assemblyai_id} for database ID {transcription_id}")
    
    while True:
        try:
            response = requests.get(f'https://api.assemblyai.com/v2/transcript/{assemblyai_id}',
                                   headers=headers)
            
            if response.status_code != 200:
                print(f"Status check failed: {response.status_code} - {response.text}")
                time.sleep(10)
                continue
            
            transcript_data = response.json()
            status = transcript_data['status']
            
            elapsed_time = time.time() - start_time
            print(f"Status: {status} (elapsed: {elapsed_time:.0f}s)")
            
            if status == 'completed':
                print("Basic transcription completed successfully!")
                success = update_database_with_results(transcription_id, transcript_data)
                return success
            elif status == 'error':
                error_msg = transcript_data.get('error', 'Unknown error')
                print(f"Transcription failed: {error_msg}")
                # Update database with error
                try:
                    requests.patch(
                        f'http://localhost:5000/api/transcriptions/{transcription_id}',
                        json={'status': 'error', 'errorMessage': f"Basic transcription failed: {error_msg}"},
                        headers={'Content-Type': 'application/json'}
                    )
                except:
                    pass
                return False
            elif status == 'processing':
                # Update progress based on elapsed time
                if elapsed_time < 30:
                    progress = 60
                elif elapsed_time < 120:  # 2 minutes
                    progress = 75
                elif elapsed_time < 240:  # 4 minutes
                    progress = 85
                elif elapsed_time < 360:  # 6 minutes
                    progress = 95
                else:
                    progress = 98
                update_progress(transcription_id, progress)
            
            # Check for timeout
            if elapsed_time > max_wait_time:
                print(f"Basic transcription timeout after {max_wait_time/60:.0f} minutes")
                try:
                    requests.patch(
                        f'http://localhost:5000/api/transcriptions/{transcription_id}',
                        json={'status': 'error', 'errorMessage': 'Basic transcription timeout'},
                        headers={'Content-Type': 'application/json'}
                    )
                except:
                    pass
                return False
            
            time.sleep(8)  # Polling interval
            
        except Exception as e:
            print(f"Error during monitoring: {e}")
            time.sleep(10)

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python3 monitor_basic_transcription.py <assemblyai_id> <transcription_id>")
        sys.exit(1)
    
    assemblyai_id = sys.argv[1]
    transcription_id = int(sys.argv[2])
    
    success = monitor_transcription(assemblyai_id, transcription_id)
    sys.exit(0 if success else 1)