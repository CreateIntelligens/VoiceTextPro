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

def update_database_with_results(transcription_id, transcript):
    """Update database with completed transcription results"""
    try:
        # Process speakers and segments
        speakers = []
        segments = []
        
        if transcript.utterances:
            for utterance in transcript.utterances:
                speaker_id = f"Speaker {utterance.speaker}"
                
                # Add speaker if not exists
                if not any(s['id'] == speaker_id for s in speakers):
                    color_index = len(speakers)
                    speakers.append({
                        'id': speaker_id,
                        'label': speaker_id,
                        'color': get_speaker_color(color_index)
                    })
                
                # Add segment
                segments.append({
                    'text': utterance.text,
                    'speaker': speaker_id,
                    'start': utterance.start,
                    'end': utterance.end,
                    'confidence': round(utterance.confidence, 2) if utterance.confidence else 0.95,
                    'timestamp': format_timestamp(utterance.start)
                })
        
        # Prepare update data
        confidence_val = transcript.confidence
        confidence_int = int(round(confidence_val * 100)) if confidence_val else None
        
        update_data = {
            'status': 'completed',
            'progress': 100,
            'transcriptText': transcript.text or '',
            'confidence': confidence_int,
            'duration': transcript.audio_duration,
            'wordCount': len(transcript.text.split()) if transcript.text else 0,
            'speakers': speakers,
            'segments': segments,
            'assemblyaiId': transcript.id
        }
        
        response = requests.patch(
            f'http://localhost:5000/api/transcriptions/{transcription_id}',
            json=update_data,
            headers={'Content-Type': 'application/json'},
            timeout=30
        )
        
        if response.status_code == 200:
            print("Database updated successfully with transcription results!", flush=True)
            return True
        else:
            print(f"Failed to update database: {response.status_code}", flush=True)
            print(f"Response: {response.text}", flush=True)
            return False
            
    except Exception as e:
        print(f"Error updating database: {e}", flush=True)
        return False

