// src/db/indexdb/IndexDB.ts
import { openDB, type IDBPDatabase } from 'idb';
import type { DB, WorkoutExerciseSummary, WorkoutHistory, WorkoutWithSets } from '../interface';
import { initializeDatabaseSequence } from '../schema';
import { Exercise, Workout, WorkoutSet, WorkoutTimer } from '../../types';

const DB_NAME = 'workout-log';
const DB_VERSION = 4;
const STORES = ['exercises', 'workouts', 'workout_sets', 'settings', 'workout_timers'] as const;

class WebDB implements DB {
  private db: IDBPDatabase;

  constructor(db: IDBPDatabase) {
    this.db = db;
  }

  async init(): Promise<void> {
    // Luotetaan jaettuun alustuslogiikkaan
    await initializeDatabaseSequence(this);
  }

  async createTablesAndStores(): Promise<void> {
    // IndexedDB:ssä säilöt luodaan openDB:n upgrade-metodissa (alhaalla),
    // joten tämä metodi voi olla tyhjä tai palauttaa suoraan resolven.
    return Promise.resolve();
  }

  async getExerciseCount(): Promise<number> {
    return await this.db.count('exercises');
  }

  async insertExercise(name: string, createdAt: string): Promise<void> {
    await this.db.add('exercises', { name, created_at: createdAt });
  }

  async getAllExercisesForDeduplication() {
    // Haetaan kaikki oliot säilöstä. Koska IndexedDB:n 'id' on automaattinen,
    // se palautuu objektin mukana (esim. { id: 1, name: 'Squat' })
    const all = await this.db.getAll('exercises');
    return all.sort((a, b) => a.id - b.id);
  }

  async updateWorkoutSetsExerciseId(originalId: number, duplicateId: number): Promise<void> {
    // 1. Avataan lukukirjoitustransaktio ('readwrite')
    const tx = this.db.transaction('workout_sets', 'readwrite');
    const store = tx.objectStore('workout_sets');

    // 2. Haetaan VAIN ne sarjat, joissa on muutettava duplicateId
    const setsIndex = store.index('exercise_id');
    const setsToUpdate = await setsIndex.getAll(IDBKeyRange.only(duplicateId));

    // Jos muutettavia sarjoja ei löydy, suljetaan transaktio ja lopetetaan heti
    if (setsToUpdate.length === 0) {
      await tx.done;
      return;
    }

    // 3. TEHOSTUS: Ajetaan kaikki päivitykset rinnakkain transaktiojonoon
    const updatePromises = setsToUpdate.map((set) => {
      set.exercise_id = originalId; // Päivitetään ID muistioliolle
      return store.put(set); // Palautetaan Promise put-operaatiosta
    });

    // Odotetaan, että kaikki put-kutsut on syötetty IndexedDB:n jonoon
    await Promise.all(updatePromises);

    // Varmistetaan, että transaktio sulkeutuu ja data kirjoitetaan levylle asti
    await tx.done;
  }

  async deleteExerciseById(id: number): Promise<void> {
    await this.db.delete('exercises', id);
  }

  // --- Settings ---

  async getSetting(key: string): Promise<string | null> {
    const row = await this.db.get('settings', key);
    return row ? row.value : null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    // .put päivittää olemassa olevan tai lisää uuden avaimen (vastaa ON CONFLICTia)
    await this.db.put('settings', { key, value });
  }

  // --- Workouts ---

  async createWorkout(): Promise<Workout> {
    const device = await this.getSetting('device_name');
    const startedAt = new Date().toISOString();

    const workoutData: any = {
      started_at: startedAt,
      finished_at: null,
      notes: null,
    };

    if (device) {
      workoutData.device = device;
    }

    // .add palauttaa IndexedDB:n automaattisesti luoman juoksevan ID:n
    const id = await this.db.add('workouts', workoutData);
    return { id: id as number, ...workoutData };
  }

  async finishWorkout(workoutId: number): Promise<void> {
    const tx = this.db.transaction('workouts', 'readwrite');
    const store = tx.objectStore('workouts');
    const workout = await store.get(workoutId);

    if (workout) {
      workout.finished_at = new Date().toISOString();
      await store.put(workout);
    }
    await tx.done;
  }

