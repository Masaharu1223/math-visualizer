import { useEffect, useRef } from 'react'
import type { Samples } from '../math/engine'

export interface Curve {
  samples: Samples
  color: string
  width?: number
  /** この x まで部分的に描画(積分の累積アニメーション用) */
  upToX?: number
  /** 補助曲線として薄く描画 */
  dim?: boolean
}

export interface Marker {
  x: number
  y: number
  color: string
}

export interface TangentLine {
  x: number
  y: number
  slope: number
  color: string
}

export interface AreaFill {
  samples: Samples
  from: number
  to: number
  color: string
}

interface Graph2DProps {
  curves: Curve[]
  markers?: Marker[]
  tangent?: TangentLine | null
  area?: AreaFill | null
  xRange: [number, number]
  /** マーカー位置を示す縦の破線 */
  connectorX?: number
  height?: number
  onXRangeChange?: (range: [number, number]) => void
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

function niceStep(raw: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(raw)))
  const r = raw / p
  if (r < 1.5) return p
  if (r < 3.5) return 2 * p
  if (r < 7.5) return 5 * p
  return 10 * p
}

/** 漸近線で表示が潰れないよう、2%〜98% 分位で y 範囲を決める(0 は常に含める) */
function fitYRange(curves: Curve[], area?: AreaFill | null): [number, number] {
  const vals: number[] = []
  const push = (s: Samples) => {
    for (let i = 0; i < s.ys.length; i++) {
      const y = s.ys[i]
      if (Number.isFinite(y)) vals.push(y)
    }
  }
  for (const c of curves) push(c.samples)
  if (area) push(area.samples)
  if (vals.length === 0) return [-1, 1]
  vals.sort((a, b) => a - b)
  const q = (t: number) => vals[clamp(Math.floor(t * (vals.length - 1)), 0, vals.length - 1)]
  let min = Math.min(q(0.02), 0)
  let max = Math.max(q(0.98), 0)
  if (max - min < 1e-6) {
    min -= 1
    max += 1
  }
  const pad = (max - min) * 0.15
  return [min - pad, max + pad]
}

function strokeLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
}

function arrowHead(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number) {
  const s = 7
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x - s * Math.cos(angle - 0.4), y - s * Math.sin(angle - 0.4))
  ctx.lineTo(x - s * Math.cos(angle + 0.4), y - s * Math.sin(angle + 0.4))
  ctx.closePath()
  ctx.fill()
}

function drawCurve(
  ctx: CanvasRenderingContext2D,
  c: Curve,
  sx: (x: number) => number,
  sy: (y: number) => number,
  h: number,
) {
  const { xs, ys } = c.samples
  ctx.lineWidth = c.width ?? 3
  ctx.strokeStyle = c.color
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.globalAlpha = c.dim ? 0.5 : 1
  if (!c.dim) {
    ctx.shadowColor = c.color
    ctx.shadowBlur = 6
  }
  ctx.beginPath()
  let started = false
  let prevPy = 0
  for (let i = 0; i < xs.length; i++) {
    if (c.upToX != null && xs[i] > c.upToX) {
      // 末端をちょうど upToX まで補間して滑らかに止める
      if (started && i > 0 && Number.isFinite(ys[i]) && Number.isFinite(ys[i - 1])) {
        const t = (c.upToX - xs[i - 1]) / (xs[i] - xs[i - 1] || 1)
        ctx.lineTo(sx(c.upToX), sy(ys[i - 1] + t * (ys[i] - ys[i - 1])))
      }
      break
    }
    const y = ys[i]
    if (!Number.isFinite(y)) {
      started = false
      continue
    }
    const px = sx(xs[i])
    const py = sy(y)
    if (py < -2 * h || py > 3 * h) {
      // 漸近線対策: 画面外遠方では線を切る
      started = false
      prevPy = py
      continue
    }
    if (started && Math.abs(py - prevPy) > h * 1.5) {
      ctx.stroke()
      ctx.beginPath()
      started = false
    }
    if (!started) {
      ctx.moveTo(px, py)
      started = true
    } else {
      ctx.lineTo(px, py)
    }
    prevPy = py
  }
  ctx.stroke()
  ctx.shadowBlur = 0
  ctx.globalAlpha = 1
}

