// src/db/sqlite/SQLiteDB.ts
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';
import type { DB, WorkoutExerciseSummary, WorkoutHistory, WorkoutWithSets } from '../interface';
import { initializeDatabaseSequence } from '../schema';
import { Exercise, Workout, WorkoutSet, WorkoutTimer } from '../../types';

class SQLiteDBImplementation implements DB {
  private db!: SQLiteDatabase;

  async init(): Promise<void> {
    this.db = await openDatabaseAsync('workout-log.db');
    // Luotetaan jaettuun alustuslogiikkaan
    await initializeDatabaseSequence(this);
  }

  async createTablesAndStores(): Promise<void> {
    await this.db.execAsync(`
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

      CREATE TABLE IF NOT EXISTS workout_timers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workout_id INTEGER UNIQUE NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
        last_action TEXT NOT NULL CHECK(last_action IN ('START', 'STOP', 'LAP', 'RESET')),
        is_running INTEGER NOT NULL CHECK(is_running IN (0, 1)),
        total_elapsed_ms INTEGER NOT NULL DEFAULT 0,
        lap_elapsed_ms INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sets_workout ON workout_sets(workout_id);
      CREATE INDEX IF NOT EXISTS idx_sets_exercise ON workout_sets(exercise_id);
    `);

    if (Platform.OS !== 'web') {
      const cols = await this.db.getAllAsync<{ name: string }>('PRAGMA table_info(workouts)');
      const hasDevice = cols.some((c) => c.name === 'device');
      if (!hasDevice) {
        await this.db.execAsync('ALTER TABLE workouts ADD COLUMN device TEXT');
      }
    }
  }

  async getExerciseCount(): Promise<number> {
    const res = await this.db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM exercises');
    return res?.c ?? 0;
  }

  async insertExercise(name: string, createdAt: string): Promise<void> {
    await this.db.runAsync('INSERT INTO exercises (name, created_at) VALUES (?, ?)', [
      name,
      createdAt,
    ]);
  }

  async getAllExercisesForDeduplication() {
    return await this.db.getAllAsync<{ id: number; name: string }>(
      'SELECT id, name FROM exercises ORDER BY id',
    );
  }

  async updateWorkoutSetsExerciseId(originalId: number, duplicateId: number): Promise<void> {
    await this.db.runAsync('UPDATE workout_sets SET exercise_id = ? WHERE exercise_id = ?', [
      originalId,
      duplicateId,
    ]);
  }

  async deleteExerciseById(id: number): Promise<void> {
    await this.db.runAsync('DELETE FROM exercises WHERE id = ?', [id]);
  }

