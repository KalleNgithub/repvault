// Synthwave color palette
export const colors = {
  // Backgrounds (deep purple/navy gradient feel)
  bg: '#0d0221',          // deepest purple-black
  bgCard: '#1a0533',      // card/block background
  bgInput: '#2a0845',     // input fields
  bgElevated: '#1f0638',  // elevated surfaces

  // Primary accent (hot orange/amber)
  accent: '#ff6b2b',       // orange highlights, CTAs
  accentMuted: '#cc5522',  // pressed/secondary orange

  // Secondary accent (neon pink/magenta)
  pink: '#ff2975',         // secondary highlights
  pinkMuted: '#b81d55',

  // Tertiary (cyan/teal for success states)
  cyan: '#00f5d4',         // success, confirmations
  cyanMuted: '#00b89c',

  // Purple midtones
  purple: '#7b2ff7',       // borders, active states
  purpleLight: '#a855f7',  // lighter purple for text accents
  purpleDim: '#3d1a6e',    // subtle borders

  // Text
  textPrimary: '#f0e6ff',  // main text (slight purple tint)
  textSecondary: '#9b8ab8', // muted text
  textDim: '#5c4a73',      // very muted

  // Borders
  border: '#2d1b4e',
  borderActive: '#7b2ff7',
};

// Font families for synthwave feel
// Using system fonts with fallbacks that work cross-platform
export const fonts = {
  // Bold/heading: geometric, modern
  heading: 'system-ui, -apple-system, "SF Pro Display", sans-serif',
  // Body: clean mono-ish for numbers, system for text
  mono: '"SF Mono", "Fira Code", "Cascadia Code", "JetBrains Mono", monospace',
};
