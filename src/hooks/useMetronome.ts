import { useState, useRef, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';

export function useMetronome(bpm = 60) {
  const [playing, setPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getContext = useCallback(() => {
    if (Platform.OS !== 'web') return null;
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new AudioContext();
    }
    const ctx = audioContextRef.current;
    // iOS Safari suspends AudioContext on app switch / tab change
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    return ctx;
  }, []);

  const tick = useCallback(() => {
    const ctx = getContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 1000;
    gain.gain.value = 0.3;
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.05);
  }, [getContext]);

  const start = useCallback(() => {
    if (playing) return;
    // Ensure context is fresh and resumed
    getContext();
    setPlaying(true);
    tick();
    const ms = 60000 / bpm;
    intervalRef.current = setInterval(tick, ms);
  }, [playing, bpm, tick, getContext]);

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
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);

  return { playing, start, stop, toggle };
}
