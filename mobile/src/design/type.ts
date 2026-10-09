import { TextStyle } from 'react-native';

/**
 * Three voices, each with one job. Mixing them is how the app avoids the
 * default system-sans flatness; using them interchangeably would undo it.
 *
 *   display — Instrument Serif. High-contrast editorial serif. Money and
 *             screen titles only. It carries the "this is a document" tone.
 *   ui      — Schibsted Grotesk. Every label, button and sentence.
 *   mono    — Martian Mono. Machine truth: fingerprints, signatures, tx
 *             ids, dates on tape, and the small-caps micro labels.
 *
 * Amounts are deliberately split: the hero total is display (it is the
 * headline), amounts inside a list are mono (they are a column that must
 * align and be scanned).
 */
export const family = {
  display: 'InstrumentSerif_400Regular',
  displayItalic: 'InstrumentSerif_400Regular_Italic',
  ui: 'SchibstedGrotesk_400Regular',
  uiMedium: 'SchibstedGrotesk_500Medium',
  uiSemi: 'SchibstedGrotesk_600SemiBold',
  uiBold: 'SchibstedGrotesk_700Bold',
  mono: 'MartianMono_400Regular',
  monoMedium: 'MartianMono_500Medium',
  monoBold: 'MartianMono_700Bold',
} as const;

export type TypeToken =
  | 'displayXL'
  | 'displayL'
  | 'displayM'
  | 'title'
  | 'body'
  | 'bodyStrong'
  | 'label'
  | 'micro'
  | 'data'
  | 'dataL'
  | 'stamp';

/**
 * Sizes are fixed rather than scaled here; system font scaling is applied at
 * the <Text> primitive via allowFontScaling so NFR accessibility still holds.
 */
export const type: Record<TypeToken, TextStyle> = {
  // Serif runs tight and slightly negative-tracked; at 52px the default
  // leading is far too airy and stops reading as a headline.
  displayXL: { fontFamily: family.display, fontSize: 52, lineHeight: 50, letterSpacing: -1 },
  displayL: { fontFamily: family.display, fontSize: 38, lineHeight: 38, letterSpacing: -0.6 },
  displayM: { fontFamily: family.display, fontSize: 28, lineHeight: 30, letterSpacing: -0.3 },

  title: { fontFamily: family.uiSemi, fontSize: 19, lineHeight: 25, letterSpacing: -0.2 },
  body: { fontFamily: family.ui, fontSize: 16, lineHeight: 23 },
  bodyStrong: { fontFamily: family.uiMedium, fontSize: 16, lineHeight: 23 },
  label: { fontFamily: family.uiMedium, fontSize: 13, lineHeight: 18 },

  // Mono is wide by design, so micro labels get generous tracking and are
  // always uppercase — they read as printed field headers, not as prose.
  micro: {
    fontFamily: family.monoMedium,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  data: { fontFamily: family.mono, fontSize: 13, lineHeight: 19 },
  dataL: { fontFamily: family.monoMedium, fontSize: 17, lineHeight: 23 },

  // Rubber stamp: the only place tracking goes this wide.
  stamp: {
    fontFamily: family.monoBold,
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
};

/** Loaded by expo-font at boot; keys must match `family` values. */
export const fontAssets = {
  InstrumentSerif_400Regular: require('@expo-google-fonts/instrument-serif/400Regular/InstrumentSerif_400Regular.ttf'),
  InstrumentSerif_400Regular_Italic: require('@expo-google-fonts/instrument-serif/400Regular_Italic/InstrumentSerif_400Regular_Italic.ttf'),
  SchibstedGrotesk_400Regular: require('@expo-google-fonts/schibsted-grotesk/400Regular/SchibstedGrotesk_400Regular.ttf'),
  SchibstedGrotesk_500Medium: require('@expo-google-fonts/schibsted-grotesk/500Medium/SchibstedGrotesk_500Medium.ttf'),
  SchibstedGrotesk_600SemiBold: require('@expo-google-fonts/schibsted-grotesk/600SemiBold/SchibstedGrotesk_600SemiBold.ttf'),
  SchibstedGrotesk_700Bold: require('@expo-google-fonts/schibsted-grotesk/700Bold/SchibstedGrotesk_700Bold.ttf'),
  MartianMono_400Regular: require('@expo-google-fonts/martian-mono/400Regular/MartianMono_400Regular.ttf'),
  MartianMono_500Medium: require('@expo-google-fonts/martian-mono/500Medium/MartianMono_500Medium.ttf'),
  MartianMono_700Bold: require('@expo-google-fonts/martian-mono/700Bold/MartianMono_700Bold.ttf'),
};
