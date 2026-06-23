import { useEffect, useMemo, useRef, useState } from 'react'
import { parseFunction } from './math/engine'
import type { ParsedFunction } from './math/engine'
import { Controls } from './components/Controls'
import { View2D } from './components/View2D'
import { View3D, DOMAIN_3D } from './components/View3D'
import { ViewParametric } from './components/ViewParametric'

type Mode = 'derivative' | 'integral' | 'surface' | 'parametric'

const DEFAULT_RANGE: [number, number] = [-4, 4]
const SURFACE_RANGE: [number, number] = [-DOMAIN_3D, DOMAIN_3D]
const DEFAULT_T_RANGE: [number, number] = [0, Math.PI * 2]

interface ParametricPreset {
  label: string
  xt: string
  yt: string
  tRange: [number, number]
}

const PRESETS_2D = [
  'x^3/3 - 2x',
  'sin(x)',
  'x * sin(x)',
  'exp(-x^2/2)',
  '1/x',
  'log(x)',
  'tan(x)',
]
const PRESETS_3D = [
  'sin(x) * cos(y)',
  'x^2 - y^2',
  'exp(-(x^2 + y^2)/2)',
  'sin(sqrt(x^2 + y^2))',
  'x * y / 3',
]
const PRESETS_PARAMETRIC: ParametricPreset[] = [
  { label: '円', xt: 'cos(t)', yt: 'sin(t)', tRange: DEFAULT_T_RANGE },
  { label: '楕円', xt: '3 * cos(t)', yt: '2 * sin(t)', tRange: DEFAULT_T_RANGE },
  { label: 'サイクロイド', xt: 't - sin(t)', yt: '1 - cos(t)', tRange: [0, Math.PI * 4] },
  {
    label: 'カージオイド',
    xt: '2 * cos(t) - cos(2 * t)',
    yt: '2 * sin(t) - sin(2 * t)',
    tRange: DEFAULT_T_RANGE,
  },
  { label: 'リサージュ', xt: 'sin(2 * t)', yt: 'sin(3 * t)', tRange: DEFAULT_T_RANGE },
]

const MODE_LABELS: Record<Mode, string> = {
  derivative: '微分',
  integral: '積分',
  surface: '3D 曲面',
  parametric: '媒介変数',
}

/** x を xRange 内でループさせるアニメーション */
function useAnimatedX(
  range: [number, number],
  playing: boolean,
  speed: number,
): [number, (x: number) => void] {
  const [x, setX] = useState((range[0] + range[1]) / 2)
  const rangeRef = useRef(range)

  useEffect(() => {
    rangeRef.current = range
  }, [range])

  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      const [a, b] = rangeRef.current
      setX((prev) => {
        const nx = prev + (dt * speed * (b - a)) / 8
        return nx > b ? a : Math.max(a, nx)
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, speed])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- range change must clamp the animated value immediately
    setX((prev) => Math.max(range[0], Math.min(range[1], prev)))
  }, [range])

  return [x, setX]
}

