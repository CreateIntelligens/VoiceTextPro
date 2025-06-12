#!/usr/bin/env python3
"""
Comprehensive Large File Handler
Advanced processing system for large audio files with multiple retry strategies
"""

import os
import sys
import time
import json
import requests
import psycopg2
import threading
from datetime import datetime
import subprocess

class ComprehensiveLargeFileHandler:
    def __init__(self, transcription_id):
        self.transcription_id = transcription_id
        self.api_key = os.environ['ASSEMBLYAI_API_KEY']
        self.headers = {'authorization': self.api_key}
        self.db_url = os.environ['DATABASE_URL']
        self.file_path = None
        self.file_size = 0
        self.assemblyai_id = None
        
    def log(self, message):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] [ID-{self.transcription_id}] {message}")
        
    def get_file_info(self):
        """Retrieve file information from database"""
        try:
            conn = psycopg2.connect(self.db_url)
            cursor = conn.cursor()
            cursor.execute("SELECT filename, file_size FROM transcriptions WHERE id = %s", (self.transcription_id,))
            result = cursor.fetchone()
            cursor.close()
            conn.close()
            
            if result:
                filename, file_size = result
                self.file_path = f"uploads/{filename}"
                self.file_size = file_size
                return True
            return False
        except Exception as e:
            self.log(f"Database query failed: {e}")
            return False
    
    def update_database(self, progress=None, status=None, assemblyai_id=None, transcript_data=None):
        """Update transcription status in database"""
        try:
            conn = psycopg2.connect(self.db_url)
            cursor = conn.cursor()
            
            if transcript_data:
                # Complete transcription result
                text = transcript_data.get('text', '')
                confidence = transcript_data.get('confidence', 0)
                duration = transcript_data.get('audio_duration', 0) / 1000 if transcript_data.get('audio_duration') else 0
                word_count = len(text.split()) if text else 0
                
                # Process additional features
                auto_highlights = json.dumps(transcript_data.get('auto_highlights_result', {}).get('results', []))
                auto_chapters = json.dumps(transcript_data.get('chapters', []))
                sentiment_analysis = json.dumps(transcript_data.get('sentiment_analysis_results', []))
                entity_detection = json.dumps(transcript_data.get('entities', []))
                content_safety = json.dumps(transcript_data.get('content_safety_labels', {}))
                
                # Process speaker segments
                speaker_segments = []
                if transcript_data.get('utterances'):
                    for utterance in transcript_data['utterances']:
                        speaker_segments.append({
                            'speaker': utterance.get('speaker', 'Unknown'),
                            'text': utterance.get('text', ''),
                            'start': utterance.get('start', 0),
                            'end': utterance.get('end', 0),
                            'confidence': utterance.get('confidence', 0)
                        })
                
                cursor.execute("""
                    UPDATE transcriptions SET 
                        progress = %s, status = %s, transcript_text = %s,
                        confidence = %s, duration = %s, word_count = %s,
                        assemblyai_id = %s, auto_highlights = %s, auto_chapters = %s,
                        sentiment_analysis = %s, entity_detection = %s, content_safety = %s,
                        speaker_segments = %s, updated_at = NOW()
                    WHERE id = %s
                """, (
                    progress, status, text, confidence, duration, word_count,
                    assemblyai_id, auto_highlights, auto_chapters, sentiment_analysis,
                    entity_detection, content_safety, json.dumps(speaker_segments),
                    self.transcription_id
                ))
            else:
                # Progress update
                update_fields = ['updated_at = NOW()']
                values = []
                
                if progress is not None:
                    update_fields.append('progress = %s')
                    values.append(progress)
                if status is not None:
                    update_fields.append('status = %s')
                    values.append(status)
                if assemblyai_id is not None:
                    update_fields.append('assemblyai_id = %s')
                    values.append(assemblyai_id)
                    self.assemblyai_id = assemblyai_id
                
                values.append(self.transcription_id)
                cursor.execute(f"UPDATE transcriptions SET {', '.join(update_fields)} WHERE id = %s", values)
            
            conn.commit()
            cursor.close()
            conn.close()
            return True
            
        except Exception as e:
            self.log(f"Database update failed: {e}")
            return False
    
    def validate_file(self):
        """Validate file exists and is accessible"""
        if not self.file_path or not os.path.exists(self.file_path):
            self.log(f"File not found: {self.file_path}")
            return False
        
        actual_size = os.path.getsize(self.file_path)
        self.log(f"File validation: {actual_size / 1024 / 1024:.1f}MB")
        
        if actual_size != self.file_size:
            self.log(f"File size mismatch: expected {self.file_size}, actual {actual_size}")
        
        return True
    
    def upload_with_chunked_strategy(self, chunk_size=2097152, max_retries=5):
        """Upload file using chunked strategy with multiple retry attempts"""
        self.log(f"Starting chunked upload (chunk size: {chunk_size / 1024 / 1024:.1f}MB)")
        
        def read_chunks(file_path, chunk_size):
            with open(file_path, 'rb') as file:
                chunk_count = 0
                while True:
                    chunk = file.read(chunk_size)
                    if not chunk:
                        break
                    chunk_count += 1
                    if chunk_count % 50 == 0:  # Log every 50 chunks
                        self.log(f"Uploading chunk {chunk_count}")
                    yield chunk
        
        for attempt in range(max_retries):
            try:
                self.log(f"Upload attempt {attempt + 1}/{max_retries}")
                self.update_database(progress=10 + (attempt * 3))
                
                response = requests.post(
                    'https://api.assemblyai.com/v2/upload',
                    headers=self.headers,
                    data=read_chunks(self.file_path, chunk_size),
                    timeout=3600  # 1 hour timeout
                )
                
                if response.status_code == 200:
                    upload_url = response.json()['upload_url']
                    self.log("Upload completed successfully")
                    self.update_database(progress=30)
                    return upload_url
                else:
                    self.log(f"Upload failed: {response.status_code} - {response.text}")
                    
            except requests.exceptions.Timeout:
                self.log(f"Upload timeout on attempt {attempt + 1}")
            except Exception as e:
                self.log(f"Upload error on attempt {attempt + 1}: {e}")
            
            if attempt < max_retries - 1:
                wait_time = min(60 * (attempt + 1), 300)  # Max 5 minute wait
                self.log(f"Waiting {wait_time} seconds before retry...")
                time.sleep(wait_time)
                
                # Try smaller chunks on subsequent attempts
                chunk_size = max(chunk_size // 2, 524288)  # Minimum 512KB
        
        return None
    
    def start_transcription_with_optimal_settings(self, upload_url):
        """Start transcription with settings optimized for large files"""
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
            'disfluencies': False,
            'dual_channel': False,
            'webhook_url': None,  # No webhook for large files
            'webhook_auth_header_name': None,
            'webhook_auth_header_value': None
        }
        
        try:
            self.log("Initiating transcription with optimal settings")
            response = requests.post(
                'https://api.assemblyai.com/v2/transcript',
                json=config,
                headers=self.headers,
                timeout=120
            )
            
            if response.status_code == 200:
                transcript_data = response.json()
                assemblyai_id = transcript_data['id']
                self.log(f"Transcription started: {assemblyai_id}")
                self.update_database(progress=40, status='processing', assemblyai_id=assemblyai_id)
                return assemblyai_id
            else:
                self.log(f"Transcription start failed: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            self.log(f"Transcription start error: {e}")
            return None
    
    def monitor_with_adaptive_polling(self, assemblyai_id):
        """Monitor transcription with adaptive polling intervals"""
        self.log("Starting adaptive monitoring")
        
        poll_count = 0
        max_polls = 720  # 6 hours maximum
        base_interval = 30
        
        while poll_count < max_polls:
            try:
                # Adaptive interval: start with 30s, increase to 60s after 1 hour
                interval = base_interval if poll_count < 120 else 60
                
                response = requests.get(
                    f'https://api.assemblyai.com/v2/transcript/{assemblyai_id}',
                    headers=self.headers,
                    timeout=45
                )
                
                if response.status_code == 200:
                    data = response.json()
                    status = data['status']
                    
                    if status == 'completed':
                        self.log("Transcription completed successfully")
                        self.update_database(progress=100, status='completed', transcript_data=data)
                        return True
                        
                    elif status == 'error':
                        error_msg = data.get('error', 'Unknown error occurred')
                        self.log(f"Transcription failed: {error_msg}")
                        self.update_database(progress=90, status='error')
                        return False
                        
                    elif status in ['queued', 'processing']:
                        # Dynamic progress calculation
                        if status == 'queued':
                            progress = min(40 + (poll_count * 0.1), 50)
                        else:  # processing
                            progress = min(50 + (poll_count * 0.2), 98)
                        
                        self.update_database(progress=int(progress))
                        
                        # Log progress every 10 minutes
                        if poll_count % (600 // interval) == 0:
                            elapsed_time = (poll_count * interval) / 60
                            self.log(f"Progress: {int(progress)}% - Status: {status} - Elapsed: {elapsed_time:.1f}min")
                    
                    else:
                        self.log(f"Unknown status: {status}")
                
                elif response.status_code == 404:
                    self.log("Transcript not found - may have been deleted")
                    self.update_database(progress=0, status='error')
                    return False
                    
                else:
                    self.log(f"Status check failed: {response.status_code}")
                
                time.sleep(interval)
                poll_count += 1
                
            except requests.exceptions.Timeout:
                self.log("Status check timeout")
                time.sleep(60)
                poll_count += 1
                
            except Exception as e:
                self.log(f"Monitoring error: {e}")
                time.sleep(120)  # Wait longer on errors
                poll_count += 1
        
        self.log("Monitoring timeout reached")
        self.update_database(progress=95, status='error')
        return False
    
    def execute_complete_workflow(self):
        """Execute the complete large file processing workflow"""
        try:
            self.log("Starting comprehensive large file processing")
            
            # Initialize
            if not self.get_file_info():
                self.log("Failed to retrieve file information")
                self.update_database(progress=0, status='error')
                return False
            
            if not self.validate_file():
                self.log("File validation failed")
                self.update_database(progress=0, status='error')
                return False
            
            self.update_database(progress=5, status='processing')
            
            # Upload phase
            upload_url = self.upload_with_chunked_strategy()
            if not upload_url:
                self.log("Upload failed after all retry attempts")
                self.update_database(progress=0, status='error')
                return False
            
            # Transcription phase
            assemblyai_id = self.start_transcription_with_optimal_settings(upload_url)
            if not assemblyai_id:
                self.log("Failed to start transcription")
                self.update_database(progress=25, status='error')
                return False
            
            # Monitoring phase
            success = self.monitor_with_adaptive_polling(assemblyai_id)
            
            if success:
                self.log("Large file processing completed successfully")
                return True
            else:
                self.log("Large file processing failed during monitoring")
                return False
                
        except Exception as e:
            self.log(f"Workflow error: {e}")
            self.update_database(progress=0, status='error')
            return False

def main():
    if len(sys.argv) != 2:
        print("Usage: python3 comprehensive_large_file_handler.py <transcription_id>")
        sys.exit(1)
    
    transcription_id = int(sys.argv[1])
    handler = ComprehensiveLargeFileHandler(transcription_id)
    
    success = handler.execute_complete_workflow()
    
    if success:
        print(f"Transcription {transcription_id} completed successfully")
        sys.exit(0)
    else:
        print(f"Transcription {transcription_id} failed")
        sys.exit(1)

if __name__ == "__main__":
    main()