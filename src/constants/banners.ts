import { ImageSourcePropType } from 'react-native';

// POISTETTU export: Tämä objekti on nyt privaatti ja näkyy vain tämän tiedoston sisällä
const DAILY_BANNERS: Record<number, ImageSourcePropType> = {
  0: require('../../assets/hero-banners/0.webp'),
  1: require('../../assets/hero-banners/1.webp'),
  2: require('../../assets/hero-banners/2.webp'),
  3: require('../../assets/hero-banners/3.webp'),
  4: require('../../assets/hero-banners/4.webp'),
  5: require('../../assets/hero-banners/5.webp'),
  6: require('../../assets/hero-banners/6.webp'),
};

/**
 * Palauttaa viikonpäivää vastaavan bannerikuvan.
 * Jos päivä on virheellinen (ei välillä 0-6), palauttaa oletuksena sunnuntain (0) bannerin.
 */
export function getBannerForDay(day: number): ImageSourcePropType {
  // Nullish coalescing (??) palauttaa oletuskuvan aina, jos avainta ei löydy
  return DAILY_BANNERS[day] ?? DAILY_BANNERS[0];
}
