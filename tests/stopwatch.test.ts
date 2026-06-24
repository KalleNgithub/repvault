import { formatTime } from '../src/hooks/useStopwatch';

describe('formatTime', () => {
  it('formats zero', () => {
    expect(formatTime(0)).toBe('0:00');
  });

  it('formats seconds with padding', () => {
    expect(formatTime(5000)).toBe('0:05');
    expect(formatTime(9000)).toBe('0:09');
  });

  it('formats minutes and seconds', () => {
    expect(formatTime(65000)).toBe('1:05');
    expect(formatTime(130000)).toBe('2:10');
  });

  it('formats large values', () => {
    expect(formatTime(3600000)).toBe('60:00');
    expect(formatTime(5999000)).toBe('99:59');
  });

  it('truncates sub-second precision', () => {
    expect(formatTime(1500)).toBe('0:01');
    expect(formatTime(1999)).toBe('0:01');
  });
});