  // --- Settings ---
  async getSetting(key: string): Promise<string | null> {
    const row = await this.db.getFirstAsync<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?',
      [key],
    );
    return row?.value ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.db.runAsync(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [key, value],
    );
  }

  // --- Exercises ---
  async getAllExercises(): Promise<Exercise[]> {
    return await this.db.getAllAsync<Exercise>('SELECT * FROM exercises ORDER BY name');
  }

  async addExercise(name: string): Promise<Exercise> {
    const result = await this.db.runAsync('INSERT INTO exercises (name) VALUES (?)', [name]);
    return {
      id: result.lastInsertRowId,
      name,
      created_at: new Date().toISOString(),
    };
  }

  // --- Workouts ---

  async createWorkout(): Promise<Workout> {
    const device = await this.getSetting('device_name');
    const result = device
      ? await this.db.runAsync('INSERT INTO workouts (device) VALUES (?)', [device])
      : await this.db.runAsync('INSERT INTO workouts DEFAULT VALUES');

    const workout = await this.db.getFirstAsync<Workout>('SELECT * FROM workouts WHERE id = ?', [
      result.lastInsertRowId,
    ]);
    return workout!;
  }

  async finishWorkout(workoutId: number): Promise<void> {
    await this.db.runAsync("UPDATE workouts SET finished_at = datetime('now') WHERE id = ?", [
      workoutId,
    ]);
  }

  async deleteWorkout(workoutId: number): Promise<void> {
    await this.db.runAsync('DELETE FROM workout_sets WHERE workout_id = ?', [workoutId]);
    await this.db.runAsync('DELETE FROM workouts WHERE id = ?', [workoutId]);
  }

  async getRecentWorkouts(limit = 20): Promise<Workout[]> {
    return await this.db.getAllAsync<Workout>(
      'SELECT * FROM workouts ORDER BY started_at DESC LIMIT ?',
      [limit],
    );
  }

  async getWorkoutSummaries(workoutIds: number[]): Promise<Map<number, WorkoutExerciseSummary[]>> {
    const result = new Map<number, WorkoutExerciseSummary[]>();

    for (const wid of workoutIds) {
      const rows = await this.db.getAllAsync<WorkoutExerciseSummary>(
        `SELECT ws.workout_id, e.name as exercise_name, COUNT(*) as set_count
         FROM workout_sets ws
         JOIN exercises e ON e.id = ws.exercise_id
         WHERE ws.workout_id = ?
         GROUP BY ws.exercise_id
         ORDER BY ws.set_index
         LIMIT 5`,
        [wid],
      );
      result.set(wid, rows);
    }
    return result;
  }

  async getWorkoutWithSets(workoutId: number): Promise<WorkoutWithSets> {
    const workout = await this.db.getFirstAsync<Workout>('SELECT * FROM workouts WHERE id = ?', [
      workoutId,
    ]);
    const sets = await this.db.getAllAsync<WorkoutSet & { exercise_name: string }>(
      `SELECT ws.*, e.name as exercise_name
       FROM workout_sets ws
       JOIN exercises e ON e.id = ws.exercise_id
       WHERE ws.workout_id = ?
       ORDER BY ws.id, ws.set_index`,
      [workoutId],
    );
    return { workout: workout || null, sets };
  }

  // --- Sets ---

  async addSet(
    workoutId: number,
    exerciseId: number,
    setIndex: number,
    reps: number | null,
    weight: number | null,
  ): Promise<WorkoutSet> {
    const result = await this.db.runAsync(
      `INSERT INTO workout_sets (workout_id, exercise_id, set_index, reps, weight, completed_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [workoutId, exerciseId, setIndex, reps, weight],
    );
    return {
      id: result.lastInsertRowId,
      workout_id: workoutId,
      exercise_id: exerciseId,
      set_index: setIndex,
      reps,
      weight,
      completed_at: new Date().toISOString(),
    };
  }

  async updateSet(setId: number, reps: number | null, weight: number | null): Promise<void> {
    await this.db.runAsync(
      "UPDATE workout_sets SET reps = ?, weight = ?, completed_at = datetime('now') WHERE id = ?",
      [reps, weight, setId],
    );
  }

  async deleteSet(setId: number): Promise<void> {
    await this.db.runAsync('DELETE FROM workout_sets WHERE id = ?', [setId]);
  }

  async getLastSetsForExercise(
    exerciseId: number,
    excludeWorkoutId?: number,
  ): Promise<WorkoutSet[]> {
    const condition = excludeWorkoutId ? 'AND ws.workout_id != ?' : '';
    const params: any[] = [exerciseId];
    if (excludeWorkoutId) params.push(excludeWorkoutId);

    const rows = await this.db.getAllAsync<WorkoutSet>(
      `SELECT ws.* FROM workout_sets ws
       JOIN workouts w ON w.id = ws.workout_id
       WHERE ws.exercise_id = ? ${condition}
       ORDER BY w.started_at DESC, ws.set_index ASC
       LIMIT 10`,
      params,
    );

    if (rows.length === 0) return [];
    const latestWorkoutId = rows[0].workout_id;
    return rows.filter((r) => r.workout_id === latestWorkoutId);
  }

  async getExerciseHistory(
    exerciseId: number,
    excludeWorkoutId?: number,
    workoutCount = 3,
  ): Promise<WorkoutHistory[]> {
    const condition = excludeWorkoutId ? 'AND ws.workout_id != ?' : '';
    const params: any[] = [exerciseId];
    if (excludeWorkoutId) params.push(excludeWorkoutId);

    const rows = await this.db.getAllAsync<WorkoutSet & { started_at: string }>(
      `SELECT ws.*, w.started_at FROM workout_sets ws
       JOIN workouts w ON w.id = ws.workout_id
       WHERE ws.exercise_id = ? ${condition}
       ORDER BY w.started_at DESC, ws.set_index ASC
       LIMIT 50`,
      params,
    );

    const grouped = new Map<number, WorkoutHistory>();
    for (const row of rows) {
      if (!grouped.has(row.workout_id)) {
        if (grouped.size >= workoutCount) break;
        grouped.set(row.workout_id, {
          workout_id: row.workout_id,
          started_at: row.started_at ?? '',
          sets: [],
        });
      }
      grouped.get(row.workout_id)!.sets.push(row);
    }

    return Array.from(grouped.values());
  }

  async updateWorkoutStartedAt(workoutId: number, startedAt: string): Promise<void> {
    await this.db.runAsync('UPDATE workouts SET started_at = ? WHERE id = ?', [
      startedAt,
      workoutId,
    ]);
  }

  async copyWorkoutWithWeightsOnly(sourceWorkoutId: number): Promise<Workout> {
    const newWorkout = await this.createWorkout();

    const oldSets = await this.db.getAllAsync<{
      exercise_id: number;
      set_index: number;
      weight: number | null;
    }>(
      'SELECT exercise_id, set_index, weight FROM workout_sets WHERE workout_id = ? ORDER BY id ASC',
      [sourceWorkoutId],
    );

    for (const set of oldSets) {
      await this.db.runAsync(
        'INSERT INTO workout_sets (workout_id, exercise_id, set_index, reps, weight, completed_at) VALUES (?, ?, ?, ?, ?, ?)',
        [newWorkout.id, set.exercise_id, set.set_index, null, set.weight, null],
      );
    }

    return newWorkout;
  }

  // --- Import/Export ---

  async getWorkouts(ids?: number[]): Promise<Workout[]> {
    if (ids && ids.length > 0) {
      const placeholders = ids.map(() => '?').join(',');
      return await this.db.getAllAsync<Workout>(
        `SELECT * FROM workouts WHERE id IN (${placeholders}) ORDER BY started_at`,
        ids,
      );
    }
    return await this.db.getAllAsync<Workout>('SELECT * FROM workouts ORDER BY started_at');
  }

  async getAllSets(): Promise<WorkoutSet[]> {
    return await this.db.getAllAsync<WorkoutSet>(
      'SELECT * FROM workout_sets ORDER BY workout_id, id',
    );
  }

  async insertWorkoutRaw(
    startedAt: string,
    finishedAt: string | null,
    notes: string | null,
    device: string | null,
  ): Promise<number> {
    const result = await this.db.runAsync(
      'INSERT INTO workouts (started_at, finished_at, notes, device) VALUES (?, ?, ?, ?)',
      [startedAt, finishedAt, notes, device],
    );
    return result.lastInsertRowId;
  }

  async insertSetRaw(
    workoutId: number,
    exerciseId: number,
    setIndex: number,
    reps: number | null,
    weight: number | null,
    completedAt: string | null,
  ): Promise<void> {
    await this.db.runAsync(
      'INSERT INTO workout_sets (workout_id, exercise_id, set_index, reps, weight, completed_at) VALUES (?, ?, ?, ?, ?, ?)',
      [workoutId, exerciseId, setIndex, reps, weight, completedAt],
    );
  }

  // --- Timers ---

  async getWorkoutTimer(workoutId: number): Promise<WorkoutTimer | null> {
    const result = await this.db.getFirstAsync<WorkoutTimer>(
      'SELECT * FROM workout_timers WHERE workout_id = ?',
      [workoutId],
    );
    return result || null;
  }

  async saveWorkoutTimer(
    workoutId: number,
    lastAction: 'START' | 'STOP' | 'LAP' | 'RESET',
    isRunning: boolean,
    totalElapsedMs: number,
    lapElapsedMs: number,
    updatedAt: string,
  ): Promise<void> {
    await this.db.runAsync(
      `INSERT OR REPLACE INTO workout_timers (
        workout_id, last_action, is_running, total_elapsed_ms, lap_elapsed_ms, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [workoutId, lastAction, isRunning ? 1 : 0, totalElapsedMs, lapElapsedMs, updatedAt],
    );
  }
}

export async function openSQLiteDatabase(): Promise<DB> {
  const instance = new SQLiteDBImplementation();
  await instance.init();
  return instance;
}
