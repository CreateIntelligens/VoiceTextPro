#!/usr/bin/env python3
"""
Fix speaker analysis and clean corrupted segments data
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

def clean_and_fix_segments(transcription_id):
    """Clean and fix corrupted segments data"""
    
    print(f"[FIX-{transcription_id}] Starting speaker analysis cleanup")
    
    # Get current transcription data
    response = requests.get(f'http://localhost:5000/api/transcriptions/{transcription_id}')
    if response.status_code != 200:
        print(f"[FIX-{transcription_id}] Failed to get transcription data")
        return
    
    data = response.json()
    segments = data.get('segments', [])
    
    if not segments:
        print(f"[FIX-{transcription_id}] No segments found")
        return
    
    print(f"[FIX-{transcription_id}] Found {len(segments)} segments")
    
    # Clean and validate segments
    cleaned_segments = []
    speaker_map = {}
    speaker_counter = 0
    
    for i, segment in enumerate(segments):
        try:
            # Validate segment data
            start = segment.get('start', 0)
            end = segment.get('end', 0)
            text = segment.get('text', '').strip()
            speaker = segment.get('speaker', f'講者 A')
            
            # Skip corrupted segments with invalid timestamps
            if start < 0 or end < 0 or start > 3600000 or end > 3600000:  # Max 1 hour
                print(f"[FIX-{transcription_id}] Skipping corrupted segment {i}: invalid timestamps")
                continue
                
            if not text:
                print(f"[FIX-{transcription_id}] Skipping empty segment {i}")
                continue
            
            # Fix speaker mapping
            if speaker not in speaker_map:
                speaker_map[speaker] = f'講者 {chr(65 + speaker_counter)}'
                speaker_counter += 1
            
            speaker_name = speaker_map[speaker]
            speaker_color = get_speaker_color(list(speaker_map.keys()).index(speaker))
            
            cleaned_segment = {
                'speaker': speaker_name,
                'text': text,
                'start': int(start),
                'end': int(end),
                'confidence': segment.get('confidence', 0.8),
                'startTime': format_timestamp(start),
                'endTime': format_timestamp(end),
                'color': speaker_color
            }
            
            cleaned_segments.append(cleaned_segment)
            
        except Exception as e:
            print(f"[FIX-{transcription_id}] Error processing segment {i}: {e}")
            continue
    
    print(f"[FIX-{transcription_id}] Cleaned segments: {len(cleaned_segments)}")
    
    # Update database with cleaned segments
    update_data = {
        'segments': cleaned_segments
    }
    
    response = requests.patch(
        f'http://localhost:5000/api/transcriptions/{transcription_id}',
        json=update_data,
        headers={'Content-Type': 'application/json'},
        timeout=30
    )
    
    if response.status_code == 200:
        print(f"[FIX-{transcription_id}] ✅ Segments cleaned and updated successfully!")
        print(f"[FIX-{transcription_id}] Speakers identified: {list(speaker_map.values())}")
    else:
        print(f"[FIX-{transcription_id}] ❌ Failed to update segments: {response.status_code}")
        print(f"[FIX-{transcription_id}] Response: {response.text}")

def main():
    # Fix transcription 43
    clean_and_fix_segments(43)

if __name__ == "__main__":
    main()