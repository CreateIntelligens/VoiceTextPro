#!/usr/bin/env python3
import os
import sys
import psycopg2
import requests
import time
import json

def process_large_file_direct(transcription_id):
    """Direct processing for large file transcription"""
    
    api_key = os.environ['ASSEMBLYAI_API_KEY']
    headers = {'authorization': api_key}
    
    # Get file path from database
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cursor = conn.cursor()
    cursor.execute("SELECT filename FROM transcriptions WHERE id = %s", (transcription_id,))
    result = cursor.fetchone()
    cursor.close()
    conn.close()
    
    if not result:
        print(f"Transcription {transcription_id} not found")
        return False
    
    file_path = f"uploads/{result[0]}"
    
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return False
    
    def update_progress(progress, status='processing', assemblyai_id=None, transcript_data=None):
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cursor = conn.cursor()
        
        if transcript_data:
            text = transcript_data.get('text', '')
            confidence = transcript_data.get('confidence', 0)
            duration = transcript_data.get('audio_duration', 0) / 1000 if transcript_data.get('audio_duration') else 0
            word_count = len(text.split()) if text else 0
            
            cursor.execute("""
                UPDATE transcriptions SET 
                    progress = %s, status = %s, transcript_text = %s,
                    confidence = %s, duration = %s, word_count = %s,
                    assemblyai_id = %s, updated_at = NOW()
                WHERE id = %s
            """, (progress, status, text, confidence, duration, word_count, assemblyai_id, transcription_id))
        else:
            if assemblyai_id:
                cursor.execute("UPDATE transcriptions SET progress=%s, status=%s, assemblyai_id=%s, updated_at=NOW() WHERE id=%s", 
                             (progress, status, assemblyai_id, transcription_id))
            else:
                cursor.execute("UPDATE transcriptions SET progress=%s, status=%s, updated_at=NOW() WHERE id=%s", 
                             (progress, status, transcription_id))
        
        conn.commit()
        cursor.close()
        conn.close()
        print(f"Progress: {progress}% ({status})")
    
    try:
        print(f"Processing large file: {file_path}")
        file_size = os.path.getsize(file_path) / 1024 / 1024
        print(f"File size: {file_size:.1f}MB")
        
        update_progress(5, 'processing')
        
        # Upload with smaller chunks for reliability
        def read_in_chunks(file_path, chunk_size=1048576):  # 1MB chunks
            with open(file_path, 'rb') as file:
                while True:
                    chunk = file.read(chunk_size)
                    if not chunk:
                        break
                    yield chunk
        
        print("Starting upload...")
        upload_response = requests.post(
            'https://api.assemblyai.com/v2/upload',
            headers=headers,
            data=read_in_chunks(file_path),
            timeout=2400  # 40 minute timeout
        )
        
        if upload_response.status_code != 200:
            print(f"Upload failed: {upload_response.status_code} - {upload_response.text}")
            update_progress(0, 'error')
            return False
        
        upload_url = upload_response.json()['upload_url']
        print("Upload completed successfully")
        update_progress(30, 'processing')
        
        # Start transcription
        config = {
            'audio_url': upload_url,
            'language_code': 'zh',
            'speaker_labels': True,
            'speakers_expected': 6,
            'auto_highlights': True,
            'auto_chapters': True,
            'sentiment_analysis': True,
            'entity_detection': True,
            'content_safety': True,
            'punctuate': True,
            'format_text': True,
            'disfluencies': False
        }
        
        print("Starting transcription...")
        transcript_response = requests.post(
            'https://api.assemblyai.com/v2/transcript',
            json=config,
            headers=headers,
            timeout=60
        )
        
        if transcript_response.status_code != 200:
            print(f"Transcription start failed: {transcript_response.status_code} - {transcript_response.text}")
            update_progress(25, 'error')
            return False
        
        assemblyai_id = transcript_response.json()['id']
        print(f"Transcription started: {assemblyai_id}")
        update_progress(50, 'processing', assemblyai_id)
        
        # Monitor transcription
        print("Monitoring transcription progress...")
        poll_count = 0
        max_polls = 480  # 4 hours
        
        while poll_count < max_polls:
            try:
                status_response = requests.get(
                    f'https://api.assemblyai.com/v2/transcript/{assemblyai_id}',
                    headers=headers,
                    timeout=30
                )
                
                if status_response.status_code == 200:
                    data = status_response.json()
                    status = data['status']
                    
                    if status == 'completed':
                        print("Transcription completed successfully!")
                        update_progress(100, 'completed', assemblyai_id, data)
                        return True
                        
                    elif status == 'error':
                        error_msg = data.get('error', 'Unknown error')
                        print(f"Transcription failed: {error_msg}")
                        update_progress(90, 'error', assemblyai_id)
                        return False
                        
                    elif status in ['queued', 'processing']:
                        progress = min(50 + (poll_count * 0.3), 98)
                        update_progress(int(progress), 'processing', assemblyai_id)
                        
                        if poll_count % 20 == 0:  # Log every 10 minutes
                            print(f"Transcription progress: {int(progress)}% - Status: {status}")
                
                time.sleep(30)
                poll_count += 1
                
            except Exception as e:
                print(f"Monitoring error: {e}")
                time.sleep(60)
                poll_count += 1
        
        print("Transcription monitoring timeout")
        update_progress(95, 'error', assemblyai_id)
        return False
        
    except Exception as e:
        print(f"Processing error: {e}")
        update_progress(0, 'error')
        return False

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python3 direct_large_file_processor.py <transcription_id>")
        sys.exit(1)
    
    transcription_id = int(sys.argv[1])
    success = process_large_file_direct(transcription_id)
    
    if success:
        print(f"Large file transcription {transcription_id} completed successfully")
    else:
        print(f"Large file transcription {transcription_id} failed")