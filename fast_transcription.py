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
        # For Chinese text, count characters as words
        return len([char for char in text if '\u4e00' <= char <= '\u9fff'])
    else:
        # For other languages, count words
        return len(text.split())

def update_progress(transcription_id, progress):
    """Update progress in database with retry"""
    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = requests.patch(
                f'http://localhost:5000/api/transcriptions/{transcription_id}',
                json={'progress': progress},
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            if response.status_code == 200:
                print(f"Progress updated to {progress}%", flush=True)
                return True
            else:
                print(f"Failed to update progress: {response.status_code}", flush=True)
        except Exception as e:
            print(f"Error updating progress (attempt {attempt + 1}): {e}", flush=True)
            if attempt < max_retries - 1:
                time.sleep(1)
    return False

def start_fast_transcription(upload_url, api_key, custom_keywords=""):
    """Start transcription with optimized settings for speed"""
    print("🚀 Starting fast transcription with optimized settings...", flush=True)
    
    headers = {"authorization": api_key}
    
    data = {
        "audio_url": upload_url,
        "speaker_labels": True,
        "speakers_expected": 4,
        "language_detection": True,
        "punctuate": True,
        "format_text": True,
        "filter_profanity": False,
        "redact_pii": False,
        "dual_channel": False,
        "auto_highlights": True,
        "summary_model": "informative",
        "summary_type": "paragraph",
        "auto_chapters": True,
        "speech_model": "best",  # Use best model for accuracy
    }
    
    # Add custom keywords if provided
    if custom_keywords and custom_keywords.strip():
        keywords = [kw.strip() for kw in custom_keywords.split(',') if kw.strip()]
        if keywords:
            data["boost_param"] = "high"
            data["word_boost"] = keywords
            print(f"Applied {len(keywords)} custom keywords for better recognition", flush=True)
    
    print("Sending transcription request to AssemblyAI...", flush=True)
    response = requests.post(
        "https://api.assemblyai.com/v2/transcript",
        json=data,
        headers=headers,
        timeout=30
    )
    
    if response.status_code != 200:
        error_msg = f"Failed to start transcription: {response.status_code} - {response.text}"
        print(f"❌ {error_msg}", flush=True)
        raise Exception(error_msg)
    
    result = response.json()
    transcript_id = result['id']
    print(f"✅ Transcription started with ID: {transcript_id}", flush=True)
    return transcript_id

def fast_poll_transcription(transcript_id, api_key, transcription_id):
    """Fast polling with adaptive intervals and dynamic progress"""
    print(f"⚡ Starting fast monitoring for transcription {transcript_id}", flush=True)
    
    start_time = time.time()
    check_count = 0
    last_status = None
    max_wait_time = 1800  # 30 minutes
    
    while True:
        try:
            elapsed_time = time.time() - start_time
            check_count += 1
            
            # Get status
            headers = {"authorization": api_key}
            response = requests.get(
                f"https://api.assemblyai.com/v2/transcript/{transcript_id}",
                headers=headers,
                timeout=15
            )
            
            if response.status_code != 200:
                print(f"❌ Error checking status: {response.status_code}", flush=True)
                time.sleep(2)
                continue
            
            data = response.json()
            status = data.get('status')
            
            # Only print status if it changed
            if status != last_status:
                print(f"📊 Status changed: {last_status} → {status}", flush=True)
                last_status = status
            
            if status == 'completed':
                print("✅ Transcription completed successfully!", flush=True)
                return data
            elif status == 'error':
                error_msg = data.get('error', 'Unknown error')
                print(f"❌ Transcription failed: {error_msg}", flush=True)
                return None
            else:
                # Smart progress calculation
                if status == 'queued':
                    progress = min(25, 10 + check_count)
                elif status == 'processing':
                    # Dynamic progress based on time and checks
                    base_progress = 30
                    time_progress = min(50, (elapsed_time / 300) * 50)  # 50% over 5 minutes
                    check_progress = min(20, check_count * 2)  # Up to 20% from checks
                    progress = int(base_progress + time_progress + check_progress)
                    progress = min(95, progress)  # Cap at 95%
                else:
                    progress = 20
                
                update_progress(transcription_id, progress)
            
            # Check for timeout
            if elapsed_time > max_wait_time:
                print(f"⏰ Timeout after {max_wait_time/60:.0f} minutes", flush=True)
                return None
            
            # Adaptive polling - faster at start, slower later
            if check_count <= 3:
                time.sleep(2)  # First 3 checks every 2 seconds
            elif elapsed_time < 60:
                time.sleep(3)  # First minute every 3 seconds
            elif elapsed_time < 180:
                time.sleep(4)  # Next 2 minutes every 4 seconds
            elif elapsed_time < 600:
                time.sleep(6)  # Next 7 minutes every 6 seconds
            else:
                time.sleep(8)  # After 10 minutes every 8 seconds
                
        except Exception as e:
            print(f"❌ Error during polling: {e}", flush=True)
            time.sleep(3)

def process_advanced_features(transcript_data):
    """Process all advanced features efficiently"""
    advanced_features = {}
    
    # Summary
    if transcript_data.get('summary'):
        advanced_features['summary'] = transcript_data['summary']
        advanced_features['summaryType'] = 'paragraph'
    
    # Auto highlights
    if transcript_data.get('auto_highlights_result'):
        highlights_result = transcript_data['auto_highlights_result']
        if highlights_result.get('status') == 'success':
            highlights = []
            for result in highlights_result.get('results', []):
                highlights.append({
                    'text': result.get('text', ''),
                    'count': result.get('count', 0),
                    'rank': result.get('rank', 0),
                    'timestamps': [{'start': ts.get('start'), 'end': ts.get('end')} 
                                 for ts in result.get('timestamps', [])]
                })
            advanced_features['autoHighlights'] = {
                'status': highlights_result['status'],
                'results': highlights
            }
    
    # Auto chapters
    if transcript_data.get('chapters'):
        chapters = []
        for chapter in transcript_data['chapters']:
            chapters.append({
                'gist': chapter.get('gist', ''),
                'headline': chapter.get('headline', ''),
                'summary': chapter.get('summary', ''),
                'start': chapter.get('start', 0),
                'end': chapter.get('end', 0)
            })
        advanced_features['autoChapters'] = chapters
    
    return advanced_features

def update_database_with_results(transcription_id, transcript_data):
    """Update database with completed transcription results"""
    try:
        # Calculate word count
        text = transcript_data.get('text', '')
        word_count = calculate_word_count(text)
        
        # Process utterances with speaker labels
        formatted_segments = []
        utterances = transcript_data.get('utterances', [])
        
        speaker_map = {}
        speaker_counter = 0
        
        for utterance in utterances:
            speaker_label = utterance.get('speaker')
            if speaker_label not in speaker_map:
                speaker_map[speaker_label] = f"講者 {chr(65 + speaker_counter)}"
                speaker_counter += 1
            
            speaker_name = speaker_map[speaker_label]
            speaker_color = get_speaker_color(list(speaker_map.keys()).index(speaker_label))
            
            formatted_segments.append({
                'speaker': speaker_name,
                'text': utterance.get('text', ''),
                'start': utterance.get('start', 0),
                'end': utterance.get('end', 0),
                'color': speaker_color
            })
        
        # Process advanced features
        advanced_features = process_advanced_features(transcript_data)
        
        # Extract duration and confidence from transcript data
        duration_ms = transcript_data.get('audio_duration', 0)
        confidence = transcript_data.get('confidence', 0.0)
        
        # Convert duration to seconds for display
        duration_seconds = duration_ms / 1000.0 if duration_ms else 0
        
        # Prepare update data with correct field names
        update_data = {
            'status': 'completed',
            'progress': 100,
            'assemblyaiId': transcript_data.get('id'),  # Add AssemblyAI ID
            'transcriptText': text,  # Use correct field name
            'text': text,
            'wordCount': word_count,
            'duration': duration_seconds,
            'confidence': confidence,
            'segments': formatted_segments,
            'advancedFeatures': advanced_features,
            'completedAt': datetime.now().isoformat()
        }
        
        # Validate update data before sending
        required_fields = ['status', 'progress', 'assemblyaiId', 'transcriptText']
        missing_fields = [field for field in required_fields if field not in update_data or not update_data[field]]
        
        if missing_fields:
            print(f"❌ Missing required fields: {missing_fields}", flush=True)
            print("🔄 Attempting basic update with available data...", flush=True)
            # Create minimal update with only essential fields
            minimal_update = {
                'status': 'error',
                'progress': 95,
                'errorMessage': f'Transcription completed but missing data: {", ".join(missing_fields)}'
            }
            requests.patch(
                f'http://localhost:5000/api/transcriptions/{transcription_id}',
                json=minimal_update,
                headers={'Content-Type': 'application/json'},
                timeout=30
            )
            return
        
        # Update database with validated data
        response = requests.patch(
            f'http://localhost:5000/api/transcriptions/{transcription_id}',
            json=update_data,
            headers={'Content-Type': 'application/json'},
            timeout=30
        )
        
        if response.status_code == 200:
            print("✅ Database updated successfully with all results!", flush=True)
        else:
            print(f"❌ Failed to update database: {response.status_code}", flush=True)
            if response.status_code == 400:
                print(f"❌ Validation error details: {response.text}", flush=True)
                # Try with minimal data to avoid validation errors
                minimal_update = {
                    'status': 'error',
                    'progress': 95,
                    'errorMessage': f'Validation failed during final update: {response.text[:200]}'
                }
                retry_response = requests.patch(
                    f'http://localhost:5000/api/transcriptions/{transcription_id}',
                    json=minimal_update,
                    headers={'Content-Type': 'application/json'},
                    timeout=30
                )
                print(f"🔄 Retry response: {retry_response.status_code}", flush=True)
            
    except Exception as e:
        print(f"❌ Error updating database: {e}", flush=True)

def main():
    if len(sys.argv) < 4:
        print("Usage: python fast_transcription.py <transcription_id> <upload_url> <api_key> [keywords]", flush=True)
        sys.exit(1)
    
    transcription_id = sys.argv[1]
    upload_url = sys.argv[2]
    api_key = sys.argv[3]
    custom_keywords = sys.argv[4] if len(sys.argv) > 4 else ""
    
    print(f"🚀 Starting FAST transcription for ID: {transcription_id}", flush=True)
    print(f"📁 Audio URL: {upload_url}", flush=True)
    
    try:
        # Start transcription
        transcript_id = start_fast_transcription(upload_url, api_key, custom_keywords)
        
        # Fast polling
        result = fast_poll_transcription(transcript_id, api_key, transcription_id)
        
        if result:
            # Update database
            update_database_with_results(transcription_id, result)
            print("🎉 Fast transcription completed successfully!", flush=True)
        else:
            print("❌ Fast transcription failed or timed out", flush=True)
            
    except Exception as e:
        print(f"❌ Fatal error: {e}", flush=True)
        # Update status to error
        try:
            requests.patch(
                f'http://localhost:5000/api/transcriptions/{transcription_id}',
                json={'status': 'error', 'progress': 0},
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
        except:
            pass

if __name__ == "__main__":
    main()