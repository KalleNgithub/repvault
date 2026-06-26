import type { DB } from './interface';
import type { Exercise, Workout, WorkoutSet } from '../types';

// --- Exercises ---

export async function getAllExercises(db: DB): Promise<Exercise[]> {
  return db.getAllAsync<Exercise>('SELECT * FROM exercises ORDER BY name');
}

export async function addExercise(db: DB, name: string): Promise<Exercise> {
  const result = await db.runAsync('INSERT INTO exercises (name) VALUES (?)', [name]);
  return { id: result.lastInsertRowId, name, created_at: new Date().toISOString() };
}

// --- Workouts ---

export async function createWorkout(db: DB): Promise<Workout> {
  const result = await db.runAsync('INSERT INTO workouts DEFAULT VALUES');
  const workout = await db.getFirstAsync<Workout>('SELECT * FROM workouts WHERE id = ?', [result.lastInsertRowId]);
  return workout!;
}

export async function finishWorkout(db: DB, workoutId: number): Promise<void> {
  await db.runAsync("UPDATE workouts SET finished_at = datetime('now') WHERE id = ?", [workoutId]);
}

export async function deleteWorkout(db: DB, workoutId: number): Promise<void> {
  await db.runAsync('DELETE FROM workout_sets WHERE workout_id = ?', [workoutId]);
  await db.runAsync('DELETE FROM workouts WHERE id = ?', [workoutId]);
}

export async function getRecentWorkouts(db: DB, limit = 20): Promise<Workout[]> {
  return db.getAllAsync<Workout>('SELECT * FROM workouts ORDER BY started_at DESC LIMIT ?', [limit]);
}

export interface WorkoutExerciseSummary {
  workout_id: number;
  exercise_name: string;
  set_count: number;
}

export async function getWorkoutSummaries(db: DB, workoutIds: number[]): Promise<Map<number, WorkoutExerciseSummary[]>> {
  const result = new Map<number, WorkoutExerciseSummary[]>();
  for (const wid of workoutIds) {
    const rows = await db.getAllAsync<WorkoutExerciseSummary>(
      `SELECT ws.workout_id, e.name as exercise_name, COUNT(*) as set_count
       FROM workout_sets ws
       JOIN exercises e ON e.id = ws.exercise_id
       WHERE ws.workout_id = ?
       GROUP BY ws.exercise_id
       ORDER BY ws.set_index
       LIMIT 5`,
      [wid]
    );
    result.set(wid, rows);
  }
  return result;
}

export async function getWorkoutWithSets(db: DB, workoutId: number) {
  const workout = await db.getFirstAsync<Workout>('SELECT * FROM workouts WHERE id = ?', [workoutId]);
  const sets = await db.getAllAsync<WorkoutSet & { exercise_name: string }>(
    `SELECT ws.*, e.name as exercise_name 
     FROM workout_sets ws 
     JOIN exercises e ON e.id = ws.exercise_id 
     WHERE ws.workout_id = ? 
     ORDER BY ws.id, ws.set_index`,
    [workoutId]
  );
  return { workout, sets };
}

// --- Sets ---

export async function addSet(
  db: DB,
  workoutId: number,
  exerciseId: number,
  setIndex: number,
  reps: number | null,
  weight: number | null,
): Promise<WorkoutSet> {
  const result = await db.runAsync(
    `INSERT INTO workout_sets (workout_id, exercise_id, set_index, reps, weight, completed_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    [workoutId, exerciseId, setIndex, reps, weight]
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

export async function updateSet(
  db: DB,
  setId: number,
  reps: number | null,
  weight: number | null,
): Promise<void> {
  await db.runAsync(
    "UPDATE workout_sets SET reps = ?, weight = ?, completed_at = datetime('now') WHERE id = ?",
    [reps, weight, setId]
  );
}

export async function deleteSet(db: DB, setId: number): Promise<void> {
  await db.runAsync('DELETE FROM workout_sets WHERE id = ?', [setId]);
}

// Get the last workout's sets for a given exercise (for pre-filling)
export async function getLastSetsForExercise(
  db: DB,
  exerciseId: number,
  excludeWorkoutId?: number,
): Promise<WorkoutSet[]> {
  const condition = excludeWorkoutId
    ? 'AND ws.workout_id != ?'
    : '';
  const params: any[] = [exerciseId];
  if (excludeWorkoutId) params.push(excludeWorkoutId);

  const rows = await db.getAllAsync<WorkoutSet>(
    `SELECT ws.* FROM workout_sets ws
     JOIN workouts w ON w.id = ws.workout_id
     WHERE ws.exercise_id = ? ${condition}
     ORDER BY w.started_at DESC, ws.set_index ASC
     LIMIT 10`,
    params
  );

  if (rows.length === 0) return [];
  const latestWorkoutId = rows[0].workout_id;
  return rows.filter(r => r.workout_id === latestWorkoutId);
}

// History: sets from the last N workouts for an exercise, grouped by workout
export interface WorkoutHistory {
  workout_id: number;
  started_at: string;
  sets: WorkoutSet[];
}

export async function getExerciseHistory(
  db: DB,
  exerciseId: number,
  excludeWorkoutId?: number,
  workoutCount = 3,
): Promise<WorkoutHistory[]> {
  const condition = excludeWorkoutId
    ? 'AND ws.workout_id != ?'
    : '';
  const params: any[] = [exerciseId];
  if (excludeWorkoutId) params.push(excludeWorkoutId);

  const rows = await db.getAllAsync<WorkoutSet & { started_at: string }>(
    `SELECT ws.*, w.started_at FROM workout_sets ws
     JOIN workouts w ON w.id = ws.workout_id
     WHERE ws.exercise_id = ? ${condition}
     ORDER BY w.started_at DESC, ws.set_index ASC
     LIMIT 50`,
    params
  );

  // Group by workout
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
