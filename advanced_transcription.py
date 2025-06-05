#!/usr/bin/env python3
import os
import sys
import time
import requests
import assemblyai as aai
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

def process_advanced_features(transcript):
    """Process all advanced features from AssemblyAI transcript"""
    advanced_data = {}
    
    # Auto-generated summary
    if hasattr(transcript, 'summary') and transcript.summary:
        advanced_data['summary'] = transcript.summary
        advanced_data['summaryType'] = 'paragraph'  # Default type
    
    # Auto highlights (key phrases)
    if hasattr(transcript, 'auto_highlights_result') and transcript.auto_highlights_result:
        highlights = []
        if transcript.auto_highlights_result.status == 'success':
            for result in transcript.auto_highlights_result.results:
                highlights.append({
                    'text': result.text,
                    'count': result.count,
                    'rank': result.rank,
                    'timestamps': [{'start': ts.start, 'end': ts.end} for ts in result.timestamps]
                })
        advanced_data['autoHighlights'] = {
            'status': transcript.auto_highlights_result.status,
            'results': highlights
        }
    
    # Auto chapters
    if hasattr(transcript, 'chapters') and transcript.chapters:
        chapters = []
        for chapter in transcript.chapters:
            chapters.append({
                'gist': chapter.gist,
                'headline': chapter.headline,
                'summary': chapter.summary,
                'start': chapter.start,
                'end': chapter.end
            })
        advanced_data['autoChapters'] = chapters
    
    # Topic detection (IAB categories)
    if hasattr(transcript, 'iab_categories_result') and transcript.iab_categories_result:
        topics = {
            'status': transcript.iab_categories_result.status,
            'results': []
        }
        if transcript.iab_categories_result.status == 'success':
            for result in transcript.iab_categories_result.results:
                topics['results'].append({
                    'text': result.text,
                    'labels': [{'relevance': label.relevance, 'label': label.label} for label in result.labels],
                    'timestamp': {'start': result.timestamp.start, 'end': result.timestamp.end}
                })
        advanced_data['topicsDetection'] = topics
    
    # Sentiment analysis
    if hasattr(transcript, 'sentiment_analysis_results') and transcript.sentiment_analysis_results:
        sentiments = []
        for result in transcript.sentiment_analysis_results:
            sentiments.append({
                'text': result.text,
                'sentiment': result.sentiment,
                'confidence': result.confidence,
                'start': result.start,
                'end': result.end
            })
        advanced_data['sentimentAnalysis'] = sentiments
    
    # Entity detection
    if hasattr(transcript, 'entities') and transcript.entities:
        entities = []
        for entity in transcript.entities:
            entities.append({
                'entity_type': entity.entity_type,
                'text': entity.text,
                'start': entity.start,
                'end': entity.end
            })
        advanced_data['entityDetection'] = entities
    
    # Content safety
    if hasattr(transcript, 'content_safety_labels') and transcript.content_safety_labels:
        safety_results = {
            'status': transcript.content_safety_labels.status,
            'results': []
        }
        if transcript.content_safety_labels.status == 'success':
            for result in transcript.content_safety_labels.results:
                safety_results['results'].append({
                    'text': result.text,
                    'labels': [{'confidence': label.confidence, 'label': label.label} for label in result.labels],
                    'timestamp': {'start': result.timestamp.start, 'end': result.timestamp.end}
                })
        advanced_data['contentSafety'] = safety_results
    
    return advanced_data

