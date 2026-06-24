import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useI18n } from '../src/i18n';
import { colors } from '../src/theme';

export default function SettingsScreen() {
  const { t, locale, setLocale } = useI18n();

  return (
    <View style={styles.container}>
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
    </View>
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
});
