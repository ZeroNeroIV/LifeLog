// ─────────────────────────────────────────────────────────────
// Life-Log · Design Tokens
// Google Stitch-inspired dark palette — used across all steps
// ─────────────────────────────────────────────────────────────

// ── Backgrounds & Surfaces ───────────────────────────────────
export const COLORS = {
  // Canvas
  bg:           '#0f172a', // slate-900  – app background
  bgDeep:       '#080d18', // darker canvas for modals/overlays

  // Cards / Bento panels
  surface:      '#1e293b', // slate-800
  surfaceHigh:  '#263348', // slightly elevated surface
  border:       '#334155', // slate-700 – dividers & card edges
  borderFaint:  '#1e293b', // near-invisible separator

  // Text hierarchy
  textPrimary:   '#f1f5f9', // slate-100
  textSecondary: '#94a3b8', // slate-400
  textMuted:     '#475569', // slate-600
  textDisabled:  '#1e293b', // slate-800

  // ── Metric accent colours ───────────────────────────────────
  water:         '#3b82f6', // blue-500
  waterLight:    '#93c5fd', // blue-300
  waterDim:      '#1d3a6b', // blue-950 tint

  caffeine:      '#f59e0b', // amber-500
  caffeineLight: '#fcd34d', // amber-300
  caffeineDim:   '#451a03', // amber-950 tint

  mood:          '#a855f7', // purple-500
  moodLight:     '#d8b4fe', // purple-300
  moodDim:       '#3b0764', // purple-950 tint

  focus:         '#22c55e', // green-500
  focusLight:    '#86efac', // green-300
  focusDim:      '#052e16', // green-950 tint

  vitaminC:      '#fb923c', // orange-400 (vitamin C)
  vitaminCLight: '#fdba74', // orange-300
  vitaminCDim:   '#431407', // orange-950 tint

  sugar:         '#ec4899', // pink-500 (sugar)
  sugarLight:    '#f9a8d4', // pink-300
  sugarDim:      '#500724', // pink-950 tint

  // ── Semantic states ──────────────────────────────────────────
  success:       '#22c55e',
  warning:       '#f59e0b',
  error:         '#ef4444',
  info:          '#38bdf8',

  // ── Pomodoro ─────────────────────────────────────────────────
  pomodoroWork:  '#ef4444', // red-500
  pomodoroBreak: '#22c55e', // green-500

  // ── Pure tones ───────────────────────────────────────────────
  white:         '#ffffff',
  black:         '#000000',
  transparent:   'transparent',
};

// ── Gradient pairs [from, to] ─────────────────────────────────
export const GRADIENTS = {
  water:    ['#1d4ed8', '#3b82f6'],  // blue
  caffeine: ['#b45309', '#f59e0b'],  // amber
  mood:     ['#7e22ce', '#a855f7'],  // purple
  focus:    ['#15803d', '#22c55e'],  // green
  vitaminC: ['#c2410c', '#fb923c'],  // orange
  sugar:    ['#be185d', '#ec4899'],  // pink
  surface:  ['#1e293b', '#0f172a'],  // dark surface fade
  hero:     ['#1e293b', '#0f172a'],  // for header backgrounds
};

// ── Spacing scale (px) ───────────────────────────────────────
export const SPACING = {
  xxs: 2,
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
  '3xl': 64,
};

// ── Border-radius scale ───────────────────────────────────────
export const RADIUS = {
  xs:   4,
  sm:   8,
  md:   14,
  lg:   20,
  xl:   28,
  xxl:  36,
  full: 9999,
};

// ── Typography weights ────────────────────────────────────────
export const FONT_WEIGHT = {
  regular:  '400',
  medium:   '500',
  semibold: '600',
  bold:     '700',
  black:    '800',
};

// ── Font sizes ────────────────────────────────────────────────
export const FONT_SIZE = {
  xs:   11,
  sm:   13,
  md:   15,
  lg:   17,
  xl:   20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
  '5xl': 48,
};

// ── Shadows (Android elevation + iOS shadow) ──────────────────
export const SHADOW = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
};

// ── Hit-slop helper ───────────────────────────────────────────
export const HIT_SLOP = {
  sm: { top: 8,  bottom: 8,  left: 8,  right: 8  },
  md: { top: 12, bottom: 12, left: 12, right: 12 },
  lg: { top: 20, bottom: 20, left: 20, right: 20 },
};
