import { useRef, useEffect, useState } from 'react';
import {
  Box,
  IconButton,
  Slider,
  Typography,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import StopIcon from '@mui/icons-material/Stop';
import Replay10Icon from '@mui/icons-material/Replay10';
import Forward10Icon from '@mui/icons-material/Forward10';

interface AudioPlayerProps {
  audioFile: File | null;
  mediaTitle: string;
  onStop: (last5Seconds: AudioBuffer) => Promise<void> | void;
}

interface WebkitWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

export function AudioPlayer({ audioFile, mediaTitle, onStop }: AudioPlayerProps) {
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

  const playAudio = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    await audio.play();
    setIsPlaying(true);
  };

  const pauseAudio = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    setIsPlaying(false);
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      pauseAudio();
      return;
    }
    playAudio().catch((error) => {
      console.error('[AudioPlayer] play failed:', error);
    });
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

    pauseAudio();

    try {
      console.log('[AudioPlayer] Extracting last 5 seconds of audio');
      
      // Get last 5 seconds of audio
      const AudioContextCtor = window.AudioContext || (window as WebkitWindow).webkitAudioContext;
      if (!AudioContextCtor) {
        throw new Error('Web Audio API is not supported in this browser');
      }
      const audioContext = new AudioContextCtor();
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
      await onStop(segmentBuffer);
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

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const audio = audioRef.current;
    if (!audio) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: mediaTitle,
      artist: 'Language Learning',
    });

    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

    try {
      navigator.mediaSession.setPositionState({
        duration: Number.isFinite(duration) ? duration : 0,
        playbackRate: audio.playbackRate || 1,
        position: Math.min(currentTime, duration || 0),
      });
    } catch {
      // Ignore platforms that do not support position state updates.
    }

    navigator.mediaSession.setActionHandler('play', () => {
      playAudio().catch((error) => console.error('[AudioPlayer] mediaSession play failed:', error));
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      pauseAudio();
    });
    navigator.mediaSession.setActionHandler('seekbackward', () => {
      handleSeek(-15);
    });
    navigator.mediaSession.setActionHandler('seekforward', () => {
      handleSeek(15);
    });
    navigator.mediaSession.setActionHandler('stop', () => {
      handleStop().catch((error) => console.error('[AudioPlayer] mediaSession stop failed:', error));
    });

    return () => {
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
      navigator.mediaSession.setActionHandler('seekbackward', null);
      navigator.mediaSession.setActionHandler('seekforward', null);
      navigator.mediaSession.setActionHandler('stop', null);
    };
  }, [mediaTitle, isPlaying, duration, currentTime]);

  if (!audioUrl) {
    return (
      <Box sx={{ py: 0.5 }}>
        <Typography variant="body2" color="text.secondary">
          No audio file loaded
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ pb: 0.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
        <IconButton onClick={handlePlayPause} color="primary" size="large" sx={{ width: 48, height: 48 }}>
          {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
        </IconButton>
        <IconButton onClick={() => handleSeek(-15)} size="large" title="Rewind 15 seconds" sx={{ width: 48, height: 48 }}>
          <Replay10Icon />
        </IconButton>
        <IconButton onClick={() => handleSeek(15)} size="large" title="Forward 15 seconds" sx={{ width: 48, height: 48 }}>
          <Forward10Icon />
        </IconButton>
        <IconButton onClick={() => handleStop()} color="secondary" size="large" sx={{ width: 48, height: 48 }}>
          <StopIcon />
        </IconButton>
        <Box sx={{ flexGrow: 1, px: 1 }}>
          <Slider
            value={currentTime}
            max={duration || 0}
            onChange={handleSliderChange}
            size="small"
            sx={{ width: '100%' }}
          />
        </Box>
        <Typography variant="caption" sx={{ minWidth: 72, textAlign: 'right' }}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </Typography>
      </Box>
      <audio ref={audioRef} src={audioUrl} />
    </Box>
  );
}

