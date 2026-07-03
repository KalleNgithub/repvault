import type { DB } from '../src/db/interface';
import { initializeDatabaseSequence } from '../src/db/schema';

jest.mock('react-native', () => ({
  Platform: {
    OS: 'web',
    select: (objs: any) => objs.ios || objs.default,
  },
}));

interface Row {
  id: number;
  [key: string]: any;
}

// In-memory mock DB for testing schema logic
function createMockDB(): DB & { tables: Record<string, Row[]> } {
  const tables: Record<string, Row[]> = {
    exercises: [],
    workouts: [],
    workout_sets: [],
    settings: [],
    workout_timers: [],
  };
  let nextId: Record<string, number> = {
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
      const row: Row = { id: nextId.exercises++, name, created_at: createdAt };
      tables.exercises.push(row);
    },

    async getAllExercisesForDeduplication() {
      return tables.exercises.map((e) => ({ id: e.id, name: e.name }));
    },

    async updateWorkoutSetsExerciseId(originalId: number, duplicateId: number) {
      for (const set of tables.workout_sets) {
        if (set.exercise_id === duplicateId) {
          set.exercise_id = originalId;
        }
      }
    },

    async deleteExerciseById(id: number) {
      tables.exercises = tables.exercises.filter((e) => e.id !== id);
    },

    // Stubs for remaining interface methods
    async getSetting() {
      return null;
    },
    async setSetting() {},
    async getAllExercises() {
      return tables.exercises as any;
    },
    async addExercise(name: string) {
      const row = { id: nextId.exercises++, name, created_at: new Date().toISOString() };
      tables.exercises.push(row);
      return row;
    },
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
    async getWorkouts() {
      return [];
    },
    async getAllSets() {
      return [];
    },
    async insertWorkoutRaw() {
      return 0;
    },
    async insertSetRaw() {},
  };

  return mock;
}

describe('initializeDatabaseSequence — seedExercises', () => {
  it('seeds 23 exercises into empty database', async () => {
    const db = createMockDB();
    await initializeDatabaseSequence(db);
    expect(db.tables.exercises).toHaveLength(23);
  });

  it('does not re-seed when exercises already exist', async () => {
    const db = createMockDB();
    await initializeDatabaseSequence(db);
    const countBefore = db.tables.exercises.length;
    await initializeDatabaseSequence(db);
    expect(db.tables.exercises).toHaveLength(countBefore);
  });

  it('seeds all expected exercise names', async () => {
    const db = createMockDB();
    await initializeDatabaseSequence(db);
    const names = db.tables.exercises.map((e) => e.name);
    expect(names).toContain('Squat');
    expect(names).toContain('Bench Press');
    expect(names).toContain('Deadlift');
    expect(names).toContain('Belt Squat');
    expect(names).toContain('Upright Row');
    expect(names).toContain('Shrugs');
  });
});

describe('initializeDatabaseSequence — deduplicateExercises', () => {
  it('removes duplicate exercises keeping lowest id', async () => {
    const db = createMockDB();
    // Manually insert duplicates
    db.tables.exercises = [
      { id: 1, name: 'Squat' },
      { id: 2, name: 'Bench Press' },
      { id: 3, name: 'Squat' }, // duplicate
      { id: 4, name: 'Bench Press' }, // duplicate
    ];
    // Skip seeding (exercises already exist), run deduplication
    await initializeDatabaseSequence(db);
    expect(db.tables.exercises).toHaveLength(2);
    expect(db.tables.exercises.map((e) => e.id)).toEqual([1, 2]);
  });

  it('reassigns workout_sets to original exercise id', async () => {
    const db = createMockDB();
    db.tables.exercises = [
      { id: 1, name: 'Squat' },
      { id: 5, name: 'Squat' }, // duplicate
    ];
    db.tables.workout_sets = [{ id: 1, exercise_id: 5, workout_id: 1, set_index: 0 }];
    await initializeDatabaseSequence(db);
    expect(db.tables.workout_sets[0].exercise_id).toBe(1);
  });

  it('does nothing when no duplicates exist', async () => {
    const db = createMockDB();
    db.tables.exercises = [
      { id: 1, name: 'Squat' },
      { id: 2, name: 'Bench Press' },
    ];
    await initializeDatabaseSequence(db);
    expect(db.tables.exercises).toHaveLength(2);
  });
});
