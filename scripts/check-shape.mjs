// 描画された2Dグラフの曲線が、実際の関数の形と一致するかを実ブラウザのピクセルで検証するスクリプト
//
// 使い方:
//   1. 別ターミナルで開発サーバーを起動しておく(自動起動はしない)
//        npx vite --port 5199
//   2. node scripts/check-shape.mjs
//      別ポートのときは URL を環境変数で指定: CHECK_SHAPE_URL=http://localhost:5399 node scripts/check-shape.mjs
//   3. 各ケースが PASS/FAIL で表示され、FAIL が1つでもあれば exit code 1
//
// 方式:
//   - 関数を入力し、x スライダーを -4 / 4 にした2枚の canvas を撮る(接線・マーカーが曲線に重なるのを避けるため、
//     左右の端から MARGIN px 以内は反対側の撮影を使う)
//   - 曲線色(#ff2e63)のピクセルを列ごとに抽出し、Math で計算した真値と比較する
//   - 真値 -> px の線形写像(px = a*y + b)は関数ごとに次のどちらかで推定する
//       'calm'  : 曲線が緩やかな列(列内の真値の幅が小さい)から最小二乗
//       'extent': 曲線全体の上端/下端 px を、真値の最大/最小(密サンプリング)に対応させる。
//                 sin(50x) のように常に急峻で 'calm' の列が無い関数向け
//   - 指標1 (形の一致): 各列を「列内の真値の min-max 帯」とのギャップで評価。maxDist / 2px 超過列の割合
//   - 指標2 (山の高さの揃い具合): 真値の極大(最大値付近)ごとに、その周辺列の描画上端 px を集め、
//     ばらつき(max-min)を見る。高周波で折れ線が山を取りこぼす(undershoot)と悪化する。
//     'extent' 写像は最良の山に合わせて較正されるため、削れた山は相対的に低く出てばらつきとして検出される
//
// 閾値の根拠(px は deviceScaleFactor 1 での値):
//   - MAX_DIST_PX = 4 : 線幅3px+グロー、真値帯のサンプリング誤差、写像推定誤差で 1〜2px は正常にずれる。
//                       描画が別の形(数十px)になる不一致は 4px を大きく超えるので、誤検出せず捕まえられる
//   - MAX_BAD_RATIO = 0.02 : 2px 超過の列が全体の2%以下なら、急峻部のアンチエイリアス等の局所的な揺れとみなす
//   - PEAK_SPREAD_PX = 3 : 正常な描画では山の上端は線幅・サブピクセル位置の違い程度(~1〜2px)しかばらつかない。
//                          サンプリング不足で山が削れると数px以上不揃いになる。
//                          (現状実測: sin(20x)=1px は正常、sin(50x)=6px は山が削れて不揃い。中間の3pxを閾値とした)

import { chromium } from 'playwright-core'
import { homedir } from 'node:os'
import { join } from 'node:path'

const EXECUTABLE = join(
  homedir(),
  'Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
)
const BASE = process.env.CHECK_SHAPE_URL ?? 'http://localhost:5199'

const X_MIN = -4
const X_MAX = 4
const MARGIN = 140
const MAX_DIST_PX = 4
const MAX_BAD_RATIO = 0.02
const PEAK_SPREAD_PX = 3

const CASES = [
  {
    expr: 'sin(3x)*exp(-x^2/8) + 0.5*cos(7x)/(1+x^2) + x/4',
    truth: (x) => Math.sin(3 * x) * Math.exp((-x * x) / 8) + (0.5 * Math.cos(7 * x)) / (1 + x * x) + x / 4,
    fit: 'calm',
  },
  {
    expr: 'abs(x)*sin(x^2) - cos(5x)/2',
    truth: (x) => Math.abs(x) * Math.sin(x * x) - Math.cos(5 * x) / 2,
    fit: 'calm',
  },
  {
    expr: 'sin(x)/x + cos(x^2)/3',
    truth: (x) => Math.sin(x) / x + Math.cos(x * x) / 3,
    fit: 'calm',
  },
  { expr: 'x^3/3 - 2x', truth: (x) => x ** 3 / 3 - 2 * x, fit: 'calm' },
  { expr: 'sin(20x)', truth: (x) => Math.sin(20 * x), fit: 'extent', peaks: true },
  { expr: 'sin(50x)', truth: (x) => Math.sin(50 * x), fit: 'extent', peaks: true },
]

