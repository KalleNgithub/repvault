import type { DB, Row, RunResult } from '../src/db/interface';
import { seedExercises, deduplicateExercises } from '../src/db/schema';

// In-memory mock DB for testing schema logic
function createMockDB(): DB & { tables: Record<string, Row[]> } {
  const tables: Record<string, Row[]> = {
    exercises: [],
    workouts: [],
    workout_sets: [],
  };
  let nextId: Record<string, number> = { exercises: 1, workouts: 1, workout_sets: 1 };

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
      const updateMatch = sql.match(/UPDATE\s+(\w+)\s+SET\s+(\w+)\s*=\s*\?\s+WHERE\s+(\w+)\s*=\s*\?/i);
      if (updateMatch) {
        const [, table, setCol, whereCol] = updateMatch;
        let changes = 0;
        for (const row of tables[table]) {
          if (row[whereCol] === params[1]) {
            row[setCol] = params[0];
            changes++;
          }
        }
        return { lastInsertRowId: 0, changes };
      }
      const deleteMatch = sql.match(/DELETE\s+FROM\s+(\w+)\s+WHERE\s+(\w+)\s*=\s*\?/i);
      if (deleteMatch) {
        const [, table, whereCol] = deleteMatch;
        const before = tables[table].length;
        tables[table] = tables[table].filter(r => r[whereCol] !== params[0]);
        return { lastInsertRowId: 0, changes: before - tables[table].length };
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

describe('seedExercises', () => {
  it('seeds 23 exercises into empty database', async () => {
    const db = createMockDB();
    await seedExercises(db);
    expect(db.tables.exercises).toHaveLength(23);
  });

  it('does not re-seed when exercises already exist', async () => {
    const db = createMockDB();
    await seedExercises(db);
    const countBefore = db.tables.exercises.length;
    await seedExercises(db);
    expect(db.tables.exercises).toHaveLength(countBefore);
  });

  it('seeds all expected exercise names', async () => {
    const db = createMockDB();
    await seedExercises(db);
    const names = db.tables.exercises.map(e => e.name);
    expect(names).toContain('Squat');
    expect(names).toContain('Bench Press');
    expect(names).toContain('Deadlift');
    expect(names).toContain('Belt Squat');
    expect(names).toContain('Upright Row');
    expect(names).toContain('Shrugs');
  });
});

describe('deduplicateExercises', () => {
  it('removes duplicate exercises keeping lowest id', async () => {
    const db = createMockDB();
    // Manually insert duplicates
    db.tables.exercises = [
      { id: 1, name: 'Squat' },
      { id: 2, name: 'Bench Press' },
      { id: 3, name: 'Squat' },       // duplicate
      { id: 4, name: 'Bench Press' },  // duplicate
    ];
    await deduplicateExercises(db);
    expect(db.tables.exercises).toHaveLength(2);
    expect(db.tables.exercises.map(e => e.id)).toEqual([1, 2]);
  });

  it('reassigns workout_sets to original exercise id', async () => {
    const db = createMockDB();
    db.tables.exercises = [
      { id: 1, name: 'Squat' },
      { id: 5, name: 'Squat' }, // duplicate
    ];
    db.tables.workout_sets = [
      { id: 1, exercise_id: 5, workout_id: 1, set_index: 0 },
    ];
    await deduplicateExercises(db);
    expect(db.tables.workout_sets[0].exercise_id).toBe(1);
  });

  it('does nothing when no duplicates exist', async () => {
    const db = createMockDB();
    db.tables.exercises = [
      { id: 1, name: 'Squat' },
      { id: 2, name: 'Bench Press' },
    ];
    await deduplicateExercises(db);
    expect(db.tables.exercises).toHaveLength(2);
  });
});
