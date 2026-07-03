import type { DB } from './interface';
import type { WorkoutSet } from '../types';

// Export format v1 — uses exercise names and ordered blocks
export interface ExportData {
  version: 1;
  exported_at: string;
  exported_from: string | null;
  exercises: string[];
  workouts: ExportWorkout[];
}

interface ExportWorkout {
  started_at: string;
  finished_at: string | null;
  notes: string | null;
  device?: string;
  blocks: ExportBlock[];
}

interface ExportBlock {
  exercise_name: string;
  sets: ExportSet[];
}

interface ExportSet {
  reps: number | null;
  weight: number | null;
  completed_at: string | null;
}

export async function exportData(db: DB, workoutIds?: number[]): Promise<ExportData> {
  const deviceName = await db.getSetting('device_name');
  const exercises = await db.getAllExercises();
  const workouts = await db.getWorkouts(workoutIds);
  const allSets = await db.getAllSets();

  const exerciseMap = new Map<number, string>();
  for (const e of exercises) {
    exerciseMap.set(e.id, e.name);
  }

  // Group sets by workout, preserving insertion order (id) to detect exercise blocks
  const workoutSetsMap = new Map<number, WorkoutSet[]>();
  for (const s of allSets) {
    if (!workoutSetsMap.has(s.workout_id)) {
      workoutSetsMap.set(s.workout_id, []);
    }
    workoutSetsMap.get(s.workout_id)!.push(s);
  }

  return {
    version: 1,
    exported_at: new Date().toISOString(),
    exported_from: deviceName,
    exercises: exercises.map((e) => e.name),
    workouts: workouts.map((w) => {
      const sets = workoutSetsMap.get(w.id) ?? [];
      // Build blocks: consecutive sets with same exercise_id form a block
      const blocks: ExportBlock[] = [];
      for (const s of sets) {
        const name = exerciseMap.get(s.exercise_id) ?? `Unknown(${s.exercise_id})`;
        const lastBlock = blocks[blocks.length - 1];
        if (lastBlock && lastBlock.exercise_name === name) {
          lastBlock.sets.push({ reps: s.reps, weight: s.weight, completed_at: s.completed_at });
        } else {
          blocks.push({
            exercise_name: name,
            sets: [{ reps: s.reps, weight: s.weight, completed_at: s.completed_at }],
          });
        }
      }

      // Only include device if different from export device
      const workoutDevice = w.device && w.device !== deviceName ? w.device : undefined;

      return {
        started_at: w.started_at,
        finished_at: w.finished_at,
        notes: w.notes,
        ...(workoutDevice && { device: workoutDevice }),
        blocks,
      };
    }),
  };
}

export interface ImportResult {
  exercisesCreated: number;
  workoutsImported: number;
  setsImported: number;
  skippedDuplicateWorkouts: number;
}

export async function importData(db: DB, data: ExportData): Promise<ImportResult> {
  if (data.version !== 1) {
    throw new Error(`Unsupported export version: ${data.version}`);
  }

  const result: ImportResult = {
    exercisesCreated: 0,
    workoutsImported: 0,
    setsImported: 0,
    skippedDuplicateWorkouts: 0,
  };

  // Resolve exercise names → IDs (create missing ones)
  const existingExercises = await db.getAllExercises();
  const nameToId = new Map<string, number>();
  for (const e of existingExercises) {
    nameToId.set(e.name, e.id);
  }

  // Collect all exercise names from blocks too (in case exercises[] is incomplete)
  const allNames = new Set(data.exercises);
  for (const w of data.workouts) {
    for (const b of w.blocks) {
      allNames.add(b.exercise_name);
    }
  }

  for (const name of allNames) {
    if (!nameToId.has(name)) {
      const exercise = await db.addExercise(name);
      nameToId.set(name, exercise.id);
      result.exercisesCreated++;
    }
  }

  // Import workouts — skip if exact started_at already exists
  const existingWorkouts = await db.getWorkouts();
  const existingStartTimes = new Set(existingWorkouts.map((w) => w.started_at));

  for (const w of data.workouts) {
    if (existingStartTimes.has(w.started_at)) {
      result.skippedDuplicateWorkouts++;
      continue;
    }

    // Resolve device: per-workout device overrides, else exported_from
    const device = w.device ?? data.exported_from ?? null;

    const workoutId = await db.insertWorkoutRaw(w.started_at, w.finished_at, w.notes, device);
    result.workoutsImported++;

    let setIndex = 0;
    for (const block of w.blocks) {
      const exerciseId = nameToId.get(block.exercise_name);
      if (!exerciseId) continue;
      for (const s of block.sets) {
        await db.insertSetRaw(workoutId, exerciseId, setIndex, s.reps, s.weight, s.completed_at);
        setIndex++;
        result.setsImported++;
      }
    }
  }

  return result;
}
