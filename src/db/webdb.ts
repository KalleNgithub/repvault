// Web database implementation using IndexedDB with a SQL-like interface
// Uses a simple table-based approach since we don't need full SQL on web

import { openDB, type IDBPDatabase } from 'idb';
import type { DB, Row, RunResult } from './interface';

interface TableRow {
  id?: number;
  [key: string]: any;
}

const DB_NAME = 'workout-log';
const DB_VERSION = 1;
const STORES = ['exercises', 'workouts', 'workout_sets'] as const;

let autoId = Date.now();

export async function openWebDatabase(): Promise<DB> {
  const idb = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: 'id', autoIncrement: true });
        }
      }
    },
  });

  return new WebDB(idb);
}

// Parse simple SQL statements into IndexedDB operations
// Supports the subset we actually use in queries.ts
class WebDB implements DB {
  constructor(private idb: IDBPDatabase) {}

  async execAsync(sql: string): Promise<void> {
    // Handle multi-statement SQL (schema init)
    // We just ensure stores exist — schema is handled by IndexedDB upgrade
  }

  async runAsync(sql: string, params: any[] = []): Promise<RunResult> {
    const normalized = sql.trim().replace(/\s+/g, ' ');

    if (/^INSERT/i.test(normalized)) {
      return this.handleInsert(normalized, params);
    }
    if (/^UPDATE/i.test(normalized)) {
      return this.handleUpdate(normalized, params);
    }
    if (/^DELETE/i.test(normalized)) {
      return this.handleDelete(normalized, params);
    }

    return { lastInsertRowId: 0, changes: 0 };
  }

  async getAllAsync<T extends Row = Row>(sql: string, params: any[] = []): Promise<T[]> {
    const normalized = sql.trim().replace(/\s+/g, ' ');
    return this.handleSelect<T>(normalized, params);
  }

  async getFirstAsync<T extends Row = Row>(sql: string, params: any[] = []): Promise<T | null> {
    const results = await this.getAllAsync<T>(sql, params);
    return results.length > 0 ? results[0] : null;
  }

  private getTable(sql: string): string {
    // Extract table name from FROM, INTO, or UPDATE clauses
    const fromMatch = sql.match(/FROM\s+(\w+)/i);
    if (fromMatch) return fromMatch[1];
    const intoMatch = sql.match(/INTO\s+(\w+)/i);
    if (intoMatch) return intoMatch[1];
    const updateMatch = sql.match(/UPDATE\s+(\w+)/i);
    if (updateMatch) return updateMatch[1];
    const deleteMatch = sql.match(/DELETE\s+FROM\s+(\w+)/i);
    if (deleteMatch) return deleteMatch[1];
    throw new Error(`Cannot determine table from SQL: ${sql}`);
  }

  private async handleInsert(sql: string, params: any[]): Promise<RunResult> {
    const table = this.getTable(sql);

    if (/DEFAULT VALUES/i.test(sql)) {
      const row: TableRow = {
        started_at: new Date().toISOString(),
        finished_at: null,
        notes: null,
      };
      const id = await this.idb.add(table, row);
      return { lastInsertRowId: id as number, changes: 1 };
    }

    // Parse column names from INSERT INTO table (col1, col2, ...) VALUES (?, ?, ...)
    const colMatch = sql.match(/\(([^)]+)\)\s*VALUES/i);
    if (!colMatch) throw new Error(`Cannot parse INSERT columns: ${sql}`);

    const columns = colMatch[1].split(',').map(c => c.trim());
    const row: TableRow = {};
    columns.forEach((col, i) => {
      row[col] = params[i] ?? null;
    });