// ブラウザ側: 曲線色のピクセルを列ごとに [上端y, 下端y] で返す
const grabColumns = () => {
  const c = document.querySelector('canvas.graph2d')
  const w = c.width
  const h = c.height
  const d = c.getContext('2d').getImageData(0, 0, w, h).data
  const cols = []
  for (let x = 0; x < w; x++) {
    let lo = -1
    let hi = -1
    for (let y = 0; y < h; y++) {
      const i = (y * w + x) * 4
      if (Math.abs(d[i] - 255) < 25 && Math.abs(d[i + 1] - 46) < 40 && Math.abs(d[i + 2] - 99) < 40 && d[i + 3] > 200) {
        if (lo < 0) lo = y
        hi = y
      }
    }
    cols.push(lo < 0 ? null : [lo, hi])
  }
  return { w, cols }
}

/** 列 i の真値の [min, max](列内を細かくサンプリング)。有限値が無ければ null */
function truthBand(truth, i, dx, samples = 40) {
  let lo = Infinity
  let hi = -Infinity
  for (let k = 0; k <= samples; k++) {
    const y = truth(X_MIN + (i + k / samples) * dx)
    if (!Number.isFinite(y)) continue
    lo = Math.min(lo, y)
    hi = Math.max(hi, y)
  }
  return Number.isFinite(lo) ? [lo, hi] : null
}

/** 'calm': 緩やかな列の (真値, 列中心px) から最小二乗で px = a*y + b を求める */
function fitCalm(truth, valid, w, dx) {
  let n = 0
  let sx = 0
  let sy = 0
  let sxx = 0
  let sxy = 0
  for (let i = 0; i < w; i++) {
    const c = valid(i)
    if (!c || c[1] - c[0] > 8) continue
    const band = truthBand(truth, i, dx, 8)
    if (!band || band[1] - band[0] >= 0.12) continue
    const y = truth(X_MIN + (i + 0.5) * dx)
    const p = (c[0] + c[1]) / 2
    n++
    sx += y
    sy += p
    sxx += y * y
    sxy += y * p
  }
  if (n < 10) return null
  const a = (n * sxy - sx * sy) / (n * sxx - sx * sx)
  return { a, b: (sy - a * sx) / n, n }
}

/** 'extent': 描画全体の上端/下端(線幅の半分を補正)を、真値の最大/最小に対応させる */
function fitExtent(truth, valid, w, dx) {
  let top = Infinity
  let bottom = -Infinity
  let thickness = Infinity
  for (let i = 0; i < w; i++) {
    const c = valid(i)
    if (!c) continue
    top = Math.min(top, c[0])
    bottom = Math.max(bottom, c[1])
    thickness = Math.min(thickness, c[1] - c[0] + 1) // 山谷など平坦な列の縦幅 = 線幅
  }
  let ymin = Infinity
  let ymax = -Infinity
  const N = w * 40
  for (let k = 0; k <= N; k++) {
    const y = truth(X_MIN + (k / N) * w * dx)
    if (!Number.isFinite(y)) continue
    ymin = Math.min(ymin, y)
    ymax = Math.max(ymax, y)
  }
  const topC = top + (thickness - 1) / 2
  const bottomC = bottom - (thickness - 1) / 2
  const a = (bottomC - topC) / (ymin - ymax)
  return { a, b: topC - a * ymax, n: 0, ymax, ymin }
}

