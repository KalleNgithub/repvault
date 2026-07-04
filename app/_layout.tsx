import { StyleSheet, Text, ImageBackground, View, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { useFonts, Orbitron_700Bold } from '@expo-google-fonts/orbitron';

import { DatabaseProvider } from '../src/db/DatabaseProvider';
import { I18nProvider } from '../src/i18n';
import { colors } from '../src/theme'; // Hyödynnetään antamaasi väripalettia
import { DAILY_BANNERS } from '../src/constants/banners'; // TUOTU TÄÄLTÄ

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'Orbitron-Bold': Orbitron_700Bold,
  });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  // Keskittää otsikon pysty- ja vaakasuunnassa yläpalkissa
  const CustomHeaderTitle = () => (
    <View style={styles.headerTitleContainer}>
      <Text style={styles.headerTitle}>RepVault</Text>
    </View>
  );

  // Asettaa 1080px kuvan ylös keskelle banneriksi hyödyntäen teeman taustavärejä
  // Asettaa 1080px kuvan ylös keskelle banneriksi hyödyntäen teeman taustavärejä
  const CustomHeaderBackground = () => {
    // Haetaan nykyisen päivän numero (0-6)
    const currentDay = new Date().getDay();
    // Valitaan kuva viikonpäivän mukaan, tai käytetään oletusta jos päivää ei tunnisteta
    const currentBanner =
      DAILY_BANNERS[currentDay] || require('../assets/valmis_banneri_city.webp');

    return (
      <View style={styles.headerBackgroundContainer}>
        <ImageBackground
          source={currentBanner}
          style={[styles.backgroundImage, StyleSheet.absoluteFill]}
          resizeMode={Platform.OS === 'web' ? 'cover' : 'contain'}
        >
          {/* Häivytetään banneri sovelluksen omaan syvään taustaväriin */}
          <View style={styles.headerOverlay} />
        </ImageBackground>
      </View>
    );
  };

  return (
    <I18nProvider>
      <DatabaseProvider>
        <Stack
          screenOptions={{
            headerBackground: () => <CustomHeaderBackground />,
            headerTitle: () => <CustomHeaderTitle />,
            headerTintColor: colors.cyan, // Korvattu: Globaali korostusväri
            headerTitleAlign: 'center',
            contentStyle: { backgroundColor: colors.bg }, // Sovelluksen päätausta
            headerShadowVisible: false,
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="workout" options={{ headerBackTitle: 'Back' }} />
          <Stack.Screen name="exercises" />
          <Stack.Screen name="history" />
          <Stack.Screen name="settings" />
        </Stack>
      </DatabaseProvider>
    </I18nProvider>
  );
}

const styles = StyleSheet.create({
  headerBackgroundContainer: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    backgroundColor: colors.bgCard, // Käytetään korttitaustaa kuvan alla reunoilla
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
    ...Platform.select({
      web: {
        backgroundPositionX: 'center',
        backgroundPositionY: 'top',
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'contain',
      },
    }),
  },
  headerOverlay: {
    ...StyleSheet.absoluteFill,
    // Muutettu käyttämään sovelluksen omaa syvää pohjaväriä (0.4 = 40% peittävyys)
    backgroundColor: `${colors.bg}66`, // 66 vastaa ~40% läpinäkyvyyttä kuusitoistajärjestelmässä
  },
  headerTitleContainer: {
    flex: 1,
    justifyContent: 'center', // Keskittää pystysuunnassa (korkeussuunnassa)
    alignItems: 'center', // Keskittää vaakasuunnassa
    width: '100%',
    height: '100%',
  },
  headerTitle: {
    fontFamily: 'Orbitron-Bold',
    fontSize: 24,
    color: colors.cyan, // Korvattu: Teeman kirkas syaaniväri
    letterSpacing: 2,
    textTransform: 'uppercase',
    textAlign: 'center',
    ...Platform.select({
      web: {
        textShadowColor: colors.pink, // Korvattu: Teeman neonpinkki hehku
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10,
      },
      default: {
        textShadowColor: colors.pink, // Korvattu: Teeman neonpinkki hehku varjona mobiilissa
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 4,
      },
    }),
  },
});