  async deleteWorkout(workoutId: number): Promise<void> {
    // Avataan lukukirjoitustransaktio molempiin tauluihin
    const tx = this.db.transaction(['workouts', 'workout_sets'], 'readwrite');
    const setsStore = tx.objectStore('workout_sets');

    // 1. Haetaan VAIN tämän poistettavan treenin sarjat indeksin avulla
    const setsIndex = setsStore.index('workout_id');
    const setsToDelete = await setsIndex.getAll(IDBKeyRange.only(workoutId));

    // 2. TEHOSTUS: Poistetaan kaikki löytyneet sarjat rinnakkain
    const deletePromises = setsToDelete.map(
      (set) => setsStore.delete(set.id), // set.id on sarjan pääavain
    );

    // Odotetaan, että kaikki sarjojen poistot on työnnetty transaktiojonoon
    await Promise.all(deletePromises);

    // 3. Poistetaan itse treeni päätaulusta
    await tx.objectStore('workouts').delete(workoutId);

    // Varmistetaan, että kaikki muutokset kirjoitetaan levylle asti
    await tx.done;
  }

  async getRecentWorkouts(limit = 20): Promise<Workout[]> {
    const workouts: Workout[] = [];

    // Avataan kursori indeksistä suoraan takaperin ('prev')
    let cursor = await this.db
      .transaction('workouts')
      .store.index('started_at')
      .openCursor(null, 'prev');

    // Luetaan vain haluttu määrä rivejä muistiin
    while (cursor && workouts.length < limit) {
      workouts.push(cursor.value);
      cursor = await cursor.continue();
    }

    return workouts;
  }

  async getWorkoutSummaries(workoutIds: number[]): Promise<Map<number, WorkoutExerciseSummary[]>> {
    const result = new Map<number, WorkoutExerciseSummary[]>();
    if (workoutIds.length === 0) return result;

    const tx = this.db.transaction(['workout_sets', 'exercises'], 'readonly');
    const setsStore = tx.objectStore('workout_sets');
    const exercisesStore = tx.objectStore('exercises');

    // Oletetaan, että workout_sets-taulussa on indeksi 'workout_id'
    const setsIndex = setsStore.index('workout_id');

    // 1. Haetaan VAIN niiden treenien sarjat, jotka pyydettiin parametreissa
    const allNeededSets: any[] = [];
    await Promise.all(
      workoutIds.map(async (wid) => {
        // getAll(IDBKeyRange.only(wid)) poimii suoraan vain tämän treenin sarjat
        const workoutSets = await setsIndex.getAll(IDBKeyRange.only(wid));
        allNeededSets.push(...workoutSets);
      }),
    );

    // 2. Kerätään uniikit exercise_id:t, jotta ei ladata turhaan kaikkia liikkeitä
    const uniqueExerciseIds = new Set<number>(allNeededSets.map((s) => s.exercise_id));

    // 3. Haetaan vain tarvittavat liikkeet ja luodaan id -> name mappi
    const exerciseMap = new Map<number, string>();
    await Promise.all(
      Array.from(uniqueExerciseIds).map(async (exId) => {
        const ex = await exercisesStore.get(exId);
        if (ex) exerciseMap.set(exId, ex.name);
      }),
    );

    // 4. Tehdään koosteet muistissa olevasta (nyt huomattavasti pienemmästä) datasta
    for (const wid of workoutIds) {
      // Koska allNeededSets sisältää vain pyydetyt, tämä filtteri on nyt erittäin kevyt
      const workoutSets = allNeededSets.filter((s) => s.workout_id === wid);
      const summaryMap = new Map<number, { name: string; count: number; firstIndex: number }>();

      for (const set of workoutSets) {
        const exName = exerciseMap.get(set.exercise_id) || 'Unknown';
        if (!summaryMap.has(set.exercise_id)) {
          summaryMap.set(set.exercise_id, { name: exName, count: 0, firstIndex: set.set_index });
        }
        summaryMap.get(set.exercise_id)!.count++;
      }

      const summaries = Array.from(summaryMap.values())
        .sort((a, b) => a.firstIndex - b.firstIndex)
        .slice(0, 5)
        .map((info) => ({
          workout_id: wid,
          exercise_name: info.name,
          set_count: info.count,
        }));

      result.set(wid, summaries);
    }

    await tx.done;
    return result;
  }

