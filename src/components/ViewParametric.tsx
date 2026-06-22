import { useEffect, useMemo, useState } from 'react'
import {
  finiteSampleXRange,
  finiteSampleYRange,
  parseParametricCurve,
  sampleParametricCurve,
} from '../math/engine'
import { Formula } from './Formula'
import { Graph2D } from './Graph2D'
import { COLOR_DF, COLOR_F } from './View2D'

interface ViewParametricProps {
  xtExpr: string
  ytExpr: string
  tRange: [number, number]
}

const fmt = (v: number) => parseFloat(v.toFixed(2)).toString()

export function ViewParametric({ xtExpr, ytExpr, tRange }: ViewParametricProps) {
  const parsed = useMemo(() => {
    try {
      return { curve: parseParametricCurve(xtExpr, ytExpr), error: null as string | null }
    } catch (e) {
      return { curve: null, error: e instanceof Error ? e.message : String(e) }
    }
  }, [xtExpr, ytExpr])

  const samples = useMemo(
    () => (parsed.curve ? sampleParametricCurve(parsed.curve, tRange[0], tRange[1]) : null),
    [parsed.curve, tRange],
  )
  const autoXRange = useMemo<[number, number]>(
    () => (samples ? finiteSampleXRange(samples) : [-1, 1]),
    [samples],
  )
  const autoYRange = useMemo<[number, number]>(
    () => (samples ? finiteSampleYRange(samples) : [-1, 1]),
    [samples],
  )
  const [xRange, setXRange] = useState<[number, number]>(autoXRange)
  const [yRange, setYRange] = useState<[number, number]>(autoYRange)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset viewport when the parsed curve changes
    setXRange(autoXRange)
    setYRange(autoYRange)
  }, [autoXRange, autoYRange])

  return (
    <div className="view-parametric">
      <div className="panel parametric-panel">
        <div className="panel-head parametric-head">
          {parsed.curve ? (
            <>
              <Formula tex={`x(t) = ${parsed.curve.x.latex}`} color={COLOR_F} />
              <Formula tex={`y(t) = ${parsed.curve.y.latex}`} color={COLOR_DF} />
              <span className="value-badge">
                {`${fmt(tRange[0])} <= t <= ${fmt(tRange[1])}`}
              </span>
            </>
          ) : (
            <span className="error-text">数式エラー: {parsed.error}</span>
          )}
        </div>
        {samples ? (
          <Graph2D
            curves={[{ samples, color: COLOR_F }]}
            xRange={xRange}
            yRange={yRange}
            preserveAspect
            onXRangeChange={setXRange}
            onYRangeChange={setYRange}
          />
        ) : (
          <div className="parametric-empty">有効な x(t), y(t) を入力してください</div>
        )}
      </div>
    </div>
  )
}