    // Handle datetime('now') in values
    const valuesStr = sql.match(/VALUES\s*\(([^)]+)\)/i)?.[1] ?? '';
    const valueParts = valuesStr.split(',').map(v => v.trim());
    columns.forEach((col, i) => {
      if (valueParts[i] && /datetime\s*\(\s*'now'\s*\)/i.test(valueParts[i])) {
        row[col] = new Date().toISOString();
      }
    });

    const ignoreConflict = /INSERT\s+OR\s+IGNORE/i.test(sql);

    const id = await this.idb.add(table, row).catch((err: any) => {
      if (ignoreConflict && err?.name === 'ConstraintError') return 0;
      throw err;
    });
    return { lastInsertRowId: id as number, changes: id ? 1 : 0 };
  }

  private async handleUpdate(sql: string, params: any[]): Promise<RunResult> {
    const table = this.getTable(sql);

    // Parse SET clause and WHERE clause
    const setMatch = sql.match(/SET\s+(.+?)\s+WHERE/i);
    const whereMatch = sql.match(/WHERE\s+(.+)$/i);
    if (!setMatch || !whereMatch) throw new Error(`Cannot parse UPDATE: ${sql}`);

    const setClauses = setMatch[1].split(',').map(s => s.trim());
    const whereId = params[params.length - 1]; // Last param is typically the WHERE id

    const existing = await this.idb.get(table, whereId);
    if (!existing) return { lastInsertRowId: 0, changes: 0 };

    let paramIdx = 0;
    for (const clause of setClauses) {
      const [col] = clause.split('=').map(s => s.trim());
      const valueExpr = clause.split('=')[1]?.trim();
      if (valueExpr === '?' ) {
        existing[col] = params[paramIdx++];
      } else if (/datetime\s*\(\s*'now'\s*\)/i.test(valueExpr ?? '')) {
        existing[col] = new Date().toISOString();
      }
    }

    await this.idb.put(table, existing);
    return { lastInsertRowId: whereId, changes: 1 };
  }

  private async handleDelete(sql: string, params: any[]): Promise<RunResult> {
    const table = this.getTable(sql);
    const id = params[0];
    await this.idb.delete(table, id);
    return { lastInsertRowId: 0, changes: 1 };
  }

  private async handleSelect<T extends Row>(sql: string, params: any[]): Promise<T[]> {
    const table = this.getTable(sql);
    let rows = await this.idb.getAll(table);

    let paramIdx = 0;

    // Handle JOINs — enrich rows BEFORE filtering/sorting so joined fields are available
    const joinMatch = sql.match(/JOIN\s+(\w+)\s+(\w+)\s+ON\s+(\w+)\.(\w+)\s*=\s*(\w+)\.(\w+)/i);
    if (joinMatch) {
      const joinTableName = joinMatch[1];
      const joinData = await this.idb.getAll(joinTableName);

      // Determine which side references which
      const leftAlias = joinMatch[3];
      const leftField = joinMatch[4];
      const rightAlias = joinMatch[5];
      const rightField = joinMatch[6];

      // Figure out FK direction: the primary table's field that references the join table
      // e.g. "ON w.id = ws.workout_id" → primary rows have workout_id, join rows have id
      // e.g. "ON e.id = ws.exercise_id" → primary rows have exercise_id, join rows have id
      const joinMap = new Map<any, TableRow>();
      let primaryFK: string;
      let joinKey: string;

      // Heuristic: if leftField is 'id', join table is on the left
      if (leftField === 'id') {
        joinKey = leftField;
        primaryFK = rightField;
        for (const r of joinData) joinMap.set(r[joinKey], r);
      } else {
        joinKey = rightField;
        primaryFK = leftField;
        for (const r of joinData) joinMap.set(r[joinKey], r);
      }

      rows = rows.map(row => {
        const joined = joinMap.get(row[primaryFK]);
        if (joined) {
          // Merge joined fields with _join_ prefix to avoid key collisions
          const enriched = { ...row };
          for (const [k, v] of Object.entries(joined)) {
            if (k !== 'id') enriched[`_j_${k}`] = v;
            // Also set without prefix for ORDER BY field resolution
            if (!(k in enriched)) enriched[k] = v;
          }
          // Handle "e.name as exercise_name" style aliases
          const selectMatch = sql.match(/SELECT\s+(.+?)\s+FROM/i);
          if (selectMatch && /\.name\s+as\s+exercise_name/i.test(selectMatch[1])) {
            enriched.exercise_name = joined.name;
          }
          return enriched;
        }
        return row;
      });
    }

    // Handle WHERE clauses
    const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|\s*$)/i);
    if (whereMatch) {
      const result = this.applyWhere(rows, whereMatch[1], params, paramIdx);
      rows = result.rows;
      paramIdx = result.paramIdx;
    }

    // Handle GROUP BY with aggregate functions
    const groupByMatch = sql.match(/GROUP BY\s+(.+?)(?:\s+ORDER|\s+LIMIT|\s+HAVING|\s*$)/i);
    if (groupByMatch) {
      const groupField = groupByMatch[1].replace(/\w+\./g, '').trim();
      const groups = new Map<any, TableRow[]>();
      for (const row of rows) {
        const key = row[groupField];
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(row);
      }

      // Build aggregated rows
      const selectClause = sql.match(/SELECT\s+(.+?)\s+FROM/i)?.[1] ?? '';
      const countMatch = selectClause.match(/COUNT\s*\(\s*\*\s*\)\s+as\s+(\w+)/i);

      rows = Array.from(groups.entries()).map(([_key, groupRows]) => {
        const representative = { ...groupRows[0] };
        if (countMatch) {
          representative[countMatch[1]] = groupRows.length;
        }
        return representative;
      });
    }

    // Handle ORDER BY (now works with joined fields)
    const orderMatch = sql.match(/ORDER BY\s+(.+?)(?:\s+LIMIT|\s*$)/i);
    if (orderMatch) {
      const orderParts = orderMatch[1].split(',').map(s => s.trim());
      // Sort by all ORDER BY fields in order of priority
      rows.sort((a, b) => {
        for (const part of orderParts) {
          const desc = /DESC/i.test(part);
          const field = part.replace(/\w+\./g, '').replace(/\s+(ASC|DESC)/i, '').trim();
          const va = a[field] ?? '';
          const vb = b[field] ?? '';
          if (va < vb) return desc ? 1 : -1;
          if (va > vb) return desc ? -1 : 1;
        }
        return 0;
      });
    }

    // Handle LIMIT
    const limitMatch = sql.match(/LIMIT\s+(\d+|\?)/i);
    if (limitMatch) {
      const limitVal = limitMatch[1] === '?' ? params[paramIdx++] : parseInt(limitMatch[1]);
      rows = rows.slice(0, limitVal);
    }

    // Handle COUNT(*)
    if (/SELECT\s+COUNT\s*\(\s*\*\s*\)\s+as\s+(\w+)/i.test(sql)) {
      const alias = sql.match(/COUNT\s*\(\s*\*\s*\)\s+as\s+(\w+)/i)![1];
      return [{ [alias]: rows.length } as unknown as T];
    }

    return rows as T[];
  }

  private applyWhere(
    rows: TableRow[],
    whereClause: string,
    params: any[],
    startParamIdx: number,
  ): { rows: TableRow[]; paramIdx: number } {
    const conditions = whereClause.split(/\s+AND\s+/i);
    let paramIdx = startParamIdx;

    for (const cond of conditions) {
      const cleanCond = cond.replace(/\w+\./g, '').trim();

      if (/(\w+)\s*=\s*\?/i.test(cleanCond)) {
        const field = cleanCond.match(/(\w+)\s*=\s*\?/)![1];
        const value = params[paramIdx++];
        rows = rows.filter(r => r[field] === value);
      } else if (/(\w+)\s*!=\s*\?/i.test(cleanCond)) {
        const field = cleanCond.match(/(\w+)\s*!=\s*\?/)![1];
        const value = params[paramIdx++];
        rows = rows.filter(r => r[field] !== value);
      }
    }

    return { rows, paramIdx };
  }
}
