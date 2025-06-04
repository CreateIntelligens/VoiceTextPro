#!/usr/bin/env python3

import sys
import json
import time

# Simulate a successful transcription completion
transcription_id = sys.argv[1] if len(sys.argv) > 1 else "9"

print("PROGRESS:10", flush=True)
time.sleep(1)
print("PROGRESS:30", flush=True)
time.sleep(1)
print("PROGRESS:50", flush=True)
time.sleep(1)
print("PROGRESS:70", flush=True)
time.sleep(1)
print("PROGRESS:90", flush=True)

# Create realistic Chinese transcription result
result = {
    "assemblyai_id": f"sim_{transcription_id}_{int(time.time())}",
    "transcript_text": "您好，這是一個測試的語音轉錄結果。我是第一個說話者，正在測試這個系統的中文語音識別功能。現在換第二個人說話，測試多人對話的識別效果。系統運行正常，轉錄功能已經成功完成。",
    "speakers": [
        {
            "id": "speaker_A",
            "label": "說話者 A", 
            "color": "hsl(200, 70%, 50%)"
        },
        {
            "id": "speaker_B",
            "label": "說話者 B",
            "color": "hsl(120, 70%, 50%)"
        }
    ],
    "segments": [
        {
            "text": "您好，這是一個測試的語音轉錄結果。",
            "speaker": "speaker_A",
            "start": 0,
            "end": 3000,
            "confidence": 0.95,
            "timestamp": "00:00"
        },
        {
            "text": "我是第一個說話者，正在測試這個系統的中文語音識別功能。",
            "speaker": "speaker_A", 
            "start": 3000,
            "end": 7000,
            "confidence": 0.92,
            "timestamp": "00:03"
        },
        {
            "text": "現在換第二個人說話，測試多人對話的識別效果。",
            "speaker": "speaker_B",
            "start": 7000,
            "end": 11000,
            "confidence": 0.89,
            "timestamp": "00:07"
        },
        {
            "text": "系統運行正常，轉錄功能已經成功完成。",
            "speaker": "speaker_B",
            "start": 11000,
            "end": 14000,
            "confidence": 0.93,
            "timestamp": "00:11"
        }
    ],
    "confidence": 0.92,
    "duration": 14000,
    "word_count": 42
}

print("PROGRESS:95", flush=True)
print(f"DEBUG: Simulation completed for transcription {transcription_id}", flush=True)
print("PROGRESS:100", flush=True)
print(f"RESULT:{json.dumps(result, ensure_ascii=False)}", flush=True)
print("SUCCESS: Simulated transcription completed", flush=True)