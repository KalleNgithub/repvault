import { Stack } from 'expo-router';
import { DatabaseProvider } from '../src/db/DatabaseProvider';
import { I18nProvider } from '../src/i18n';
import { colors } from '../src/theme';

export default function RootLayout() {
  return (
    <I18nProvider>
      <DatabaseProvider>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bgCard },
            headerTintColor: colors.textPrimary,
            headerTitleStyle: { fontWeight: 'bold' },
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="index" options={{ title: 'RepVault' }} />
          <Stack.Screen name="workout" options={{ title: 'RepVault', headerBackTitle: 'Back' }} />
          <Stack.Screen name="exercises" options={{ title: 'RepVault' }} />
          <Stack.Screen name="history" options={{ title: 'RepVault' }} />
          <Stack.Screen name="settings" options={{ title: 'RepVault' }} />
        </Stack>
      </DatabaseProvider>
    </I18nProvider>
  );
}
