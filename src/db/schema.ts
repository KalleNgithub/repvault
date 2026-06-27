import { Platform } from 'react-native';
import type { DB } from './interface';

export async function initDatabase(db: DB): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS workouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      finished_at TEXT,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS workout_sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES exercises(id),
      set_index INTEGER NOT NULL,
      reps INTEGER,
      weight REAL,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sets_workout ON workout_sets(workout_id);
    CREATE INDEX IF NOT EXISTS idx_sets_exercise ON workout_sets(exercise_id);
  `);

  // Migration: add device column to workouts (native SQLite only — web/IndexedDB is schemaless)
  if (Platform.OS !== 'web') {
    const cols = await db.getAllAsync<{ name: string }>("PRAGMA table_info(workouts)");
    const hasDevice = cols.some(c => c.name === 'device');
    if (!hasDevice) {
      await db.execAsync('ALTER TABLE workouts ADD COLUMN device TEXT');
    }
  }
}

export async function deduplicateExercises(db: DB): Promise<void> {
  const all = await db.getAllAsync<{ id: number; name: string }>('SELECT id, name FROM exercises ORDER BY id');
  const seen = new Map<string, number>();
  for (const row of all) {
    if (seen.has(row.name)) {
      // Update any workout_sets referencing the duplicate to point to the original
      const originalId = seen.get(row.name)!;
      await db.runAsync('UPDATE workout_sets SET exercise_id = ? WHERE exercise_id = ?', [originalId, row.id]);
      await db.runAsync('DELETE FROM exercises WHERE id = ?', [row.id]);
    } else {
      seen.set(row.name, row.id);
    }
  }
}

export async function seedExercises(db: DB): Promise<void> {
  const count = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM exercises');
  if (count && count.c > 0) return;

  const exercises = [
    'Squat', 'Bench Press', 'Deadlift', 'Overhead Press', 'Barbell Row',
    'Pull-up', 'Dip', 'Leg Press', 'Romanian Deadlift', 'Incline Bench Press',
    'Lat Pulldown', 'Cable Row', 'Leg Curl', 'Leg Extension', 'Lateral Raise',
    'Bicep Curl', 'Tricep Extension', 'Face Pull', 'Calf Raise', 'Plank',
    'Belt Squat', 'Upright Row', 'Shrugs',
  ];

  for (const name of exercises) {
    await db.runAsync(
      'INSERT INTO exercises (name, created_at) VALUES (?, ?)',
      [name, new Date().toISOString()]
    );
  }
}