export default function App() {
  const [mode, setMode] = useState<Mode>('derivative')
  const [expr2d, setExpr2d] = useState(PRESETS_2D[0])
  const [expr3d, setExpr3d] = useState(PRESETS_3D[0])
  const [xtExpr, setXtExpr] = useState(PRESETS_PARAMETRIC[0].xt)
  const [ytExpr, setYtExpr] = useState(PRESETS_PARAMETRIC[0].yt)
  const [tRange, setTRange] = useState<[number, number]>(PRESETS_PARAMETRIC[0].tRange)
  const [xRange, setXRange] = useState<[number, number]>(DEFAULT_RANGE)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)

  const isParametric = mode === 'parametric'
  const is3D = mode === 'surface'
  const expr = is3D ? expr3d : expr2d
  const setExpr = is3D ? setExpr3d : setExpr2d
  const presets = is3D ? PRESETS_3D : PRESETS_2D
  const effRange = is3D ? SURFACE_RANGE : xRange

  const parsed = useMemo(() => {
    if (isParametric) return { fn: null, error: null as string | null }
    try {
      return { fn: parseFunction(expr, is3D ? ['x', 'y'] : ['x']), error: null as string | null }
    } catch (e) {
      return { fn: null, error: e instanceof Error ? e.message : String(e) }
    }
  }, [expr, is3D, isParametric])

  const [lastValid, setLastValid] = useState<Record<'2d' | '3d', ParsedFunction | null>>({
    '2d': null,
    '3d': null,
  })
  const key = is3D ? '3d' : '2d'
  useEffect(() => {
    if (!parsed.fn) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- cache the latest valid parser result for invalid input fallback
    setLastValid((prev) => (prev[key] === parsed.fn ? prev : { ...prev, [key]: parsed.fn }))
  }, [key, parsed.fn])
  const fn = parsed.fn ?? lastValid[key]

  const [x, setX] = useAnimatedX(effRange, !isParametric && playing, speed)
  const [t, setT] = useAnimatedX(tRange, isParametric && playing, speed)
  const currentParametricPresetIndex = PRESETS_PARAMETRIC.findIndex(
    (p) => p.xt === xtExpr && p.yt === ytExpr && p.tRange[0] === tRange[0] && p.tRange[1] === tRange[1],
  )

  return (
    <div className="app">
      <header className="app-header">
        <h1>関数ビジュアライザー</h1>
        <nav className="tabs">
          {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
            <button
              key={m}
              className={m === mode ? 'tab active' : 'tab'}
              onClick={() => setMode(m)}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </nav>
      </header>

      {isParametric ? (
        <div className="parametric-inputs">
          <div className="input-row">
            <span className="fn-label">x(t) =</span>
            <input
              className="fn-input"
              value={xtExpr}
              onChange={(e) => setXtExpr(e.target.value)}
              spellCheck={false}
              placeholder="例: cos(t)"
            />
          </div>
          <div className="input-row">
            <span className="fn-label">y(t) =</span>
            <input
              className="fn-input"
              value={ytExpr}
              onChange={(e) => setYtExpr(e.target.value)}
              spellCheck={false}
              placeholder="例: sin(t)"
            />
            <select
              className="preset-select"
              value={currentParametricPresetIndex >= 0 ? String(currentParametricPresetIndex) : ''}
              onChange={(e) => {
                if (!e.target.value) return
                const preset = PRESETS_PARAMETRIC[Number(e.target.value)]
                setXtExpr(preset.xt)
                setYtExpr(preset.yt)
                setTRange(preset.tRange)
              }}
            >
              <option value="" disabled>
                プリセット
              </option>
              {PRESETS_PARAMETRIC.map((p, i) => (
                <option key={p.label} value={String(i)}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <>
          <div className="input-row">
            <span className="fn-label">{is3D ? 'f(x, y) =' : 'f(x) ='}</span>
            <input
              className={parsed.error ? 'fn-input invalid' : 'fn-input'}
              value={expr}
              onChange={(e) => setExpr(e.target.value)}
              spellCheck={false}
              placeholder={is3D ? '例: sin(x) * cos(y)' : '例: x^3/3 - 2x'}
            />
            <select
              className="preset-select"
              value={presets.includes(expr) ? expr : ''}
              onChange={(e) => e.target.value && setExpr(e.target.value)}
            >
              <option value="" disabled>
                プリセット
              </option>
              {presets.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          {parsed.error && <p className="error-text">数式エラー: {parsed.error}</p>}
        </>
      )}

      <Controls
        playing={playing}
        onTogglePlay={() => setPlaying((p) => !p)}
        speed={speed}
        onSpeedChange={setSpeed}
        x={isParametric ? t : x}
        onXChange={(v) => {
          setPlaying(false)
          if (isParametric) setT(v)
          else setX(v)
        }}
        xRange={isParametric ? tRange : effRange}
        onResetView={!is3D && !isParametric ? () => setXRange(DEFAULT_RANGE) : undefined}
      />

      {isParametric ? (
        <ViewParametric xtExpr={xtExpr} ytExpr={ytExpr} tRange={tRange} />
      ) : (
        fn &&
        (is3D ? (
          <View3D fn={fn} x={x} />
        ) : (
          <View2D
            fn={fn}
            mode={mode as 'derivative' | 'integral'}
            x={x}
            xRange={xRange}
            onXRangeChange={setXRange}
          />
        ))
      )}

      <footer className="app-footer">
        使える記法: x^2, sin, cos, tan, exp, log, sqrt, pi, e など(math.js 構文)/
        グラフはドラッグで移動・ホイールでズーム
      </footer>
    </div>
  )
}
