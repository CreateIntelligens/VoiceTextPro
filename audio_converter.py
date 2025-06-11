#!/usr/bin/env python3
"""
Audio file converter for transcription platform
Converts WebM recordings to WAV format for AssemblyAI compatibility
"""

import os
import subprocess
import sys
import requests
import json
from datetime import datetime

def convert_audio_file(input_file, output_file):
    """Convert audio file using ffmpeg"""
    try:
        # Convert to WAV format with standard settings
        cmd = [
            'ffmpeg', '-i', input_file,
            '-ar', '16000',  # Sample rate 16kHz
            '-ac', '1',      # Mono channel
            '-f', 'wav',     # WAV format
            '-y',            # Overwrite output file
            output_file
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode == 0:
            print(f"✅ Audio conversion successful: {output_file}")
            return True
        else:
            print(f"❌ FFmpeg error: {result.stderr}")
            return False
            
    except Exception as e:
        print(f"❌ Conversion failed: {e}")
        return False

def update_progress(transcription_id, progress, status=None):
    """Update transcription progress"""
    try:
        data = {'progress': progress}
        if status:
            data['status'] = status
            
        response = requests.patch(
            f'http://localhost:5000/api/transcriptions/{transcription_id}',
            json=data,
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        print(f"Progress updated to {progress}%")
    except Exception as e:
        print(f"Failed to update progress: {e}")

def process_transcription_with_conversion(transcription_id):
    """Process transcription with audio conversion"""
    try:
        # Get transcription details
        response = requests.get(f'http://localhost:5000/api/transcriptions/{transcription_id}')
        if response.status_code != 200:
            print(f"Failed to get transcription details: {response.status_code}")
            return False
            
        transcription = response.json()
        filename = transcription['filename']
        
        input_file = f'uploads/{filename}'
        converted_file = f'uploads/{filename}_converted.wav'
        
        if not os.path.exists(input_file):
            print(f"Input file not found: {input_file}")
            return False
            
        print(f"Converting audio file: {filename}")
        update_progress(transcription_id, 2, 'processing')
        
        # Convert audio file
        if not convert_audio_file(input_file, converted_file):
            update_progress(transcription_id, 0, 'error')
            requests.patch(
                f'http://localhost:5000/api/transcriptions/{transcription_id}',
                json={'errorMessage': 'Audio conversion failed'},
                headers={'Content-Type': 'application/json'}
            )
            return False
            
        update_progress(transcription_id, 5)
        
        # Upload converted file to AssemblyAI
        api_key = os.environ.get('ASSEMBLYAI_API_KEY')
        if not api_key:
            print("Missing ASSEMBLYAI_API_KEY")
            return False
            
        headers = {'authorization': api_key}
        
        print("Uploading converted file to AssemblyAI...")
        with open(converted_file, 'rb') as f:
            upload_response = requests.post(
                'https://api.assemblyai.com/v2/upload',
                files={'file': f},
                headers=headers
            )
            
        if upload_response.status_code != 200:
            print(f"Upload failed: {upload_response.status_code}")
            return False
            
        upload_result = upload_response.json()
        audio_url = upload_result['upload_url']
        
        update_progress(transcription_id, 10)
        
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
        
        transcript_response = requests.post(
            'https://api.assemblyai.com/v2/transcript',
            json=transcript_request,
            headers=headers
        )
        
        if transcript_response.status_code != 200:
            print(f"Transcription start failed: {transcript_response.status_code}")
            return False
            
        result = transcript_response.json()
        assemblyai_id = result['id']
        
        # Update database with AssemblyAI ID
        requests.patch(
            f'http://localhost:5000/api/transcriptions/{transcription_id}',
            json={'assemblyaiId': assemblyai_id, 'progress': 15},
            headers={'Content-Type': 'application/json'}
        )
        
        print(f"✅ Transcription started with ID: {assemblyai_id}")
        
        # Clean up converted file
        try:
            os.remove(converted_file)
        except:
            pass
            
        return assemblyai_id
        
    except Exception as e:
        print(f"❌ Processing failed: {e}")
        return False

def main():
    """Main function"""
    if len(sys.argv) != 2:
        print("Usage: python3 audio_converter.py <transcription_id>")
        sys.exit(1)
        
    transcription_id = int(sys.argv[1])
    print(f"Starting audio conversion for transcription {transcription_id}")
    
    assemblyai_id = process_transcription_with_conversion(transcription_id)
    
    if assemblyai_id:
        print(f"✅ Audio conversion and transcription start completed")
        print(f"AssemblyAI ID: {assemblyai_id}")
        
        # Start monitoring (delegate to monitoring script)
        subprocess.Popen([
            'python3', 'monitor_basic_transcription.py', 
            assemblyai_id, str(transcription_id)
        ])
        
    else:
        print("❌ Audio conversion failed")
        sys.exit(1)

if __name__ == "__main__":
    main()