  async getWorkoutWithSets(workoutId: number): Promise<WorkoutWithSets> {
    const tx = this.db.transaction(['workouts', 'workout_sets', 'exercises'], 'readonly');

    // 1. Haetaan itse treeni suoraan ID-pääavaimella
    const workout = await tx.objectStore('workouts').get(workoutId);
    if (!workout) {
      await tx.done;
      return { workout: null, sets: [] };
    }

    // 2. Haetaan VAIN tämän treenin sarjat käyttämällä 'workout_id'-indeksiä
    const setsStore = tx.objectStore('workout_sets');
    const setsIndex = setsStore.index('workout_id');
    const workoutSets = await setsIndex.getAll(IDBKeyRange.only(workoutId));

    // 3. Poimitaan uniikit exercise_id:t, jotta ei ladata kaikkia maailman liikkeitä
    const uniqueExerciseIds = new Set<number>(workoutSets.map((s) => s.exercise_id));
    const exercisesStore = tx.objectStore('exercises');
    const exerciseMap = new Map<number, string>();

    // 4. Haetaan vain tarvittavat liikkeet rinnakkain (Promise.all)
    await Promise.all(
      Array.from(uniqueExerciseIds).map(async (exId) => {
        const ex = await exercisesStore.get(exId);
        if (ex) exerciseMap.set(exId, ex.name);
      }),
    );

    // 5. Muutetaan sarjat lopulliseen muotoon ja järjestetään ne muistissa
    const sets = workoutSets
      .map((s) => ({
        ...s,
        exercise_name: exerciseMap.get(s.exercise_id) || 'Unknown',
      }))
      // Koska lista sisältää nyt vain tämän treenin sarjat, sorttaaminen on salamannopeaa
      .sort((a, b) => a.id - b.id || a.set_index - b.set_index);

    await tx.done;
    return { workout, sets };
  }

  async updateWorkoutStartedAt(workoutId: number, startedAt: string): Promise<void> {
    const tx = this.db.transaction('workouts', 'readwrite');
    const store = tx.objectStore('workouts');
    const workout = await store.get(workoutId);

    if (workout) {
      workout.started_at = startedAt;
      await store.put(workout);
    }
    await tx.done;
  }

  async copyWorkoutWithWeightsOnly(sourceWorkoutId: number): Promise<Workout> {
    // 1. Luodaan uusi treeni pohjaksi (tämä avaa oman pienen transaktion taustalla)
    const newWorkout = await this.createWorkout();

    // 2. Avataan lukukirjoitustransaktio ('readwrite')
    const tx = this.db.transaction('workout_sets', 'readwrite');
    const store = tx.objectStore('workout_sets');

    // 3. Haetaan vain kopioitavan treenin sarjat indeksin avulla
    const setsIndex = store.index('workout_id');
    const oldSets = await setsIndex.getAll(IDBKeyRange.only(sourceWorkoutId));

    // Järjestetään sarjat muistissa oikeaan järjestykseen
    oldSets.sort((a, b) => a.id - b.id);

    // 4. TEHOSTUS: Käynnistetään kaikki tallennukset rinnakkain
    // Array.map luo listan Promiseja, jotka suoritetaan tietokannassa samanaikaisesti
    const savePromises = oldSets.map((set) =>
      store.add({
        workout_id: newWorkout.id,
        exercise_id: set.exercise_id,
        set_index: set.set_index,
        reps: null,
        weight: set.weight,
        completed_at: null,
      }),
    );

    // Odotetaan, että kaikki sarjat on lähetetty tietokantaan jonoon
    await Promise.all(savePromises);

    // Varmistetaan, että transaktio sulkeutuu onnistuneesti levylle
    await tx.done;

    return newWorkout;
  }

