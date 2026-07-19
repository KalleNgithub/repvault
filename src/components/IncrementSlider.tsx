import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme';

interface IncrementSliderProps {
  label: string;
  step: number;
  onIncrement: (delta: number) => void;
  /** Max steps in each direction (default 10) */
  range?: number;
}

export const IncrementSlider: React.FC<IncrementSliderProps> = ({
  label,
  step,
  onIncrement,
  range = 10,
}) => {
  const [currentValue, setCurrentValue] = useState(0);
  const snapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (value: number): void => {
    setCurrentValue(Math.round(value));
  };

  const handleRelease = (): void => {
    const snapped = currentValue;
    if (snapped !== 0) {
      onIncrement(snapped * step);
    }
    // Snap back to center
    if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
    snapTimerRef.current = setTimeout(() => {
      setCurrentValue(0);
    }, 100);
  };

  const delta = currentValue * step;
  const deltaText = delta === 0 ? '±0' : delta > 0 ? `+${delta}` : `${delta}`;

  const totalNotches = range * 2 + 1;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.sliderWrapper}>
        <input
          type="range"
          min={-range}
          max={range}
          step={1}
          value={currentValue}
          onChange={(e) => handleChange(Number((e.target as HTMLInputElement).value))}
          onMouseUp={handleRelease}
          onTouchEnd={handleRelease}
          style={{
            width: '100%',
            height: 36,
            accentColor: colors.cyan,
            cursor: 'pointer',
          }}
        />
        <View style={styles.notchRow}>
          {Array.from({ length: totalNotches }, (_, i) => {
            const isCenter = i === range;
            const isRightOfThumb = i - range > currentValue;
            return (
              <View
                key={i}
                style={[
                  styles.notch,
                  isCenter && styles.notchCenter,
                  isRightOfThumb && styles.notchCyan,
                ]}
              />
            );
          })}
        </View>
      </View>
      <Text style={styles.deltaText}>{deltaText}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  label: {
    color: colors.textSecondary,
    fontSize: 11,
    width: 28,
  },
  sliderWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  notchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    height: 6,
    marginTop: -4,
  },
  notch: {
    width: 5,
    height: 5,
    backgroundColor: colors.textSecondary,
    borderRadius: 3,
  },
  notchCenter: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.textPrimary,
  },
  notchCyan: {
    backgroundColor: colors.cyan,
  },
  deltaText: {
    color: colors.cyan,
    fontSize: 14,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
    width: 44,
    textAlign: 'right',
  },
});
