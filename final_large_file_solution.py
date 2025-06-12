#!/usr/bin/env python3
import os
import sys
import psycopg2
import requests
import time
import json

def process_large_file_final(transcription_id):
    api_key = os.environ['ASSEMBLYAI_API_KEY']
    headers = {'authorization': api_key}
    
    # Get file info
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cursor = conn.cursor()
    cursor.execute("SELECT filename FROM transcriptions WHERE id = %s", (transcription_id,))
    result = cursor.fetchone()
    cursor.close()
    conn.close()
    
    if not result:
        return False
    
    file_path = f"uploads/{result[0]}"
    
    def update_status(progress, status='processing', assemblyai_id=None, data=None):
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cursor = conn.cursor()
        
        if data:
            text = data.get('text', '')
            confidence = data.get('confidence', 0)
            duration = data.get('audio_duration', 0) / 1000 if data.get('audio_duration') else 0
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
    
    try:
        update_status(10)
        
        # Upload with direct file reading
        with open(file_path, 'rb') as file:
            upload_response = requests.post(
                'https://api.assemblyai.com/v2/upload',
                headers=headers,
                data=file,
                timeout=3600
            )
        
        if upload_response.status_code != 200:
            update_status(0, 'error')
            return False
        
        upload_url = upload_response.json()['upload_url']
        update_status(40)
        
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
            'format_text': True
        }
        
        transcript_response = requests.post(
            'https://api.assemblyai.com/v2/transcript',
            json=config,
            headers=headers,
            timeout=120
        )
        
        if transcript_response.status_code != 200:
            update_status(35, 'error')
            return False
        
        assemblyai_id = transcript_response.json()['id']
        update_status(50, 'processing', assemblyai_id)
        
        # Monitor until completion
        for poll in range(480):
            response = requests.get(
                f'https://api.assemblyai.com/v2/transcript/{assemblyai_id}',
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                status = data['status']
                
                if status == 'completed':
                    update_status(100, 'completed', assemblyai_id, data)
                    return True
                elif status == 'error':
                    update_status(90, 'error', assemblyai_id)
                    return False
                elif status in ['queued', 'processing']:
                    progress = min(50 + (poll * 0.3), 98)
                    update_status(int(progress))
            
            time.sleep(30)
        
        update_status(95, 'error', assemblyai_id)
        return False
        
    except Exception as e:
        update_status(0, 'error')
        return False

if __name__ == "__main__":
    success = process_large_file_final(50)
    print("Success" if success else "Failed")