def update_database_with_results(transcription_id, transcript):
    """Update database with completed transcription results and advanced features"""
    try:
        # Process speakers and segments
        speakers = []
        segments = []
        
        if transcript.utterances:
            for utterance in transcript.utterances:
                speaker_id = f"Speaker {utterance.speaker}"
                
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
                    'text': utterance.text,
                    'speaker': speaker_id,
                    'start': utterance.start,
                    'end': utterance.end,
                    'confidence': utterance.confidence
                })
        
        # Calculate word count
        word_count = calculate_word_count(transcript.text) if transcript.text else 0
        
        # Process advanced features
        advanced_features = process_advanced_features(transcript)
        
        # Prepare update data
        update_data = {
            'status': 'completed',
            'progress': 100,
            'transcriptText': transcript.text,
            'speakers': speakers,
            'segments': segments,
            'confidence': transcript.confidence,
            'duration': transcript.audio_duration,
            'wordCount': word_count,
            **advanced_features  # Add all advanced features
        }
        
        # Update database
        response = requests.patch(
            f'http://localhost:5000/api/transcriptions/{transcription_id}',
            json=update_data,
            headers={'Content-Type': 'application/json'},
            timeout=30
        )
        
        if response.status_code == 200:
            print(f"✓ Transcription completed successfully with advanced features", flush=True)
            print(f"✓ Word count: {word_count}", flush=True)
            print(f"✓ Duration: {transcript.audio_duration}s", flush=True)
            print(f"✓ Confidence: {transcript.confidence:.2%}", flush=True)
            if advanced_features.get('summary'):
                print(f"✓ Summary generated", flush=True)
            if advanced_features.get('autoChapters'):
                print(f"✓ Auto chapters: {len(advanced_features['autoChapters'])}", flush=True)
            if advanced_features.get('autoHighlights'):
                highlights_count = len(advanced_features['autoHighlights'].get('results', []))
                print(f"✓ Auto highlights: {highlights_count}", flush=True)
            if advanced_features.get('topicsDetection'):
                topics_count = len(advanced_features['topicsDetection'].get('results', []))
                print(f"✓ Topics detected: {topics_count}", flush=True)
            if advanced_features.get('sentimentAnalysis'):
                print(f"✓ Sentiment analysis: {len(advanced_features['sentimentAnalysis'])} segments", flush=True)
        else:
            print(f"✗ Failed to update database: {response.status_code} - {response.text}", flush=True)
            
    except Exception as e:
        print(f"✗ Error updating database: {e}", flush=True)

def main():
    if len(sys.argv) < 3:
        print("Usage: python3 advanced_transcription.py <audio_file_path> <transcription_id> [custom_keywords]")
        sys.exit(1)
    
    audio_file_path = sys.argv[1]
    transcription_id = sys.argv[2]
    custom_keywords = sys.argv[3] if len(sys.argv) > 3 else ""
    
    # Set up AssemblyAI API key
    api_key = os.getenv('ASSEMBLYAI_API_KEY')
    if not api_key:
        print("✗ ASSEMBLYAI_API_KEY environment variable not set")
        sys.exit(1)
    
    aai.settings.api_key = api_key
    
    print(f"🎤 Starting advanced transcription for ID: {transcription_id}")
    print(f"📁 File: {audio_file_path}")
    if custom_keywords:
        print(f"🔍 Custom keywords: {custom_keywords}")
    
    try:
        # Configure transcription with advanced features
        config = aai.TranscriptionConfig(
            speaker_labels=True,
            speakers_expected=None,  # Auto-detect number of speakers
            language_detection=True,
            language_code="zh",  # Chinese
            punctuate=True,
            format_text=True,
            disfluencies=False,
            # Advanced features
            summarization=True,
            summary_model="informative",
            summary_type="paragraph",
            auto_highlights=True,
            auto_chapters=True,
            iab_categories=True,
            sentiment_analysis=True,
            entity_detection=True,
            content_safety=True,
            # Custom keywords
            word_boost=[word.strip() for word in custom_keywords.split(',')] if custom_keywords else []
        )
        
        print("⏳ Uploading audio file...")
        update_progress(transcription_id, 10)
        
        # Create transcriber and start transcription
        transcriber = aai.Transcriber(config=config)
        transcript = transcriber.transcribe(audio_file_path)
        
        print(f"🔄 AssemblyAI ID: {transcript.id}")
        update_progress(transcription_id, 30)
        
        # Wait for completion with progress updates
        while transcript.status in [aai.TranscriptStatus.queued, aai.TranscriptStatus.processing]:
            print(f"⏳ Status: {transcript.status}")
            if transcript.status == aai.TranscriptStatus.processing:
                update_progress(transcription_id, 60)
            time.sleep(5)
            transcript = transcriber.get_transcript(transcript.id)
        
        if transcript.status == aai.TranscriptStatus.error:
            print(f"✗ Transcription failed: {transcript.error}")
            # Update database with error
            requests.patch(
                f'http://localhost:5000/api/transcriptions/{transcription_id}',
                json={'status': 'error', 'errorMessage': transcript.error},
                headers={'Content-Type': 'application/json'}
            )
            sys.exit(1)
        
        print("✅ Transcription completed, processing results...")
        update_progress(transcription_id, 90)
        
        # Update database with all results including advanced features
        update_database_with_results(transcription_id, transcript)
        
        print("🎉 Advanced transcription process completed successfully!")
        
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