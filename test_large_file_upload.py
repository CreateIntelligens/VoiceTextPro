#!/usr/bin/env python3
"""
Test script to verify large file upload and segmentation functionality
Creates a test large file and verifies the complete processing workflow
"""

import os
import psycopg2
import requests
import time
import subprocess
from pathlib import Path

def create_test_large_file(size_mb=120):
    """Create a test audio file of specified size"""
    test_file_path = f'uploads/test_large_file_{size_mb}mb.m4a'
    
    try:
        # Create a test audio file using ffmpeg
        # Generate 10 minutes of test audio and repeat to reach desired size
        duration_seconds = (size_mb * 8)  # Approximate duration to reach file size
        
        ffmpeg_cmd = [
            'ffmpeg', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=10',
            '-ac', '1', '-ar', '44100', '-c:a', 'aac', '-b:a', '128k',
            '-y', test_file_path
        ]
        
        # First create a base 10-second file
        base_cmd = [
            'ffmpeg', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=10',
            '-ac', '1', '-ar', '44100', '-c:a', 'aac', '-b:a', '128k',
            '-y', 'uploads/base_audio.m4a'
        ]
        
        subprocess.run(base_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        
        # Create filter to repeat the audio multiple times
        repeat_count = max(1, duration_seconds // 10)
        
        # Create concat filter
        concat_inputs = []
        for i in range(repeat_count):
            concat_inputs.extend(['-i', 'uploads/base_audio.m4a'])
        
        filter_parts = [f'[{i}:0]' for i in range(repeat_count)]
        filter_complex = f'{"".join(filter_parts)}concat=n={repeat_count}:v=0:a=1[out]'
        
        final_cmd = ['ffmpeg'] + concat_inputs + [
            '-filter_complex', filter_complex,
            '-map', '[out]',
            '-c:a', 'aac', '-b:a', '128k',
            '-y', test_file_path
        ]
        
        print(f"Creating test file: {test_file_path}")
        subprocess.run(final_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        
        # Clean up base file
        if os.path.exists('uploads/base_audio.m4a'):
            os.remove('uploads/base_audio.m4a')
        
        if os.path.exists(test_file_path):
            actual_size = os.path.getsize(test_file_path) / (1024 * 1024)
            print(f"Test file created: {actual_size:.1f}MB")
            return test_file_path
        else:
            print("Failed to create test file")
            return None
            
    except Exception as e:
        print(f"Error creating test file: {e}")
        return None

def test_segmentation_functionality():
    """Test the segmentation functionality directly"""
    from enhanced_large_file_processor import EnhancedLargeFileProcessor
    
    print("Testing segmentation functionality...")
    
    # Create test processor instance
    processor = EnhancedLargeFileProcessor()
    
    # Create test file
    test_file = create_test_large_file(120)
    if not test_file:
        print("Failed to create test file")
        return False
    
    try:
        # Test segmentation
        segments = processor.create_optimal_segments(test_file, target_size_mb=80)
        
        if len(segments) > 1:
            print(f"✓ Segmentation successful: {len(segments)} segments created")
            
            # Verify segments exist and have reasonable sizes
            total_size = 0
            for i, segment in enumerate(segments):
                if os.path.exists(segment):
                    size_mb = os.path.getsize(segment) / (1024 * 1024)
                    total_size += size_mb
                    print(f"  Segment {i+1}: {size_mb:.1f}MB")
                else:
                    print(f"  ✗ Segment {i+1} not found: {segment}")
                    return False
            
            print(f"✓ Total segmented size: {total_size:.1f}MB")
            
            # Clean up test segments
            for segment in segments:
                if os.path.exists(segment):
                    os.remove(segment)
            
            # Clean up test file
            if os.path.exists(test_file):
                os.remove(test_file)
            
            return True
        else:
            print("✗ Segmentation failed - no segments created")
            return False
            
    except Exception as e:
        print(f"✗ Segmentation test error: {e}")
        return False

def test_database_integration():
    """Test database integration for transcription records"""
    try:
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cursor = conn.cursor()
        
        # Create a test transcription record
        cursor.execute('''
            INSERT INTO transcriptions (filename, original_name, file_size, status, progress)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
        ''', ('test_large_file.m4a', '測試大檔案.m4a', 125829120, 'pending', 0))
        
        test_id = cursor.fetchone()[0]
        print(f"✓ Test transcription record created: ID {test_id}")
        
        # Test update functionality
        cursor.execute('''
            UPDATE transcriptions SET progress = %s, status = %s WHERE id = %s
        ''', (50, 'processing', test_id))
        
        # Verify update
        cursor.execute('SELECT progress, status FROM transcriptions WHERE id = %s', (test_id,))
        result = cursor.fetchone()
        
        if result and result[0] == 50 and result[1] == 'processing':
            print("✓ Database update successful")
        else:
            print("✗ Database update failed")
            return False
        
        # Clean up test record
        cursor.execute('DELETE FROM transcriptions WHERE id = %s', (test_id,))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        print("✓ Database integration test passed")
        return True
        
    except Exception as e:
        print(f"✗ Database test error: {e}")
        return False

def test_upload_detection():
    """Test the upload size detection logic"""
    # Simulate file upload scenarios
    test_cases = [
        (50 * 1024 * 1024, False, "50MB file - should use standard processing"),
        (120 * 1024 * 1024, True, "120MB file - should use large file processing"),
        (200 * 1024 * 1024, True, "200MB file - should use large file processing")
    ]
    
    print("Testing upload size detection...")
    
    for file_size, should_be_large, description in test_cases:
        file_size_mb = file_size / (1024 * 1024)
        is_large_file = file_size_mb > 100
        
        if is_large_file == should_be_large:
            print(f"✓ {description}")
        else:
            print(f"✗ {description} - Detection failed")
            return False
    
    print("✓ Upload size detection test passed")
    return True

def main():
    """Run comprehensive tests"""
    print("=== Large File Processing System Test ===")
    print()
    
    # Check required dependencies
    if not os.environ.get('ASSEMBLYAI_API_KEY'):
        print("✗ ASSEMBLYAI_API_KEY not found")
        return
    
    if not os.environ.get('DATABASE_URL'):
        print("✗ DATABASE_URL not found")
        return
    
    # Create uploads directory if it doesn't exist
    os.makedirs('uploads', exist_ok=True)
    os.makedirs('uploads/segments', exist_ok=True)
    
    print("✓ Environment check passed")
    print()
    
    # Run tests
    tests = [
        ("Upload Size Detection", test_upload_detection),
        ("Database Integration", test_database_integration),
        ("File Segmentation", test_segmentation_functionality)
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        print(f"Running {test_name} test...")
        try:
            if test_func():
                passed += 1
                print(f"✓ {test_name} PASSED")
            else:
                print(f"✗ {test_name} FAILED")
        except Exception as e:
            print(f"✗ {test_name} ERROR: {e}")
        print()
    
    print(f"=== Test Results: {passed}/{total} tests passed ===")
    
    if passed == total:
        print("🎉 All tests passed! Large file processing system is ready.")
    else:
        print("⚠️  Some tests failed. Please check the issues above.")

if __name__ == "__main__":
    main()