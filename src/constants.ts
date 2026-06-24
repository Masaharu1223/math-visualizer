export type Mode = 'derivative' | 'integral' | 'surface' | 'parametric'

export interface ParametricPreset {
  label: string
  xt: string
  yt: string
  tRange: [number, number]
}

export const DEFAULT_RANGE: [number, number] = [-4, 4]
export const DEFAULT_T_RANGE: [number, number] = [0, Math.PI * 2]
export const CYCLOID_T_RANGE: [number, number] = [DEFAULT_T_RANGE[0], DEFAULT_T_RANGE[1] * 2]

export const PRESETS_2D = [
  'x^3/3 - 2x',
  'sin(x)',
  'x * sin(x)',
  'exp(-x^2/2)',
  '1/x',
  'log(x)',
  'tan(x)',
]

export const PRESETS_3D = [
  'sin(x) * cos(y)',
  'x^2 - y^2',
  'exp(-(x^2 + y^2)/2)',
  'sin(sqrt(x^2 + y^2))',
  'x * y / 3',
]

export const PRESETS_PARAMETRIC: ParametricPreset[] = [
  { label: '円', xt: 'cos(t)', yt: 'sin(t)', tRange: DEFAULT_T_RANGE },
  { label: '楕円', xt: '3 * cos(t)', yt: '2 * sin(t)', tRange: DEFAULT_T_RANGE },
  { label: 'サイクロイド', xt: 't - sin(t)', yt: '1 - cos(t)', tRange: CYCLOID_T_RANGE },
  {
    label: 'カージオイド',
    xt: '2 * cos(t) - cos(2 * t)',
    yt: '2 * sin(t) - sin(2 * t)',
    tRange: DEFAULT_T_RANGE,
  },
  { label: 'リサージュ', xt: 'sin(2 * t)', yt: 'sin(3 * t)', tRange: DEFAULT_T_RANGE },
]

export const MODE_LABELS: Record<Mode, string> = {
  derivative: '微分',
  integral: '積分',
  surface: '3D 曲面',
  parametric: '媒介変数',
}