  // --- Sets ---

  async addSet(
    workoutId: number,
    exerciseId: number,
    setIndex: number,
    reps: number | null,
    weight: number | null,
  ): Promise<WorkoutSet> {
    const completedAt = new Date().toISOString();
    const setData = {
      workout_id: workoutId,
      exercise_id: exerciseId,
      set_index: setIndex,
      reps,
      weight,
      completed_at: completedAt,
    };

    const id = await this.db.add('workout_sets', setData);
    return { id: id as number, ...setData };
  }

  async updateSet(setId: number, reps: number | null, weight: number | null): Promise<void> {
    const tx = this.db.transaction('workout_sets', 'readwrite');
    const store = tx.objectStore('workout_sets');
    const set = await store.get(setId);

    if (set) {
      set.reps = reps;
      set.weight = weight;
      set.completed_at = new Date().toISOString();
      await store.put(set);
    }
    await tx.done;
  }

  async deleteSet(setId: number): Promise<void> {
    await this.db.delete('workout_sets', setId);
  }

  async getLastSetsForExercise(
    exerciseId: number,
    excludeWorkoutId?: number,
  ): Promise<WorkoutSet[]> {
    const tx = this.db.transaction(['workouts', 'workout_sets'], 'readonly');
    const setsStore = tx.objectStore('workout_sets');
    const workoutsStore = tx.objectStore('workouts');

    // 1. Haetaan VAIN ne sarjat, jotka liittyvät tähän liikkeeseen (exercise_id)
    const setsIndex = setsStore.index('exercise_id');
    const exerciseSets = await setsIndex.getAll(IDBKeyRange.only(exerciseId));

    if (exerciseSets.length === 0) {
      await tx.done;
      return [];
    }

    // Suodatetaan tarvittaessa pois käynnissä oleva treeni
    const validSets = excludeWorkoutId
      ? exerciseSets.filter((s) => s.workout_id !== excludeWorkoutId)
      : exerciseSets;

    if (validSets.length === 0) {
      await tx.done;
      return [];
    }

    // 2. Selvitetään uniikit workout_id:t, jotta voidaan hakea niiden aikaleimat
    const workoutIds = Array.from(new Set<number>(validSets.map((s) => s.workout_id)));

    // 3. TEHOSTUS: Haetaan VAIN näiden kyseisten treenien tiedot rinnakkain
    const timeMap = new Map<number, number>();
    await Promise.all(
      workoutIds.map(async (wId) => {
        const w = await workoutsStore.get(wId);
        if (w) {
          // Jos 'started_at' on ISO-string, getTime() on nopea muunnos
          timeMap.set(wId, new Date(w.started_at).getTime());
        }
      }),
    );

    // 4. Etsitään uusin workout_id vertaamalla haettuja aikoja
    let latestWorkoutId = validSets[0].workout_id;
    let maxTime = timeMap.get(latestWorkoutId) || 0;

    for (const set of validSets) {
      const t = timeMap.get(set.workout_id) || 0;
      if (t > maxTime) {
        maxTime = t;
        latestWorkoutId = set.workout_id;
      }
    }

    // 5. Suodatetaan lopulliset sarjat vain tälle uusimmalle treenille ja järjestetään
    const result = validSets
      .filter((s) => s.workout_id === latestWorkoutId)
      .sort((a, b) => a.set_index - b.set_index)
      .slice(0, 10);

    await tx.done;
    return result;
  }

