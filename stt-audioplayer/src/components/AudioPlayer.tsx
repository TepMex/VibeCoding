import { useRef, useEffect, useState } from 'react';
import {
  Box,
  IconButton,
  Slider,
  Typography,
  Paper,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import StopIcon from '@mui/icons-material/Stop';
import Replay10Icon from '@mui/icons-material/Replay10';
import Forward10Icon from '@mui/icons-material/Forward10';

interface AudioPlayerProps {
  audioFile: File | null;
  onStop: (last5Seconds: AudioBuffer) => void;
}

export function AudioPlayer({ audioFile, onStop }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioBufferRef = useRef<ArrayBuffer | null>(null);

  useEffect(() => {
    if (audioFile) {
      const url = URL.createObjectURL(audioFile);
      setAudioUrl(url);
      audioFile.arrayBuffer().then((buffer) => {
        audioBufferRef.current = buffer;
      });

      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setAudioUrl(null);
      audioBufferRef.current = null;
    }
  }, [audioFile]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioUrl]);

  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + seconds));
  };

  const handleSliderChange = (_event: Event, value: number | number[]) => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.currentTime = value as number;
    setCurrentTime(value as number);
  };

  const handleStop = async () => {
    console.log('[AudioPlayer] Stop button clicked');
    const audio = audioRef.current;
    if (!audio || !audioBufferRef.current) {
      console.warn('[AudioPlayer] Stop failed: audio or buffer not available', {
        hasAudio: !!audio,
        hasBuffer: !!audioBufferRef.current
      });
      return;
    }

    audio.pause();
    setIsPlaying(false);

    try {
      console.log('[AudioPlayer] Extracting last 5 seconds of audio');
      
      // Get last 5 seconds of audio
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const sourceBuffer = audioBufferRef.current;
      
      console.log('[AudioPlayer] Decoding audio data...', {
        bufferSize: sourceBuffer.byteLength
      });
      
      const decodedAudio = await audioContext.decodeAudioData(sourceBuffer.slice(0));

      const sampleRate = decodedAudio.sampleRate;
      const channels = decodedAudio.numberOfChannels;
      const duration = decodedAudio.duration;
      const currentTime = audio.currentTime;

      console.log('[AudioPlayer] Audio decoded:', {
        sampleRate,
        channels,
        duration: `${duration.toFixed(2)}s`,
        currentTime: `${currentTime.toFixed(2)}s`
      });

      // Calculate start time (5 seconds before current time, or from start if less than 5 seconds)
      const startTime = Math.max(0, currentTime - 5);
      const startSample = Math.floor(startTime * sampleRate);
      const endSample = Math.floor(currentTime * sampleRate);
      const length = endSample - startSample;

      console.log('[AudioPlayer] Extracting segment:', {
        startTime: `${startTime.toFixed(2)}s`,
        endTime: `${currentTime.toFixed(2)}s`,
        startSample,
        endSample,
        segmentLength: length,
        segmentDuration: `${(length / sampleRate).toFixed(2)}s`
      });

      // Extract the audio segment
      const segmentLength = length;
      const segmentBuffer = audioContext.createBuffer(channels, segmentLength, sampleRate);

      for (let channel = 0; channel < channels; channel++) {
        const channelData = decodedAudio.getChannelData(channel);
        const segmentData = segmentBuffer.getChannelData(channel);
        for (let i = 0; i < segmentLength; i++) {
          segmentData[i] = channelData[startSample + i];
        }
      }

      console.log('[AudioPlayer] Segment extracted, calling onStop callback');
      // Pass AudioBuffer directly
      onStop(segmentBuffer);
      console.log('[AudioPlayer] onStop callback completed');
    } catch (error) {
      console.error('[AudioPlayer] Error in handleStop:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  };

  const formatTime = (seconds: number): string => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!audioUrl) {
    return (
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          No audio file loaded
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <IconButton onClick={handlePlayPause} color="primary" size="large">
          {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
        </IconButton>
        <IconButton onClick={() => handleSeek(-15)} size="small" title="Rewind 15 seconds">
          <Replay10Icon />
        </IconButton>
        <IconButton onClick={() => handleSeek(15)} size="small" title="Forward 15 seconds">
          <Forward10Icon />
        </IconButton>
        <IconButton onClick={handleStop} color="secondary" size="small">
          <StopIcon />
        </IconButton>
        <Box sx={{ flexGrow: 1, px: 2 }}>
          <Slider
            value={currentTime}
            max={duration || 0}
            onChange={handleSliderChange}
            size="small"
            sx={{ width: '100%' }}
          />
        </Box>
        <Typography variant="body2" sx={{ minWidth: 100, textAlign: 'right' }}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </Typography>
      </Box>
      <audio ref={audioRef} src={audioUrl} />
    </Paper>
  );
}

