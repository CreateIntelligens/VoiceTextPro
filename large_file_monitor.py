#!/usr/bin/env python3
"""
大型檔案處理即時監控工具
提供完整的檔案處理狀態監控和分析功能
"""

import os
import sys
import time
import requests
import psycopg2
from datetime import datetime, timedelta
import json

class LargeFileMonitor:
    def __init__(self):
        self.api_key = os.environ.get('ASSEMBLYAI_API_KEY')
        self.db_url = os.environ.get('DATABASE_URL')
        self.headers = {'authorization': self.api_key}
        
    def get_db_connection(self):
        """建立資料庫連線"""
        return psycopg2.connect(self.db_url)
    
    def format_file_size(self, size_bytes):
        """格式化檔案大小顯示"""
        if size_bytes < 1024:
            return f"{size_bytes}B"
        elif size_bytes < 1024 * 1024:
            return f"{size_bytes/1024:.1f}KB"
        elif size_bytes < 1024 * 1024 * 1024:
            return f"{size_bytes/(1024*1024):.1f}MB"
        else:
            return f"{size_bytes/(1024*1024*1024):.1f}GB"
    
    def get_processing_files(self):
        """取得正在處理的大型檔案"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT id, filename, status, progress, assemblyai_id, 
                   created_at, updated_at, word_count, duration
            FROM transcriptions 
            WHERE status IN ('processing', 'uploading', 'pending')
            ORDER BY created_at DESC
        """)
        
        results = cursor.fetchall()
        cursor.close()
        conn.close()
        return results
    
    def get_file_info(self, filename):
        """取得檔案資訊"""
        try:
            file_path = os.path.join('uploads', filename)
            if os.path.exists(file_path):
                size = os.path.getsize(file_path)
                return self.format_file_size(size)
            return "檔案不存在"
        except:
            return "無法取得"
    
    def check_assemblyai_status(self, assemblyai_id):
        """檢查 AssemblyAI 處理狀態"""
        if not assemblyai_id:
            return None
            
        try:
            response = requests.get(
                f'https://api.assemblyai.com/v2/transcript/{assemblyai_id}',
                headers=self.headers,
                timeout=10
            )
            
            if response.status_code == 200:
                return response.json()
        except Exception as e:
            print(f"API 檢查錯誤: {e}")
        return None
    
    def analyze_large_files(self):
        """分析大型檔案處理統計"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        # 大檔案統計 (假設超過50個字符的檔名為大檔案)
        cursor.execute("""
            SELECT 
                COUNT(*) as total_files,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
                COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing,
                COUNT(CASE WHEN status = 'error' THEN 1 END) as failed,
                AVG(CASE WHEN word_count > 0 THEN word_count END) as avg_words,
                AVG(CASE WHEN duration > 0 THEN duration END) as avg_duration
            FROM transcriptions 
            WHERE LENGTH(filename) > 40
        """)
        
        stats = cursor.fetchone()
        cursor.close()
        conn.close()
        return stats
    
    def display_status(self):
        """顯示處理狀態"""
        print("\n" + "="*80)
        print("📊 大型檔案處理監控系統")
        print("="*80)
        print(f"檢查時間: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        # 正在處理的檔案
        processing_files = self.get_processing_files()
        
        if processing_files:
            print(f"\n🔄 正在處理的檔案 ({len(processing_files)}個)")
            print("-" * 80)
            
            for file_info in processing_files:
                id, filename, status, progress, assemblyai_id, created, updated, words, duration = file_info
                
                file_size = self.get_file_info(filename)
                elapsed = datetime.now() - updated
                
                print(f"ID {id}: {filename[:40]}...")
                print(f"  檔案大小: {file_size}")
                print(f"  狀態: {status} ({progress}%)")
                print(f"  建立時間: {created.strftime('%m-%d %H:%M')}")
                print(f"  最後更新: {updated.strftime('%m-%d %H:%M')} ({elapsed.seconds//60}分鐘前)")
                
                # 檢查 AssemblyAI 狀態
                if assemblyai_id:
                    api_data = self.check_assemblyai_status(assemblyai_id)
                    if api_data:
                        api_status = api_data.get('status', 'unknown')
                        print(f"  AssemblyAI: {api_status}")
                        
                        if api_status == 'completed':
                            print(f"  ⚠️  AssemblyAI已完成，需要更新資料庫")
                        elif api_status == 'error':
                            error_msg = api_data.get('error', '未知錯誤')
                            print(f"  ❌ 錯誤: {error_msg}")
                    else:
                        print(f"  AssemblyAI ID: {assemblyai_id} (無法連線)")
                print()
        else:
            print("\n✅ 目前沒有正在處理的檔案")
        
        # 統計資訊
        stats = self.analyze_large_files()
        if stats:
            total, completed, processing, failed, avg_words, avg_duration = stats
            
            print(f"\n📈 大型檔案處理統計")
            print("-" * 40)
            print(f"總檔案數: {total}")
            print(f"已完成: {completed} ({completed/total*100:.1f}%)" if total > 0 else "已完成: 0")
            print(f"處理中: {processing}")
            print(f"失敗: {failed}")
            print(f"平均字數: {avg_words:.0f}" if avg_words else "平均字數: N/A")
            print(f"平均時長: {avg_duration:.1f}秒" if avg_duration else "平均時長: N/A")
    
    def auto_update_completed(self):
        """自動更新已完成的轉錄"""
        processing_files = self.get_processing_files()
        updated_count = 0
        
        for file_info in processing_files:
            id, filename, status, progress, assemblyai_id, created, updated, words, duration = file_info
            
            if assemblyai_id and status == 'processing':
                api_data = self.check_assemblyai_status(assemblyai_id)
                
                if api_data and api_data.get('status') == 'completed':
                    self.update_completed_transcription(id, api_data)
                    updated_count += 1
                    print(f"✅ 已更新完成的轉錄 ID {id}")
        
        if updated_count > 0:
            print(f"\n🔄 自動更新了 {updated_count} 個已完成的轉錄")
        
        return updated_count
    
    def update_completed_transcription(self, transcription_id, transcript_data):
        """更新已完成的轉錄到資料庫"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        text = transcript_data.get('text', '')
        confidence = transcript_data.get('confidence', 0)
        duration = transcript_data.get('audio_duration', 0) / 1000 if transcript_data.get('audio_duration') else 0
        
        # 計算字數
        import re
        chinese_chars = len(re.findall(r'[\u4e00-\u9fff]', text))
        english_words = len([w for w in re.split(r'[\s\u4e00-\u9fff]+', text) if w.strip() and re.match(r'[a-zA-Z]', w)])
        word_count = chinese_chars + english_words
        
        # 處理高級功能
        highlights = json.dumps(transcript_data.get('auto_highlights_result', {}).get('results', []))
        chapters = json.dumps(transcript_data.get('chapters', []))
        sentiment = json.dumps(transcript_data.get('sentiment_analysis_results', []))
        entities = json.dumps(transcript_data.get('entities', []))
        safety = json.dumps(transcript_data.get('content_safety_labels', {}))
        
        # 處理對話者分段
        segments = []
        if transcript_data.get('utterances'):
            for utterance in transcript_data['utterances']:
                segments.append({
                    'speaker': utterance.get('speaker', 'Unknown'),
                    'text': utterance.get('text', ''),
                    'start': utterance.get('start', 0),
                    'end': utterance.get('end', 0),
                    'confidence': utterance.get('confidence', 0)
                })
        
        cursor.execute('''
            UPDATE transcriptions SET 
                progress = 100, status = 'completed', transcript_text = %s,
                confidence = %s, duration = %s, word_count = %s,
                auto_highlights = %s, auto_chapters = %s,
                sentiment_analysis = %s, entity_detection = %s, content_safety = %s,
                speaker_segments = %s, updated_at = NOW()
            WHERE id = %s
        ''', (text, confidence, duration, word_count,
              highlights, chapters, sentiment,
              entities, safety, json.dumps(segments), transcription_id))
        
        conn.commit()
        cursor.close()
        conn.close()

def main():
    """主程式"""
    monitor = LargeFileMonitor()
    
    if len(sys.argv) > 1:
        command = sys.argv[1]
        
        if command == 'status':
            monitor.display_status()
        elif command == 'update':
            updated = monitor.auto_update_completed()
            monitor.display_status()
        elif command == 'watch':
            print("🔍 開始監控模式 (Ctrl+C 結束)")
            try:
                while True:
                    monitor.display_status()
                    updated = monitor.auto_update_completed()
                    print(f"\n⏰ 等待30秒後重新檢查...")
                    time.sleep(30)
            except KeyboardInterrupt:
                print("\n監控結束")
        else:
            print("使用方式:")
            print("  python3 large_file_monitor.py status  - 顯示狀態")
            print("  python3 large_file_monitor.py update  - 更新並顯示狀態")
            print("  python3 large_file_monitor.py watch   - 持續監控模式")
    else:
        monitor.display_status()

if __name__ == "__main__":
    main()