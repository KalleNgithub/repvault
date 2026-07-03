import { exportData, importData, ExportData } from '../src/db/importExport';
import type { DB } from '../src/db/interface';
import type { Exercise, Workout, WorkoutSet } from '../src/types';

interface Row {
  id: number;
  [key: string]: any;
}

function createMockDB(): DB & { tables: Record<string, Row[]> } {
  const tables: Record<string, Row[]> = {
    exercises: [],
    workouts: [],
    workout_sets: [],
    settings: [],
    workout_timers: [],
  };
  const nextId: Record<string, number> = {
    exercises: 1,
    workouts: 1,
    workout_sets: 1,
    settings: 1,
    workout_timers: 1,
  };

  const mock: DB & { tables: Record<string, Row[]> } = {
    tables,

    async init() {},
    async createTablesAndStores() {},
    async getExerciseCount() {
      return tables.exercises.length;
    },
    async insertExercise(name: string, createdAt: string) {
      tables.exercises.push({ id: nextId.exercises++, name, created_at: createdAt });
    },
    async getAllExercisesForDeduplication() {
      return tables.exercises.map((e) => ({ id: e.id, name: e.name }));
    },
    async updateWorkoutSetsExerciseId() {},
    async deleteExerciseById() {},

    async getSetting(key: string) {
      const row = tables.settings.find((s) => s.key === key);
      return row ? row.value : null;
    },
    async setSetting() {},

    async getAllExercises() {
      return [...tables.exercises] as Exercise[];
    },

    async addExercise(name: string) {
      const row = { id: nextId.exercises++, name, created_at: new Date().toISOString() };
      tables.exercises.push(row);
      return row;
    },

    async getWorkouts(ids?: number[]) {
      let result = [...tables.workouts] as Workout[];
      if (ids && ids.length > 0) {
        const idSet = new Set(ids);
        result = result.filter((w) => idSet.has(w.id));
      }
      return result.sort((a, b) => a.started_at.localeCompare(b.started_at));
    },

    async getAllSets() {
      return [...tables.workout_sets] as WorkoutSet[];
    },

    async insertWorkoutRaw(
      startedAt: string,
      finishedAt: string | null,
      notes: string | null,
      device: string | null,
    ) {
      const id = nextId.workouts++;
      tables.workouts.push({ id, started_at: startedAt, finished_at: finishedAt, notes, device });
      return id;
    },

    async insertSetRaw(
      workoutId: number,
      exerciseId: number,
      setIndex: number,
      reps: number | null,
      weight: number | null,
      completedAt: string | null,
    ) {
      tables.workout_sets.push({
        id: nextId.workout_sets++,
        workout_id: workoutId,
        exercise_id: exerciseId,
        set_index: setIndex,
        reps,
        weight,
        completed_at: completedAt,
      });
    },

    // Stubs for remaining interface methods
    async createWorkout() {
      return { id: 1, started_at: '', finished_at: null, notes: null, device: null };
    },
    async finishWorkout() {},
    async deleteWorkout() {},
    async getRecentWorkouts() {
      return [];
    },
    async getWorkoutSummaries() {
      return new Map();
    },
    async getWorkoutWithSets() {
      return { workout: null, sets: [] };
    },
    async updateWorkoutStartedAt() {},
    async copyWorkoutWithWeightsOnly() {
      return { id: 1, started_at: '', finished_at: null, notes: null, device: null };
    },
    async addSet() {
      return {
        id: 1,
        workout_id: 1,
        exercise_id: 1,
        set_index: 0,
        reps: null,
        weight: null,
        completed_at: null,
      };
    },
    async updateSet() {},
    async deleteSet() {},
    async getLastSetsForExercise() {
      return [];
    },
    async getExerciseHistory() {
      return [];
    },
    async getWorkoutTimer() {
      return null;
    },
    async saveWorkoutTimer() {},
  };

  return mock;
}

