#!/usr/bin/env python3
"""
Fix incomplete transcription - retrieve and properly process the complete AssemblyAI result
"""

import os
import requests
import json
import psycopg2
from datetime import datetime

def format_timestamp(milliseconds):
    """Convert milliseconds to MM:SS format"""
    if not milliseconds:
        return "00:00"
    seconds = int(milliseconds / 1000)
    minutes = seconds // 60
    seconds = seconds % 60
    return f"{minutes:02d}:{seconds:02d}"

def get_speaker_color(speaker_index):
    """Get color for speaker based on index"""
    colors = [
        "hsl(220, 70%, 50%)",  # Blue
        "hsl(120, 70%, 50%)",  # Green  
        "hsl(0, 70%, 50%)",    # Red
        "hsl(280, 70%, 50%)",  # Purple
        "hsl(30, 70%, 50%)",   # Orange
        "hsl(180, 70%, 50%)",  # Cyan
        "hsl(60, 70%, 50%)",   # Yellow
        "hsl(320, 70%, 50%)",  # Magenta
    ]
    return colors[speaker_index % len(colors)]

def calculate_word_count(text):
    """Calculate word count for different languages"""
    if not text:
        return 0
    
    # For Chinese text, count characters (excluding spaces and punctuation)
    chinese_chars = len([char for char in text if '\u4e00' <= char <= '\u9fff'])
    if chinese_chars > len(text) * 0.3:  # If more than 30% Chinese characters
        return chinese_chars
    
    # For other languages, count words
    return len(text.split())

def fix_transcription(transcription_id):
    """Fix the incomplete transcription by retrieving complete AssemblyAI data"""
    
    # Get current transcription data
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    
    cur.execute('SELECT assemblyai_id FROM transcriptions WHERE id = %s', (transcription_id,))
    result = cur.fetchone()
    
    if not result or not result[0]:
        print(f"❌ No AssemblyAI ID found for transcription {transcription_id}")
        return False
    
    assemblyai_id = result[0]
    print(f"🔍 Retrieving complete data for AssemblyAI ID: {assemblyai_id}")
    
    # Get complete transcript from AssemblyAI
    headers = {
        'authorization': os.environ['ASSEMBLYAI_API_KEY'],
        'content-type': 'application/json'
    }
    
    response = requests.get(
        f'https://api.assemblyai.com/v2/transcript/{assemblyai_id}',
        headers=headers
    )
    
    if response.status_code != 200:
        print(f"❌ Failed to retrieve transcript: {response.status_code}")
        return False
    
    transcript_data = response.json()
    
    if transcript_data.get('status') != 'completed':
        print(f"❌ Transcript not completed: {transcript_data.get('status')}")
        return False
    
    print("✅ Retrieved complete transcript data!")
    
    # Process the complete transcript
    text = transcript_data.get('text', '')
    word_count = calculate_word_count(text)
    
    print(f"📊 Complete transcript - Length: {len(text)} chars, Words: {word_count}")
    
    # Process utterances with proper validation and speaker mapping
    formatted_segments = []
    utterances = transcript_data.get('utterances', [])
    
    speaker_map = {}
    speaker_counter = 0
    
    print(f"Processing {len(utterances)} speaker segments")
    
    for i, utterance in enumerate(utterances):
        try:
            # Extract data with validation
            text_content = utterance.get('text', '').strip()
            speaker_id = utterance.get('speaker', f'Speaker_{i}')
            start_time = utterance.get('start', 0)
            end_time = utterance.get('end', 0)
            confidence = utterance.get('confidence', 0.0)
            
            # Skip empty utterances
            if not text_content or len(text_content) < 2:
                continue
            
            # Map speaker to consistent identifier
            if speaker_id not in speaker_map:
                speaker_counter += 1
                speaker_map[speaker_id] = f"講者 {chr(64 + speaker_counter)}"  # A, B, C, etc.
            
            formatted_segments.append({
                'text': text_content,
                'speaker': speaker_map[speaker_id],
                'start': start_time,
                'end': end_time,
                'startTime': format_timestamp(start_time),
                'endTime': format_timestamp(end_time),
                'confidence': confidence,
                'color': get_speaker_color(speaker_counter - 1)
            })
            
        except Exception as e:
            print(f"Error processing segment {i}: {e}")
            continue
    
    print(f"✅ Processed {len(formatted_segments)} valid segments")
    print(f"🎤 Identified speakers: {list(speaker_map.values())}")
    
    # Process advanced features
    advanced_features = {}
    
    # Auto summary
    if transcript_data.get('summary'):
        advanced_features['summary'] = transcript_data['summary']
    
    # Auto highlights
    if transcript_data.get('auto_highlights_result'):
        highlights_result = transcript_data['auto_highlights_result']
        if highlights_result.get('status') == 'success' and highlights_result.get('results'):
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
    
    # Extract duration and confidence from transcript data
    duration_ms = transcript_data.get('audio_duration', 0)
    confidence = transcript_data.get('confidence', 0.0)
    
    # Convert duration to integer seconds for database
    duration_seconds = int(duration_ms / 1000) if duration_ms else 0
    
    # Update database with complete results
    update_data = {
        'status': 'completed',
        'progress': 100,
        'transcript_text': text,
        'word_count': word_count,
        'duration': duration_seconds,
        'confidence': confidence,
        'segments': json.dumps(formatted_segments),
        'summary': advanced_features.get('summary'),
        'auto_highlights': json.dumps(advanced_features.get('autoHighlights')) if advanced_features.get('autoHighlights') else None,
        'auto_chapters': json.dumps(advanced_features.get('autoChapters')) if advanced_features.get('autoChapters') else None,
        'updated_at': datetime.now()
    }
    
    # Update the database
    set_clause = ', '.join([f"{key} = %s" for key in update_data.keys()])
    values = list(update_data.values())
    values.append(transcription_id)
    
    cur.execute(f'UPDATE transcriptions SET {set_clause} WHERE id = %s', values)
    conn.commit()
    
    print("✅ Database updated with complete transcription results!")
    print(f"📊 Final stats - Text: {len(text)} chars, Words: {word_count}, Segments: {len(formatted_segments)}")
    
    cur.close()
    conn.close()
    
    return True

def main():
    transcription_id = 54  # Current transcription ID
    
    print(f"🔧 Fixing incomplete transcription {transcription_id}")
    
    if fix_transcription(transcription_id):
        print("✅ Transcription fixed successfully!")
    else:
        print("❌ Failed to fix transcription")

if __name__ == "__main__":
    main()