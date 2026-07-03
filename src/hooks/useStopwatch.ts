import { useState, useRef, useCallback, useEffect } from 'react';

export function useStopwatch() {
  const [elapsed, setElapsed] = useState(0); // milliseconds
  const [running, setRunning] = useState(false);
  const [laps, setLaps] = useState<number[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);

  const setTimer = useCallback((elapsed: number, running: boolean, laps: number[] = []) => {
    startTimeRef.current = Date.now() - elapsed;

    setLaps(laps);
    setElapsed(elapsed);
    setRunning(running);
  }, []);

  const start = useCallback(() => {
    if (running) return;
    startTimeRef.current = Date.now() - elapsed;
    setRunning(true);
  }, [running, elapsed]);

  const stop = useCallback(() => {
    setRunning(false);
  }, []);

  const reset = useCallback(() => {
    setRunning(false);
    setElapsed(0);
    setLaps([]);
  }, []);

  const lap = useCallback(() => {
    setLaps((prev) => [...prev, elapsed]);
  }, [elapsed]);

  // Get time since last lap (or since start if no laps)
  const lapTime = laps.length > 0 ? elapsed - laps[laps.length - 1] : elapsed;

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setElapsed(Date.now() - startTimeRef.current);
      }, 100);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  return { elapsed, lapTime, running, laps, start, stop, reset, lap, setTimer };
}

export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