def main():
    if len(sys.argv) < 3:
        print("Usage: python3 fixed_transcription.py <audio_file_path> <transcription_id> [custom_keywords]")
        sys.exit(1)
    
    audio_file_path = sys.argv[1]
    transcription_id = sys.argv[2]
    custom_keywords = sys.argv[3] if len(sys.argv) > 3 else ""
    
    # Set API key
    aai.settings.api_key = os.getenv("ASSEMBLYAI_API_KEY", "0f0da6a87ee34439b8188dc991414cca")
    
    try:
        print("PROGRESS:10", flush=True)
        update_progress(transcription_id, 10)
        print(f"DEBUG: Starting transcription for file: {audio_file_path}", flush=True)
        
        print("PROGRESS:20", flush=True)
        update_progress(transcription_id, 20)
        
        # Parse custom keywords
        word_boost_keywords = ["business", "meeting", "strategy", "customer", "platform", "channel", "social", "marketing", "management", "analysis", "solution", "problem", "market", "competition", "value", "service", "product", "technology"]
        
        if custom_keywords.strip():
            print(f"DEBUG: All provided keywords: {custom_keywords}", flush=True)
            custom_words = [kw.strip() for kw in custom_keywords.split('、') if kw.strip()]
            word_boost_keywords.extend(custom_words)
        
        print(f"DEBUG: Using {len(word_boost_keywords)} keywords for word boost", flush=True)
        
        print("PROGRESS:30", flush=True)
        update_progress(transcription_id, 30)
        
        # Configure transcription
        config = aai.TranscriptionConfig(
            language_code="zh",
            speaker_labels=True,
            punctuate=True,
            format_text=True,
            word_boost=word_boost_keywords,
            boost_param="high",
            speech_model=aai.SpeechModel.best
        )
        
        print("DEBUG: Created transcription config", flush=True)
        
        print("PROGRESS:40", flush=True)
        update_progress(transcription_id, 40)
        
        # Start transcription
        print("DEBUG: Starting file upload and transcription", flush=True)
        transcriber = aai.Transcriber()
        transcript = transcriber.submit(audio_file_path, config=config)
        
        print(f"DEBUG: Submitted, transcript ID: {transcript.id}", flush=True)
        
        print("PROGRESS:50", flush=True)
        update_progress(transcription_id, 50)
        
        print(f"DEBUG: Initial status: {transcript.status}", flush=True)
        
        # Enhanced monitoring with better error handling
        max_retries = 360  # 30 minutes at 5-second intervals for large files
        retry_count = 0
        last_status = None
        
        while transcript.status in [aai.TranscriptStatus.queued, aai.TranscriptStatus.processing] and retry_count < max_retries:
            # Progressive progress reporting
            if retry_count < 60:  # First 5 minutes
                progress = min(50 + retry_count // 2, 75)
            else:  # After 5 minutes
                progress = min(75 + (retry_count - 60) // 8, 90)
            
            if retry_count % 6 == 0:  # Update progress every 30 seconds
                print(f"PROGRESS:{progress}", flush=True)
                update_progress(transcription_id, progress)
            
            print(f"DEBUG: Status check {retry_count + 1}/{max_retries}, status: {transcript.status}", flush=True)
            
            # Show progress for large files
            if retry_count > 0 and retry_count % 24 == 0:  # Every 2 minutes
                minutes_elapsed = retry_count * 5 / 60
                print(f"DEBUG: Elapsed: {minutes_elapsed:.1f} minutes. Large files may take 15-30 minutes.", flush=True)
            
            time.sleep(5)
            retry_count += 1
            
            # Refresh transcript status with robust error handling
            try:
                old_transcript = transcript
                transcript = aai.Transcript.get_by_id(transcript.id)
                
                # Only log status changes
                if transcript.status != last_status:
                    print(f"DEBUG: Status changed from {last_status} to {transcript.status}", flush=True)
                    last_status = transcript.status
                
                if transcript.status == aai.TranscriptStatus.completed:
                    print("DEBUG: Transcription completed successfully!", flush=True)
                    break
                elif transcript.status == aai.TranscriptStatus.error:
                    error_msg = getattr(transcript, 'error', 'Unknown transcription error')
                    print(f"ERROR: Transcription failed: {error_msg}", file=sys.stderr, flush=True)
                    
                    # Update database with error
                    requests.patch(
                        f'http://localhost:5000/api/transcriptions/{transcription_id}',
                        json={'status': 'error', 'errorMessage': str(error_msg)},
                        headers={'Content-Type': 'application/json'},
                        timeout=10
                    )
                    sys.exit(1)
                    
            except Exception as e:
                print(f"ERROR: Failed to check transcript status: {e}", flush=True)
                # Don't exit immediately, give it a few more tries
                if retry_count > 50:  # After 4+ minutes of failures
                    print("ERROR: Too many status check failures", file=sys.stderr, flush=True)
                    sys.exit(1)
                continue
        
        # Final status verification
        if retry_count >= max_retries:
            print("ERROR: Transcription timed out after 30 minutes", file=sys.stderr, flush=True)
            requests.patch(
                f'http://localhost:5000/api/transcriptions/{transcription_id}',
                json={'status': 'error', 'errorMessage': 'Transcription timed out'},
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            sys.exit(1)
        
        if transcript.status != aai.TranscriptStatus.completed:
            error_msg = f"Transcription ended with unexpected status: {transcript.status}"
            print(f"ERROR: {error_msg}", file=sys.stderr, flush=True)
            requests.patch(
                f'http://localhost:5000/api/transcriptions/{transcription_id}',
                json={'status': 'error', 'errorMessage': error_msg},
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            sys.exit(1)
        
        print("PROGRESS:95", flush=True)
        update_progress(transcription_id, 95)
        print("DEBUG: Processing and saving transcription results", flush=True)
        
        # Update database with results
        if update_database_with_results(transcription_id, transcript):
            print("PROGRESS:100", flush=True)
            print("SUCCESS: Transcription completed and saved!", flush=True)
        else:
            print("ERROR: Failed to save transcription results", file=sys.stderr, flush=True)
            sys.exit(1)
            
    except Exception as e:
        error_msg = f"Transcription process failed: {str(e)}"
        print(f"ERROR: {error_msg}", file=sys.stderr, flush=True)
        
        # Update database with error
        try:
            requests.patch(
                f'http://localhost:5000/api/transcriptions/{transcription_id}',
                json={'status': 'error', 'errorMessage': error_msg},
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
        except:
            pass
        
        sys.exit(1)

if __name__ == "__main__":
    main()