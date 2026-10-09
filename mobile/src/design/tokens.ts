/**
 * SnapClaim design tokens — "Ledger & Tape".
 *
 * The visual idea: a thermal receipt tape stapled into a notarised ledger.
 * Consequences that run through every token below —
 *   · Paper, not screen. Warm off-white ground, never #FFF, never pure #000.
 *   · Printed, not rendered. Corners are 2px, borders are hairlines and
 *     perforations, separation comes from rules and torn edges, not shadows.
 *   · Ink has meaning. Vermilion is a stamp and only ever marks a seal.
 */

export const palette = {
  // Warm paper / ink ramp. Hue held at ~45deg so nothing reads as grey-blue.
  paper000: '#FBF8F1', // tape, raised card
  paper100: '#F2EEE4', // app ground
  paper200: '#E7E1D3', // sunken well
  rule300: '#D6CFBE', // hairline, perforation
  rule400: '#B8AF9A', // stronger rule
  ink300: '#8C8470', // tertiary text
  ink500: '#5B5546', // secondary text
  ink700: '#2E2B22',
  ink900: '#17150F', // primary text

  // Dark side: warm black, never neutral.
  night900: '#121108',
  night800: '#1C1A12',
  night700: '#262318',
  night600: '#332F21',

  // Stamp inks. Reserved, never decorative.
  vermilion: '#C8341E', // the seal
  vermilionSoft: '#F2D9D2',
  seal: '#2F6B4F', // match / verified
  sealSoft: '#D6E3DA',
  amber: '#B5831F', // low-confidence field, needs a look
  amberSoft: '#F3E6C9',
} as const;

export const light = {
  ground: palette.paper100,
  tape: palette.paper000,
  well: palette.paper200,
  rule: palette.rule300,
  ruleStrong: palette.rule400,
  text: palette.ink900,
  textSecondary: palette.ink500,
  textTertiary: palette.ink300,
  onInk: palette.paper000,
  inkFill: palette.ink900,
  stamp: palette.vermilion,
  stampSoft: palette.vermilionSoft,
  ok: palette.seal,
  okSoft: palette.sealSoft,
  warn: palette.amber,
  warnSoft: palette.amberSoft,
} as const;

export const dark = {
  ground: palette.night900,
  tape: palette.night800,
  well: palette.night700,
  rule: palette.night600,
  ruleStrong: '#4A452F',
  text: palette.paper100,
  textSecondary: '#A9A28C',
  textTertiary: '#7A7360',
  onInk: palette.night900,
  inkFill: palette.paper100,
  stamp: '#E8553C',
  stampSoft: '#3A1C15',
  ok: '#5FA883',
  okSoft: '#17291F',
  warn: '#D9A73F',
  warnSoft: '#2E2413',
} as const;

/**
 * Widened to `string` on purpose: `as const` above gives each token a literal
 * type, which would make the dark scheme structurally incompatible with the
 * light one and stop either from satisfying a shared Scheme.
 */
export type Scheme = { readonly [K in keyof typeof light]: string };

/** 4pt base. Named for intent so screens stop inventing numbers. */
export const space = {
  hair: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  gutter: 20, // screen horizontal inset
} as const;

/** Printed paper, not plastic. Nothing is a pill except an intentional tag. */
export const radius = { sharp: 0, card: 2, tag: 999 } as const;

export const hairline = 1;

/** Tap targets — FR/NFR floor is 48dp; never ship a control under this. */
export const minTarget = 48;
