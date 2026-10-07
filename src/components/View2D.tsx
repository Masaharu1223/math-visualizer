import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  cumulativeIntegralSamples,
  differentiate,
  interpolateSamples,
  sampleCountForWidth,
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

export interface FnEntry {
  fn: ParsedFunction
  color: string
}

interface View2DProps {
  fns: FnEntry[]
  /** 接線・面積塗り・f'' の対象にする fns の添字 */
  activeIndex: number
  mode: 'derivative' | 'integral'
  x: number
  xRange: [number, number]
  onXRangeChange: (range: [number, number]) => void
}

const fmt = (v: number) => (Number.isFinite(v) ? v.toFixed(2) : '—')

function safeDifferentiate(fn: ParsedFunction): ParsedFunction | null {
  try {
    return differentiate(fn)
  } catch {
    return null
  }
}

/**
 * 要素の幅(CSS px)を追跡する。グラフのサンプル密度を表示幅に合わせるために使う。
 * 計測対象は .view2d ルートなので、パネルが横に並ぶ場合の実効密度はこれより低くなる(点が多めになるだけで害はない)
 */
function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

export function View2D({ fns, activeIndex, mode, x, xRange, onXRangeChange }: View2DProps) {
  const [xmin, xmax] = xRange
  const [rootRef, width] = useElementWidth<HTMLDivElement>()
  const n = sampleCountForWidth(width)
  const [showSecond, setShowSecond] = useState(false)
  const [integralFrom, setIntegralFrom] = useState(0)
  const multi = fns.length > 1
  const sub = (name: string, i: number) => (multi ? `${name}_{${i + 1}}` : name)

  // フックはループ内で呼べないので、全関数のサンプルを1つの useMemo で計算する
  const data = useMemo(
    () =>
      fns.map(({ fn }, i) => {
        const fEval = (v: number) => fn.eval({ x: v })
        const df = mode === 'derivative' ? safeDifferentiate(fn) : null
        const d2f = df && i === activeIndex && showSecond ? safeDifferentiate(df) : null
        return {
          fSamples: sampleFunction(fEval, xmin, xmax, n),
          df,
          dfSamples: df ? sampleFunction((v) => df.eval({ x: v }), xmin, xmax, n) : null,
          d2f,
          d2fSamples: d2f ? sampleFunction((v) => d2f.eval({ x: v }), xmin, xmax, n) : null,
          FSamples:
            mode === 'integral'
              ? cumulativeIntegralSamples(fEval, integralFrom, xmin, xmax, n)
              : null,
        }
      }),
    [fns, activeIndex, showSecond, mode, integralFrom, xmin, xmax, n],
  )
  const fxs = fns.map(({ fn }) => fn.eval({ x }))
  const activeData = data[activeIndex]

  if (mode === 'derivative') {
    const slope = activeData.df ? activeData.df.eval({ x }) : NaN
    const topCurves: Curve[] = fns.map(({ color }, i) => ({
      samples: data[i].fSamples,
      color,
    }))
    const topMarkers: Marker[] = fns.map(({ color }, i) => ({
      x,
      y: fxs[i],
      color,
    }))
    const bottomCurves: Curve[] = []
    const bottomMarkers: Marker[] = []
    fns.forEach(({ color }, i) => {
      const { df, dfSamples, d2f, d2fSamples } = data[i]
      if (df && dfSamples) {
        bottomCurves.push({ samples: dfSamples, color })
        bottomMarkers.push({ x, y: df.eval({ x }), color })
      }
      if (d2f && d2fSamples) {
        bottomCurves.push({
          samples: d2fSamples,
          color: COLOR_D2F,
          width: 2,
          dim: true,
        })
        bottomMarkers.push({ x, y: d2f.eval({ x }), color: COLOR_D2F })
      }
    })
    return (
      <div className="view2d" ref={rootRef}>
        <div className="panel">
          {fns.map(({ fn, color }, i) => (
            <div className={i === 0 ? 'panel-head' : 'panel-head sub'} key={i}>
              <Formula tex={`${sub('f', i)}(x) = ${fn.latex}`} color={color} />
              <span className="value-badge" style={{ color }}>
                f{multi ? `${i + 1}` : ''}({x.toFixed(2)}) = {fmt(fxs[i])}
              </span>
            </div>
          ))}
          <Graph2D
            curves={topCurves}
            markers={topMarkers}
            tangent={
              Number.isFinite(slope)
                ? { x, y: fxs[activeIndex], slope, color: COLOR_TANGENT }
                : null
            }
            connectorX={x}
            xRange={xRange}
            onXRangeChange={onXRangeChange}
          />
        </div>
        <div className="panel">
          {fns.map(({ color }, i) => {
            const { df } = data[i]
            return (
              <div className={i === 0 ? 'panel-head' : 'panel-head sub'} key={i}>
                {df ? (
                  <>
                    <Formula tex={`${sub("f'", i)}(x) = ${df.latex}`} color={color} />
                    <span className="value-badge" style={{ color }}>
                      f{multi ? `${i + 1}` : ''}'({x.toFixed(2)}) = {fmt(df.eval({ x }))}
                      (接線の傾き)
                    </span>
                  </>
                ) : (
                  <span className="error-text">
                    {multi ? `f${i + 1}: ` : ''}
                    この関数は記号微分できませんでした
                  </span>
                )}
              </div>
            )
          })}
          {activeData.df && (
            <div className="panel-head sub">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={showSecond}
                  onChange={(e) => setShowSecond(e.target.checked)}
                />
                <span style={{ color: COLOR_D2F }}>
                  {multi ? `f${activeIndex + 1}''(x)` : "f''(x)"} も表示
                </span>
              </label>
            </div>
          )}
          {bottomCurves.length > 0 && (
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
  const Fxs = data.map(({ FSamples }) => (FSamples ? interpolateSamples(FSamples, x) : NaN))
  const Fx = Fxs[activeIndex]
  const fx = fxs[activeIndex]
  return (
    <div className="view2d" ref={rootRef}>
      <div className="panel">
        {fns.map(({ fn, color }, i) => (
          <div className={i === 0 ? 'panel-head' : 'panel-head sub'} key={i}>
            <Formula tex={`${sub('f', i)}(x) = ${fn.latex}`} color={color} />
            {i === activeIndex && (
              <span className="value-badge" style={{ color: COLOR_DF }}>
                塗りつぶし面積(符号付き)= {fmt(Fx)}
              </span>
            )}
            {i === 0 && (
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
            )}
          </div>
        ))}
        <Graph2D
          curves={fns.map(({ color }, i) => ({
            samples: data[i].fSamples,
            color,
          }))}
          markers={fns.map(({ color }, i) => ({ x, y: fxs[i], color }))}
          area={{
            samples: activeData.fSamples,
            from: integralFrom,
            to: x,
            color: 'rgba(77, 217, 255, 0.22)',
          }}
          connectorX={x}
          xRange={xRange}
          onXRangeChange={onXRangeChange}
        />
      </div>
      <div className="panel">
        {fns.map(({ color }, i) => (
          <div className={i === 0 ? 'panel-head' : 'panel-head sub'} key={i}>
            <Formula
              tex={`${sub('F', i)}(x) = \\int_{${integralFrom.toFixed(1)}}^{x} ${sub('f', i)}(t)\\, dt`}
              color={color}
            />
            <span className="value-badge" style={{ color }}>
              F{multi ? `${i + 1}` : ''}({x.toFixed(2)}) = {fmt(Fxs[i])}
            </span>
            {i === 0 && (
              <span className="hint-text">
                黄色の接線の傾き = {multi ? `f${activeIndex + 1}` : 'f'}
                (x)(微積分学の基本定理)
              </span>
            )}
          </div>
        ))}
        <Graph2D
          curves={fns.flatMap(({ color }, i) => {
            const { FSamples } = data[i]
            return FSamples ? [{ samples: FSamples, color, upToX: x }] : []
          })}
          markers={fns.map(({ color }, i) => ({ x, y: Fxs[i], color }))}
          tangent={
            Number.isFinite(Fx) && Number.isFinite(fx)
              ? { x, y: Fx, slope: fx, color: COLOR_TANGENT }
              : null
          }
          connectorX={x}
          xRange={xRange}
          onXRangeChange={onXRangeChange}
        />
      </div>
    </div>
  )
}
