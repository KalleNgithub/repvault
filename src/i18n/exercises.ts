// Display-time translations for seeded exercise names
// User-created exercises are shown as-is

type ExerciseTranslations = Record<string, string>;

const exercisesFi: ExerciseTranslations = {
  Squat: 'Kyykky',
  'Bench Press': 'Penkkipunnerrus',
  Deadlift: 'Maastaveto',
  'Overhead Press': 'Pystypunnerrus',
  'Barbell Row': 'Kulmasoutu',
  'Pull-up': 'Leuanveto',
  Dip: 'Dippi',
  'Leg Press': 'Jalkaprässi',
  'Romanian Deadlift': 'Romanialainen maastaveto',
  'Incline Bench Press': 'Vinopenkkipunnerrus',
  'Lat Pulldown': 'Ylätalja',
  'Cable Row': 'Alatalja',
  'Leg Curl': 'Jalkakoukistus',
  'Leg Extension': 'Jalkaojennnus',
  'Lateral Raise': 'Sivunosto',
  'Bicep Curl': 'Hauiskääntö',
  'Tricep Extension': 'Ojentajapunnerrus',
  'Face Pull': 'Face pull',
  'Calf Raise': 'Pohjenosto',
  Plank: 'Lankku',
  'Belt Squat': 'Vyökyykky',
  'Upright Row': 'Pystysoutu',
  Shrugs: 'Olankohautus',
};

const exerciseTranslations: Record<string, ExerciseTranslations> = {
  fi: exercisesFi,
};

export function translateExercise(name: string, locale: string): string {
  if (locale === 'en') return name;
  return exerciseTranslations[locale]?.[name] ?? name;
}
