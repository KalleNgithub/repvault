import { useState, useRef, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';

export function useMetronome(bpm = 60) {
  const [playing, setPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tick = useCallback(() => {
    if (Platform.OS === 'web') {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      const ctx = audioContextRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 1000;
      gain.gain.value = 0.3;
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.05);
    }
    // For native platforms, we'll use expo-av in a future iteration
  }, []);

  const start = useCallback(() => {
    if (playing) return;
    setPlaying(true);
    tick(); // immediate first tick
    const ms = 60000 / bpm;
    intervalRef.current = setInterval(tick, ms);
  }, [playing, bpm, tick]);

  const stop = useCallback(() => {
    setPlaying(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const toggle = useCallback(() => {
    if (playing) stop();
    else start();
  }, [playing, start, stop]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { playing, start, stop, toggle };
}
