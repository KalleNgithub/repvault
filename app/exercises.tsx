import { View, Text, Pressable, StyleSheet, FlatList, TextInput } from 'react-native';
import { useState, useEffect } from 'react';
import { useDatabase } from '../src/db/DatabaseProvider';
import { useI18n, translateExercise } from '../src/i18n';
import { getAllExercises, addExercise } from '../src/db/queries';
import { colors } from '../src/theme';
import type { Exercise } from '../src/types';

export default function ExercisesScreen() {
  const db = useDatabase();
  const { t, locale } = useI18n();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    getAllExercises(db).then((exs) => {
      exs.sort((a, b) =>
        translateExercise(a.name, locale).localeCompare(translateExercise(b.name, locale), locale)
      );
      setExercises(exs);
    });
  }, [db, locale]);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    // Enforce unique names (case-insensitive check)
    const exists = exercises.some(e => e.name.toLowerCase() === name.toLowerCase());
    if (exists) return;
    await addExercise(db, name);
    setNewName('');
    const updated = await getAllExercises(db);
    updated.sort((a, b) =>
      translateExercise(a.name, locale).localeCompare(translateExercise(b.name, locale), locale)
    );
    setExercises(updated);
  };

  return (
    <View style={styles.container}>
      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          placeholder={t.newExercisePlaceholder}
          placeholderTextColor={colors.textSecondary}
          value={newName}
          onChangeText={setNewName}
          onSubmitEditing={handleAdd}
        />
        <Pressable style={styles.addBtn} onPress={handleAdd}>
          <Text style={styles.addBtnText}>{t.add}</Text>
        </Pressable>
      </View>

      <FlatList
        data={exercises}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text style={styles.itemText}>{translateExercise(item.name, locale)}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: colors.bg },
  addRow: { flexDirection: 'row', marginBottom: 16, gap: 8 },
  input: {
    flex: 1,
    backgroundColor: colors.bgInput,
    color: colors.textPrimary,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addBtn: {
    backgroundColor: colors.purple,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
  },
  addBtnText: { color: colors.textPrimary, fontWeight: 'bold', fontSize: 16 },
  item: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  itemText: { color: colors.textPrimary, fontSize: 16 },
});
