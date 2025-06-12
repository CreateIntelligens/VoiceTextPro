#!/usr/bin/env python3
"""
Direct upload handler for testing large file processing
"""

import os
import psycopg2
import subprocess
import sys

def create_test_transcription():
    """Create a test transcription record for the existing large file"""
    try:
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cursor = conn.cursor()
        
        # Create transcription record for the 184MB file
        cursor.execute('''
            INSERT INTO transcriptions (filename, original_name, file_size, status, progress)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
        ''', ('cfadc4d244c605271a37219a30afb44d', '長安東路一段18號.m4a', 184709824, 'pending', 0))
        
        transcription_id = cursor.fetchone()[0]
        
        conn.commit()
        cursor.close()
        conn.close()
        
        print(f"Created transcription record: ID {transcription_id}")
        return transcription_id
        
    except Exception as e:
        print(f"Database error: {e}")
        return None

def start_large_file_processing(transcription_id):
    """Start the enhanced large file processor"""
    try:
        # Launch the enhanced processor
        cmd = ['python3', 'enhanced_large_file_processor.py', str(transcription_id)]
        
        print(f"Starting enhanced large file processor for transcription {transcription_id}")
        
        # Run in background
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            universal_newlines=True
        )
        
        # Monitor initial output
        for i in range(10):  # First 10 lines of output
            line = process.stdout.readline()
            if line:
                print(f"[PROCESSOR] {line.strip()}")
            else:
                break
        
        print(f"Large file processor started (PID: {process.pid})")
        return True
        
    except Exception as e:
        print(f"Failed to start processor: {e}")
        return False

def main():
    """Main function to handle direct upload testing"""
    print("=== Direct Upload Handler ===")
    
    # Check if file exists
    file_path = 'uploads/cfadc4d244c605271a37219a30afb44d'
    if not os.path.exists(file_path):
        print("Large file not found")
        return False
    
    file_size_mb = os.path.getsize(file_path) / (1024 * 1024)
    print(f"Found large file: {file_size_mb:.1f}MB")
    
    # Create transcription record
    transcription_id = create_test_transcription()
    if not transcription_id:
        print("Failed to create transcription record")
        return False
    
    # Start processing
    success = start_large_file_processing(transcription_id)
    if success:
        print(f"Processing started for transcription {transcription_id}")
        print("You can monitor progress in the web interface")
        return True
    else:
        print("Failed to start processing")
        return False

if __name__ == "__main__":
    main()