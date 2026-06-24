// Platform-agnostic database interface
// Native uses expo-sqlite, Web uses IndexedDB

export interface Row {
  [key: string]: any;
}

export interface RunResult {
  lastInsertRowId: number;
  changes: number;
}

export interface DB {
  getAllAsync<T extends Row = Row>(sql: string, params?: any[]): Promise<T[]>;
  getFirstAsync<T extends Row = Row>(sql: string, params?: any[]): Promise<T | null>;
  runAsync(sql: string, params?: any[]): Promise<RunResult>;
  execAsync(sql: string): Promise<void>;
}
