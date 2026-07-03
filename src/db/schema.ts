import type { DB } from './interface';

export async function initializeDatabaseSequence(db: DB): Promise<void> {
  // 1. Luodaan taulut (SQLite) tai objektisäilöt (IndexedDB) alustakohtaisesti
  await db.createTablesAndStores();

  // 2. Ajetaan siemenennys (Toimii molemmilla, koska käyttää rajapinnan metodeja)
  await seedExercisesIfNeeded(db);

  // 3. Ajetaan duplikaattien poisto (Toimii molemmilla)
  await deduplicateExercisesIfNeeded(db);
}

async function seedExercisesIfNeeded(db: DB): Promise<void> {
  const count = await db.getExerciseCount();
  if (count > 0) return;

  const exercises = [
    'Squat',
    'Bench Press',
    'Deadlift',
    'Overhead Press',
    'Barbell Row',
    'Pull-up',
    'Dip',
    'Leg Press',
    'Romanian Deadlift',
    'Incline Bench Press',
    'Lat Pulldown',
    'Cable Row',
    'Leg Curl',
    'Leg Extension',
    'Lateral Raise',
    'Bicep Curl',
    'Tricep Extension',
    'Face Pull',
    'Calf Raise',
    'Plank',
    'Belt Squat',
    'Upright Row',
    'Shrugs',
  ];

  for (const name of exercises) {
    await db.insertExercise(name, new Date().toISOString());
  }
}

async function deduplicateExercisesIfNeeded(db: DB): Promise<void> {
  const all = await db.getAllExercisesForDeduplication();
  const seen = new Map<string, number>();

  for (const row of all) {
    if (seen.has(row.name)) {
      const originalId = seen.get(row.name)!;
      await db.updateWorkoutSetsExerciseId(originalId, row.id);
      await db.deleteExerciseById(row.id);
    } else {
      seen.set(row.name, row.id);
    }
  }
}
