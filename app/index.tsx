import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { useDatabase } from '../src/db/DatabaseProvider';
import { createWorkout, getRecentWorkouts, deleteWorkout, getWorkoutSummaries, type WorkoutExerciseSummary, copyWorkoutWithWeightsOnly } from '../src/db/queries';
import { useI18n, formatDateLocale, translateExercise } from '../src/i18n';
import { colors } from '../src/theme';
import type { Workout } from '../src/types';

export default function HomeScreen() {
  const db = useDatabase();
  const router = useRouter();
  const { t, locale } = useI18n();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [summaries, setSummaries] = useState<Map<number, WorkoutExerciseSummary[]>>(new Map());
  const [isCopyMode, setIsCopyMode] = useState(false);

  const loadData = useCallback(async () => {
    const wks = await getRecentWorkouts(db);
    setWorkouts(wks);
    if (wks.length > 0) {
      const sums = await getWorkoutSummaries(db, wks.map(w => w.id));
      setSummaries(sums);
    }
  }, [db]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleNewWorkout = async () => {
    const workout = await createWorkout(db);
    router.push({ pathname: '/workout', params: { id: workout.id.toString() } });
  };

  const formatDate = (dateStr: string) => formatDateLocale(dateStr, locale);

  const handleDelete = async (workoutId: number) => {
    await deleteWorkout(db, workoutId);
    loadData();
  };

  const handleSelectOldWorkout = async (sourceWorkoutId: number) => {
    try {
      await copyWorkoutWithWeightsOnly(db, sourceWorkoutId);
      setIsCopyMode(false);
      await loadData();
    } catch (error) {
      console.error("Treenin kopiointi epäonnistui:", error);
    }
  };


  return (
    <View style={styles.container}>
      <View style={styles.buttonRow}>
        <Pressable
          style={[styles.newButton, isCopyMode && styles.disabledBtn]}
          onPress={handleNewWorkout}
          disabled={isCopyMode}
        >
          <Text style={styles.newButtonText}>{t.newWorkout}</Text>
        </Pressable>

        <Pressable
          style={[styles.oldButton, isCopyMode && styles.activeOldBtn]}
          onPress={() => setIsCopyMode(!isCopyMode)}
        >
          <Text style={[styles.oldButtonText, isCopyMode && styles.activeOldBtnText]}
            numberOfLines={1}
            ellipsizeMode="clip">
            {isCopyMode ? t.cancel : t.oldWorkOut}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>{t.recent}</Text>
      <FlatList
        data={workouts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={[styles.workoutItem, isCopyMode && styles.workoutItemCopyable]}>
            <Pressable
              style={styles.workoutContent}
              onPress={() =>
                isCopyMode
                  ? handleSelectOldWorkout(item.id)
                  : router.push({ pathname: '/workout', params: { id: item.id.toString() } })
              }
            >
              <View style={styles.workoutHeader}>
                <Text style={styles.workoutDate}>{formatDate(item.started_at)}</Text>
                <Text style={styles.workoutStatus}>
                  {item.finished_at ? t.done : t.inProgress}
                </Text>
              </View>
              {summaries.get(item.id) && summaries.get(item.id)!.length > 0 && (
                <Text style={styles.workoutPreview} numberOfLines={1}>
                  {summaries.get(item.id)!.map(s => `${s.set_count}× ${translateExercise(s.exercise_name, locale)}`).join(', ')}
                </Text>
              )}
            </Pressable>
            <Pressable
              style={[styles.deleteBtn, isCopyMode && { opacity: 0 }]}
              onPress={() => handleDelete(item.id)}
              disabled={isCopyMode} // Estää vahinkopainallukset, vaikka nappi on näkymätön
            >
              <Text style={styles.deleteText}>×</Text>
            </Pressable>

          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>{t.noWorkouts}</Text>}
      />

      <View style={styles.bottomNav}>
        <Pressable style={styles.navButton} onPress={() => router.push('/exercises')}>
          <Text style={styles.navButtonText}>{t.exercises}</Text>
        </Pressable>
        <Pressable style={styles.navButton} onPress={() => router.push('/settings')}>
          <Text style={styles.navButtonText}>⚙ {t.settings}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: colors.bg },
  buttonRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  newButton: {
    flex: 1,
    backgroundColor: colors.purple,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  newButtonText: { color: colors.textPrimary, fontSize: 18, fontWeight: 'bold' },
  oldButton: {
    flex: 1,
    backgroundColor: colors.purpleDim,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.purple
  },
  oldButtonText: { color: colors.textPrimary, fontSize: 18, fontWeight: 'bold',  },
  disabledBtn: { opacity: 0.3 },
  activeOldBtn: {
    backgroundColor: colors.purpleDim,
    borderColor: colors.pink
  },
  activeOldBtnText: {
    color: colors.pink
  },
  sectionTitle: { color: colors.textSecondary, fontSize: 14, marginBottom: 8, textTransform: 'uppercase' },
  workoutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 4,
  },
  workoutItemCopyable: {
    borderLeftWidth: 4,
    borderLeftColor: colors.purple,
    backgroundColor: colors.purpleDim,
    borderBottomColor: colors.border,
  },
  workoutContent: {
    flex: 1,
    paddingVertical: 12,
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  workoutDate: { color: colors.textPrimary, fontSize: 16 },
  workoutStatus: { color: colors.textSecondary, fontSize: 14 },
  workoutPreview: { color: colors.textSecondary, fontSize: 13, marginTop: 3 },
  deleteBtn: { paddingHorizontal: 12, paddingVertical: 12 },
  deleteText: { color: colors.textSecondary, fontSize: 18 },
  empty: { color: colors.textSecondary, textAlign: 'center', marginTop: 20 },
  bottomNav: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  navButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  navButtonText: { color: colors.textSecondary, fontSize: 16 },
  copyTitleHint: { color: colors.accent, fontWeight: 'bold' },
});
