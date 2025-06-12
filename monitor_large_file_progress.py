#!/usr/bin/env python3
"""
大檔案轉錄進度監控腳本
實時監控分段處理和轉錄進度
"""

import os
import time
import psycopg2
import requests
from datetime import datetime

def get_db_status(transcription_id):
    """獲取數據庫中的轉錄狀態"""
    try:
        conn = psycopg2.connect(os.environ.get('DATABASE_URL'))
        cur = conn.cursor()
        cur.execute(
            "SELECT status, progress, assemblyai_id, updated_at FROM transcriptions WHERE id = %s",
            (transcription_id,)
        )
        result = cur.fetchone()
        conn.close()
        return result
    except Exception as e:
        print(f"數據庫查詢錯誤: {e}")
        return None

def check_segments_status(transcription_id):
    """檢查分段檔案創建狀態"""
    segment_dir = f"uploads/segments_{transcription_id}"
    if not os.path.exists(segment_dir):
        return {"exists": False, "count": 0, "total_size": 0}
    
    files = [f for f in os.listdir(segment_dir) if f.startswith("segment_")]
    total_size = sum(os.path.getsize(os.path.join(segment_dir, f)) for f in files)
    
    return {
        "exists": True,
        "count": len(files),
        "files": sorted(files),
        "total_size": total_size,
        "total_size_mb": total_size / (1024 * 1024)
    }

def check_assemblyai_status(assemblyai_id):
    """檢查 AssemblyAI 轉錄狀態"""
    if not assemblyai_id:
        return None
    
    try:
        headers = {'authorization': os.environ.get('ASSEMBLYAI_API_KEY')}
        response = requests.get(
            f'https://api.assemblyai.com/v2/transcript/{assemblyai_id}',
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            return {"error": f"HTTP {response.status_code}"}
    except Exception as e:
        return {"error": str(e)}

def monitor_progress(transcription_id, check_interval=15):
    """持續監控轉錄進度"""
    print(f"開始監控轉錄 ID: {transcription_id}")
    print(f"檢查間隔: {check_interval} 秒")
    print("=" * 60)
    
    last_progress = 0
    start_time = time.time()
    
    while True:
        current_time = datetime.now().strftime("%H:%M:%S")
        elapsed = int(time.time() - start_time)
        
        # 檢查數據庫狀態
        db_status = get_db_status(transcription_id)
        if not db_status:
            print(f"[{current_time}] 無法獲取數據庫狀態")
            time.sleep(check_interval)
            continue
        
        status, progress, assemblyai_id, updated_at = db_status
        
        # 檢查分段狀態
        segments_info = check_segments_status(transcription_id)
        
        # 檢查 AssemblyAI 狀態
        assemblyai_status = None
        if assemblyai_id:
            assemblyai_status = check_assemblyai_status(assemblyai_id)
        
        # 輸出狀態報告
        print(f"\n[{current_time}] 運行時間: {elapsed//60}分{elapsed%60}秒")
        print(f"數據庫狀態: {status} | 進度: {progress}%")
        
        if progress != last_progress:
            print(f"📈 進度更新: {last_progress}% → {progress}%")
            last_progress = progress
        
        if segments_info["exists"]:
            print(f"分段檔案: {segments_info['count']} 個 ({segments_info['total_size_mb']:.1f}MB)")
            if segments_info["count"] > 0:
                latest_files = segments_info["files"][-3:] if len(segments_info["files"]) > 3 else segments_info["files"]
                print(f"最新分段: {', '.join(latest_files)}")
        
        if assemblyai_id:
            print(f"AssemblyAI ID: {assemblyai_id}")
            if assemblyai_status:
                if "error" in assemblyai_status:
                    print(f"AssemblyAI 錯誤: {assemblyai_status['error']}")
                else:
                    ai_status = assemblyai_status.get('status', 'unknown')
                    print(f"AssemblyAI 狀態: {ai_status}")
                    if 'audio_duration' in assemblyai_status:
                        duration = assemblyai_status['audio_duration'] / 1000  # 轉換為秒
                        print(f"音頻時長: {duration/60:.1f} 分鐘")
        
        # 檢查是否完成
        if status == 'completed':
            print("\n🎉 轉錄已完成!")
            break
        elif status == 'error':
            print("\n❌ 轉錄失敗")
            break
        elif progress >= 100:
            print("\n✅ 進度已達 100%")
            break
        
        print("-" * 40)
        time.sleep(check_interval)

def main():
    import sys
    
    if len(sys.argv) < 2:
        print("用法: python3 monitor_large_file_progress.py <transcription_id> [check_interval]")
        sys.exit(1)
    
    transcription_id = int(sys.argv[1])
    check_interval = int(sys.argv[2]) if len(sys.argv) > 2 else 15
    
    monitor_progress(transcription_id, check_interval)

if __name__ == "__main__":
    main()