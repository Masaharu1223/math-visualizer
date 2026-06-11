import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { differentiate } from '../math/engine'
import type { ParsedFunction } from '../math/engine'
import { Formula } from './Formula'
import { COLOR_DF, COLOR_F, COLOR_TANGENT } from './View2D'

export const DOMAIN_3D = 3
const SEG = 96
const ZMAX = 4
const C_LOW = new THREE.Color('#1f7fae')
const C_HIGH = new THREE.Color(COLOR_F)

interface View3DProps {
  fn: ParsedFunction
  x: number
}

interface SceneRefs {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  controls: OrbitControls
  surfaceMesh: THREE.Mesh
  wireMesh: THREE.Mesh
  pathLine: THREE.Line
  point: THREE.Mesh
  halo: THREE.Mesh
  arrow: THREE.ArrowHelper
  plane: THREE.Mesh
  raf: number
}

const clampZ = (z: number) => Math.max(-ZMAX, Math.min(ZMAX, z))
const fmt = (v: number) => (Number.isFinite(v) ? v.toFixed(2) : '—')

/** 数学座標 (x, y, z=f) を three.js 座標 (x, 上方向 = z, 奥行き = y) に対応させる */
function buildSurfaceGeometry(fn: ParsedFunction): THREE.PlaneGeometry {
  const geo = new THREE.PlaneGeometry(2 * DOMAIN_3D, 2 * DOMAIN_3D, SEG, SEG)
  const pos = geo.attributes.position as THREE.BufferAttribute
  const count = pos.count
  const mxs = new Float32Array(count)
  const mys = new Float32Array(count)
  const zs = new Float32Array(count)
  let zmin = Infinity
  let zmax = -Infinity
  for (let i = 0; i < count; i++) {
    const mx = pos.getX(i)
    const my = pos.getY(i)
    let z = fn.eval({ x: mx, y: my })
    if (!Number.isFinite(z)) z = 0
    z = clampZ(z)
    mxs[i] = mx
    mys[i] = my
    zs[i] = z
    if (z < zmin) zmin = z
    if (z > zmax) zmax = z
  }
  const colors = new Float32Array(count * 3)
  const c = new THREE.Color()
  for (let i = 0; i < count; i++) {
    pos.setXYZ(i, mxs[i], zs[i], mys[i])
    const t = (zs[i] - zmin) / Math.max(zmax - zmin, 1e-6)
    c.lerpColors(C_LOW, C_HIGH, t)
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.computeVertexNormals()
  return geo
}

export function View3D({ fn, x }: View3DProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const refs = useRef<SceneRefs | null>(null)
  const [y0, setY0] = useState(0.5)
  const [showPlane, setShowPlane] = useState(true)
  const [showGradient, setShowGradient] = useState(true)

  const fx = useMemo(() => {
    try {
      return differentiate(fn, 'x')
    } catch {
      return null
    }
  }, [fn])
  const fy = useMemo(() => {
    try {
      return differentiate(fn, 'y')
    } catch {
      return null
    }
  }, [fn])

  // シーン構築(マウント時に一度)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(container.clientWidth, container.clientHeight)
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / Math.max(container.clientHeight, 1),
      0.1,
      200,
    )
    camera.position.set(6.5, 5.5, 8.5)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.target.set(0, 0, 0)

    scene.add(new THREE.AmbientLight(0xaaaabb, 0.9))
    const dir = new THREE.DirectionalLight(0xffffff, 1.4)
    dir.position.set(5, 10, 7)
    scene.add(dir)
    scene.add(new THREE.GridHelper(2 * DOMAIN_3D + 2, 16, 0x44445a, 0x26263a))

    const surfaceMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      roughness: 0.55,
      metalness: 0.1,
      transparent: true,
      opacity: 0.95,
    })
    const wireMaterial = new THREE.MeshBasicMaterial({
      wireframe: true,
      color: 0xffffff,
      transparent: true,
      opacity: 0.06,
    })
    const initialGeo = new THREE.PlaneGeometry(1, 1)
    const surfaceMesh = new THREE.Mesh(initialGeo, surfaceMaterial)
    const wireMesh = new THREE.Mesh(initialGeo, wireMaterial)
    scene.add(surfaceMesh, wireMesh)

    const pathLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }),
    )
    scene.add(pathLine)

    const point = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    )
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 24, 24),
      new THREE.MeshBasicMaterial({ color: COLOR_F, transparent: true, opacity: 0.35 }),
    )
    scene.add(point, halo)

    const arrow = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(),
      1,
      0xffe14d,
      0.18,
      0.09,
    )
    scene.add(arrow)

    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 1.8),
      new THREE.MeshBasicMaterial({
        color: COLOR_TANGENT,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    )
    scene.add(plane)

    refs.current = {
      renderer,
      scene,
      camera,
      controls,
      surfaceMesh,
      wireMesh,
      pathLine,
      point,
      halo,
      arrow,
      plane,
      raf: 0,
    }

    const animate = () => {
      controls.update()
      renderer.render(scene, camera)
      refs.current!.raf = requestAnimationFrame(animate)
    }
    animate()

    const ro = new ResizeObserver(() => {
      const w = container.clientWidth
      const h = container.clientHeight
      if (w === 0 || h === 0) return
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    })
    ro.observe(container)

    return () => {
      cancelAnimationFrame(refs.current?.raf ?? 0)
      ro.disconnect()
      controls.dispose()
      surfaceMesh.geometry.dispose()
      surfaceMaterial.dispose()
      wireMaterial.dispose()
      pathLine.geometry.dispose()
      renderer.dispose()
      container.removeChild(renderer.domElement)
      refs.current = null
    }
  }, [])

  // 曲面の再構築(関数が変わったとき)
  useEffect(() => {
    const r = refs.current
    if (!r) return
    const geo = buildSurfaceGeometry(fn)
    const old = r.surfaceMesh.geometry
    r.surfaceMesh.geometry = geo
    r.wireMesh.geometry = geo
    old.dispose()
  }, [fn])

  // 点が動く経路 y = y0 上の曲線
  useEffect(() => {
    const r = refs.current
    if (!r) return
    const N = 240
    const pts = new Float32Array((N + 1) * 3)
    for (let i = 0; i <= N; i++) {
      const px = -DOMAIN_3D + (2 * DOMAIN_3D * i) / N
      let z = fn.eval({ x: px, y: y0 })
      if (!Number.isFinite(z)) z = 0
      pts[i * 3] = px
      pts[i * 3 + 1] = clampZ(z)
      pts[i * 3 + 2] = y0
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pts, 3))
    const old = r.pathLine.geometry
    r.pathLine.geometry = geo
    old.dispose()
  }, [fn, y0])

  // 動く点・勾配ベクトル・接平面の更新
  useEffect(() => {
    const r = refs.current
    if (!r) return
    let z = fn.eval({ x, y: y0 })
    if (!Number.isFinite(z)) z = 0
    z = clampZ(z)
    r.point.position.set(x, z, y0)
    r.halo.position.set(x, z, y0)

    const gx = fx ? fx.eval({ x, y: y0 }) : NaN
    const gy = fy ? fy.eval({ x, y: y0 }) : NaN
    const gradOk = Number.isFinite(gx) && Number.isFinite(gy)

    // 勾配方向に沿った曲面の接ベクトル(最急上昇方向)
    const gradLen = gradOk ? Math.hypot(gx, gy) : 0
    r.arrow.visible = showGradient && gradOk && gradLen > 1e-9
    if (r.arrow.visible) {
      const dir = new THREE.Vector3(gx / gradLen, gradLen, gy / gradLen).normalize()
      r.arrow.position.set(x, z, y0)
      r.arrow.setDirection(dir)
      r.arrow.setLength(Math.min(1.4, 0.5 + 0.4 * gradLen), 0.18, 0.09)
    }

    // 接平面(法線 = (-fx, -fy, 1) を three 座標に変換)
    r.plane.visible = showPlane && gradOk
    if (r.plane.visible) {
      const n = new THREE.Vector3(-gx, 1, -gy).normalize()
      r.plane.position.set(x, z, y0)
      r.plane.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n)
    }
  }, [fn, fx, fy, x, y0, showPlane, showGradient])

  const fVal = fn.eval({ x, y: y0 })
  const fxVal = fx ? fx.eval({ x, y: y0 }) : NaN
  const fyVal = fy ? fy.eval({ x, y: y0 }) : NaN

  return (
    <div className="view3d-wrap">
      <div className="panel">
        <div className="panel-head">
          <Formula tex={`f(x, y) = ${fn.latex}`} color={COLOR_F} />
          {fx && (
            <Formula tex={`\\frac{\\partial f}{\\partial x} = ${fx.latex}`} color={COLOR_DF} />
          )}
          {fy && (
            <Formula tex={`\\frac{\\partial f}{\\partial y} = ${fy.latex}`} color={COLOR_DF} />
          )}
        </div>
        <div className="panel-head sub">
          <span className="value-badge">
            点 ({x.toFixed(2)}, {y0.toFixed(2)}) : f = {fmt(fVal)}, ∂f/∂x = {fmt(fxVal)},
            ∂f/∂y = {fmt(fyVal)}
          </span>
          <label className="toggle">
            y₀ = {y0.toFixed(1)}
            <input
              type="range"
              min={-DOMAIN_3D}
              max={DOMAIN_3D}
              step={0.1}
              value={y0}
              onChange={(e) => setY0(Number(e.target.value))}
            />
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={showPlane}
              onChange={(e) => setShowPlane(e.target.checked)}
            />
            接平面
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={showGradient}
              onChange={(e) => setShowGradient(e.target.checked)}
            />
            勾配ベクトル
          </label>
        </div>
        <div ref={containerRef} className="view3d" />
        <p className="hint-text" style={{ padding: '6px 12px' }}>
          ドラッグで回転 / ホイールでズーム。白い点は y = y₀ 上の曲線に沿って動きます。
        </p>
      </div>
    </div>
  )
}
