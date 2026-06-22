import { describe, expect, it } from 'vitest'
import {
  cumulativeIntegralSamples,
  differentiate,
  finiteSampleXRange,
  finiteSampleYRange,
  integrate,
  interpolateSamples,
  parseFunction,
  parseParametricCurve,
  sampleParametricCurve,
  sampleFunction,
} from './engine'

describe('parseFunction', () => {
  it('数式をパースして評価できる', () => {
    const f = parseFunction('x^3/3 - 2x')
    expect(f.eval({ x: 3 })).toBeCloseTo(3, 10) // 27/3 - 6 = 3
    expect(f.eval({ x: 0 })).toBeCloseTo(0, 10)
  })

  it('定数 pi / e を使える', () => {
    const f = parseFunction('sin(pi * x) + e')
    expect(f.eval({ x: 1 })).toBeCloseTo(Math.E, 10)
  })

  it('未知の変数はパース時にエラーになる', () => {
    expect(() => parseFunction('x + q')).toThrow(/未知の変数/)
  })

  it('未知の関数はパース時にエラーになる', () => {
    expect(() => parseFunction('foo(x)')).toThrow(/未知の関数/)
  })

  it('空文字はエラーになる', () => {
    expect(() => parseFunction('  ')).toThrow()
  })

  it('複素数や発散は NaN を返す', () => {
    const f = parseFunction('sqrt(x)')
    expect(f.eval({ x: -1 })).toBeNaN()
    const g = parseFunction('1/x')
    expect(g.eval({ x: 0 })).toBeNaN()
  })
})

describe('differentiate', () => {
  it('x^3/3 - 2x の導関数は x^2 - 2', () => {
    const f = parseFunction('x^3/3 - 2x')
    const d = differentiate(f)
    expect(d.eval({ x: 2 })).toBeCloseTo(2, 10)
    expect(d.eval({ x: 0 })).toBeCloseTo(-2, 10)
  })

  it('sin の導関数は cos', () => {
    const d = differentiate(parseFunction('sin(x)'))
    expect(d.eval({ x: 0 })).toBeCloseTo(1, 10)
    expect(d.eval({ x: Math.PI })).toBeCloseTo(-1, 10)
  })

  it('偏微分できる', () => {
    const f = parseFunction('x^2 * y', ['x', 'y'])
    const fx = differentiate(f, 'x')
    const fy = differentiate(f, 'y')
    expect(fx.eval({ x: 3, y: 2 })).toBeCloseTo(12, 10) // 2xy
    expect(fy.eval({ x: 3, y: 2 })).toBeCloseTo(9, 10) // x^2
  })

  it('2 階微分できる', () => {
    const f = parseFunction('x^4')
    const d2 = differentiate(differentiate(f))
    expect(d2.eval({ x: 2 })).toBeCloseTo(48, 10) // 12x^2
  })
})

describe('integrate', () => {
  it('∫0→π sin(x) dx = 2', () => {
    const f = parseFunction('sin(x)')
    expect(integrate((x) => f.eval({ x }), 0, Math.PI)).toBeCloseTo(2, 6)
  })

  it('積分区間を逆にすると符号が反転する', () => {
    const f = (x: number) => x * x
    expect(integrate(f, 2, 0)).toBeCloseTo(-8 / 3, 6)
  })
})

describe('cumulativeIntegralSamples / interpolateSamples', () => {
  it('F(x) = ∫0→x t dt = x^2/2 になる', () => {
    const F = cumulativeIntegralSamples((x) => x, 0, -2, 2)
    expect(interpolateSamples(F, 1)).toBeCloseTo(0.5, 2)
    expect(interpolateSamples(F, -2)).toBeCloseTo(2, 2)
    expect(interpolateSamples(F, 2)).toBeCloseTo(2, 2)
    expect(interpolateSamples(F, 0)).toBeCloseTo(0, 2)
  })

  it('範囲外の補間は NaN', () => {
    const s = sampleFunction((x) => x, 0, 1, 10)
    expect(interpolateSamples(s, 2)).toBeNaN()
  })
})

describe('parametric curves', () => {
  it('x(t), y(t) をパースして評価できる', () => {
    const curve = parseParametricCurve('cos(t)', 'sin(t)')
    expect(curve.eval(0).x).toBeCloseTo(1, 10)
    expect(curve.eval(0).y).toBeCloseTo(0, 10)
    expect(curve.eval(Math.PI / 2).x).toBeCloseTo(0, 10)
    expect(curve.eval(Math.PI / 2).y).toBeCloseTo(1, 10)
  })

  it('t 以外の未知変数はパース時にエラーになる', () => {
    expect(() => parseParametricCurve('x + t', 'sin(t)')).toThrow(/未知の変数/)
  })

  it('曲線を t 範囲でサンプリングできる', () => {
    const curve = parseParametricCurve('t', 't^2')
    const samples = sampleParametricCurve(curve, -1, 1, 4)
    expect(samples.xs).toHaveLength(5)
    expect(samples.ys).toHaveLength(5)
    expect(samples.xs[0]).toBeCloseTo(-1, 10)
    expect(samples.ys[0]).toBeCloseTo(1, 10)
    expect(samples.xs[2]).toBeCloseTo(0, 10)
    expect(samples.ys[2]).toBeCloseTo(0, 10)
    expect(samples.xs[4]).toBeCloseTo(1, 10)
    expect(samples.ys[4]).toBeCloseTo(1, 10)
  })

  it('非有限な点は NaN として曲線を切れる', () => {
    const curve = parseParametricCurve('1 / (t - 1)', 't')
    const samples = sampleParametricCurve(curve, 0, 2, 2)
    expect(samples.xs[1]).toBeNaN()
    expect(samples.ys[1]).toBeNaN()
  })

  it('有限な x 座標から描画範囲を計算できる', () => {
    const curve = parseParametricCurve('cos(t)', 'sin(t)')
    const samples = sampleParametricCurve(curve, 0, Math.PI * 2, 200)
    const [xmin, xmax] = finiteSampleXRange(samples)
    const [ymin, ymax] = finiteSampleYRange(samples)
    expect(xmin).toBeLessThan(-1)
    expect(xmax).toBeGreaterThan(1)
    expect(ymin).toBeLessThan(-1)
    expect(ymax).toBeGreaterThan(1)
  })

  it('有限でも巨大な外れ値を表示範囲にそのまま採用しない', () => {
    const curve = parseParametricCurve('tan(t)', 'sin(t)')
    const samples = sampleParametricCurve(curve, 0, Math.PI, 400)
    const [xmin, xmax] = finiteSampleXRange(samples)
    expect(xmin).toBeGreaterThan(-1000)
    expect(xmax).toBeLessThan(1000)
  })
})
