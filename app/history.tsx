import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useDatabase } from '../src/db/DatabaseProvider';
import { getRecentWorkouts } from '../src/db/queries';
import { colors } from '../src/theme';
import type { Workout } from '../src/types';

export default function HistoryScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [workouts, setWorkouts] = useState<Workout[]>([]);

  useEffect(() => {
    getRecentWorkouts(db, 50).then(setWorkouts);
  }, [db]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={workouts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <Pressable
            style={styles.item}
            onPress={() => router.push({ pathname: '/workout', params: { id: item.id.toString() } })}
          >
            <Text style={styles.date}>{formatDate(item.started_at)}</Text>
            <Text style={styles.status}>{item.finished_at ? 'Completed' : 'In progress'}</Text>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No workouts yet</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: colors.bg },
  item: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  date: { color: colors.textPrimary, fontSize: 16 },
  status: { color: colors.textSecondary, fontSize: 14 },
  empty: { color: colors.textSecondary, textAlign: 'center', marginTop: 40 },
});
