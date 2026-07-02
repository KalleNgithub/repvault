import { View, Text, Pressable, TextInput, ScrollView, StyleSheet, Platform } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { translateExercise, useI18n } from '../src/i18n';
import { useDatabase } from '../src/db/DatabaseProvider';
import { exportData, importData, ExportData } from '../src/db/importExport';
import { getSetting, setSetting, getRecentWorkouts, WorkoutExerciseSummary, getWorkoutSummaries } from '../src/db/queries';
import type { Workout } from '../src/types';
import { colors } from '../src/theme';

type ExportMode = 'last' | 'all' | 'pick';

export default function SettingsScreen() {
  const { t, locale, setLocale } = useI18n();
  const db = useDatabase();
  const [status, setStatus] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState('');
  const [deviceSaved, setDeviceSaved] = useState(false);

  // Export picker state
  const [exportMode, setExportMode] = useState<ExportMode>('last');
  const [lastN, setLastN] = useState(1);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [summaries, setSummaries] = useState<Map<number, WorkoutExerciseSummary[]>>(new Map());
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    getSetting(db, 'device_name').then(v => { if (v) setDeviceName(v); });
    getRecentWorkouts(db, 100).then(setWorkouts);
  }, [db]);

  useEffect(() => {
    if (workouts.length > 0) {
      getWorkoutSummaries(db, workouts.map(w => w.id)).then(setSummaries);
    }
  }, [db, workouts]);


  const saveDeviceName = useCallback(async () => {
    const trimmed = deviceName.trim();
    if (trimmed) {
      await setSetting(db, 'device_name', trimmed);
      setDeviceSaved(true);
      setTimeout(() => setDeviceSaved(false), 2000);
    }
  }, [db, deviceName]);

  const toggleWorkout = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getExportIds = (): number[] | undefined => {
    if (exportMode === 'all') return undefined;
    if (exportMode === 'last') {
      return workouts.slice(0, lastN).map(w => w.id);
    }
    return Array.from(selected);
  };

  const handleExport = async () => {
    try {
      const ids = getExportIds();
      if (exportMode === 'pick' && (!ids || ids.length === 0)) {
        setStatus('✗ No workouts selected');
        return;
      }
      const data = await exportData(db, ids);
      const json = JSON.stringify(data, null, 2);

      if (Platform.OS === 'web') {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `repvault-export-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
      const count = data.workouts.length;
      setStatus(`✓ Exported ${count} workout${count !== 1 ? 's' : ''}`);
    } catch (e: any) {
      setStatus(`✗ Export failed: ${e.message}`);
    }
  };

  const handleImport = async () => {
    try {
      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async () => {
          const file = input.files?.[0];
          if (!file) return;
          const text = await file.text();
          const data: ExportData = JSON.parse(text);
          const result = await importData(db, data);
          setStatus(
            `✓ Imported ${result.workoutsImported} workout${result.workoutsImported !== 1 ? 's' : ''}, ` +
            `${result.setsImported} sets, ${result.exercisesCreated} new exercises` +
            (result.skippedDuplicateWorkouts > 0 ? ` (${result.skippedDuplicateWorkouts} skipped)` : '')
          );
          // Refresh workout list
          getRecentWorkouts(db, 100).then(setWorkouts);
        };
        input.click();
      }
    } catch (e: any) {
      setStatus(`✗ Import failed: ${e.message}`);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(locale === 'fi' ? 'fi-FI' : 'en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.sectionTitle}>{t.language}</Text>

      <Pressable
        style={[styles.langBtn, locale === 'fi' && styles.activeLang]}
        onPress={() => setLocale('fi')}
      >
        <Text style={styles.flag}>🇫🇮</Text>
        <Text style={styles.langText}>{t.finnish}</Text>
        {locale === 'fi' && <Text style={styles.check}>✓</Text>}
      </Pressable>

      <Pressable
        style={[styles.langBtn, locale === 'en' && styles.activeLang]}
        onPress={() => setLocale('en')}
      >
        <Text style={styles.flag}>🇬🇧</Text>
        <Text style={styles.langText}>{t.english}</Text>
        {locale === 'en' && <Text style={styles.check}>✓</Text>}
      </Pressable>

      {/* Device Name */}
      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
        {locale === 'fi' ? 'Laitteen nimi' : 'Device Name'}
      </Text>
      <View style={styles.deviceRow}>
        <TextInput
          style={styles.deviceInput}
          value={deviceName}
          onChangeText={setDeviceName}
          placeholder={locale === 'fi' ? 'esim. "Kallen iPhone"' : 'e.g. "John\'s iPhone"'}
          placeholderTextColor={colors.textSecondary}
          onBlur={saveDeviceName}
          onSubmitEditing={saveDeviceName}
        />
        {deviceSaved && <Text style={styles.savedBadge}>✓</Text>}
      </View>

      {/* Export */}
      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
        {locale === 'fi' ? 'Vie' : 'Export'}
      </Text>

      {/* Mode selector */}
      <View style={styles.modeRow}>
        {(['last', 'all', 'pick'] as ExportMode[]).map(mode => (
          <Pressable
            key={mode}
            style={[styles.modeBtn, exportMode === mode && styles.modeBtnActive]}
            onPress={() => setExportMode(mode)}
          >
            <Text style={[styles.modeBtnText, exportMode === mode && styles.modeBtnTextActive]}>
              {mode === 'last' ? (locale === 'fi' ? `Viim. ${lastN}` : `Last ${lastN}`)
                : mode === 'all' ? (locale === 'fi' ? 'Kaikki' : 'All')
                : (locale === 'fi' ? 'Valitse' : 'Pick')}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Last N controls */}
      {exportMode === 'last' && (
        <View style={styles.lastNRow}>
          <Pressable style={styles.incBtn} onPress={() => setLastN(n => Math.max(1, n - 1))}>
            <Text style={styles.incBtnText}>−</Text>
          </Pressable>
          <Text style={styles.lastNValue}>{lastN}</Text>
          <Pressable style={styles.incBtn} onPress={() => setLastN(n => Math.min(n + 1, workouts.length))}>
            <Text style={styles.incBtnText}>+</Text>
          </Pressable>
        </View>
      )}

      {/* Checkbox picker */}
      {exportMode === 'pick' && (
        <ScrollView
          style={styles.pickList}
          nestedScrollEnabled={true}
        >
          {workouts.map(w => (
            <Pressable
              key={w.id}
              style={styles.pickItem}
              onPress={() => toggleWorkout(w.id)}
            >
              <Text style={styles.pickCheckbox}>
                {selected.has(w.id) ? '☑' : '☐'}
              </Text>
              <View style={styles.pickContainer}>
                <Text style={styles.pickDate}>{formatDate(w.started_at)}</Text>
                {summaries.get(w.id) && summaries.get(w.id)!.length > 0 && (
                  <Text style={styles.workoutPreview} numberOfLines={1}>
                    {summaries.get(w.id)!.map(s => `${s.set_count}× ${translateExercise(s.exercise_name, locale)}`).join(', ')}
                  </Text>
                )}
              </View>
              {w.device && <Text style={styles.pickDevice}>{w.device}</Text>}
            </Pressable>
          ))}
          {workouts.length === 0 && (
            <Text style={styles.emptyText}>
              {locale === 'fi' ? 'Ei treenejä' : 'No workouts'}
            </Text>
          )}
        </ScrollView>
      )}

      <Pressable style={styles.dataBtn} onPress={handleExport}>
        <Text style={styles.dataBtnText}>
          {locale === 'fi' ? 'Vie treenit' : 'Export Workouts'}
        </Text>
      </Pressable>

      {/* Import */}
      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
        {locale === 'fi' ? 'Tuo' : 'Import'}
      </Text>

      <Pressable style={styles.dataBtn} onPress={handleImport}>
        <Text style={styles.dataBtnText}>
          {locale === 'fi' ? 'Tuo tiedostosta' : 'Import from File'}
        </Text>
      </Pressable>

      {status && <Text style={styles.status}>{status}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: colors.bg },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 14,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  langBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: colors.bgCard,
  },
  activeLang: {
    borderWidth: 1,
    borderColor: colors.accent,
  },
  flag: { fontSize: 32, marginRight: 12 },
  langText: { color: colors.textPrimary, fontSize: 18, flex: 1 },
  check: { color: colors.accent, fontSize: 20 },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  deviceInput: {
    flex: 1,
    backgroundColor: colors.bgCard,
    color: colors.textPrimary,
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  savedBadge: {
    color: colors.accent,
    fontSize: 20,
    marginLeft: 8,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.bgCard,
    alignItems: 'center',
  },
  modeBtnActive: {
    backgroundColor: colors.accent,
  },
  modeBtnText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  modeBtnTextActive: {
    color: colors.bg,
  },
  lastNRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 12,
  },
  incBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  incBtnText: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
  },
  lastNValue: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    minWidth: 40,
    textAlign: 'center',
  },
  pickList: {
    marginBottom: 12,
    maxHeight: 240,
    overflow: 'hidden', // Estää elementtejä valumasta rajan yli
    borderRadius: 6,    // Valinnainen: pitää kulmat siistinä jos taustavärit näkyvät
  },
  pickItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.bgCard,
    borderRadius: 6,
    marginBottom: 4,
  },
  pickCheckbox: {
    color: colors.accent,
    fontSize: 20,
    marginRight: 10,
  },
  pickContainer: {
    flex: 1,
  },
  pickDate: {
    color: colors.textPrimary,
    fontSize: 15,
  },
  pickDevice: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 12,
  },
  dataBtn: {
    backgroundColor: colors.bgCard,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  dataBtnText: { color: colors.textPrimary, fontSize: 16 },
  status: { color: colors.cyan, fontSize: 14, marginTop: 12 },
  workoutPreview: { color: colors.textSecondary, fontSize: 13, marginTop: 3 },
});
