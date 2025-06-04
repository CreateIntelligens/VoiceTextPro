#!/usr/bin/env python3
"""
Fix word count calculation for Chinese text transcriptions
"""

def calculate_chinese_word_count(text):
    """Calculate word count properly for Chinese text"""
    if not text:
        return 0
    
    # Count Chinese characters (non-ASCII)
    chinese_chars = len([c for c in text if ord(c) > 127])
    
    # Count English words (space-separated words with ASCII characters)
    english_words = len([w for w in text.split() if w and any(ord(c) <= 127 for c in w)])
    
    # Total count: Chinese characters + English words
    return chinese_chars + english_words

def format_timestamp(milliseconds):
    """Convert milliseconds to MM:SS format"""
    if milliseconds is None:
        return "00:00"
    
    total_seconds = milliseconds // 1000
    minutes = total_seconds // 60
    seconds = total_seconds % 60
    return f"{minutes:02d}:{seconds:02d}"

def get_speaker_color(speaker_index):
    """Get color for speaker based on index"""
    colors = [
        "hsl(220, 70%, 50%)",  # Blue
        "hsl(120, 70%, 50%)",  # Green  
        "hsl(0, 70%, 50%)",    # Red
        "hsl(280, 70%, 50%)",  # Purple
        "hsl(45, 70%, 50%)",   # Orange
        "hsl(180, 70%, 50%)"   # Cyan
    ]
    return colors[speaker_index % len(colors)]

def update_database_with_results(transcription_id, transcript):
    """Update database with completed transcription results"""
    import requests
    
    # Process speakers and segments
    speakers = []
    segments = []
    
    if transcript.get("utterances"):
        for utterance in transcript["utterances"]:
            speaker_id = f"Speaker {utterance['speaker']}"
            
            # Add speaker if not exists
            if not any(s['id'] == speaker_id for s in speakers):
                color = get_speaker_color(len(speakers))
                speakers.append({
                    'id': speaker_id,
                    'label': speaker_id,
                    'color': color
                })
            
            # Add segment with proper timestamp
            timestamp = format_timestamp(utterance['start'])
            segments.append({
                'text': utterance['text'],
                'speaker': speaker_id,
                'start': utterance['start'],
                'end': utterance['end'],
                'confidence': round(utterance.get('confidence', 0.95), 2),
                'timestamp': timestamp
            })
    
    # Calculate proper word count for Chinese text
    text_content = transcript.get('text', '')
    word_count = calculate_chinese_word_count(text_content)
    
    # Prepare update data
    confidence_val = transcript.get('confidence')
    confidence_int = int(round(confidence_val * 100)) if confidence_val else None
    
    update_data = {
        'status': 'completed',
        'progress': 100,
        'transcriptText': text_content,
        'confidence': confidence_int,
        'duration': transcript.get('audio_duration'),
        'wordCount': word_count,  # Use corrected word count
        'speakers': speakers,
        'segments': segments
    }
    
    # Update database
    try:
        response = requests.patch(
            f'http://localhost:5000/api/transcriptions/{transcription_id}',
            json=update_data,
            headers={'Content-Type': 'application/json'},
            timeout=30
        )
        
        if response.status_code == 200:
            print(f"✅ 轉錄完成！字數統計已修正為 {word_count:,} 個字")
            return True
        else:
            print(f"❌ 資料庫更新失敗: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ 更新過程中發生錯誤: {e}")
        return False

if __name__ == "__main__":
    # Test the word count calculation
    test_text = "我們在場館會議的時候看了.哪一家上禮拜五上禮拜五.看了哪一家是誰"
    count = calculate_chinese_word_count(test_text)
    print(f"測試文字字數: {count}")