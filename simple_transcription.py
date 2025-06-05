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

def upload_audio_file(file_path, api_key):
    """Upload audio file to AssemblyAI"""
    print(f"⏳ Uploading audio file: {file_path}")
    
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
                            data=read_file(file_path))
    
    if response.status_code == 200:
        upload_url = response.json()['upload_url']
        print(f"✅ Audio uploaded successfully: {upload_url}")
        return upload_url
    else:
        raise Exception(f"Upload failed: {response.status_code} - {response.text}")

def start_transcription(upload_url, api_key, custom_keywords=""):
    """Start transcription with advanced features"""
    print("🚀 Starting transcription with advanced features...")
    
    # Build request data with automatic language detection
    data = {
        "audio_url": upload_url,
        "speaker_labels": True,
        "language_detection": True,
        "punctuate": True,
        "format_text": True,
        "disfluencies": False,
        # Advanced features
        "summarization": True,
        "auto_highlights": True,
        "auto_chapters": True,
        "iab_categories": True,
        "sentiment_analysis": True,
        "entity_detection": True,
        "content_safety": True
    }
    
    # Add custom keywords if provided
    if custom_keywords:
        keywords_list = [word.strip() for word in custom_keywords.split(',') if word.strip()]
        if keywords_list:
            data["word_boost"] = keywords_list
            print(f"🔍 Using custom keywords: {keywords_list}")
    
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
        print(f"🔄 Transcription started with ID: {transcript_id}")
        return transcript_id
    else:
        raise Exception(f"Transcription start failed: {response.status_code} - {response.text}")

def poll_transcription_status(transcript_id, api_key, transcription_id):
    """Poll transcription status until completion"""
    headers = {'authorization': api_key}
    
    while True:
        response = requests.get(f'https://api.assemblyai.com/v2/transcript/{transcript_id}',
                               headers=headers)
        
        if response.status_code != 200:
            raise Exception(f"Status check failed: {response.status_code} - {response.text}")
        
        transcript_data = response.json()
        status = transcript_data['status']
        
        print(f"⏳ Status: {status}")
        
        if status == 'completed':
            print("✅ Transcription completed successfully!")
            return transcript_data
        elif status == 'error':
            error_msg = transcript_data.get('error', 'Unknown error')
            raise Exception(f"Transcription failed: {error_msg}")
        elif status == 'processing':
            update_progress(transcription_id, 60)
        
        time.sleep(5)