function draw(canvas: HTMLCanvasElement, props: Graph2DProps) {
  const { curves, markers = [], tangent, area, xRange, connectorX } = props
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = canvas.clientWidth
  const h = canvas.clientHeight
  if (w === 0 || h === 0) return
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)

  const [xmin, xmax] = xRange
  const [ymin, ymax] = fitYRange(curves, area)
  const kx = w / (xmax - xmin)
  const ky = h / (ymax - ymin)
  const sx = (x: number) => (x - xmin) * kx
  const sy = (y: number) => h - (y - ymin) * ky

  // グリッド
  const xstep = niceStep((xmax - xmin) / 8)
  const ystep = niceStep((ymax - ymin) / 6)
  ctx.lineWidth = 1
  ctx.strokeStyle = 'rgba(140, 150, 180, 0.10)'
  for (let gx = Math.ceil(xmin / xstep) * xstep; gx <= xmax; gx += xstep) {
    strokeLine(ctx, sx(gx), 0, sx(gx), h)
  }
  for (let gy = Math.ceil(ymin / ystep) * ystep; gy <= ymax; gy += ystep) {
    strokeLine(ctx, 0, sy(gy), w, sy(gy))
  }

  // 軸(原点を通る、矢印付き)
  const axisColor = '#8e94a8'
  ctx.strokeStyle = axisColor
  ctx.fillStyle = axisColor
  ctx.lineWidth = 1.6
  const oy = clamp(sy(0), 1, h - 1)
  const ox = clamp(sx(0), 1, w - 1)
  strokeLine(ctx, 0, oy, w - 8, oy)
  arrowHead(ctx, w - 1, oy, 0)
  strokeLine(ctx, ox, h, ox, 8)
  arrowHead(ctx, ox, 1, -Math.PI / 2)

  // 目盛りとラベル
  ctx.font = '11px ui-monospace, monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillStyle = 'rgba(180, 188, 210, 0.7)'
  const fmt = (v: number) => (Math.abs(v) < 1e-9 ? '0' : parseFloat(v.toPrecision(4)).toString())
  for (let gx = Math.ceil(xmin / xstep) * xstep; gx <= xmax; gx += xstep) {
    if (Math.abs(gx) < xstep / 2) continue
    ctx.strokeStyle = axisColor
    strokeLine(ctx, sx(gx), oy - 4, sx(gx), oy + 4)
    ctx.fillText(fmt(gx), sx(gx), Math.min(oy + 7, h - 13))
  }
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  for (let gy = Math.ceil(ymin / ystep) * ystep; gy <= ymax; gy += ystep) {
    if (Math.abs(gy) < ystep / 2) continue
    strokeLine(ctx, ox - 4, sy(gy), ox + 4, sy(gy))
    ctx.fillText(fmt(gy), Math.max(ox - 8, 26), sy(gy))
  }

  // 面積(積分モード)
  if (area) {
    const { xs, ys } = area.samples
    const lo = Math.min(area.from, area.to)
    const hi = Math.max(area.from, area.to)
    ctx.beginPath()
    let started = false
    for (let i = 0; i < xs.length; i++) {
      if (xs[i] < lo || xs[i] > hi || !Number.isFinite(ys[i])) continue
      const px = sx(xs[i])
      const py = clamp(sy(ys[i]), -h, 2 * h)
      if (!started) {
        ctx.moveTo(px, sy(0))
        ctx.lineTo(px, py)
        started = true
      } else {
        ctx.lineTo(px, py)
      }
    }
    if (started) {
      ctx.lineTo(sx(Math.min(hi, xs[xs.length - 1])), sy(0))
      ctx.closePath()
      ctx.fillStyle = area.color
      ctx.fill()
    }
  }

  // 曲線
  for (const c of curves) drawCurve(ctx, c, sx, sy, h)

  // 接線
  if (
    tangent &&
    Number.isFinite(tangent.y) &&
    Number.isFinite(tangent.slope)
  ) {
    const px = sx(tangent.x)
    const py = sy(tangent.y)
    let dx = kx
    let dy = -tangent.slope * ky
    const len = Math.hypot(dx, dy) || 1
    dx /= len
    dy /= len
    const half = 130
    ctx.strokeStyle = tangent.color
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.shadowColor = tangent.color
    ctx.shadowBlur = 8
    strokeLine(ctx, px - dx * half, py - dy * half, px + dx * half, py + dy * half)
    ctx.shadowBlur = 0
  }

  // マーカー位置の縦破線
  if (connectorX != null) {
    ctx.save()
    ctx.setLineDash([3, 6])
    ctx.strokeStyle = 'rgba(200, 205, 225, 0.4)'
    ctx.lineWidth = 1.4
    strokeLine(ctx, sx(connectorX), 0, sx(connectorX), h)
    ctx.restore()
  }

  // マーカー(グロー付きの点)
  for (const m of markers) {
    if (!Number.isFinite(m.y)) continue
    const px = sx(m.x)
    const py = sy(m.y)
    ctx.globalAlpha = 0.25
    ctx.fillStyle = m.color
    ctx.beginPath()
    ctx.arc(px, py, 13, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.shadowColor = m.color
    ctx.shadowBlur = 14
    ctx.beginPath()
    ctx.arc(px, py, 6.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(px, py, 3, 0, Math.PI * 2)
    ctx.fill()
  }
}

export function Graph2D(props: Graph2DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const propsRef = useRef(props)
  propsRef.current = props
  const dragRef = useRef<{ startX: number; range: [number, number] } | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas) draw(canvas, props)
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ro = new ResizeObserver(() => draw(canvas, propsRef.current))
    ro.observe(canvas)

    const onWheel = (e: WheelEvent) => {
      const p = propsRef.current
      if (!p.onXRangeChange) return
      e.preventDefault()
      const [xmin, xmax] = p.xRange
      const rect = canvas.getBoundingClientRect()
      const fx = (e.clientX - rect.left) / rect.width
      const cx = xmin + fx * (xmax - xmin)
      const scale = Math.exp(e.deltaY * 0.0015)
      const span = clamp((xmax - xmin) * scale, 0.5, 200)
      p.onXRangeChange([cx - fx * span, cx + (1 - fx) * span])
    }
    const onDown = (e: PointerEvent) => {
      dragRef.current = { startX: e.clientX, range: propsRef.current.xRange }
      canvas.setPointerCapture(e.pointerId)
    }
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current
      const p = propsRef.current
      if (!d || !p.onXRangeChange) return
      const rect = canvas.getBoundingClientRect()
      const dx = ((e.clientX - d.startX) / rect.width) * (d.range[1] - d.range[0])
      p.onXRangeChange([d.range[0] - dx, d.range[1] - dx])
    }
    const onUp = () => {
      dragRef.current = null
    }

    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)
    return () => {
      ro.disconnect()
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="graph2d"
      style={props.height != null ? { height: props.height } : undefined}
    />
  )
}