/** 極大(最大値付近)ごとの描画上端px のばらつき */
function peakStats(truth, valid, w, dx, map) {
  const thresh = map.ymax - 0.02 * (map.ymax - map.ymin)
  // 真値が閾値以上の連続区間ごとに、その中で最大の列を山の中心とする
  const centers = []
  let cur = null
  for (let i = 0; i < w; i++) {
    const band = truthBand(truth, i, dx, 20)
    if (band && band[1] >= thresh) {
      if (!cur || band[1] > cur.y) cur = { i, y: band[1] }
    } else if (cur) {
      centers.push(cur.i)
      cur = null
    }
  }
  if (cur) centers.push(cur.i)
  const tops = []
  for (const ci of centers) {
    if (ci < 3 || ci > w - 4) continue
    let top = Infinity
    for (let i = ci - 2; i <= ci + 2; i++) {
      const c = valid(i)
      if (c) top = Math.min(top, c[0])
    }
    if (Number.isFinite(top)) tops.push(top)
  }
  if (tops.length < 3) return null
  return { peaks: tops.length, spread: Math.max(...tops) - Math.min(...tops) }
}

const browser = await chromium.launch({ executablePath: EXECUTABLE })
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1 })
let anyFail = false
try {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  for (const { expr, truth, fit, peaks } of CASES) {
    await page.locator('.fn-input').first().fill(expr)
    await page.locator('.x-slider input').fill(String(X_MIN))
    await page.waitForTimeout(400)
    const A = await page.evaluate(grabColumns)
    await page.locator('.x-slider input').fill(String(X_MAX))
    await page.waitForTimeout(400)
    const B = await page.evaluate(grabColumns)

    const w = A.w
    const dx = (X_MAX - X_MIN) / w
    // スライダー位置の接線・マーカーを避ける: 左側は x=4 の撮影(B)、右側は x=-4 の撮影(A)
    const valid = (i) => (i >= MARGIN ? A.cols[i] : B.cols[i])

    const map = fit === 'extent' ? fitExtent(truth, valid, w, dx) : fitCalm(truth, valid, w, dx)
    if (!map) {
      console.log(`FAIL  ${expr}  (写像を推定できない: 曲線が描画されていない可能性)`)
      anyFail = true
      continue
    }

    let maxDist = 0
    let bad = 0
    let checked = 0
    let worstX = null
    for (let i = 0; i < w; i++) {
      const c = valid(i)
      if (!c) continue
      const band = truthBand(truth, i, dx)
      if (!band) continue
      checked++
      const lo = map.a * band[1] + map.b // a<0 なので真値の大きい方が上(小さい px)
      const hi = map.a * band[0] + map.b
      const dist = Math.max(0, lo - c[1], c[0] - hi)
      if (dist > maxDist) {
        maxDist = dist
        worstX = X_MIN + i * dx
      }
      if (dist > 2) bad++
    }
    const badRatio = checked ? bad / checked : 1

    const reasons = []
    if (checked < w * 0.5) reasons.push(`検証列が少ない(${checked}/${w})`)
    if (maxDist > MAX_DIST_PX) reasons.push(`maxDist ${maxDist.toFixed(1)}px > ${MAX_DIST_PX}`)
    if (badRatio > MAX_BAD_RATIO) reasons.push(`2px超過列 ${(badRatio * 100).toFixed(1)}% > ${MAX_BAD_RATIO * 100}%`)

    let peakInfo = ''
    if (peaks) {
      const ps = peakStats(truth, valid, w, dx, map)
      if (!ps) {
        reasons.push('山を検出できない')
      } else {
        peakInfo = ` peaks=${ps.peaks} peakSpread=${ps.spread.toFixed(1)}px`
        if (ps.spread > PEAK_SPREAD_PX) reasons.push(`山の高さ不揃い ${ps.spread.toFixed(1)}px > ${PEAK_SPREAD_PX}`)
      }
    }

    const ok = reasons.length === 0
    if (!ok) anyFail = true
    console.log(
      `${ok ? 'PASS' : 'FAIL'}  ${expr}  [${fit}] checked=${checked} pxPerUnit=${(-map.a).toFixed(1)} ` +
        `maxDist=${maxDist.toFixed(1)}px(x=${worstX?.toFixed(2) ?? '-'}) bad2px=${(badRatio * 100).toFixed(1)}%${peakInfo}` +
        (ok ? '' : `\n      -> ${reasons.join(' / ')}`),
    )
  }
} finally {
  await browser.close()
}
process.exit(anyFail ? 1 : 0)
