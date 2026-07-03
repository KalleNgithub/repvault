// Platform-agnostic database interface
// Native uses expo-sqlite, Web uses IndexedDB

import { Exercise, Workout, WorkoutSet, WorkoutTimer } from '../types';

export interface WorkoutExerciseSummary {
  workout_id: number;
  exercise_name: string;
  set_count: number;
}

export interface WorkoutHistory {
  workout_id: number;
  started_at: string;
  sets: WorkoutSet[];
}

export interface WorkoutWithSets {
  workout: Workout | null;
  sets: (WorkoutSet & { exercise_name: string })[];
}

// Määrittele tähän kaikki sovelluksesi tarvitsemat tietokantatoiminnot
export interface DB {
  // --- Alustustyökalut ja elinkaari ---
  init(): Promise<void>;
  createTablesAndStores(): Promise<void>;
  getExerciseCount(): Promise<number>;
  insertExercise(name: string, createdAt: string): Promise<void>;

  // Duplikoinnin poiston vaatimat metodit
  getAllExercisesForDeduplication(): Promise<{ id: number; name: string }[]>;
  updateWorkoutSetsExerciseId(originalId: number, duplicateId: number): Promise<void>;
  deleteExerciseById(id: number): Promise<void>;

  // --- Settings ---
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;

  // --- Exercises ---
  getAllExercises(): Promise<Exercise[]>;
  addExercise(name: string): Promise<Exercise>;

  // --- Workouts ---
  createWorkout(): Promise<Workout>;
  finishWorkout(workoutId: number): Promise<void>;
  deleteWorkout(workoutId: number): Promise<void>;
  getRecentWorkouts(limit?: number): Promise<Workout[]>;
  getWorkoutSummaries(workoutIds: number[]): Promise<Map<number, WorkoutExerciseSummary[]>>;
  getWorkoutWithSets(workoutId: number): Promise<WorkoutWithSets>;
  updateWorkoutStartedAt(workoutId: number, startedAt: string): Promise<void>;
  copyWorkoutWithWeightsOnly(sourceWorkoutId: number): Promise<Workout>;

  // --- Sets ---
  addSet(
    workoutId: number,
    exerciseId: number,
    setIndex: number,
    reps: number | null,
    weight: number | null,
  ): Promise<WorkoutSet>;
  updateSet(setId: number, reps: number | null, weight: number | null): Promise<void>;
  deleteSet(setId: number): Promise<void>;
  getLastSetsForExercise(exerciseId: number, excludeWorkoutId?: number): Promise<WorkoutSet[]>;
  getExerciseHistory(
    exerciseId: number,
    excludeWorkoutId?: number,
    workoutCount?: number,
  ): Promise<WorkoutHistory[]>;

  // --- Timers ---
  getWorkoutTimer(workoutId: number): Promise<WorkoutTimer | null>;
  saveWorkoutTimer(
    workoutId: number,
    lastAction: 'START' | 'STOP' | 'LAP' | 'RESET',
    isRunning: boolean,
    totalElapsedMs: number,
    lapElapsedMs: number,
    updatedAt: string,
  ): Promise<void>;

  // --- Import/Export ---
  getWorkouts(ids?: number[]): Promise<Workout[]>;
  getAllSets(): Promise<WorkoutSet[]>;
  insertWorkoutRaw(
    startedAt: string,
    finishedAt: string | null,
    notes: string | null,
    device: string | null,
  ): Promise<number>;
  insertSetRaw(
    workoutId: number,
    exerciseId: number,
    setIndex: number,
    reps: number | null,
    weight: number | null,
    completedAt: string | null,
  ): Promise<void>;
}
