import { useEffect, useMemo, useRef, useState } from 'react'
import { parseFunction } from './math/engine'
import type { ParsedFunction } from './math/engine'
import { Controls } from './components/Controls'
import { View2D } from './components/View2D'
import { View3D, DOMAIN_3D } from './components/View3D'
import { ViewParametric } from './components/ViewParametric'
import { addExpr, removeExpr, updateExpr } from './functionList'
import {
  DEFAULT_RANGE,
  FUNCTION_COLORS,
  MAX_FUNCTIONS,
  MODE_LABELS,
  PRESETS_2D,
  PRESETS_3D,
  PRESETS_PARAMETRIC,
} from './constants'
import type { Mode } from './constants'

type ParseResult = { fn: ParsedFunction | null; error: string | null }

function tryParse(expr: string, vars: string[]): ParseResult {
  try {
    return { fn: parseFunction(expr, vars), error: null }
  } catch (e) {
    return { fn: null, error: e instanceof Error ? e.message : String(e) }
  }
}

const SURFACE_RANGE: [number, number] = [-DOMAIN_3D, DOMAIN_3D]

const MAX_FRAME_DELTA_SEC = 0.1
const ANIMATION_SPEED_SCALE = 8

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
      const dt = Math.min((now - last) / 1000, MAX_FRAME_DELTA_SEC)
      last = now
      const [a, b] = rangeRef.current
      setX((prev) => {
        const nx = prev + (dt * speed * (b - a)) / ANIMATION_SPEED_SCALE
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
  const [exprs2d, setExprs2d] = useState([PRESETS_2D[0]])
  const [activeIndex, setActiveIndex] = useState(0)
  const [expr3d, setExpr3d] = useState(PRESETS_3D[0])
  const [xtExpr, setXtExpr] = useState(PRESETS_PARAMETRIC[0].xt)
  const [ytExpr, setYtExpr] = useState(PRESETS_PARAMETRIC[0].yt)
  const [tRange, setTRange] = useState<[number, number]>(PRESETS_PARAMETRIC[0].tRange)
  const [xRange, setXRange] = useState<[number, number]>(DEFAULT_RANGE)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)

  const isParametric = mode === 'parametric'
  const is3D = mode === 'surface'
  const effRange = is3D ? SURFACE_RANGE : xRange

  const parsed2d = useMemo(() => exprs2d.map((e) => tryParse(e, ['x'])), [exprs2d])
  const parsed3d = useMemo(() => tryParse(expr3d, ['x', 'y']), [expr3d])

  // 無効な入力のあいだは、関数ごとに直前の有効な関数を描画し続ける
  const [lastValid2d, setLastValid2d] = useState<(ParsedFunction | null)[]>([])
  const [lastValid3d, setLastValid3d] = useState<ParsedFunction | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- cache the latest valid parser results for invalid input fallback
    setLastValid2d((prev) => {
      const next = parsed2d.map((p, i) => p.fn ?? prev[i] ?? null)
      return next.length === prev.length && next.every((f, i) => f === prev[i]) ? prev : next
    })
  }, [parsed2d])
  useEffect(() => {
    if (!parsed3d.fn) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- cache the latest valid parser result for invalid input fallback
    setLastValid3d(parsed3d.fn)
  }, [parsed3d.fn])
  const fn3d = parsed3d.fn ?? lastValid3d

  const fns2d = useMemo(
    () =>
      parsed2d.flatMap((p, i) => {
        const fn = p.fn ?? lastValid2d[i]
        return fn ? [{ index: i, fn, color: FUNCTION_COLORS[i] }] : []
      }),
    [parsed2d, lastValid2d],
  )
  const activeFnIndex = Math.max(
    0,
    fns2d.findIndex((f) => f.index === activeIndex),
  )

  const addFunction = () =>
    setExprs2d((list) => addExpr(list, PRESETS_2D[list.length % PRESETS_2D.length]))
  const removeFunction = (i: number) => {
    setExprs2d((list) => removeExpr(list, i))
    setLastValid2d((list) => list.filter((_, j) => j !== i))
    setActiveIndex((a) => (i < a ? a - 1 : i === a ? 0 : a))
  }

  const [x, setX] = useAnimatedX(effRange, !isParametric && playing, speed)
  const [t, setT] = useAnimatedX(tRange, isParametric && playing, speed)
  const currentParametricPresetIndex = PRESETS_PARAMETRIC.findIndex(
    (p) =>
      p.xt === xtExpr && p.yt === ytExpr && p.tRange[0] === tRange[0] && p.tRange[1] === tRange[1],
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
      ) : is3D ? (
        <>
          <div className="input-row">
            <span className="fn-label">f(x, y) =</span>
            <input
              className={parsed3d.error ? 'fn-input invalid' : 'fn-input'}
              value={expr3d}
              onChange={(e) => setExpr3d(e.target.value)}
              spellCheck={false}
              placeholder="例: sin(x) * cos(y)"
            />
            <select
              className="preset-select"
              value={PRESETS_3D.includes(expr3d) ? expr3d : ''}
              onChange={(e) => e.target.value && setExpr3d(e.target.value)}
            >
              <option value="" disabled>
                プリセット
              </option>
              {PRESETS_3D.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          {parsed3d.error && <p className="error-text">数式エラー: {parsed3d.error}</p>}
        </>
      ) : (
        <>
          {exprs2d.map((expr, i) => {
            const error = parsed2d[i].error
            return (
              <div key={i}>
                <div className="input-row">
                  <button
                    className={
                      i === activeIndex ? 'fn-label fn-select active' : 'fn-label fn-select'
                    }
                    style={{ color: FUNCTION_COLORS[i] }}
                    title="接線・面積の対象にする"
                    onClick={() => setActiveIndex(i)}
                  >
                    {exprs2d.length > 1 ? `f${i + 1}(x) =` : 'f(x) ='}
                  </button>
                  <input
                    className={error ? 'fn-input invalid' : 'fn-input'}
                    value={expr}
                    onChange={(e) => setExprs2d((list) => updateExpr(list, i, e.target.value))}
                    spellCheck={false}
                    placeholder="例: x^3/3 - 2x"
                  />
                  <select
                    className="preset-select"
                    value={PRESETS_2D.includes(expr) ? expr : ''}
                    onChange={(e) =>
                      e.target.value && setExprs2d((list) => updateExpr(list, i, e.target.value))
                    }
                  >
                    <option value="" disabled>
                      プリセット
                    </option>
                    {PRESETS_2D.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  {exprs2d.length > 1 && (
                    <button
                      className="fn-remove"
                      aria-label={`f${i + 1} を削除`}
                      onClick={() => removeFunction(i)}
                    >
                      ×
                    </button>
                  )}
                </div>
                {error && <p className="error-text">数式エラー: {error}</p>}
              </div>
            )
          })}
          <button
            className="fn-add"
            disabled={exprs2d.length >= MAX_FUNCTIONS}
            onClick={addFunction}
          >
            + 関数を追加
          </button>
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
      ) : is3D ? (
        fn3d && <View3D fn={fn3d} x={x} />
      ) : (
        fns2d.length > 0 && (
          <View2D
            fns={fns2d}
            activeIndex={activeFnIndex}
            mode={mode as 'derivative' | 'integral'}
            x={x}
            xRange={xRange}
            onXRangeChange={setXRange}
          />
        )
      )}

      <footer className="app-footer">
        使える記法: x^2, sin, cos, tan, exp, log, sqrt, pi, e など(math.js 構文)/
        グラフはドラッグで移動・ホイールでズーム
      </footer>
    </div>
  )
}
