#!/usr/bin/env python3
"""
Core speaker analysis logic for all transcription scripts
Provides standardized speaker identification and validation
"""

import re

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

def process_speaker_segments(transcript_data, debug=True):
    """
    Process AssemblyAI utterances into clean speaker segments
    
    Args:
        transcript_data: Full AssemblyAI response data
        debug: Whether to print debug information
        
    Returns:
        list: Cleaned and validated speaker segments
    """
    utterances = transcript_data.get('utterances', [])
    audio_duration = transcript_data.get('audio_duration', 0)
    max_valid_time = audio_duration + 5000  # Add 5 second buffer
    
    if debug:
        print(f"📊 Processing {len(utterances)} utterances with max duration: {max_valid_time}ms", flush=True)
    
    formatted_segments = []
    speaker_map = {}
    speaker_counter = 0
    valid_segments = 0
    skipped_segments = 0
    
    for i, utterance in enumerate(utterances):
        try:
            # Extract and validate basic data
            speaker_label = utterance.get('speaker')
            text = utterance.get('text', '').strip()
            start_time = utterance.get('start', 0)
            end_time = utterance.get('end', 0)
            confidence = utterance.get('confidence', 0.0)
            
            # Skip invalid segments
            if not text or len(text) < 2:
                skipped_segments += 1
                continue
                
            # Validate timestamps
            if start_time < 0 or end_time < 0 or start_time >= end_time:
                skipped_segments += 1
                if debug:
                    print(f"⚠️  Skipping segment {i}: invalid timestamps ({start_time} → {end_time})", flush=True)
                continue
                
            # Check against audio duration (if available)
            if max_valid_time > 0 and (start_time > max_valid_time or end_time > max_valid_time):
                skipped_segments += 1
                if debug:
                    print(f"⚠️  Skipping segment {i}: timestamps exceed audio duration", flush=True)
                continue
            
            # Normalize speaker labels
            if speaker_label is None or speaker_label == '' or speaker_label == 'null':
                speaker_label = 'UNKNOWN'
            
            # Convert to string to handle any type
            speaker_label = str(speaker_label)
            
            # Map speakers consistently
            if speaker_label not in speaker_map:
                speaker_map[speaker_label] = f"講者 {chr(65 + speaker_counter)}"
                speaker_counter += 1
            
            speaker_name = speaker_map[speaker_label]
            speaker_color = get_speaker_color(list(speaker_map.keys()).index(speaker_label))
            
            # Create validated segment
            segment = {
                'speaker': speaker_name,
                'text': text,
                'start': int(start_time),
                'end': int(end_time),
                'confidence': float(confidence),
                'startTime': format_timestamp(start_time),
                'endTime': format_timestamp(end_time),
                'color': speaker_color
            }
            
            formatted_segments.append(segment)
            valid_segments += 1
            
        except Exception as e:
            skipped_segments += 1
            if debug:
                print(f"⚠️  Error processing segment {i}: {e}", flush=True)
            continue
    
    if debug:
        print(f"✅ Processed segments: {valid_segments} valid, {skipped_segments} skipped", flush=True)
        print(f"🎯 Identified speakers: {list(speaker_map.values())}", flush=True)
    
    return formatted_segments

def validate_segment_integrity(segments):
    """
    Validate segment data integrity after processing
    
    Args:
        segments: List of processed segments
        
    Returns:
        tuple: (valid_segments, validation_issues)
    """
    valid_segments = []
    issues = []
    
    for i, segment in enumerate(segments):
        try:
            # Check required fields
            required_fields = ['speaker', 'text', 'start', 'end', 'color']
            missing_fields = [field for field in required_fields if field not in segment]
            
            if missing_fields:
                issues.append(f"Segment {i}: missing fields {missing_fields}")
                continue
            
            # Validate data types
            if not isinstance(segment['start'], int) or not isinstance(segment['end'], int):
                issues.append(f"Segment {i}: invalid timestamp data types")
                continue
                
            if segment['start'] >= segment['end']:
                issues.append(f"Segment {i}: start >= end ({segment['start']} >= {segment['end']})")
                continue
            
            # Validate text content
            if not segment['text'] or len(segment['text'].strip()) < 2:
                issues.append(f"Segment {i}: invalid text content")
                continue
            
            valid_segments.append(segment)
            
        except Exception as e:
            issues.append(f"Segment {i}: validation error - {e}")
            continue
    
    return valid_segments, issues

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