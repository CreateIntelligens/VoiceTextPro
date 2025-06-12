#!/usr/bin/env python3
"""
Robust Large File Processor
Handles large audio file transcription with improved error handling and retry mechanisms
"""

import os
import sys
import time
import json
import requests
import psycopg2
from datetime import datetime

class RobustLargeFileProcessor:
    def __init__(self, transcription_id):
        self.transcription_id = transcription_id
        self.api_key = os.environ['ASSEMBLYAI_API_KEY']
        self.headers = {'authorization': self.api_key}
        self.db_url = os.environ['DATABASE_URL']
        
    def log(self, message):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] [ID-{self.transcription_id}] {message}")
        
    def update_db(self, progress=None, status=None, assemblyai_id=None, transcript_data=None):
        """Update database with current processing status"""
        try:
            conn = psycopg2.connect(self.db_url)
            cursor = conn.cursor()
            
            if transcript_data:
                # Complete transcription update
                text = transcript_data.get('text', '')
                confidence = transcript_data.get('confidence', 0)
                duration = transcript_data.get('audio_duration', 0) / 1000 if transcript_data.get('audio_duration') else 0
                word_count = len(text.split()) if text else 0
                
                cursor.execute("""
                    UPDATE transcriptions SET 
                        progress = %s, status = %s, assemblyai_id = %s,
                        transcript_text = %s, confidence = %s, duration = %s,
                        word_count = %s, updated_at = NOW()
                    WHERE id = %s
                """, (progress, status, assemblyai_id, text, confidence, duration, word_count, self.transcription_id))
            else:
                # Progress update only
                update_parts = []
                values = []
                
                if progress is not None:
                    update_parts.append("progress = %s")
                    values.append(progress)
                    
                if status is not None:
                    update_parts.append("status = %s")
                    values.append(status)
                    
                if assemblyai_id is not None:
                    update_parts.append("assemblyai_id = %s")
                    values.append(assemblyai_id)
                    
                update_parts.append("updated_at = NOW()")
                values.append(self.transcription_id)
                
                query = f"UPDATE transcriptions SET {', '.join(update_parts)} WHERE id = %s"
                cursor.execute(query, values)
            
            conn.commit()
            cursor.close()
            conn.close()
            return True
            
        except Exception as e:
            self.log(f"Database update failed: {e}")
            return False
    
    def get_file_info(self):
        """Get file information from database"""
        try:
            conn = psycopg2.connect(self.db_url)
            cursor = conn.cursor()
            cursor.execute("SELECT filename, file_size FROM transcriptions WHERE id = %s", (self.transcription_id,))
            result = cursor.fetchone()
            cursor.close()
            conn.close()
            
            if result:
                filename, file_size = result
                file_path = f"uploads/{filename}"
                return file_path, file_size
            return None, None
            
        except Exception as e:
            self.log(f"Failed to get file info: {e}")
            return None, None
    
    def upload_file_with_retry(self, file_path, max_retries=3):
        """Upload file to AssemblyAI with retry mechanism"""
        self.log(f"Starting file upload: {file_path}")
        
        if not os.path.exists(file_path):
            self.log(f"File not found: {file_path}")
            return None
            
        file_size = os.path.getsize(file_path)
        self.log(f"File size: {file_size / 1024 / 1024:.1f}MB")
        
        def read_file_chunks(filename, chunk_size=5242880):  # 5MB chunks
            with open(filename, 'rb') as f:
                while True:
                    chunk = f.read(chunk_size)
                    if not chunk:
                        break
                    yield chunk
        
        for attempt in range(max_retries):
            try:
                self.log(f"Upload attempt {attempt + 1}/{max_retries}")
                self.update_db(progress=10 + (attempt * 5))
                
                response = requests.post(
                    'https://api.assemblyai.com/v2/upload',
                    headers=self.headers,
                    data=read_file_chunks(file_path),
                    timeout=600  # 10 minute timeout
                )
                
                if response.status_code == 200:
                    upload_url = response.json()['upload_url']
                    self.log("File upload successful")
                    self.update_db(progress=30)
                    return upload_url
                else:
                    self.log(f"Upload failed with status {response.status_code}: {response.text}")
                    
            except requests.exceptions.Timeout:
                self.log(f"Upload timeout on attempt {attempt + 1}")
            except Exception as e:
                self.log(f"Upload error on attempt {attempt + 1}: {e}")
            
            if attempt < max_retries - 1:
                wait_time = (attempt + 1) * 30  # Exponential backoff
                self.log(f"Waiting {wait_time} seconds before retry...")
                time.sleep(wait_time)
        
        self.log("All upload attempts failed")
        return None
    
    def start_transcription(self, upload_url):
        """Start transcription with AssemblyAI"""
        self.log("Starting transcription...")
        
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
        
        try:
            response = requests.post(
                'https://api.assemblyai.com/v2/transcript',
                json=config,
                headers=self.headers,
                timeout=60
            )
            
            if response.status_code == 200:
                transcript_data = response.json()
                assemblyai_id = transcript_data['id']
                self.log(f"Transcription started successfully: {assemblyai_id}")
                self.update_db(progress=50, assemblyai_id=assemblyai_id)
                return assemblyai_id
            else:
                self.log(f"Transcription start failed: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            self.log(f"Transcription start error: {e}")
            return None
    
    def monitor_transcription(self, assemblyai_id):
        """Monitor transcription progress until completion"""
        self.log("Starting transcription monitoring...")
        
        max_polls = 480  # 4 hours with 30-second intervals
        poll_count = 0
        
        while poll_count < max_polls:
            try:
                response = requests.get(
                    f'https://api.assemblyai.com/v2/transcript/{assemblyai_id}',
                    headers=self.headers,
                    timeout=30
                )
                
                if response.status_code != 200:
                    self.log(f"Status check failed: {response.status_code}")
                    time.sleep(30)
                    poll_count += 1
                    continue
                
                data = response.json()
                status = data['status']
                
                if status == 'completed':
                    self.log("Transcription completed!")
                    self.update_db(progress=100, status='completed', transcript_data=data)
                    return True
                    
                elif status == 'error':
                    error_msg = data.get('error', 'Unknown error')
                    self.log(f"Transcription failed: {error_msg}")
                    self.update_db(progress=90, status='error')
                    return False
                    
                elif status in ['queued', 'processing']:
                    # Calculate progress based on time elapsed
                    progress = min(50 + (poll_count * 0.8), 98)
                    self.update_db(progress=int(progress))
                    
                    if poll_count % 10 == 0:  # Log every 5 minutes
                        self.log(f"Transcription in progress... {int(progress)}% (Status: {status})")
                
                time.sleep(30)
                poll_count += 1
                
            except Exception as e:
                self.log(f"Monitoring error: {e}")
                time.sleep(60)
                poll_count += 1
        
        self.log("Monitoring timeout reached")
        self.update_db(progress=95, status='error')
        return False
    
    def process_complete_workflow(self):
        """Execute the complete large file processing workflow"""
        try:
            self.log("Starting robust large file processing workflow")
            self.update_db(progress=5, status='processing')
            
            # Get file information
            file_path, file_size = self.get_file_info()
            if not file_path:
                self.log("Failed to get file information")
                self.update_db(progress=0, status='error')
                return False
            
            # Upload file
            upload_url = self.upload_file_with_retry(file_path)
            if not upload_url:
                self.log("File upload failed after all retries")
                self.update_db(progress=0, status='error')
                return False
            
            # Start transcription
            assemblyai_id = self.start_transcription(upload_url)
            if not assemblyai_id:
                self.log("Failed to start transcription")
                self.update_db(progress=25, status='error')
                return False
            
            # Monitor until completion
            success = self.monitor_transcription(assemblyai_id)
            
            if success:
                self.log("Large file processing completed successfully")
                return True
            else:
                self.log("Large file processing failed during monitoring")
                return False
                
        except Exception as e:
            self.log(f"Workflow error: {e}")
            self.update_db(progress=0, status='error')
            return False

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 robust_large_file_processor.py <transcription_id>")
        sys.exit(1)
    
    transcription_id = int(sys.argv[1])
    processor = RobustLargeFileProcessor(transcription_id)
    
    success = processor.process_complete_workflow()
    
    if success:
        print(f"Large file transcription {transcription_id} completed successfully")
    else:
        print(f"Large file transcription {transcription_id} failed")

if __name__ == "__main__":
    main()