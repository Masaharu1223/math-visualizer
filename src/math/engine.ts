import * as mathjs from 'mathjs'
import type { MathNode } from 'mathjs'

const ns = mathjs as unknown as Record<string, unknown>

export interface ParsedFunction {
  source: string
  node: MathNode
  latex: string
  eval: (scope: Record<string, number>) => number
}

export interface Samples {
  xs: Float64Array
  ys: Float64Array
}

function fromNode(node: MathNode, allowedVars: string[]): ParsedFunction {
  // 未知のシンボルは評価時の NaN ではなくパース時にエラーにする
  node.traverse((n, _path, parent) => {
    if (!mathjs.isSymbolNode(n)) return
    const name = n.name
    if (allowedVars.includes(name)) return
    if (mathjs.isFunctionNode(parent) && parent.fn === n) {
      if (ns[name] === undefined) throw new Error(`未知の関数です: ${name}`)
      return
    }
    if (ns[name] === undefined) throw new Error(`未知の変数です: ${name}`)
  })
  const compiled = node.compile()
  return {
    source: node.toString(),
    node,
    latex: node.toTex({ parenthesis: 'auto' }),
    eval: (scope) => {
      try {
        const v: unknown = compiled.evaluate(scope)
        return typeof v === 'number' && Number.isFinite(v) ? v : NaN
      } catch {
        return NaN
      }
    },
  }
}

export function parseFunction(input: string, allowedVars: string[] = ['x']): ParsedFunction {
  if (!input.trim()) throw new Error('数式を入力してください')
  return fromNode(mathjs.parse(input), allowedVars)
}

export function differentiate(
  fn: ParsedFunction,
  variable = 'x',
  allowedVars: string[] = ['x', 'y'],
): ParsedFunction {
  const d = mathjs.derivative(fn.node, variable)
  let node: MathNode = d
  try {
    node = mathjs.simplify(d)
  } catch {
    node = d
  }
  return fromNode(node, allowedVars)
}

export function sampleFunction(
  f: (x: number) => number,
  xmin: number,
  xmax: number,
  n = 600,
): Samples {
  const xs = new Float64Array(n + 1)
  const ys = new Float64Array(n + 1)
  const dx = (xmax - xmin) / n
  for (let i = 0; i <= n; i++) {
    const x = xmin + dx * i
    xs[i] = x
    ys[i] = f(x)
  }
  return { xs, ys }
}

export function interpolateSamples(s: Samples, x: number): number {
  const { xs, ys } = s
  const n = xs.length
  if (n === 0 || x < xs[0] || x > xs[n - 1]) return NaN
  let lo = 0
  let hi = n - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (xs[mid] <= x) lo = mid
    else hi = mid
  }
  const t = (x - xs[lo]) / (xs[hi] - xs[lo] || 1)
  return ys[lo] + t * (ys[hi] - ys[lo])
}

const finiteOrZero = (f: (x: number) => number, x: number): number => {
  const y = f(x)
  return Number.isFinite(y) ? y : 0
}

/** 合成シンプソン則による数値積分(特異点は 0 として扱う) */
export function integrate(f: (x: number) => number, a: number, b: number, n = 400): number {
  if (a === b) return 0
  if (n % 2 === 1) n++
  const h = (b - a) / n
  let sum = finiteOrZero(f, a) + finiteOrZero(f, b)
  for (let i = 1; i < n; i++) {
    sum += finiteOrZero(f, a + h * i) * (i % 2 === 0 ? 2 : 4)
  }
  return (sum * h) / 3
}

/** F(x) = ∫_a^x f(t) dt を [xmin, xmax] 上にサンプリング(台形則の累積) */
export function cumulativeIntegralSamples(
  f: (x: number) => number,
  a: number,
  xmin: number,
  xmax: number,
  n = 600,
): Samples {
  const xs = new Float64Array(n + 1)
  const ys = new Float64Array(n + 1)
  const dx = (xmax - xmin) / n
  let acc = integrate(f, a, xmin)
  let prev = finiteOrZero(f, xmin)
  xs[0] = xmin
  ys[0] = acc
  for (let i = 1; i <= n; i++) {
    const x = xmin + dx * i
    const cur = finiteOrZero(f, x)
    acc += ((prev + cur) / 2) * dx
    xs[i] = x
    ys[i] = acc
    prev = cur
  }
  return { xs, ys }
}
