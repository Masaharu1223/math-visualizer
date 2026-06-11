import { useCallback, useMemo, useState } from 'react'
import {
  cumulativeIntegralSamples,
  differentiate,
  interpolateSamples,
  sampleFunction,
} from '../math/engine'
import type { ParsedFunction } from '../math/engine'
import { Formula } from './Formula'
import { Graph2D } from './Graph2D'
import type { Curve, Marker } from './Graph2D'

export const COLOR_F = '#ff2e63'
export const COLOR_DF = '#4dd9ff'
export const COLOR_TANGENT = '#ffe14d'
export const COLOR_D2F = '#b07cff'

interface View2DProps {
  fn: ParsedFunction
  mode: 'derivative' | 'integral'
  x: number
  xRange: [number, number]
  onXRangeChange: (range: [number, number]) => void
}

const fmt = (v: number) => (Number.isFinite(v) ? v.toFixed(2) : '—')

function useSafeDerivative(fn: ParsedFunction | null): ParsedFunction | null {
  return useMemo(() => {
    if (!fn) return null
    try {
      return differentiate(fn)
    } catch {
      return null
    }
  }, [fn])
}

export function View2D({ fn, mode, x, xRange, onXRangeChange }: View2DProps) {
  const [xmin, xmax] = xRange
  const fEval = useCallback((v: number) => fn.eval({ x: v }), [fn])
  const fSamples = useMemo(() => sampleFunction(fEval, xmin, xmax), [fEval, xmin, xmax])
  const fx = fn.eval({ x })

  const df = useSafeDerivative(mode === 'derivative' ? fn : null)
  const d2f = useSafeDerivative(df)
  const [showSecond, setShowSecond] = useState(false)
  const [integralFrom, setIntegralFrom] = useState(0)

  const dfSamples = useMemo(
    () => (df ? sampleFunction((v) => df.eval({ x: v }), xmin, xmax) : null),
    [df, xmin, xmax],
  )
  const d2fSamples = useMemo(
    () =>
      d2f && showSecond ? sampleFunction((v) => d2f.eval({ x: v }), xmin, xmax) : null,
    [d2f, showSecond, xmin, xmax],
  )
  const FSamples = useMemo(
    () =>
      mode === 'integral' ? cumulativeIntegralSamples(fEval, integralFrom, xmin, xmax) : null,
    [mode, fEval, integralFrom, xmin, xmax],
  )

  if (mode === 'derivative') {
    const slope = df ? df.eval({ x }) : NaN
    const bottomCurves: Curve[] = []
    const bottomMarkers: Marker[] = []
    if (dfSamples) {
      bottomCurves.push({ samples: dfSamples, color: COLOR_DF })
      bottomMarkers.push({ x, y: slope, color: COLOR_DF })
    }
    if (d2fSamples && d2f) {
      bottomCurves.push({ samples: d2fSamples, color: COLOR_D2F, width: 2, dim: true })
      bottomMarkers.push({ x, y: d2f.eval({ x }), color: COLOR_D2F })
    }
    return (
      <div className="view2d">
        <div className="panel">
          <div className="panel-head">
            <Formula tex={`f(x) = ${fn.latex}`} color={COLOR_F} />
            <span className="value-badge" style={{ color: COLOR_F }}>
              f({x.toFixed(2)}) = {fmt(fx)}
            </span>
          </div>
          <Graph2D
            curves={[{ samples: fSamples, color: COLOR_F }]}
            markers={[{ x, y: fx, color: COLOR_F }]}
            tangent={Number.isFinite(slope) ? { x, y: fx, slope, color: COLOR_TANGENT } : null}
            connectorX={x}
            xRange={xRange}
            onXRangeChange={onXRangeChange}
          />
        </div>
        <div className="panel">
          <div className="panel-head">
            {df ? (
              <>
                <Formula tex={`f'(x) = ${df.latex}`} color={COLOR_DF} />
                <span className="value-badge" style={{ color: COLOR_DF }}>
                  f'({x.toFixed(2)}) = {fmt(slope)}(接線の傾き)
                </span>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={showSecond}
                    onChange={(e) => setShowSecond(e.target.checked)}
                  />
                  <span style={{ color: COLOR_D2F }}>f''(x) も表示</span>
                </label>
              </>
            ) : (
              <span className="error-text">この関数は記号微分できませんでした</span>
            )}
          </div>
          {dfSamples && (
            <Graph2D
              curves={bottomCurves}
              markers={bottomMarkers}
              connectorX={x}
              xRange={xRange}
              onXRangeChange={onXRangeChange}
            />
          )}
        </div>
      </div>
    )
  }

  // 積分モード
  const Fx = FSamples ? interpolateSamples(FSamples, x) : NaN
  return (
    <div className="view2d">
      <div className="panel">
        <div className="panel-head">
          <Formula tex={`f(x) = ${fn.latex}`} color={COLOR_F} />
          <span className="value-badge" style={{ color: COLOR_DF }}>
            塗りつぶし面積(符号付き)= {fmt(Fx)}
          </span>
          <label className="toggle">
            下限 a = {integralFrom.toFixed(1)}
            <input
              type="range"
              min={xmin}
              max={xmax}
              step={0.1}
              value={integralFrom}
              onChange={(e) => setIntegralFrom(Number(e.target.value))}
            />
          </label>
        </div>
        <Graph2D
          curves={[{ samples: fSamples, color: COLOR_F }]}
          markers={[{ x, y: fx, color: COLOR_F }]}
          area={{ samples: fSamples, from: integralFrom, to: x, color: 'rgba(77, 217, 255, 0.22)' }}
          connectorX={x}
          xRange={xRange}
          onXRangeChange={onXRangeChange}
        />
      </div>
      <div className="panel">
        <div className="panel-head">
          <Formula
            tex={`F(x) = \\int_{${integralFrom.toFixed(1)}}^{x} f(t)\\, dt`}
            color={COLOR_DF}
          />
          <span className="value-badge" style={{ color: COLOR_DF }}>
            F({x.toFixed(2)}) = {fmt(Fx)}
          </span>
          <span className="hint-text">黄色の接線の傾き = f(x)(微積分学の基本定理)</span>
        </div>
        {FSamples && (
          <Graph2D
            curves={[{ samples: FSamples, color: COLOR_DF, upToX: x }]}
            markers={[{ x, y: Fx, color: COLOR_DF }]}
            tangent={
              Number.isFinite(Fx) && Number.isFinite(fx)
                ? { x, y: Fx, slope: fx, color: COLOR_TANGENT }
                : null
            }
            connectorX={x}
            xRange={xRange}
            onXRangeChange={onXRangeChange}
          />
        )}
      </div>
    </div>
  )
}