  async getExerciseHistory(
    exerciseId: number,
    excludeWorkoutId?: number,
    workoutCount = 3,
  ): Promise<WorkoutHistory[]> {
    const tx = this.db.transaction(['workouts', 'workout_sets'], 'readonly');
    const setsStore = tx.objectStore('workout_sets');
    const workoutsStore = tx.objectStore('workouts');

    // 1. Haetaan VAIN ne sarjat, jotka liittyvät tähän liikkeeseen
    const setsIndex = setsStore.index('exercise_id');
    const exerciseSets = await setsIndex.getAll(IDBKeyRange.only(exerciseId));

    if (exerciseSets.length === 0) {
      await tx.done;
      return [];
    }

    // Suodatetaan tarvittaessa pois aktiivinen treeni
    const validSets = excludeWorkoutId
      ? exerciseSets.filter((s) => s.workout_id !== excludeWorkoutId)
      : exerciseSets;

    if (validSets.length === 0) {
      await tx.done;
      return [];
    }

    // 2. Selvitetään uniikit workout_id:t, jotta voidaan hakea vain niiden aikaleimat
    const uniqueWorkoutIds = Array.from(new Set<number>(validSets.map((s) => s.workout_id)));

    // 3. TEHOSTUS: Haetaan vain tarvittavien treenien tiedot rinnakkain
    const timeMap = new Map<number, { started_at: string; time: number }>();
    await Promise.all(
      uniqueWorkoutIds.map(async (wId) => {
        const w = await workoutsStore.get(wId);
        if (w) {
          timeMap.set(wId, {
            started_at: w.started_at,
            time: new Date(w.started_at).getTime(), // Lasketaan getTime vain KERRAN per treeni
          });
        }
      }),
    );

    // 4. Järjestetään sarjat muistissa (nyt huomattavasti pienempi lista)
    // Koska aikaleimat haettiin valmiiksi, sort-funktio on äärimmäisen kevyt numerovertailu
    validSets.sort((a, b) => {
      const timeA = timeMap.get(a.workout_id)?.time || 0;
      const timeB = timeMap.get(b.workout_id)?.time || 0;
      return timeB - timeA || a.set_index - b.set_index;
    });

    await tx.done;

    // 5. Ryhmitellään sarjat treenikohtaisesti
    const grouped = new Map<number, WorkoutHistory>();
    for (const set of validSets) {
      if (!grouped.has(set.workout_id)) {
        // Jos olemme jo keränneet halutun määrän treenejä (esim. 3), lopetetaan
        if (grouped.size >= workoutCount) break;

        grouped.set(set.workout_id, {
          workout_id: set.workout_id,
          started_at: timeMap.get(set.workout_id)?.started_at || '',
          sets: [],
        });
      }
      grouped.get(set.workout_id)!.sets.push(set);
    }

    return Array.from(grouped.values());
  }

  // --- Import/Export ---

