import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import type { DB } from './interface';
import { initDatabase, seedExercises, deduplicateExercises } from './schema';

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
        const { openWebDatabase } = await import('./webdb');
        database = await openWebDatabase();
      } else {
        const { openDatabaseAsync } = await import('expo-sqlite');
        database = await openDatabaseAsync('workout-log.db') as unknown as DB;
      }

      await initDatabase(database);
      await deduplicateExercises(database);
      await seedExercises(database);
      if (mounted) setDb(database);
    })();
    return () => { mounted = false; };
  }, []);

  if (!db) return null; // loading

  return (
    <DatabaseContext.Provider value={db}>
      {children}
    </DatabaseContext.Provider>
  );
}