def process_advanced_features(transcript_data):
    """Process all advanced features from transcript data"""
    advanced_features = {}
    
    # Auto-generated summary
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
    
    # Topic detection
    if transcript_data.get('iab_categories_result'):
        topics_result = transcript_data['iab_categories_result']
        topics = {
            'status': topics_result.get('status', ''),
            'results': []
        }
        if topics_result.get('status') == 'success':
            for result in topics_result.get('results', []):
                topics['results'].append({
                    'text': result.get('text', ''),
                    'labels': [{'relevance': label.get('relevance'), 'label': label.get('label')} 
                             for label in result.get('labels', [])],
                    'timestamp': result.get('timestamp', {})
                })
        advanced_features['topicsDetection'] = topics
    
    # Sentiment analysis
    if transcript_data.get('sentiment_analysis_results'):
        sentiments = []
        for result in transcript_data['sentiment_analysis_results']:
            sentiments.append({
                'text': result.get('text', ''),
                'sentiment': result.get('sentiment', ''),
                'confidence': result.get('confidence', 0),
                'start': result.get('start', 0),
                'end': result.get('end', 0)
            })
        advanced_features['sentimentAnalysis'] = sentiments
    
    # Entity detection
    if transcript_data.get('entities'):
        entities = []
        for entity in transcript_data['entities']:
            entities.append({
                'entity_type': entity.get('entity_type', ''),
                'text': entity.get('text', ''),
                'start': entity.get('start', 0),
                'end': entity.get('end', 0)
            })
        advanced_features['entityDetection'] = entities
    
    # Content safety
    if transcript_data.get('content_safety_labels'):
        safety_result = transcript_data['content_safety_labels']
        safety = {
            'status': safety_result.get('status', ''),
            'results': []
        }
        if safety_result.get('status') == 'success':
            for result in safety_result.get('results', []):
                safety['results'].append({
                    'text': result.get('text', ''),
                    'labels': [{'confidence': label.get('confidence'), 'label': label.get('label')} 
                             for label in result.get('labels', [])],
                    'timestamp': result.get('timestamp', {})
                })
        advanced_features['contentSafety'] = safety
    
    return advanced_features

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
        
        # Process advanced features
        advanced_features = process_advanced_features(transcript_data)
        
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
            **advanced_features
        }
        
        # Update database
        response = requests.patch(
            f'http://localhost:5000/api/transcriptions/{transcription_id}',
            json=update_data,
            headers={'Content-Type': 'application/json'},
            timeout=30
        )
        
        if response.status_code == 200:
            print(f"✓ Transcription completed successfully with advanced features")
            print(f"✓ Word count: {word_count}")
            print(f"✓ Duration: {transcript_data.get('audio_duration', 0)}s")
            print(f"✓ Confidence: {transcript_data.get('confidence', 0):.2%}")
            if advanced_features.get('summary'):
                print(f"✓ Summary generated")
            if advanced_features.get('autoChapters'):
                print(f"✓ Auto chapters: {len(advanced_features['autoChapters'])}")
            if advanced_features.get('autoHighlights'):
                highlights_count = len(advanced_features['autoHighlights'].get('results', []))
                print(f"✓ Auto highlights: {highlights_count}")
            if advanced_features.get('topicsDetection'):
                topics_count = len(advanced_features['topicsDetection'].get('results', []))
                print(f"✓ Topics detected: {topics_count}")
            if advanced_features.get('sentimentAnalysis'):
                print(f"✓ Sentiment analysis: {len(advanced_features['sentimentAnalysis'])} segments")
        else:
            print(f"✗ Failed to update database: {response.status_code} - {response.text}")
            
    except Exception as e:
        print(f"✗ Error updating database: {e}")

def main():
    if len(sys.argv) < 3:
        print("Usage: python3 simple_transcription.py <audio_file_path> <transcription_id> [custom_keywords]")
        sys.exit(1)
    
    audio_file_path = sys.argv[1]
    transcription_id = sys.argv[2]
    custom_keywords = sys.argv[3] if len(sys.argv) > 3 else ""
    
    # Get API key
    api_key = os.getenv('ASSEMBLYAI_API_KEY')
    if not api_key:
        print("✗ ASSEMBLYAI_API_KEY environment variable not set")
        sys.exit(1)
    
    print(f"🎤 Starting simple transcription for ID: {transcription_id}")
    print(f"📁 File: {audio_file_path}")
    if custom_keywords:
        print(f"🔍 Custom keywords: {custom_keywords}")
    
    try:
        # Step 1: Upload audio file
        update_progress(transcription_id, 10)
        upload_url = upload_audio_file(audio_file_path, api_key)
        
        # Step 2: Start transcription
        update_progress(transcription_id, 30)
        transcript_id = start_transcription(upload_url, api_key, custom_keywords)
        
        # Step 3: Poll for completion
        update_progress(transcription_id, 50)
        transcript_data = poll_transcription_status(transcript_id, api_key, transcription_id)
        
        # Step 4: Update database
        update_progress(transcription_id, 90)
        update_database_with_results(transcription_id, transcript_data)
        
        print("🎉 Transcription process completed successfully!")
        
    except Exception as e:
        print(f"✗ Error during transcription: {e}")
        # Update database with error
        try:
            requests.patch(
                f'http://localhost:5000/api/transcriptions/{transcription_id}',
                json={'status': 'error', 'errorMessage': str(e)},
                headers={'Content-Type': 'application/json'}
            )
        except:
            pass
        sys.exit(1)

if __name__ == "__main__":
    main()