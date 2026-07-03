import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import type { DB } from './interface';

const DatabaseContext = createContext<DB | null>(null);

export function useDatabase(): DB {
  const db = useContext(DatabaseContext);
  if (!db) throw new Error('useDatabase must be used within DatabaseProvider');
  return db;
}

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<DB | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      let database: DB;

      if (Platform.OS === 'web') {
        const { openWebDatabase } = await import('./indexdb/IndexDB');
        database = await openWebDatabase();
      } else {
        const { openSQLiteDatabase } = await import('./sqlite/SQLiteDB');
        database = await openSQLiteDatabase();
      }

      if (mounted) setDb(database);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (!db) return null; // loading

  return <DatabaseContext.Provider value={db}>{children}</DatabaseContext.Provider>;
}
