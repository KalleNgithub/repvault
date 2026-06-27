import { exportData, importData, ExportData } from '../src/db/importExport';
import type { DB, Row, RunResult } from '../src/db/interface';

function createMockDB(): DB & { tables: Record<string, Row[]> } {
  const tables: Record<string, Row[]> = {
    exercises: [],
    workouts: [],
    workout_sets: [],
    settings: [],
  };
  const nextId: Record<string, number> = { exercises: 1, workouts: 1, workout_sets: 1, settings: 1 };

  return {
    tables,
    async execAsync() {},
    async runAsync(sql: string, params: any[] = []): Promise<RunResult> {
      const insertMatch = sql.match(/INSERT.*INTO\s+(\w+)/i);
      if (insertMatch) {
        const table = insertMatch[1];
        const colMatch = sql.match(/\(([^)]+)\)\s*VALUES/i);
        if (!colMatch) return { lastInsertRowId: 0, changes: 0 };
        const cols = colMatch[1].split(',').map(c => c.trim());
        const row: Row = { id: nextId[table]++ };
        cols.forEach((col, i) => { row[col] = params[i] ?? null; });
        tables[table].push(row);
        return { lastInsertRowId: row.id as number, changes: 1 };
      }
      return { lastInsertRowId: 0, changes: 0 };
    },
    async getAllAsync<T extends Row>(sql: string): Promise<T[]> {
      const fromMatch = sql.match(/FROM\s+(\w+)/i);
      if (!fromMatch) return [];
      return [...tables[fromMatch[1]]] as T[];
    },
    async getFirstAsync<T extends Row>(sql: string): Promise<T | null> {
      if (/COUNT/i.test(sql)) {
        const fromMatch = sql.match(/FROM\s+(\w+)/i);
        if (!fromMatch) return null;
        return { c: tables[fromMatch[1]].length } as unknown as T;
      }
      const results = await this.getAllAsync<T>(sql);
      return results[0] ?? null;
    },
  };
}

describe('exportData', () => {
  it('exports exercises, workouts, and sets by name', async () => {
    const db = createMockDB();
    db.tables.exercises = [
      { id: 1, name: 'Squat', created_at: '2026-01-01' },
      { id: 2, name: 'Bench Press', created_at: '2026-01-01' },
    ];
    db.tables.workouts = [
      { id: 1, started_at: '2026-06-01T10:00:00Z', finished_at: '2026-06-01T11:00:00Z', notes: null },
    ];
    db.tables.workout_sets = [
      { id: 1, workout_id: 1, exercise_id: 1, set_index: 0, reps: 5, weight: 100, completed_at: '2026-06-01T10:05:00Z' },
      { id: 2, workout_id: 1, exercise_id: 2, set_index: 0, reps: 8, weight: 60, completed_at: '2026-06-01T10:10:00Z' },
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
    db.tables.exercises = [
      { id: 1, name: 'Squat', created_at: '2026-01-01' },
    ];

    const data: ExportData = {
      version: 1,
      exported_at: '2026-06-26T00:00:00Z',
      exported_from: "John's iPhone",
      exercises: ['Squat', 'Deadlift'],
      workouts: [{
        started_at: '2026-06-20T08:00:00Z',
        finished_at: '2026-06-20T09:00:00Z',
        notes: null,
        blocks: [
          {
            exercise_name: 'Squat',
            sets: [ {reps: 5, weight: 120, completed_at: '2026-06-20T08:05:00Z'} ]
           },
          {
            exercise_name: 'Deadlift',
            sets: [ {reps: 3, weight: 180, completed_at: '2026-06-20T08:20:00Z'}]
          },
        ],
      }],
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
    db.tables.workouts = [{ id: 1, started_at: '2026-06-20T08:00:00Z', finished_at: null, notes: null }];

    const data: ExportData = {
      version: 1,
      exported_at: '2026-06-26T00:00:00Z',
      exported_from: "John's iPhone",
      exercises: ['Squat'],
      workouts: [{
        started_at: '2026-06-20T08:00:00Z',
        finished_at: null,
        notes: null,
        blocks: [ {exercise_name: 'Squat', sets: [{ reps: 5, weight: 100, completed_at: null }]}],
      }],
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
