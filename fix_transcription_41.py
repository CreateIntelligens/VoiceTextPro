#!/usr/bin/env python3
"""
Fix transcription 41 that completed but failed during database update
"""

import os
import requests
import json
import re
from datetime import datetime

def format_timestamp(milliseconds):
    """Convert milliseconds to MM:SS format"""
    if not milliseconds:
        return "00:00"
    seconds = milliseconds / 1000
    minutes = int(seconds // 60)
    seconds = int(seconds % 60)
    return f"{minutes:02d}:{seconds:02d}"

def get_speaker_color(speaker_index):
    """Get color for speaker based on index"""
    colors = ['#2563eb', '#dc2626', '#059669', '#7c2d12', '#4338ca', '#be185d']
    return colors[speaker_index % len(colors)]

def calculate_word_count(text):
    """Calculate word count for different languages"""
    if not text:
        return 0
    
    # Count Chinese characters
    chinese_chars = len(re.findall(r'[\u4e00-\u9fff]', text))
    
    # Count English words
    english_words = len(re.findall(r'\b[a-zA-Z]+\b', text))
    
    # Count numbers as words
    numbers = len(re.findall(r'\b\d+\b', text))
    
    return chinese_chars + english_words + numbers

def main():
    transcription_id = 41
    
    # Check if file exists
    filename = "43801c7b18e1f36d0907576169712498"
    file_path = f"uploads/{filename}"
    
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return
    
    print(f"Starting recovery for transcription {transcription_id}")
    
    # Upload file to AssemblyAI with correct MIME type
    api_key = os.environ.get('ASSEMBLYAI_API_KEY')
    if not api_key:
        print("Missing ASSEMBLYAI_API_KEY")
        return
        
    headers = {'authorization': api_key}
    
    # Upload file
    with open(file_path, 'rb') as f:
        files = {'file': (f'{filename}.m4a', f, 'audio/mp4')}
        upload_response = requests.post('https://api.assemblyai.com/v2/upload', files=files, headers=headers)
    
    if upload_response.status_code != 200:
        print(f"Upload failed: {upload_response.status_code}")
        return
        
    upload_result = upload_response.json()
    audio_url = upload_result['upload_url']
    print("File uploaded successfully")
    
    # Start transcription
    transcript_request = {
        'audio_url': audio_url,
        'speaker_labels': True,
        'language_code': 'zh',
        'punctuate': True,
        'format_text': True,
        'auto_highlights': True,
        'entity_detection': True,
        'sentiment_analysis': True
    }
    
    response = requests.post(
        'https://api.assemblyai.com/v2/transcript',
        json=transcript_request,
        headers=headers
    )
    
    if response.status_code != 200:
        print(f"Transcription start failed: {response.status_code}")
        return
        
    result = response.json()
    assemblyai_id = result['id']
    print(f"Transcription started: {assemblyai_id}")
    
    # Update database with AssemblyAI ID
    update_data = {
        'assemblyaiId': assemblyai_id,
        'status': 'processing',
        'progress': 10,
        'errorMessage': None
    }
    
    db_response = requests.patch(
        f'http://localhost:5000/api/transcriptions/{transcription_id}',
        json=update_data,
        headers={'Content-Type': 'application/json'}
    )
    
    if db_response.status_code == 200:
        print("Database updated with new AssemblyAI ID")
    else:
        print(f"Database update failed: {db_response.status_code}")
        
    # Monitor until completion
    import time
    
    for i in range(120):  # Wait up to 10 minutes
        try:
            response = requests.get(f'https://api.assemblyai.com/v2/transcript/{assemblyai_id}', headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                status = data.get('status')
                
                if status == 'queued':
                    progress = 15
                elif status == 'processing':
                    progress = min(20 + (i * 1), 95)
                elif status == 'completed':
                    print("Transcription completed! Processing results...")
                    
                    # Extract and process data with correct types
                    text = data.get('text', '')
                    confidence = float(data.get('confidence', 0.0))
                    duration = int(data.get('audio_duration', 0) / 1000) if data.get('audio_duration') else 0
                    word_count = calculate_word_count(text)
                    
                    # Process utterances
                    formatted_segments = []
                    utterances = data.get('utterances', [])
                    
                    speaker_map = {}
                    speaker_counter = 0
                    
                    for utterance in utterances:
                        speaker_label = utterance.get('speaker')
                        if speaker_label not in speaker_map:
                            speaker_map[speaker_label] = f'講者 {chr(65 + speaker_counter)}'
                            speaker_counter += 1
                        
                        speaker_name = speaker_map[speaker_label]
                        speaker_color = get_speaker_color(list(speaker_map.keys()).index(speaker_label))
                        
                        formatted_segments.append({
                            'speaker': speaker_name,
                            'text': utterance.get('text', ''),
                            'start': utterance.get('start', 0),
                            'end': utterance.get('end', 0),
                            'confidence': utterance.get('confidence', 0),
                            'startTime': format_timestamp(utterance.get('start')),
                            'endTime': format_timestamp(utterance.get('end')),
                            'color': speaker_color
                        })
                    
                    # Process advanced features
                    advanced_features = {}
                    
                    # Auto highlights
                    if data.get('auto_highlights_result'):
                        highlights_result = data['auto_highlights_result']
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
                    
                    # Entity detection
                    if data.get('entities'):
                        entities = []
                        for entity in data['entities']:
                            entities.append({
                                'entity_type': entity.get('entity_type', ''),
                                'text': entity.get('text', ''),
                                'start': entity.get('start', 0),
                                'end': entity.get('end', 0)
                            })
                        advanced_features['entities'] = entities
                    
                    # Sentiment analysis
                    if data.get('sentiment_analysis_results'):
                        sentiment_results = []
                        for result in data['sentiment_analysis_results']:
                            sentiment_results.append({
                                'text': result.get('text', ''),
                                'sentiment': result.get('sentiment', ''),
                                'confidence': result.get('confidence', 0),
                                'start': result.get('start', 0),
                                'end': result.get('end', 0)
                            })
                        advanced_features['sentimentAnalysis'] = sentiment_results
                    
                    # Update database with correct data types
                    update_data = {
                        'status': 'completed',
                        'progress': 100,
                        'assemblyaiId': assemblyai_id,
                        'transcriptText': text,
                        'text': text,
                        'wordCount': word_count,
                        'duration': duration,  # Integer
                        'confidence': confidence,  # Float
                        'segments': formatted_segments,
                        'advancedFeatures': advanced_features,
                        'errorMessage': None,
                        'completedAt': datetime.now().isoformat()
                    }
                    
                    print(f"Updating database with correct types:")
                    print(f"- Duration: {duration} seconds (int)")
                    print(f"- Confidence: {confidence} (float)")
                    print(f"- Word count: {word_count}")
                    print(f"- Segments: {len(formatted_segments)}")
                    
                    response = requests.patch(
                        f'http://localhost:5000/api/transcriptions/{transcription_id}',
                        json=update_data,
                        headers={'Content-Type': 'application/json'},
                        timeout=30
                    )
                    
                    if response.status_code == 200:
                        print("✅ Database updated successfully!")
                    else:
                        print(f"❌ Database update failed: {response.status_code}")
                        print(f"Response: {response.text}")
                    
                    break
                    
                elif status == 'error':
                    error_msg = data.get('error', 'Unknown error')
                    print(f"Transcription error: {error_msg}")
                    break
                
                # Update progress
                if status in ['queued', 'processing']:
                    requests.patch(
                        f'http://localhost:5000/api/transcriptions/{transcription_id}',
                        json={'progress': progress},
                        headers={'Content-Type': 'application/json'}
                    )
                    print(f"Progress: {progress}%")
                    
            time.sleep(5)
            
        except Exception as e:
            print(f"Error during monitoring: {e}")
            time.sleep(5)
    
    print("Recovery process completed")

if __name__ == "__main__":
    main()