import { useState, useRef, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * Start when toggle happens 300ms after stopping.
 * Stop on touch, click, switch app, switch tab.
 * @param bpm Beats per minute.
 * @returns Audible toggleable beeper.
 */
export function useMetronome(bpm = 60) {
  const [playing, setPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<any>(null);
  const lastStopIdRef = useRef<number>(0);

  const playingRef = useRef(false);

  const stop = useCallback(() => {
    lastStopIdRef.current = Date.now();
    setPlaying(false);
    playingRef.current = false;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (Platform.OS === 'web') {
      window.removeEventListener('touchstart', stop, { capture: true });
      window.removeEventListener('mousedown', stop, { capture: true });
    }
  }, []);

  const playClick = useCallback(() => {
    if (Platform.OS !== 'web') return;

    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.value = 1000;
    gain.gain.value = 0.3;

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.05);

    setTimeout(() => {
      osc.disconnect();
      gain.disconnect();
    }, 100);
  }, []);

  const start = useCallback(() => {
    if (playingRef.current) return;

    setPlaying(true);
    playingRef.current = true;

    playClick();
    const ms = 60000 / bpm;
    intervalRef.current = setInterval(playClick, ms);

    // Aktivoitetaan globaali kosketuksen kaappaus (capture: true varmistaa, että tämä napataan ennen sovelluksen muita nappeja)
    if (Platform.OS === 'web') {
      setTimeout(() => {
        if (playingRef.current) {
          window.addEventListener('touchstart', stop, { capture: true, once: true });
          window.addEventListener('mousedown', stop, { capture: true, once: true });
        }
      }, 50); // Pieni viive, jotta käynnistysklikkaus itse ei sammuta metronomia heti
    }
  }, [bpm, playClick, stop]);

  const toggle = useCallback(() => {
    // Same touch down/up
    if (Date.now() - lastStopIdRef.current < 300) {
      return;
    }
    if (playingRef.current) stop();
    else start();
  }, [start, stop]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleVisibilityAndExit = () => {
      if (document.visibilityState === 'hidden') {
        stop();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityAndExit);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityAndExit);
      // Jos komponentti tuhoutuu (esim. harjoitus valmistuu ja näkymä vaihtuu), pakotetaan sammutus ja siivous
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
      window.removeEventListener('touchstart', stop, { capture: true });
      window.removeEventListener('mousedown', stop, { capture: true });
    };
  }, [stop]);

  return { playing, start, stop, toggle };
}
