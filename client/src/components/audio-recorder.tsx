import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Mic, 
  MicOff, 
  Square, 
  Play, 
  Pause, 
  Upload, 
  Trash2,
  Volume2,
  Settings 
} from 'lucide-react';

interface AudioRecorderProps {
  onRecordingComplete: (audioBlob: Blob, filename: string) => void;
  isDisabled?: boolean;
}

export default function AudioRecorder({ onRecordingComplete, isDisabled }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [frequencyData, setFrequencyData] = useState<number[]>(new Array(32).fill(0));
  const [waveformData, setWaveformData] = useState<number[]>(new Array(64).fill(0));

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const frequencyArrayRef = useRef<Uint8Array | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const animationRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
  };

  const requestMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      
      streamRef.current = stream;
      setPermissionGranted(true);
      
      // Setup audio analysis for level monitoring
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048; // Increase for better resolution
      analyser.smoothingTimeConstant = 0.3; // Smooth the data
      source.connect(analyser);
      analyserRef.current = analyser;
      
      toast({
        title: "麥克風權限已授予",
        description: "現在可以開始錄音",
      });
      
      return stream;
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast({
        title: "無法存取麥克風",
        description: "請檢查麥克風權限設定",
        variant: "destructive",
      });
      throw error;
    }
  };

  const startRecording = async () => {
    try {
      const stream = streamRef.current || await requestMicrophonePermission();
      
      // Reset previous recording
      chunksRef.current = [];
      setAudioBlob(null);
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }
      
      // Ensure audio analyzer is properly set up for this stream
      if (!analyserRef.current || !streamRef.current) {
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.3;
        source.connect(analyser);
        analyserRef.current = analyser;
        streamRef.current = stream;
      }
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setIsRecording(false);
        setIsPaused(false);
        
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        
        // Stop visualization
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
      
      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 0.1);
      }, 100);
      
      // Start audio level monitoring
      monitorAudioLevel();
      
      toast({
        title: "開始錄音",
        description: "正在錄製音頻...",
      });
      
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: "錄音失敗",
        description: "無法開始錄音，請檢查麥克風設定",
        variant: "destructive",
      });
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        setIsPaused(false);
        timerRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 0.1);
        }, 100);
        monitorAudioLevel();
      } else {
        mediaRecorderRef.current.pause();
        setIsPaused(true);
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      setAudioLevel(0);
    }
  };

  const monitorAudioLevel = () => {
    if (!analyserRef.current) return;
    
    const bufferLength = analyserRef.current.frequencyBinCount;
    const timeDataArray = new Uint8Array(bufferLength);
    const frequencyDataArray = new Uint8Array(bufferLength);
    
    dataArrayRef.current = timeDataArray;
    frequencyArrayRef.current = frequencyDataArray;
    
    const updateVisualization = () => {
      if (!analyserRef.current) {
        animationRef.current = requestAnimationFrame(updateVisualization);
        return;
      }
      
      if (!isRecording || isPaused) {
        // Reset visualization data when not recording
        setWaveformData(new Array(64).fill(0));
        setFrequencyData(new Array(32).fill(0));
        setAudioLevel(0);
        animationRef.current = requestAnimationFrame(updateVisualization);
        return;
      }
      
      // Get time domain data for waveform
      analyserRef.current.getByteTimeDomainData(timeDataArray);
      // Get frequency domain data for spectrum
      analyserRef.current.getByteFrequencyData(frequencyDataArray);
      
      // Calculate audio level
      const average = frequencyDataArray.reduce((a, b) => a + b) / frequencyDataArray.length;
      setAudioLevel(Math.min(100, (average / 128) * 100));
      
      // Update waveform data (sample down to 64 points)
      const waveformSamples = new Array(64);
      for (let i = 0; i < 64; i++) {
        const index = Math.floor((i / 64) * timeDataArray.length);
        waveformSamples[i] = (timeDataArray[index] - 128) / 128; // Normalize to -1 to 1
      }
      setWaveformData([...waveformSamples]); // Force state update
      
      // Update frequency data (sample down to 32 bars)
      const frequencySamples = new Array(32);
      for (let i = 0; i < 32; i++) {
        const index = Math.floor((i / 32) * frequencyDataArray.length);
        frequencySamples[i] = frequencyDataArray[index] / 255; // Normalize to 0 to 1
      }
      setFrequencyData([...frequencySamples]); // Force state update
      
      animationRef.current = requestAnimationFrame(updateVisualization);
    };
    
    updateVisualization();
  };

  const playRecording = () => {
    if (audioRef.current && audioUrl) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const deleteRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setPlaybackTime(0);
    setDuration(0);
    setIsPlaying(false);
    setRecordingTime(0);
    
    toast({
      title: "錄音已刪除",
      description: "可以重新開始錄音",
    });
  };

  const uploadRecording = () => {
    if (audioBlob) {
      const filename = `recording_${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
      onRecordingComplete(audioBlob, filename);
      
      toast({
        title: "錄音已上傳",
        description: "開始處理語音轉錄...",
      });
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getRecordingStatus = () => {
    if (isRecording && !isPaused) return { text: '錄音中', color: 'bg-red-500', pulse: true };
    if (isRecording && isPaused) return { text: '已暫停', color: 'bg-yellow-500', pulse: false };
    if (audioBlob) return { text: '錄音完成', color: 'bg-green-500', pulse: false };
    return { text: '準備錄音', color: 'bg-gray-400', pulse: false };
  };

  const status = getRecordingStatus();

  return (
    <Card className="w-full">
      <CardHeader className="px-4 sm:px-6">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Mic className="w-5 h-5 text-blue-600" />
            <span className="text-lg sm:text-xl">高品質錄音</span>
          </div>
          <Badge 
            className={`${status.color} text-white ${status.pulse ? 'animate-pulse' : ''}`}
          >
            {status.text}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="px-4 sm:px-6 space-y-6">
        {/* Real-time Audio Visualization */}
        {isRecording && !isPaused && (
          <div className="space-y-4">
            {/* Audio Level Indicator */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>音量</span>
                <span>{Math.round(audioLevel)}%</span>
              </div>
              <Progress value={audioLevel} className="h-2" />
            </div>

            {/* Waveform Display */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">波形顯示</div>
              <div className="h-16 bg-gray-900 rounded-lg p-2 flex items-center justify-center overflow-hidden">
                <div className="flex items-center justify-center h-full space-x-1">
                  {waveformData.map((amplitude, index) => (
                    <div
                      key={index}
                      className="bg-gradient-to-t from-blue-400 to-purple-500 rounded-sm transition-all duration-75"
                      style={{
                        height: `${Math.max(2, Math.abs(amplitude) * 48)}px`,
                        width: '2px',
                        opacity: 0.8 + Math.abs(amplitude) * 0.2
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Frequency Spectrum Display */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">頻譜分析</div>
              <div className="h-20 bg-gray-900 rounded-lg p-2 flex items-end justify-center space-x-1">
                {frequencyData.map((magnitude, index) => (
                  <div
                    key={index}
                    className="rounded-t-sm transition-all duration-100"
                    style={{
                      height: `${Math.max(2, magnitude * 64)}px`,
                      width: '6px',
                      background: `linear-gradient(to top, 
                        ${magnitude > 0.7 ? '#ef4444' : 
                          magnitude > 0.4 ? '#f59e0b' : 
                          magnitude > 0.2 ? '#10b981' : '#3b82f6'
                        } 0%, 
                        ${magnitude > 0.7 ? '#fca5a5' : 
                          magnitude > 0.4 ? '#fde68a' : 
                          magnitude > 0.2 ? '#a7f3d0' : '#bfdbfe'
                        } 100%)`,
                      opacity: 0.7 + magnitude * 0.3
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Recording Timer */}
        <div className="text-center">
          <div className="text-3xl sm:text-4xl font-mono font-bold text-gray-900">
            {formatTime(recordingTime)}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {isRecording ? (isPaused ? '錄音已暫停' : '正在錄音') : '錄音時長'}
          </p>
        </div>

        {/* Recording Controls */}
        <div className="flex flex-wrap justify-center gap-3">
          {!isRecording ? (
            <Button
              onClick={startRecording}
              disabled={isDisabled}
              className="bg-red-600 hover:bg-red-700 text-white flex-1 sm:flex-none"
              size="lg"
            >
              <Mic className="w-5 h-5 mr-2" />
              開始錄音
            </Button>
          ) : (
            <>
              <Button
                onClick={pauseRecording}
                variant="outline"
                className="flex-1 sm:flex-none"
                size="lg"
              >
                {isPaused ? (
                  <>
                    <Play className="w-5 h-5 mr-2" />
                    繼續
                  </>
                ) : (
                  <>
                    <Pause className="w-5 h-5 mr-2" />
                    暫停
                  </>
                )}
              </Button>
              <Button
                onClick={stopRecording}
                variant="destructive"
                className="flex-1 sm:flex-none"
                size="lg"
              >
                <Square className="w-5 h-5 mr-2" />
                停止
              </Button>
            </>
          )}
        </div>

        {/* Playback Section */}
        {audioUrl && (
          <div className="space-y-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-gray-900">錄音預覽</h4>
              <div className="flex items-center space-x-2">
                <Volume2 className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-500">
                  {formatTime(duration)}
                </span>
              </div>
            </div>

            <audio
              ref={audioRef}
              src={audioUrl}
              onLoadedMetadata={() => {
                if (audioRef.current) {
                  setDuration(audioRef.current.duration);
                }
              }}
              onTimeUpdate={() => {
                if (audioRef.current) {
                  setPlaybackTime(audioRef.current.currentTime);
                }
              }}
              onEnded={() => {
                setIsPlaying(false);
                setPlaybackTime(0);
              }}
              className="hidden"
            />

            <div className="space-y-2">
              <Progress 
                value={duration > 0 ? (playbackTime / duration) * 100 : 0} 
                className="h-2 cursor-pointer"
                onClick={(e) => {
                  if (audioRef.current && duration > 0) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const clickedTime = (x / rect.width) * duration;
                    audioRef.current.currentTime = clickedTime;
                    setPlaybackTime(clickedTime);
                  }
                }}
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>{formatTime(playbackTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-2">
              <Button
                onClick={playRecording}
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-none"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-4 h-4 mr-2" />
                    暫停
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    播放
                  </>
                )}
              </Button>
              
              <Button
                onClick={uploadRecording}
                disabled={isDisabled}
                className="bg-blue-600 hover:bg-blue-700 flex-1 sm:flex-none"
                size="sm"
              >
                <Upload className="w-4 h-4 mr-2" />
                上傳轉錄
              </Button>
              
              <Button
                onClick={deleteRecording}
                variant="destructive"
                size="sm"
                className="flex-1 sm:flex-none"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                刪除
              </Button>
            </div>
          </div>
        )}

        {/* Audio Settings Info */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center mb-2">
            <Settings className="w-4 h-4 text-gray-600 mr-2" />
            <span className="text-sm font-medium text-gray-700">音質設定</span>
          </div>
          <div className="text-xs text-gray-600 space-y-1">
            <div>• 採樣率: 44.1 kHz (CD品質)</div>
            <div>• 聲道: 立體聲</div>
            <div>• 格式: WebM (Opus編碼)</div>
            <div>• 降噪: 啟用</div>
            <div>• 回音消除: 啟用</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}