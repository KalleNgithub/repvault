import { translateExercise } from '../src/i18n/exercises';
import { en } from '../src/i18n/en';
import { fi } from '../src/i18n/fi';

describe('translateExercise', () => {
  it('returns English name unchanged for en locale', () => {
    expect(translateExercise('Squat', 'en')).toBe('Squat');
    expect(translateExercise('Bench Press', 'en')).toBe('Bench Press');
  });

  it('translates known exercises to Finnish', () => {
    expect(translateExercise('Squat', 'fi')).toBe('Kyykky');
    expect(translateExercise('Deadlift', 'fi')).toBe('Maastaveto');
    expect(translateExercise('Belt Squat', 'fi')).toBe('Vyökyykky');
    expect(translateExercise('Upright Row', 'fi')).toBe('Pystysoutu');
    expect(translateExercise('Shrugs', 'fi')).toBe('Olankohautus');
  });

  it('falls back to original name for user-created exercises', () => {
    expect(translateExercise('My Custom Lift', 'fi')).toBe('My Custom Lift');
    expect(translateExercise('My Custom Lift', 'en')).toBe('My Custom Lift');
  });

  it('falls back to original name for unsupported locale', () => {
    expect(translateExercise('Squat', 'de')).toBe('Squat');
  });
});

describe('i18n translation keys', () => {
  const enKeys = Object.keys(en) as (keyof typeof en)[];
  const fiKeys = Object.keys(fi) as (keyof typeof fi)[];

  it('Finnish has all English keys', () => {
    for (const key of enKeys) {
      expect(fi).toHaveProperty(key);
    }
  });

  it('English has all Finnish keys', () => {
    for (const key of fiKeys) {
      expect(en).toHaveProperty(key);
    }
  });

  it('no translation value is empty', () => {
    for (const key of enKeys) {
      expect(en[key]).toBeTruthy();
      expect(fi[key]).toBeTruthy();
    }
  });
});