  async getWorkouts(ids?: number[]): Promise<Workout[]> {
    // REITTI A: Jos ids-lista on annettu, haetaan vain pyydetyt rivit yksitellen rinnakkain
    if (ids && ids.length > 0) {
      const store = this.db.transaction('workouts', 'readonly').objectStore('workouts');

      // Haetaan kaikki pyydetyt treenit rinnakkain niiden pääavaimella (id)
      const workouts = await Promise.all(ids.map((id) => store.get(id)));

      // Suodatetaan mahdolliset undefined-tulokset (jos ID:llä ei löytynyt treeniä)
      // ja järjestetään ne lopuksi aloitusajan mukaan
      return (workouts.filter((w) => w !== undefined) as Workout[]).sort(
        (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime(),
      );
    }

    // REITTI B: Export-tilanne (ids-listaa ei ole). Haetaan KAIKKI valmiiksi järjestettynä.
    // Hyödynnetään started_at-indeksiä. Koska lukusuuntaa ei määritellä, selain lukee
    // indeksin luonnostaan nousevassa järjestyksessä (vanhimmasta uusimpaan).
    return await this.db.getAllFromIndex('workouts', 'started_at');
  }

  async getAllSets(): Promise<WorkoutSet[]> {
    const all = await this.db.getAll('workout_sets');
    return all.sort((a, b) => a.workout_id - b.workout_id || a.id - b.id);
  }

  async insertWorkoutRaw(
    startedAt: string,
    finishedAt: string | null,
    notes: string | null,
    device: string | null,
  ): Promise<number> {
    const workoutData: any = { started_at: startedAt, finished_at: finishedAt, notes };
    if (device) workoutData.device = device;
    const id = await this.db.add('workouts', workoutData);
    return id as number;
  }

  async insertSetRaw(
    workoutId: number,
    exerciseId: number,
    setIndex: number,
    reps: number | null,
    weight: number | null,
    completedAt: string | null,
  ): Promise<void> {
    await this.db.add('workout_sets', {
      workout_id: workoutId,
      exercise_id: exerciseId,
      set_index: setIndex,
      reps,
      weight,
      completed_at: completedAt,
    });
  }

  // --- Timers ---

  async getWorkoutTimer(workoutId: number): Promise<WorkoutTimer | null> {
    const timer = await this.db.get('workout_timers', workoutId);
    return timer || null;
  }

  async saveWorkoutTimer(
    workoutId: number,
    lastAction: 'START' | 'STOP' | 'LAP' | 'RESET',
    isRunning: boolean,
    totalElapsedMs: number,
    lapElapsedMs: number,
    updatedAt: string,
  ): Promise<void> {
    await this.db.put('workout_timers', {
      workout_id: workoutId,
      last_action: lastAction,
      is_running: isRunning ? 1 : 0, // Pidetään datamuoto yhtenäisenä SQLitelle
      total_elapsed_ms: totalElapsedMs,
      lap_elapsed_ms: lapElapsedMs,
      updated_at: updatedAt,
    });
  }

  // --- Exercises ---

  async getAllExercises(): Promise<Exercise[]> {
    const all = await this.db.getAll('exercises');
    // Järjestetään aakkosjärjestyksen mukaan (vastaa SQL ORDER BY name)
    return all.sort((a, b) => a.name.localeCompare(b.name));
  }

  async addExercise(name: string): Promise<Exercise> {
    const createdAt = new Date().toISOString();
    const id = await this.db.add('exercises', { name, created_at: createdAt });
    return { id: id as number, name, created_at: createdAt };
  }
}

export async function openWebDatabase(): Promise<DB> {
  const idb = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, _newVersion, transaction) {
      // Create stores that don't exist yet (fresh install or new stores)
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) {
          if (store === 'settings') {
            db.createObjectStore(store, { keyPath: 'key' });
          } else if (store === 'workout_timers') {
            db.createObjectStore(store, { keyPath: 'workout_id' });
          } else {
            db.createObjectStore(store, { keyPath: 'id', autoIncrement: true });
          }
        }
      }

      // Migration from v3 → v4: add indexes and recreate workout_timers with correct keyPath
      if (oldVersion < 4) {
        // Recreate workout_timers with workout_id as keyPath (was 'id' + autoIncrement)
        if (db.objectStoreNames.contains('workout_timers')) {
          const existingStore = transaction.objectStore('workout_timers');
          // Check if keyPath needs migration (old schema used 'id')
          if (existingStore.keyPath === 'id') {
            db.deleteObjectStore('workout_timers');
            db.createObjectStore('workout_timers', { keyPath: 'workout_id' });
          }
        }

        // Add indexes to workouts
        const workoutStore = transaction.objectStore('workouts');
        if (!workoutStore.indexNames.contains('started_at')) {
          workoutStore.createIndex('started_at', 'started_at', { unique: false });
        }

        // Add indexes to workout_sets
        const setStore = transaction.objectStore('workout_sets');
        if (!setStore.indexNames.contains('workout_id')) {
          setStore.createIndex('workout_id', 'workout_id', { unique: false });
        }
        if (!setStore.indexNames.contains('exercise_id')) {
          setStore.createIndex('exercise_id', 'exercise_id', { unique: false });
        }
      }
    },
    blocked(currentVersion, blockedVersion) {
      console.warn(
        `IndexedDB upgrade blocked: v${currentVersion} → v${blockedVersion}. Close other tabs.`,
      );
    },
    blocking(_currentVersion, _blockedVersion, event) {
      // This connection blocks a newer version in another tab — close so it can proceed
      (event.target as IDBDatabase)?.close();
    },
    terminated() {
      console.warn('IndexedDB connection terminated unexpectedly.');
    },
  });

  const webDBInstance = new WebDB(idb);
  await webDBInstance.init();
  return webDBInstance;
}
