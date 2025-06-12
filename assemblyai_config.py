"""
AssemblyAI 語音識別調教配置
提供不同場景的最佳化設置選項
"""

# 標準會議轉錄配置（平衡品質與速度）
STANDARD_CONFIG = {
    # 講者識別設置
    "speaker_labels": True,
    "speakers_expected": 4,
    "speech_threshold": 0.3,
    
    # 語言處理設置
    "language_detection": True,
    "language_confidence_threshold": 0.6,
    
    # 音頻增強設置
    "boost_param": "high",
    "multichannel": False,
    
    # 文本處理設置
    "punctuate": True,
    "format_text": True,
    "disfluencies": False,
    "filter_profanity": False,
    
    # 隱私保護設置
    "redact_pii": False,
    
    # AI 分析功能
    "summarization": True,
    "auto_highlights": True,
    "iab_categories": True,
    "sentiment_analysis": True,
    "entity_detection": True,
    "content_safety": True,
    "custom_topics": True
}

# 快速轉錄配置（優化速度）
FAST_CONFIG = {
    # 講者識別設置
    "speaker_labels": True,
    "speakers_expected": 3,
    "speech_threshold": 0.4,
    
    # 語言處理設置
    "language_detection": True,
    "language_confidence_threshold": 0.7,
    
    # 音頻增強設置
    "boost_param": "default",
    "multichannel": False,
    
    # 文本處理設置
    "punctuate": True,
    "format_text": True,
    "disfluencies": False,
    "filter_profanity": False,
    
    # 隱私保護設置
    "redact_pii": False,
    
    # 精簡 AI 功能（提高速度）
    "summarization": False,
    "auto_highlights": True,
    "iab_categories": False,
    "sentiment_analysis": False,
    "entity_detection": False,
    "content_safety": False,
    "custom_topics": False
}

# 高品質轉錄配置（最佳準確度）
HIGH_QUALITY_CONFIG = {
    # 講者識別設置
    "speaker_labels": True,
    "speakers_expected": 6,
    "speech_threshold": 0.2,
    
    # 語言處理設置
    "language_detection": True,
    "language_confidence_threshold": 0.5,
    
    # 音頻增強設置
    "boost_param": "high",
    "multichannel": True,
    
    # 文本處理設置
    "punctuate": True,
    "format_text": True,
    "disfluencies": True,  # 保留所有語言細節
    "filter_profanity": False,
    
    # 隱私保護設置
    "redact_pii": False,
    
    # 完整 AI 功能
    "summarization": True,
    "auto_highlights": True,
    "iab_categories": True,
    "sentiment_analysis": True,
    "entity_detection": True,
    "content_safety": True,
    "custom_topics": True
}

# 隱私保護配置（敏感內容處理）
PRIVACY_CONFIG = {
    # 講者識別設置
    "speaker_labels": True,
    "speakers_expected": 4,
    "speech_threshold": 0.3,
    
    # 語言處理設置
    "language_detection": True,
    "language_confidence_threshold": 0.6,
    
    # 音頻增強設置
    "boost_param": "high",
    "multichannel": False,
    
    # 文本處理設置
    "punctuate": True,
    "format_text": True,
    "disfluencies": False,
    "filter_profanity": True,
    
    # 隱私保護設置（啟用）
    "redact_pii": True,
    "redact_pii_policies": [
        "us_social_security_number",
        "credit_card_number",
        "phone_number",
        "email_address"
    ],
    "redact_pii_sub": "hash",
    
    # 基本 AI 功能
    "summarization": True,
    "auto_highlights": True,
    "iab_categories": False,
    "sentiment_analysis": False,
    "entity_detection": True,
    "content_safety": True,
    "custom_topics": False
}

# 中文優化配置（針對中文語音優化）
CHINESE_OPTIMIZED_CONFIG = {
    # 講者識別設置
    "speaker_labels": True,
    "speakers_expected": 4,
    "speech_threshold": 0.25,  # 中文語音特性調整
    
    # 語言處理設置
    "language_code": "zh",  # 指定中文
    "language_detection": False,  # 關閉自動檢測
    "language_confidence_threshold": 0.8,
    
    # 音頻增強設置
    "boost_param": "high",
    "multichannel": False,
    
    # 文本處理設置
    "punctuate": True,
    "format_text": True,
    "disfluencies": False,
    "filter_profanity": False,
    
    # 隱私保護設置
    "redact_pii": False,
    
    # AI 分析功能
    "summarization": True,
    "auto_highlights": True,
    "iab_categories": True,
    "sentiment_analysis": True,
    "entity_detection": True,
    "content_safety": True,
    "custom_topics": True
}

def get_config(config_type="standard"):
    """獲取指定類型的配置"""
    configs = {
        "standard": STANDARD_CONFIG,
        "fast": FAST_CONFIG,
        "high_quality": HIGH_QUALITY_CONFIG,
        "privacy": PRIVACY_CONFIG,
        "chinese": CHINESE_OPTIMIZED_CONFIG
    }
    return configs.get(config_type, STANDARD_CONFIG)

def apply_custom_keywords(config, keywords):
    """應用自定義關鍵字到配置"""
    if keywords:
        keywords_list = [word.strip() for word in keywords.split(',') if word.strip()]
        if keywords_list:
            config["word_boost"] = keywords_list
    return config

def print_config_summary(config_type):
    """列印配置摘要"""
    config = get_config(config_type)
    print(f"\n📋 使用 {config_type.upper()} 配置:")
    print(f"   講者數量: {config.get('speakers_expected', 'auto')}")
    print(f"   音頻增強: {config.get('boost_param', 'default')}")
    print(f"   語音閾值: {config.get('speech_threshold', 0.5)}")
    print(f"   AI 功能: {'完整' if config.get('summarization') else '精簡'}")
    print(f"   隱私保護: {'啟用' if config.get('redact_pii') else '關閉'}")