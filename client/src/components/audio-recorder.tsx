import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import {
  Mic,
  Square,
  Play,
  Pause,
  Upload,
  Trash2,
  Download,
  Settings
} from 'lucide-react';
import AudioSettingsPanel, { AudioSettings } from './audio-settings-panel';

interface AudioRecorderProps {
  onRecordingComplete: (audioBlob: Blob, filename: string) => void;
  isDisabled?: boolean;
}

export default function AudioRecorder({ onRecordingComplete, isDisabled }: AudioRecorderProps) {
  const { user } = useAuth();

  const MAX_RECORDING_TIME = user?.role === 'admin' ? Infinity : 10800;
  const isAdmin = user?.role === 'admin';

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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const animationRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const isRecordingRef = useRef(false);
  const isPausedRef = useRef(false);

  const [audioSettings, setAudioSettings] = useState<AudioSettings>({
    sensitivity: 1000,
    autoGainControl: true,
    noiseSuppression: false,
    echoCancellation: true,
    minDecibels: -120,
    maxDecibels: 0,
    smoothingTimeConstant: 0.1,
    fftSize: 256
  });

  const { toast } = useToast();

  useEffect(() => {
    return () => cleanup();
  }, []);

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  };

  const requestMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 48000,
          channelCount: 1,
          echoCancellation: audioSettings.echoCancellation,
          noiseSuppression: audioSettings.noiseSuppression,
          autoGainControl: audioSettings.autoGainControl
        }
      });

      streamRef.current = stream;
      setPermissionGranted(true);

      const audioContext = new AudioContext();
      await audioContext.resume();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = audioSettings.fftSize;
      analyser.smoothingTimeConstant = audioSettings.smoothingTimeConstant;
      analyser.minDecibels = audioSettings.minDecibels;
      analyser.maxDecibels = audioSettings.maxDecibels;
      source.connect(analyser);
      analyserRef.current = analyser;

      toast({ title: "麥克風已就緒" });
      return stream;
    } catch (error) {
      toast({ title: "無法存取麥克風", description: "請檢查權限設定", variant: "destructive" });
      throw error;
    }
  };

  const startRecording = async () => {
    try {
      const stream = streamRef.current || await requestMicrophonePermission();

      chunksRef.current = [];
      setAudioBlob(null);
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }

      if (!analyserRef.current || !streamRef.current) {
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.1;
        analyser.minDecibels = -120;
        analyser.maxDecibels = 0;
        source.connect(analyser);
        analyserRef.current = analyser;
        streamRef.current = stream;
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 128000
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        console.log('[AudioRecorder] ondataavailable:', event.data.size, 'bytes');
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        console.log('[AudioRecorder] onstop, chunks:', chunksRef.current.length);
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        console.log('[AudioRecorder] Created blob:', blob.size, 'bytes');
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setIsRecording(false);
        setIsPaused(false);
        if (timerRef.current) clearInterval(timerRef.current);
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
      };

      mediaRecorder.onerror = (event) => {
        console.error('[AudioRecorder] MediaRecorder error:', event);
      };

      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);
      isRecordingRef.current = true;
      isPausedRef.current = false;

      mediaRecorder.start(100);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 0.1;
          if (!isAdmin && newTime >= MAX_RECORDING_TIME) {
            stopRecording();
            toast({ title: "已達最大時長", variant: "destructive" });
          }
          return newTime;
        });
      }, 100);

      monitorAudioLevel();
      toast({ title: "開始錄音" });
    } catch (error) {
      toast({ title: "錄音失敗", variant: "destructive" });
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
        if (timerRef.current) clearInterval(timerRef.current);
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      setAudioLevel(0);
    }
  };

  const monitorAudioLevel = () => {
    if (!analyserRef.current || !streamRef.current) return;

    const updateVolumeLevel = () => {
      if (!analyserRef.current || !isRecordingRef.current || isPausedRef.current) {
        setAudioLevel(0);
        return;
      }

      try {
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        let maxValue = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
          maxValue = Math.max(maxValue, dataArray[i]);
        }
        const average = sum / bufferLength;
        const baseLevel = (average / 255) * audioSettings.sensitivity;
        const peakBoost = (maxValue / 255) * (audioSettings.sensitivity * 0.25);
        setAudioLevel(Math.min(100, baseLevel + peakBoost * 0.3));
      } catch (error) {
        console.error('Error reading audio data:', error);
      }

      if (isRecordingRef.current && !isPausedRef.current) {
        animationRef.current = requestAnimationFrame(updateVolumeLevel);
      }
    };

    updateVolumeLevel();
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

  const downloadRecording = () => {
    if (audioBlob) {
      const url = URL.createObjectURL(audioBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recording_${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "已下載" });
    }
  };

  const deleteRecording = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setPlaybackTime(0);
    setDuration(0);
    setIsPlaying(false);
    setRecordingTime(0);
    toast({ title: "已刪除" });
  };

  const uploadRecording = () => {
    console.log('[AudioRecorder] uploadRecording called, audioBlob:', audioBlob ? `${audioBlob.size} bytes` : 'null');
    if (audioBlob) {
      const filename = `recording_${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
      console.log('[AudioRecorder] Calling onRecordingComplete with filename:', filename);
      try {
        onRecordingComplete(audioBlob, filename);
        toast({ title: "開始轉錄" });
      } catch (error) {
        console.error('[AudioRecorder] Error in onRecordingComplete:', error);
        toast({ title: "上傳失敗", description: String(error), variant: "destructive" });
      }
    } else {
      console.warn('[AudioRecorder] No audioBlob available');
      toast({ title: "沒有錄音資料", variant: "destructive" });
    }
  };

  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds) || seconds < 0) return '00:00';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Recording Visualization */}
      {isRecording && (
        <div className="flex flex-col items-center py-6">
          {/* Compact Recording Display */}
          <div className="flex items-center gap-4 w-full max-w-xs">
            {/* Animated Indicator */}
            <div className="relative w-14 h-14 shrink-0">
              <div
                className={`absolute inset-0 rounded-full ${isPaused ? 'bg-amber-500/20 border-amber-500' : 'bg-primary/20 border-primary'} border-2 transition-all duration-150`}
                style={{
                  transform: `scale(${1 + (audioLevel / 250)})`,
                }}
              />
              <div className={`absolute inset-0 rounded-full ${isPaused ? 'bg-amber-500' : 'bg-primary'} flex items-center justify-center`}>
                {isPaused ? (
                  <Pause className="w-6 h-6 text-background" />
                ) : (
                  <Mic className="w-6 h-6 text-background" />
                )}
              </div>
              {!isPaused && (
                <div className="absolute -inset-1 rounded-full border border-primary/40 animate-ping" />
              )}
            </div>

            {/* Time & Volume */}
            <div className="flex-1 space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-mono font-bold text-foreground">
                  {formatTime(recordingTime)}
                </span>
                <span className={`text-xs ${isPaused ? 'text-amber-500' : 'text-primary'}`}>
                  {isPaused ? '已暫停' : '錄音中'}
                </span>
              </div>
              {/* Volume Bar */}
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-100 ${isPaused ? 'bg-amber-500/50' : 'bg-gradient-to-r from-primary to-secondary'}`}
                  style={{ width: `${audioLevel}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Idle State */}
      {!isRecording && !audioUrl && (
        <div className="flex flex-col items-center py-12">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Mic className="w-8 h-8 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">點擊下方按鈕開始錄音</p>
        </div>
      )}

      {/* Recording Controls */}
      <div className="space-y-3">
        {!isRecording ? (
          <div className="flex gap-2">
            <Button
              onClick={startRecording}
              disabled={isDisabled}
              className="flex-1 h-12 rounded-xl text-base"
            >
              <Mic className="w-5 h-5 mr-2" />
              開始錄音
            </Button>
            <AudioSettingsPanel
              settings={audioSettings}
              onSettingsChange={setAudioSettings}
              isRecording={isRecording}
            />
          </div>
        ) : (
          <div className="flex gap-2">
            <Button
              onClick={pauseRecording}
              variant="outline"
              className="flex-1 h-12 rounded-xl"
            >
              {isPaused ? <Play className="w-5 h-5 mr-2" /> : <Pause className="w-5 h-5 mr-2" />}
              {isPaused ? '繼續' : '暫停'}
            </Button>
            <Button
              onClick={stopRecording}
              variant="destructive"
              className="flex-1 h-12 rounded-xl"
            >
              <Square className="w-5 h-5 mr-2" />
              停止
            </Button>
          </div>
        )}
      </div>

      {/* Playback Section */}
      {audioUrl && (
        <div className="space-y-4 p-4 rounded-xl bg-card/50 border border-border/50">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">錄音預覽</span>
            <span className="text-xs text-muted-foreground">{formatTime(duration)}</span>
          </div>

          <audio
            ref={audioRef}
            src={audioUrl}
            onLoadedMetadata={() => {
              if (audioRef.current && isFinite(audioRef.current.duration)) {
                setDuration(audioRef.current.duration);
              }
            }}
            onTimeUpdate={() => {
              if (audioRef.current && isFinite(audioRef.current.currentTime)) {
                setPlaybackTime(audioRef.current.currentTime);
              }
            }}
            onEnded={() => {
              setIsPlaying(false);
              setPlaybackTime(0);
            }}
            className="hidden"
          />

          {/* Progress */}
          <div
            className="h-1.5 bg-muted rounded-full cursor-pointer overflow-hidden"
            onClick={(e) => {
              if (audioRef.current && duration > 0 && isFinite(duration)) {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickedTime = ((e.clientX - rect.left) / rect.width) * duration;
                if (isFinite(clickedTime) && clickedTime >= 0) {
                  audioRef.current.currentTime = clickedTime;
                  setPlaybackTime(clickedTime);
                }
              }
            }}
          >
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${duration > 0 ? (playbackTime / duration) * 100 : 0}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{formatTime(playbackTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>

          {/* Playback Controls */}
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={playRecording}
              className="flex flex-col items-center p-2 rounded-lg hover:bg-muted/50 transition-colors"
            >
              {isPlaying ? <Pause className="w-5 h-5 text-foreground" /> : <Play className="w-5 h-5 text-foreground" />}
              <span className="text-[10px] text-muted-foreground mt-1">{isPlaying ? '暫停' : '播放'}</span>
            </button>
            <button
              onClick={downloadRecording}
              className="flex flex-col items-center p-2 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <Download className="w-5 h-5 text-foreground" />
              <span className="text-[10px] text-muted-foreground mt-1">下載</span>
            </button>
            <button
              onClick={deleteRecording}
              className="flex flex-col items-center p-2 rounded-lg hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="w-5 h-5 text-destructive" />
              <span className="text-[10px] text-destructive mt-1">刪除</span>
            </button>
            <button
              onClick={uploadRecording}
              disabled={isDisabled}
              className="flex flex-col items-center p-2 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              <Upload className="w-5 h-5 text-primary" />
              <span className="text-[10px] text-primary mt-1">轉錄</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