describe('exportData', () => {
  it('exports exercises, workouts, and sets by name', async () => {
    const db = createMockDB();
    db.tables.exercises = [
      { id: 1, name: 'Squat', created_at: '2026-01-01' },
      { id: 2, name: 'Bench Press', created_at: '2026-01-01' },
    ];
    db.tables.workouts = [
      {
        id: 1,
        started_at: '2026-06-01T10:00:00Z',
        finished_at: '2026-06-01T11:00:00Z',
        notes: null,
      },
    ];
    db.tables.workout_sets = [
      {
        id: 1,
        workout_id: 1,
        exercise_id: 1,
        set_index: 0,
        reps: 5,
        weight: 100,
        completed_at: '2026-06-01T10:05:00Z',
      },
      {
        id: 2,
        workout_id: 1,
        exercise_id: 2,
        set_index: 0,
        reps: 8,
        weight: 60,
        completed_at: '2026-06-01T10:10:00Z',
      },
    ];

    const result = await exportData(db);
    expect(result.version).toBe(1);
    expect(result.exercises).toEqual(['Squat', 'Bench Press']);
    expect(result.workouts).toHaveLength(1);
    expect(result.workouts[0].blocks[0].exercise_name).toBe('Squat');
    expect(result.workouts[0].blocks[0].sets[0].weight).toBe(100);
    expect(result.workouts[0].blocks[1].exercise_name).toBe('Bench Press');
  });
});

describe('importData', () => {
  it('creates missing exercises and imports workouts', async () => {
    const db = createMockDB();
    db.tables.exercises = [{ id: 1, name: 'Squat', created_at: '2026-01-01' }];

    const data: ExportData = {
      version: 1,
      exported_at: '2026-06-26T00:00:00Z',
      exported_from: "John's iPhone",
      exercises: ['Squat', 'Deadlift'],
      workouts: [
        {
          started_at: '2026-06-20T08:00:00Z',
          finished_at: '2026-06-20T09:00:00Z',
          notes: null,
          blocks: [
            {
              exercise_name: 'Squat',
              sets: [{ reps: 5, weight: 120, completed_at: '2026-06-20T08:05:00Z' }],
            },
            {
              exercise_name: 'Deadlift',
              sets: [{ reps: 3, weight: 180, completed_at: '2026-06-20T08:20:00Z' }],
            },
          ],
        },
      ],
    };

    const result = await importData(db, data);
    expect(result.exercisesCreated).toBe(1); // Deadlift
    expect(result.workoutsImported).toBe(1);
    expect(result.setsImported).toBe(2);
    expect(result.skippedDuplicateWorkouts).toBe(0);
  });

  it('skips workouts with matching started_at', async () => {
    const db = createMockDB();
    db.tables.exercises = [{ id: 1, name: 'Squat', created_at: '2026-01-01' }];
    db.tables.workouts = [
      { id: 1, started_at: '2026-06-20T08:00:00Z', finished_at: null, notes: null },
    ];

    const data: ExportData = {
      version: 1,
      exported_at: '2026-06-26T00:00:00Z',
      exported_from: "John's iPhone",
      exercises: ['Squat'],
      workouts: [
        {
          started_at: '2026-06-20T08:00:00Z',
          finished_at: null,
          notes: null,
          blocks: [
            { exercise_name: 'Squat', sets: [{ reps: 5, weight: 100, completed_at: null }] },
          ],
        },
      ],
    };

    const result = await importData(db, data);
    expect(result.skippedDuplicateWorkouts).toBe(1);
    expect(result.workoutsImported).toBe(0);
    expect(result.setsImported).toBe(0);
  });

  it('rejects unsupported version', async () => {
    const db = createMockDB();
    const data = { version: 99, exported_at: '', exercises: [], workouts: [] } as any;
    await expect(importData(db, data)).rejects.toThrow('Unsupported export version');
  });
});
