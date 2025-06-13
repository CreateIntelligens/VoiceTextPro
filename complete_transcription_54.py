#!/usr/bin/env python3
"""
Complete the transcription 54 by retrieving full AssemblyAI data and updating database
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

def complete_transcription():
    """Complete the transcription by retrieving full AssemblyAI data"""
    
    assemblyai_id = "2ff133dd-94f1-46a5-b863-308f628850c7"
    transcription_id = 54
    
    print(f"Retrieving complete data for AssemblyAI ID: {assemblyai_id}")
    
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
        print(f"Failed to retrieve transcript: {response.status_code}")
        return False
    
    transcript_data = response.json()
    
    if transcript_data.get('status') != 'completed':
        print(f"Transcript not completed: {transcript_data.get('status')}")
        return False
    
    print("Retrieved complete transcript data!")
    
    # Process the complete transcript
    text = transcript_data.get('text', '')
    word_count = calculate_word_count(text)
    
    print(f"Complete transcript - Length: {len(text)} chars, Words: {word_count}")
    
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
    
    print(f"Processed {len(formatted_segments)} valid segments")
    print(f"Identified speakers: {list(speaker_map.values())}")
    
    # Extract duration and confidence from transcript data
    duration_ms = transcript_data.get('audio_duration', 0)
    confidence = transcript_data.get('confidence', 0.0)
    
    # Convert duration to integer seconds for database
    duration_seconds = int(duration_ms / 1000) if duration_ms else 0
    
    # Update database via API
    update_data = {
        'status': 'completed',
        'progress': 100,
        'transcriptText': text,
        'wordCount': word_count,
        'duration': duration_seconds,
        'confidence': confidence,
        'segments': formatted_segments
    }
    
    # Send update via API
    response = requests.patch(
        f'http://localhost:5000/api/transcriptions/{transcription_id}',
        json=update_data,
        headers={'Content-Type': 'application/json'},
        timeout=30
    )
    
    if response.status_code == 200:
        print("Database updated successfully with complete results!")
        print(f"Final stats - Text: {len(text)} chars, Words: {word_count}, Segments: {len(formatted_segments)}")
        return True
    else:
        print(f"Failed to update database: {response.status_code}")
        if response.text:
            print(f"Error details: {response.text}")
        return False

def main():
    print("Completing transcription 54 with full AssemblyAI data")
    
    if complete_transcription():
        print("Transcription completed successfully!")
    else:
        print("Failed to complete transcription")

if __name__ == "__main__":
    main()