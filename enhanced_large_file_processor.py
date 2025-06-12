#!/usr/bin/env python3
"""
Enhanced Large File Processor for 184MB+ Audio Files
Implements intelligent segmentation with optimal chunk sizes and robust error handling
"""

import os
import psycopg2
import requests
import time
import json
import subprocess
import math
from pathlib import Path

class EnhancedLargeFileProcessor:
    def __init__(self, transcription_id=None):
        self.transcription_id = transcription_id
        self.api_key = os.environ['ASSEMBLYAI_API_KEY']
        self.headers = {'authorization': self.api_key}
        self.segments = []
        self.segment_results = []
        
    def log(self, message):
        timestamp = time.strftime('%H:%M:%S')
        print(f"[{timestamp}] {message}")
        
    def update_db(self, progress=None, status=None, assemblyai_id=None, result_data=None):
        """Update database with current processing status"""
        try:
            conn = psycopg2.connect(os.environ['DATABASE_URL'])
            cursor = conn.cursor()
            
            if result_data:
                # Process completed transcription with full results
                text = result_data.get('text', '')
                confidence = result_data.get('confidence', 0)
                duration = result_data.get('audio_duration', 0) / 1000 if result_data.get('audio_duration') else 0
                word_count = len([word for word in text.split() if word.strip()])
                
                # Process speaker segments
                speaker_segments = []
                if result_data.get('utterances'):
                    for utterance in result_data['utterances']:
                        speaker_segments.append({
                            'speaker': utterance.get('speaker', 'Unknown'),
                            'text': utterance.get('text', ''),
                            'start': utterance.get('start', 0),
                            'end': utterance.get('end', 0),
                            'confidence': utterance.get('confidence', 0)
                        })
                
                # Process advanced features
                auto_highlights = json.dumps(result_data.get('auto_highlights_result', {}).get('results', []))
                auto_chapters = json.dumps(result_data.get('chapters', []))
                sentiment_analysis = json.dumps(result_data.get('sentiment_analysis_results', []))
                entity_detection = json.dumps(result_data.get('entities', []))
                content_safety = json.dumps(result_data.get('content_safety_labels', {}))
                
                cursor.execute('''
                    UPDATE transcriptions SET 
                        progress = %s, status = %s, transcript_text = %s,
                        confidence = %s, duration = %s, word_count = %s,
                        assemblyai_id = %s, auto_highlights = %s, auto_chapters = %s,
                        sentiment_analysis = %s, entity_detection = %s, content_safety = %s,
                        speaker_segments = %s, updated_at = NOW()
                    WHERE id = %s
                ''', (progress, status, text, confidence, duration, word_count,
                      assemblyai_id, auto_highlights, auto_chapters, sentiment_analysis,
                      entity_detection, content_safety, json.dumps(speaker_segments),
                      self.transcription_id))
            else:
                # Simple progress/status update
                if assemblyai_id:
                    cursor.execute('''
                        UPDATE transcriptions SET progress=%s, status=%s, assemblyai_id=%s, updated_at=NOW() 
                        WHERE id=%s
                    ''', (progress, status, assemblyai_id, self.transcription_id))
                else:
                    cursor.execute('''
                        UPDATE transcriptions SET progress=%s, status=%s, updated_at=NOW() 
                        WHERE id=%s
                    ''', (progress, status, self.transcription_id))
            
            conn.commit()
            cursor.close()
            conn.close()
            return True
            
        except Exception as e:
            self.log(f"Database update error: {e}")
            return False
    
    def get_file_info(self):
        """Get file information from database"""
        try:
            conn = psycopg2.connect(os.environ['DATABASE_URL'])
            cursor = conn.cursor()
            cursor.execute('SELECT filename FROM transcriptions WHERE id = %s', (self.transcription_id,))
            result = cursor.fetchone()
            cursor.close()
            conn.close()
            
            if result:
                filename = result[0]
                file_path = f'uploads/{filename}'
                if os.path.exists(file_path):
                    file_size = os.path.getsize(file_path)
                    return {'path': file_path, 'size': file_size, 'filename': filename}
            
            return None
            
        except Exception as e:
            self.log(f"Failed to get file info: {e}")
            return None
    
    def create_optimal_segments(self, file_path, target_size_mb=80):
        """Create optimal audio segments for processing"""
        try:
            file_size = os.path.getsize(file_path)
            file_size_mb = file_size / (1024 * 1024)
            
            self.log(f"Original file size: {file_size_mb:.1f}MB")
            
            if file_size_mb <= target_size_mb:
                self.log("File size within limit, processing as single file")
                return [file_path]
            
            # Calculate number of segments needed
            num_segments = math.ceil(file_size_mb / target_size_mb)
            self.log(f"Creating {num_segments} segments")
            
            # Get audio duration
            duration_cmd = [
                'ffprobe', '-v', 'quiet', '-show_entries', 'format=duration',
                '-of', 'csv=p=0', file_path
            ]
            
            try:
                duration_output = subprocess.check_output(duration_cmd, stderr=subprocess.DEVNULL)
                total_duration = float(duration_output.decode().strip())
                segment_duration = total_duration / num_segments
                
                self.log(f"Total duration: {total_duration:.1f}s, segment duration: {segment_duration:.1f}s")
                
            except:
                # Fallback: estimate based on file size
                segment_duration = 600  # 10 minutes per segment
                self.log(f"Using fallback segment duration: {segment_duration}s")
            
            # Create segments directory
            segments_dir = Path('uploads/segments')
            segments_dir.mkdir(exist_ok=True)
            
            # Clear any existing segments
            for existing_segment in segments_dir.glob(f'segment_{self.transcription_id}_*.m4a'):
                existing_segment.unlink()
            
            segments = []
            
            for i in range(num_segments):
                start_time = i * segment_duration
                segment_path = segments_dir / f'segment_{self.transcription_id}_{i:03d}.m4a'
                
                # Create segment using ffmpeg
                ffmpeg_cmd = [
                    'ffmpeg', '-i', file_path,
                    '-ss', str(start_time),
                    '-t', str(segment_duration),
                    '-c', 'copy',
                    '-avoid_negative_ts', 'make_zero',
                    '-y',  # Overwrite output files
                    str(segment_path)
                ]
                
                self.log(f"Creating segment {i+1}/{num_segments}")
                
                try:
                    subprocess.run(
                        ffmpeg_cmd,
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        check=True,
                        timeout=300  # 5 minutes timeout per segment
                    )
                    
                    if segment_path.exists() and segment_path.stat().st_size > 1024:  # At least 1KB
                        segments.append(str(segment_path))
                        segment_size = segment_path.stat().st_size / (1024 * 1024)
                        self.log(f"Segment {i+1} created: {segment_size:.1f}MB")
                    else:
                        self.log(f"Segment {i+1} creation failed or too small")
                        
                except subprocess.TimeoutExpired:
                    self.log(f"Segment {i+1} creation timed out")
                except subprocess.CalledProcessError as e:
                    self.log(f"Segment {i+1} creation failed: {e}")
            
            self.log(f"Successfully created {len(segments)} segments")
            return segments
            
        except Exception as e:
            self.log(f"Segmentation failed: {e}")
            return [file_path]  # Fallback to original file
    
    def upload_file(self, file_path):
        """Upload file to AssemblyAI with retry mechanism"""
        max_retries = 3
        
        for attempt in range(max_retries):
            try:
                self.log(f"Uploading {os.path.basename(file_path)} (attempt {attempt + 1})")
                
                with open(file_path, 'rb') as file:
                    response = requests.post(
                        'https://api.assemblyai.com/v2/upload',
                        headers=self.headers,
                        data=file,
                        timeout=1800  # 30 minutes timeout
                    )
                
                if response.status_code == 200:
                    upload_url = response.json()['upload_url']
                    self.log(f"Upload successful: {upload_url}")
                    return upload_url
                else:
                    self.log(f"Upload failed with status {response.status_code}")
                    
            except requests.exceptions.Timeout:
                self.log(f"Upload timeout on attempt {attempt + 1}")
            except Exception as e:
                self.log(f"Upload error on attempt {attempt + 1}: {e}")
            
            if attempt < max_retries - 1:
                wait_time = (attempt + 1) * 30
                self.log(f"Waiting {wait_time}s before retry")
                time.sleep(wait_time)
        
        return None
    
    def start_transcription(self, upload_url):
        """Start transcription with optimal settings"""
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
            'dual_channel': False
        }
        
        try:
            response = requests.post(
                'https://api.assemblyai.com/v2/transcript',
                json=config,
                headers=self.headers,
                timeout=120
            )
            
            if response.status_code == 200:
                transcript_id = response.json()['id']
                self.log(f"Transcription started: {transcript_id}")
                return transcript_id
            else:
                self.log(f"Transcription start failed: {response.status_code}")
                return None
                
        except Exception as e:
            self.log(f"Transcription start error: {e}")
            return None
    
    def monitor_transcription(self, transcript_id):
        """Monitor transcription until completion"""
        max_polls = 480  # 4 hours maximum
        
        for poll_count in range(max_polls):
            try:
                response = requests.get(
                    f'https://api.assemblyai.com/v2/transcript/{transcript_id}',
                    headers=self.headers,
                    timeout=30
                )
                
                if response.status_code == 200:
                    data = response.json()
                    status = data['status']
                    
                    if status == 'completed':
                        self.log("Transcription completed")
                        return data
                    elif status == 'error':
                        error_msg = data.get('error', 'Unknown error')
                        self.log(f"Transcription failed: {error_msg}")
                        return None
                    elif status in ['queued', 'processing']:
                        if poll_count % 30 == 0:  # Log every 15 minutes
                            elapsed_min = (poll_count * 30) / 60
                            self.log(f"Status: {status} - Elapsed: {elapsed_min:.1f}min")
                
                time.sleep(30)
                
            except Exception as e:
                self.log(f"Monitoring error: {e}")
                time.sleep(60)
        
        self.log("Monitoring timeout")
        return None
    
    def merge_segment_transcriptions(self, segment_results):
        """Merge multiple segment transcription results"""
        if not segment_results:
            return None
        
        if len(segment_results) == 1:
            return segment_results[0]
        
        # Merge text content
        merged_text = ""
        merged_utterances = []
        merged_highlights = []
        merged_chapters = []
        merged_sentiment = []
        merged_entities = []
        
        time_offset = 0
        
        for i, result in enumerate(segment_results):
            if not result:
                continue
                
            # Add text with separator
            segment_text = result.get('text', '')
            if segment_text:
                if merged_text:
                    merged_text += "\n\n"
                merged_text += f"[段落 {i+1}]\n{segment_text}"
            
            # Process utterances with time offset
            if result.get('utterances'):
                for utterance in result['utterances']:
                    adjusted_utterance = utterance.copy()
                    adjusted_utterance['start'] += time_offset
                    adjusted_utterance['end'] += time_offset
                    merged_utterances.append(adjusted_utterance)
            
            # Merge other features
            if result.get('auto_highlights_result', {}).get('results'):
                merged_highlights.extend(result['auto_highlights_result']['results'])
            
            if result.get('chapters'):
                for chapter in result['chapters']:
                    adjusted_chapter = chapter.copy()
                    adjusted_chapter['start'] += time_offset
                    adjusted_chapter['end'] += time_offset
                    merged_chapters.append(adjusted_chapter)
            
            if result.get('sentiment_analysis_results'):
                merged_sentiment.extend(result['sentiment_analysis_results'])
            
            if result.get('entities'):
                merged_entities.extend(result['entities'])
            
            # Update time offset for next segment
            if result.get('audio_duration'):
                time_offset += result['audio_duration']
        
        # Create merged result
        merged_result = {
            'text': merged_text,
            'utterances': merged_utterances,
            'confidence': sum(r.get('confidence', 0) for r in segment_results if r) / len([r for r in segment_results if r]),
            'audio_duration': time_offset,
            'auto_highlights_result': {'results': merged_highlights},
            'chapters': merged_chapters,
            'sentiment_analysis_results': merged_sentiment,
            'entities': merged_entities,
            'content_safety_labels': segment_results[0].get('content_safety_labels', {}) if segment_results[0] else {}
        }
        
        return merged_result
    
    def process_complete_workflow(self):
        """Execute the complete large file processing workflow"""
        try:
            self.log("Starting enhanced large file processing")
            self.update_db(5, 'processing')
            
            # Get file information
            file_info = self.get_file_info()
            if not file_info:
                self.log("Failed to get file information")
                self.update_db(0, 'error')
                return False
            
            self.log(f"Processing file: {file_info['filename']} ({file_info['size'] / 1024 / 1024:.1f}MB)")
            
            # Create optimal segments
            segments = self.create_optimal_segments(file_info['path'])
            self.update_db(15, 'processing')
            
            # Process each segment
            segment_results = []
            total_segments = len(segments)
            
            for i, segment_path in enumerate(segments):
                self.log(f"Processing segment {i+1}/{total_segments}")
                
                # Upload segment
                upload_url = self.upload_file(segment_path)
                if not upload_url:
                    self.log(f"Failed to upload segment {i+1}")
                    continue
                
                progress = 15 + (i * 40 / total_segments)
                self.update_db(int(progress))
                
                # Start transcription
                transcript_id = self.start_transcription(upload_url)
                if not transcript_id:
                    self.log(f"Failed to start transcription for segment {i+1}")
                    continue
                
                # Monitor transcription
                result = self.monitor_transcription(transcript_id)
                if result:
                    segment_results.append(result)
                    self.log(f"Segment {i+1} completed successfully")
                else:
                    self.log(f"Segment {i+1} failed")
                    segment_results.append(None)
                
                progress = 15 + ((i+1) * 40 / total_segments)
                self.update_db(int(progress))
            
            # Merge results
            self.log("Merging segment results")
            self.update_db(85, 'processing')
            
            merged_result = self.merge_segment_transcriptions(segment_results)
            if merged_result:
                # Save final result
                self.log("Saving final transcription result")
                
                # Use the first successful segment's transcript_id for reference
                for result in segment_results:
                    if result and result.get('id'):
                        merged_result['id'] = result['id']
                        break
                
                self.update_db(100, 'completed', merged_result.get('id'), merged_result)
                self.log("Large file processing completed successfully")
                
                # Cleanup segments
                try:
                    segments_dir = Path('uploads/segments')
                    for segment_file in segments_dir.glob(f'segment_{self.transcription_id}_*.m4a'):
                        segment_file.unlink()
                    self.log("Cleanup completed")
                except:
                    pass
                
                return True
            else:
                self.log("Failed to merge segment results")
                self.update_db(90, 'error')
                return False
                
        except Exception as e:
            self.log(f"Workflow error: {e}")
            self.update_db(0, 'error')
            return False

def main():
    """Main processing function"""
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python enhanced_large_file_processor.py <transcription_id>")
        sys.exit(1)
    
    transcription_id = int(sys.argv[1])
    processor = EnhancedLargeFileProcessor(transcription_id)
    
    success = processor.process_complete_workflow()
    if success:
        print(f"Transcription {transcription_id} completed successfully")
    else:
        print(f"Transcription {transcription_id} failed")
        sys.exit(1)

if __name__ == "__main__":
    main()