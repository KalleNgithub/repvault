import { View, Text, Pressable, StyleSheet, ScrollView, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { useDatabase } from '../src/db/DatabaseProvider';
import { useI18n, translateExercise } from '../src/i18n';

import type { Exercise, Workout, WorkoutSet } from '../src/types';
import { useStopwatch, formatTime } from '../src/hooks/useStopwatch';
import { useMetronome } from '../src/hooks/useMetronome';
import { colors } from '../src/theme';
import { WorkoutHistory } from '../src/db/interface';
import { IncrementSlider } from '../src/components/IncrementSlider';

interface ExerciseBlock {
  exercise: Exercise;
  sets: WorkoutSet[];
  lastSets: WorkoutSet[]; // for pre-fill
  history: WorkoutHistory[]; // for display
  collapsed: boolean;
}

const WEIGHT_STEP = 2.5;
const REPS_STEP = 1;

// Find the heaviest set (by weight, then reps as tiebreak)
function heaviestSet(sets: WorkoutSet[]): WorkoutSet | null {
  if (sets.length === 0) return null;
  return sets.reduce((best, s) => {
    const bw = best.weight ?? 0;
    const sw = s.weight ?? 0;
    if (sw > bw) return s;
    if (sw === bw && (s.reps ?? 0) > (best.reps ?? 0)) return s;
    return best;
  });
}

// Format a set as "weight×reps"
function fmtSet(s: WorkoutSet): string {
  return `${s.weight ?? '-'}×${s.reps ?? '-'}`;
}

export default function WorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const workoutId = parseInt(id!, 10);
  const db = useDatabase();
  const { t, locale } = useI18n();
  const stopwatch = useStopwatch();
  const metronome = useMetronome(60);

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [blocks, setBlocks] = useState<ExerciseBlock[]>([]);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [focusedSetId, setFocusedSetId] = useState<number | null>(null);
  // Editing: which set+field is active, and the pending text value
  const [editing, setEditing] = useState<{ setId: number; field: 'weight' | 'reps' } | null>(null);
  const [editValue, setEditValue] = useState('');

  const loadWorkout = useCallback(async () => {
    const { workout, sets } = await db.getWorkoutWithSets(workoutId);
    setWorkout(workout);

    // Backfill block_order for legacy workouts (all sets null after migration)
    if (sets.length > 0 && sets.every((s) => s.block_order == null)) {
      await db.backfillBlockOrder(workoutId);
      const reloaded = await db.getWorkoutWithSets(workoutId);
      sets.length = 0;
      sets.push(...reloaded.sets);
    }

    const exercises = await db.getAllExercises();
    setAllExercises(exercises);

    const exerciseMap = new Map<number, { exercise: Exercise; sets: WorkoutSet[] }>();
    GROUP_SETS_BY_EXERCISE: for (const s of sets) {
      if (!exerciseMap.has(s.exercise_id)) {
        const ex = exercises.find((e) => e.id === s.exercise_id);

        if (!ex) {
          console.error(`Tietokantavirhe: Liikettä ID:llä ${s.exercise_id} ei löydy.`);
          continue GROUP_SETS_BY_EXERCISE;
        }

        exerciseMap.set(s.exercise_id, { exercise: ex, sets: [] });
      }
      exerciseMap.get(s.exercise_id)!.sets.push(s);
    }

    LOAD_EXERCISE_BLOCKS: {
      if (exerciseMap.size === 0) {
        break LOAD_EXERCISE_BLOCKS;
      }
      const newBlocks: ExerciseBlock[] = [];
      for (const [exId, { exercise, sets: exSets }] of exerciseMap) {
        const lastSets = await db.getLastSetsForExercise(exId, workoutId);
        const history = await db.getExerciseHistory(exId, workoutId, 3);
        newBlocks.push({ exercise, sets: exSets, lastSets, history, collapsed: false });
      }

      setBlocks((prevBlocks) => {
        return newBlocks.map((nb) => {
          const existing = prevBlocks.find((pb) => pb.exercise.id === nb.exercise.id);
          return {
            ...nb,
            collapsed: existing ? existing.collapsed : nb.collapsed,
          };
        });
      });
    }

    LOAD_WORKOUT_TIMER: {
      try {
        const savedTimer = await db.getWorkoutTimer(workoutId);
        if (!savedTimer) {
          stopwatch.reset();
          break LOAD_WORKOUT_TIMER;
        }

        const now = Date.now();
        const updatedAt = new Date(savedTimer.updated_at).getTime();
        const backgroundElapsedMs = now - updatedAt;

        const isRunning = savedTimer.is_running === 1;
        let elapsed = savedTimer.total_elapsed_ms;
        let lapElapsed = savedTimer.lap_elapsed_ms;

        if (isRunning) {
          elapsed += backgroundElapsedMs;
          lapElapsed += backgroundElapsedMs;
        }

        const countedLaps: number[] = [];
        if (elapsed > 0 && elapsed !== lapElapsed) {
          const previousLapEnded = elapsed - lapElapsed;
          countedLaps.push(previousLapEnded);
        }

        stopwatch.setTimer(elapsed, isRunning, countedLaps);
      } catch (error) {
        console.error('Virhe sekuntikellon alustuksessa:', error);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, workoutId]);

  useEffect(() => {
    loadWorkout(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [loadWorkout]);

  const handleAdjustDate = async (daysDelta: number) => {
    if (!workout) return;
    const currentDate = new Date(workout.started_at);
    currentDate.setDate(currentDate.getDate() + daysDelta);
    const newIsoString = currentDate.toISOString();

    try {
      await db.updateWorkoutStartedAt(workoutId, newIsoString);
      setWorkout((prev) => {
        if (!prev) return null;
        return { ...prev, started_at: newIsoString };
      });
    } catch (error) {
      console.error('Päivämäärän päivitys epäonnistui:', error);
    }
  };

  const handleAddExercise = async (exercise: Exercise) => {
    setShowExercisePicker(false);
    const lastSets = await db.getLastSetsForExercise(exercise.id, workoutId);
    const prefillReps = lastSets.length > 0 ? lastSets[0].reps : null;
    const prefillWeight = lastSets.length > 0 ? lastSets[0].weight : null;
    await db.addSet(workoutId, exercise.id, 0, prefillReps, prefillWeight);
    // New exercise block goes to the end
    const newBlockOrder = blocks.length;
    await db.updateBlockOrder(workoutId, exercise.id, newBlockOrder);
    await loadWorkout();
  };

  const handleAddSet = async (block: ExerciseBlock) => {
    // If currently editing, commit the edit first
    if (editing) {
      await saveEdit(editing.setId, editing.field, editValue);
      setEditing(null);
      setEditValue('');
    }
    const lastIdx = block.sets.length > 0 ? block.sets[block.sets.length - 1].set_index : -1;
    const ref =
      block.sets.length > 0
        ? block.sets[block.sets.length - 1]
        : (block.lastSets[block.sets.length] ?? null);
    await db.addSet(
      workoutId,
      block.exercise.id,
      lastIdx + 1,
      ref?.reps ?? null,
      ref?.weight ?? null,
    );
    // Ensure the new set inherits this block's order (use array position, not stale field)
    const blockIdx = blocks.findIndex((b) => b.exercise.id === block.exercise.id);
    if (blockIdx >= 0) {
      await db.updateBlockOrder(workoutId, block.exercise.id, blockIdx);
    }
    if (stopwatch.running) stopwatch.lap();
    await loadWorkout();
  };

  const handleDeleteSet = async (setId: number) => {
    if (focusedSetId === setId) setFocusedSetId(null);
    await db.deleteSet(setId);
    await loadWorkout();
  };

  const handleIncrement = async (setId: number, field: 'weight' | 'reps', delta: number) => {
    const set = blocks.flatMap((b) => b.sets).find((s) => s.id === setId);
    if (!set) return;
    const current = field === 'weight' ? (set.weight ?? 0) : (set.reps ?? 0);
    const newVal = Math.max(0, current + delta);
    const reps = field === 'reps' ? newVal : set.reps;
    const weight = field === 'weight' ? newVal : set.weight;
    await db.updateSet(setId, reps, weight);
    await loadWorkout();
  };

  // Save current edit value to DB
  const saveEdit = async (setId: number, field: 'weight' | 'reps', value: string) => {
    const numValue = value === '' ? null : parseFloat(value);
    const set = blocks.flatMap((b) => b.sets).find((s) => s.id === setId);
    if (!set) return;
    const reps = field === 'reps' ? (numValue as number | null) : set.reps;
    const weight = field === 'weight' ? numValue : set.weight;
    await db.updateSet(setId, reps, weight);
  };

  // Track if we're transitioning weight→reps (suppress blur handling)
  const [transitioning, setTransitioning] = useState(false);

  // Enter/submit on weight: save weight, then switch to editing reps
  const handleWeightSubmit = async () => {
    if (!editing || editing.field !== 'weight') return;
    const { setId } = editing;
    setTransitioning(true);
    await saveEdit(setId, 'weight', editValue);

    // Switch to reps — set state synchronously before any re-render
    const set = blocks.flatMap((b) => b.sets).find((s) => s.id === setId);
    setEditing({ setId, field: 'reps' });
    setEditValue(set?.reps?.toString() ?? '');
    // Let React re-render with the new editing state, then reload data
    setTimeout(async () => {
      setTransitioning(false);
      await loadWorkout();
    }, 0);
  };

  // Enter/submit on reps: save and close editing
  const handleRepsSubmit = async () => {
    if (!editing || editing.field !== 'reps') return;
    await saveEdit(editing.setId, 'reps', editValue);
    setEditing(null);
    setEditValue('');
    await loadWorkout();
  };

  // Blur: save whatever field and close (but skip if transitioning to reps)
  const handleBlur = async () => {
    if (!editing || transitioning) return;
    // Small delay to allow +set press to register first
    await new Promise((r) => setTimeout(r, 150));
    if (!editing || transitioning) return;
    await saveEdit(editing.setId, editing.field, editValue);
    setEditing(null);
    setEditValue('');
    await loadWorkout();
  };

  const startEditing = (setId: number, field: 'weight' | 'reps') => {
    const set = blocks.flatMap((b) => b.sets).find((s) => s.id === setId);
    if (!set) return;
    setFocusedSetId(setId);
    setEditing({ setId, field });
    setEditValue((field === 'weight' ? set.weight : set.reps)?.toString() ?? '');
  };

  const toggleCollapse = (idx: number) => {
    setBlocks((prev) => prev.map((b, i) => (i === idx ? { ...b, collapsed: !b.collapsed } : b)));
  };

  const moveExercise = (idx: number, direction: -1 | 1) => {
    const target = idx + direction;
    setBlocks((prev) => {
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];

      // Persist new block order to DB
      for (let i = 0; i < next.length; i++) {
        db.updateBlockOrder(workoutId, next[i].exercise.id, i);
      }

      return next;
    });
  };

  const handleFinish = async () => {
    const now = new Date().toISOString();

    stopwatch.stop();
    await db.saveWorkoutTimer(workoutId, 'STOP', false, stopwatch.elapsed, stopwatch.lapTime, now);

    await db.finishWorkout(workoutId);
    router.back();
  };

  // Render history row: sets from past workouts, grouped with | separator
  const renderHistory = (history: WorkoutHistory[]) => {
    if (history.length === 0) return null;
    const MAX_SETS_PER_WORKOUT = 5;

    return (
      <View style={styles.historyRow}>
        <Text style={styles.historyLabel}>{t.prev}</Text>
        <View style={styles.historyContent}>
          {history.map((wh, wi) => {
            const heavy = heaviestSet(wh.sets);
            // If too many sets, only show heaviest
            const displaySets =
              wh.sets.length > MAX_SETS_PER_WORKOUT ? (heavy ? [heavy] : []) : wh.sets;

            return (
              <View key={wh.workout_id} style={styles.historyGroup}>
                {wi > 0 && <Text style={styles.historySep}>|</Text>}
                {displaySets.map((s, si) => {
                  const isHeaviest = heavy && s.id === heavy.id;
                  return (
                    <Text
                      key={s.id ?? si}
                      style={[styles.historySet, isHeaviest && styles.historyBold]}
                    >
                      {fmtSet(s)}
                      {si < displaySets.length - 1 ? '  ' : ''}
                    </Text>
                  );
                })}
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const handleWebDateChange = async (e: any) => {
    if (!workout || !e.target.value) return;

    // e.target.value "YYYY-MM-DD"
    const selectedDate = new Date(e.target.value);
    const currentDate = new Date(workout.started_at);

    currentDate.setFullYear(selectedDate.getFullYear());
    currentDate.setMonth(selectedDate.getMonth());
    currentDate.setDate(selectedDate.getDate());

    const newIsoString = currentDate.toISOString();

    try {
      await db.updateWorkoutStartedAt(workoutId, newIsoString);
      setWorkout((prev) => (prev ? { ...prev, started_at: newIsoString } : null));
    } catch (err) {
      console.error('Kalenteripäivitys epäonnistui:', err);
    }
  };

  // ISO -> "YYYY-MM-DD"
  const inputDateValue = workout ? new Date(workout.started_at).toISOString().split('T')[0] : '';

  const handleStart = async () => {
    const now = new Date().toISOString();

    stopwatch.start();
    await db.saveWorkoutTimer(workoutId, 'START', true, stopwatch.elapsed, stopwatch.lapTime, now);
  };

  const handleStop = async () => {
    const now = new Date().toISOString();
    const newElapsed = stopwatch.elapsed;
    const newLap = stopwatch.lapTime;

    stopwatch.stop();
    await db.saveWorkoutTimer(workoutId, 'STOP', false, newElapsed, newLap, now);
  };

  const handleLap = async () => {
    const now = new Date().toISOString();
    const newElapsed = stopwatch.elapsed;

    stopwatch.lap();
    await db.saveWorkoutTimer(workoutId, 'LAP', true, newElapsed, 0, now);
  };

  const handleReset = async () => {
    const now = new Date().toISOString();

    stopwatch.reset();
    await db.saveWorkoutTimer(workoutId, 'RESET', false, 0, 0, now);
  };

  return (
    <View style={styles.container}>
      {/* Timer Bar */}
      <View style={styles.timerBar}>
        <View style={styles.timerSection}>
          <Text style={styles.timerLabel}>{t.rest}</Text>
          <Text style={styles.lapTime}>{formatTime(stopwatch.lapTime)}</Text>
          <Text style={styles.totalTime}>{formatTime(stopwatch.elapsed)}</Text>
        </View>
        <View style={styles.timerButtons}>
          <Pressable onPress={stopwatch.running ? handleLap : handleStart} style={styles.timerBtn}>
            <Text style={styles.timerBtnText}>{stopwatch.running ? t.lap : t.start}</Text>
          </Pressable>
          <Pressable onPress={stopwatch.running ? handleStop : handleReset} style={styles.timerBtn}>
            <Text style={styles.timerBtnText}>{stopwatch.running ? t.stop : t.reset}</Text>
          </Pressable>
        </View>
        <View style={styles.metronomeSection}>
          <Pressable
            onPress={metronome.toggle}
            style={[styles.timerBtn, metronome.playing && styles.activeBtn]}
          >
            <Text style={styles.timerBtnText}>{metronome.playing ? '60 BPM ■' : '60 BPM ▶'}</Text>
          </Pressable>
        </View>
      </View>

      {/* Workout metadata and Exercise Blocks */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {workout && (
          <View style={styles.dateEditRow}>
            <Pressable onPress={() => handleAdjustDate(-1)} style={styles.dateBtn}>
              <Text style={styles.dateBtnText}>−</Text>
            </Pressable>

            <input
              type="date"
              value={inputDateValue}
              onChange={handleWebDateChange}
              style={webInputStyle}
            />

            <Pressable onPress={() => handleAdjustDate(1)} style={styles.dateBtn}>
              <Text style={styles.dateBtnText}>+</Text>
            </Pressable>
          </View>
        )}
        {blocks.map((block, idx) => (
          <View key={block.exercise.id} style={styles.exerciseBlock}>
            <View style={styles.exerciseHeader}>
              <Pressable onPress={() => toggleCollapse(idx)} style={styles.exerciseNameWrap}>
                <Text style={styles.exerciseName}>
                  {block.collapsed ? '►' : '▼'} {translateExercise(block.exercise.name, locale)}
                </Text>
              </Pressable>
              <View style={styles.reorderButtons}>
                {idx > 0 && (
                  <Pressable onPress={() => moveExercise(idx, -1)} style={styles.reorderBtn}>
                    <Text style={styles.reorderText}>▲</Text>
                  </Pressable>
                )}
                {idx < blocks.length - 1 && (
                  <Pressable onPress={() => moveExercise(idx, 1)} style={styles.reorderBtn}>
                    <Text style={styles.reorderText}>▼</Text>
                  </Pressable>
                )}
              </View>
            </View>

            {!block.collapsed && (
              <View style={styles.setsTable}>
                {/* History from previous workouts */}
                {renderHistory(block.history)}

                {/* Column headers */}
                <View style={styles.tableHeader}>
                  <Text style={[styles.colHeader, styles.colSet]}>#</Text>
                  <Text style={[styles.colHeader, styles.colWeight]}>{t.kg}</Text>
                  <Text style={[styles.colHeader, styles.colReps]}>{t.reps}</Text>
                </View>

                {/* Set rows */}
                {block.sets.map((s, i) => {
                  const focused = focusedSetId === s.id;
                  return (
                    <View key={s.id}>
                      <View style={[styles.tableRow, focused && styles.focusedRow]}>
                        <Pressable
                          style={styles.rowContent}
                          onPress={() => setFocusedSetId(focused ? null : s.id)}
                        >
                          <Text style={[styles.cellText, styles.colSet, styles.setNum]}>
                            {i + 1}
                          </Text>

                          <Pressable
                            style={[styles.editableCell, styles.colWeight]}
                            onPress={() => startEditing(s.id, 'weight')}
                          >
                            {editing?.setId === s.id && editing.field === 'weight' ? (
                              <TextInput
                                style={styles.editInput}
                                value={editValue}
                                onChangeText={setEditValue}
                                onBlur={handleBlur}
                                onSubmitEditing={handleWeightSubmit}
                                keyboardType="numeric"
                                autoFocus
                                selectTextOnFocus
                              />
                            ) : (
                              <Text style={styles.cellValue}>{s.weight ?? '-'}</Text>
                            )}
                          </Pressable>

                          <Pressable
                            style={[styles.editableCell, styles.colReps]}
                            onPress={() => startEditing(s.id, 'reps')}
                          >
                            {editing?.setId === s.id && editing.field === 'reps' ? (
                              <TextInput
                                style={styles.editInput}
                                value={editValue}
                                onChangeText={setEditValue}
                                onBlur={handleBlur}
                                onSubmitEditing={handleRepsSubmit}
                                keyboardType="numeric"
                                autoFocus
                                selectTextOnFocus
                              />
                            ) : (
                              <Text style={styles.cellValue}>{s.reps ?? '-'}</Text>
                            )}
                          </Pressable>
                        </Pressable>

                        <Pressable onPress={() => handleDeleteSet(s.id)} style={styles.deleteBtn}>
                          <Text style={styles.deleteText}>×</Text>
                        </Pressable>
                      </View>

                      {/* Increment sliders for focused row */}
                      {focused && !editing && (
                        <View style={styles.incrementRow}>
                          <IncrementSlider
                            label={t.kg}
                            step={WEIGHT_STEP}
                            range={4}
                            onIncrement={(delta) => handleIncrement(s.id, 'weight', delta)}
                          />
                          <IncrementSlider
                            label={t.reps}
                            step={REPS_STEP}
                            range={5}
                            onIncrement={(delta) => handleIncrement(s.id, 'reps', delta)}
                          />
                        </View>
                      )}
                    </View>
                  );
                })}

                <Pressable onPress={() => handleAddSet(block)} style={styles.addSetRow}>
                  <Text style={styles.addSetText}>{t.addSet}</Text>
                </Pressable>
              </View>
            )}
          </View>
        ))}

        <View style={showExercisePicker ? styles.pickerContainer : undefined}>
          <Pressable
            style={[styles.addExerciseBtn, showExercisePicker && styles.addExerciseBtnOpen]}
            onPress={() => setShowExercisePicker(!showExercisePicker)}
          >
            <Text style={styles.addExerciseText}>{t.addExercise}</Text>
          </Pressable>

          {showExercisePicker && (
            <View style={styles.pickerList}>
              {allExercises
                .filter((e) => !blocks.some((b) => b.exercise.id === e.id))
                .sort((a, b) =>
                  translateExercise(a.name, locale).localeCompare(
                    translateExercise(b.name, locale),
                    locale,
                  ),
                )
                .map((e) => (
                  <Pressable
                    key={e.id}
                    style={styles.pickerItem}
                    onPress={() => handleAddExercise(e)}
                  >
                    <Text style={styles.pickerText}>{translateExercise(e.name, locale)}</Text>
                  </Pressable>
                ))}
            </View>
          )}
        </View>

        <Pressable style={styles.finishBtn} onPress={handleFinish}>
          <Text style={styles.finishText}>{t.finishWorkout}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  timerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  timerSection: { flex: 1 },
  timerLabel: { color: colors.textSecondary, fontSize: 10 },
  lapTime: {
    color: colors.accent,
    fontSize: 24,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  totalTime: { color: colors.textSecondary, fontSize: 14, fontVariant: ['tabular-nums'] },
  timerButtons: { flexDirection: 'column', gap: 4 },
  timerBtn: {
    backgroundColor: colors.purpleDim,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    minWidth: 85,
    alignItems: 'center',
  },
  activeBtn: { backgroundColor: colors.purple },
  timerBtnText: { color: colors.textPrimary, fontSize: 12, fontWeight: 'bold' },
  metronomeSection: { marginLeft: 8 },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
    flexDirection: 'column',
  },
  dateEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center', // Keskittää koko paketin
    backgroundColor: colors.bgCard,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 16,
  },
  dateDisplayWrap: {
    minWidth: 130,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    position: 'relative',
  },
  dateDisplay: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  dateBtn: {
    backgroundColor: colors.purpleDim,
    width: 36,
    height: 36,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateBtnText: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  exerciseBlock: {
    marginBottom: 12,
    backgroundColor: colors.bgCard,
    borderRadius: 8,
    overflow: 'hidden',
  },
  exerciseHeader: {
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  exerciseNameWrap: { flex: 1 },
  exerciseName: { color: colors.textPrimary, fontSize: 16, fontWeight: 'bold' },
  reorderButtons: { flexDirection: 'row', gap: 4 },
  reorderBtn: { paddingHorizontal: 8, paddingVertical: 2 },
  reorderText: { color: colors.textSecondary, fontSize: 14 },
  setsTable: { paddingHorizontal: 10, paddingBottom: 8 },
  // History row
  historyRow: {
    flexDirection: 'row',
    paddingBottom: 6,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  historyLabel: { color: colors.textDim, fontSize: 11, width: 30, paddingTop: 2 },
  historyContent: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  historyGroup: { flexDirection: 'row', alignItems: 'center' },
  historySep: { color: colors.textDim, fontSize: 14, marginHorizontal: 6 },
  historySet: { color: colors.textSecondary, fontSize: 12, fontVariant: ['tabular-nums'] },
  historyBold: { color: colors.textSecondary, fontWeight: 'bold' },
  // Table
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 4,
    marginBottom: 4,
  },
  colHeader: { color: colors.textSecondary, fontSize: 11, textTransform: 'uppercase' },
  colSet: { width: 24 },
  colWeight: { width: 64, textAlign: 'center' },
  colReps: { width: 52, textAlign: 'center' },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  focusedRow: {
    backgroundColor: colors.bgInput,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  setNum: { color: colors.textSecondary, fontSize: 14 },
  cellText: { color: colors.textPrimary, fontSize: 16, fontVariant: ['tabular-nums'] },
  editableCell: {
    backgroundColor: colors.bgInput,
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginHorizontal: 2,
    minHeight: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellValue: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  editInput: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    width: '100%',        // Pakoittaa kentän täyttämään vain ympäröivän solun leveyden
    minWidth: 40,
    padding: 0,
  },
  deleteBtn: { paddingHorizontal: 8, paddingVertical: 2 },
  deleteText: { color: colors.textSecondary, fontSize: 16 },
  incrementRow: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  addSetRow: {
    paddingVertical: 6,
    alignItems: 'center',
  },
  addSetText: { color: colors.cyan, fontSize: 14 },
  addExerciseBtn: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    marginBottom: 12,
  },
  addExerciseBtnOpen: {
    borderStyle: 'solid',
    borderColor: colors.purple,
    borderBottomWidth: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    marginBottom: 0,
  },
  addExerciseText: { color: colors.textSecondary, fontSize: 16 },
  pickerContainer: {
    marginBottom: 12,
  },
  pickerList: {
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.purple,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    padding: 8,
  },
  pickerItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  pickerText: { color: colors.textPrimary, fontSize: 16 },
  finishBtn: {
    backgroundColor: colors.accent,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 20,
  },
  finishText: { color: colors.textPrimary, fontSize: 16, fontWeight: 'bold' },
});

const webInputStyle = {
  border: 'none',
  background: 'transparent',
  outline: 'none',
  WebkitAppearance: 'auto' as any,
  appearance: 'auto' as const,
  color: colors.textPrimary,
  fontSize: '15px',
  fontWeight: '600' as const,
  fontFamily: 'sans-serif',
  textAlign: 'center' as const,
  padding: 0,
  margin: 0,
  height: '36px',
  cursor: 'pointer',
  width: '135px',
  minWidth: '135px',
  maxWidth: '135px',
};
