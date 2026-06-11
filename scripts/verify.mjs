// 各モードを開いてスクリーンショットを保存し、コンソールエラーを検出する動作確認スクリプト
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const EXECUTABLE = join(
  homedir(),
  'Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
)
const BASE = 'http://localhost:5199'
const OUT = 'screenshots'
mkdirSync(OUT, { recursive: true })

const errors = []
const browser = await chromium.launch({ executablePath: EXECUTABLE })
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text())
})
page.on('pageerror', (err) => errors.push(String(err)))

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
await page.screenshot({ path: `${OUT}/1-derivative.png` })

// f'' トグルを有効化
await page.getByText("f''(x) も表示").click()
await page.waitForTimeout(500)
await page.screenshot({ path: `${OUT}/2-derivative-second.png` })

// 積分モード
await page.getByRole('button', { name: '積分' }).click()
await page.waitForTimeout(1500)
await page.screenshot({ path: `${OUT}/3-integral.png` })

// 3D モード
await page.getByRole('button', { name: '3D 曲面' }).click()
await page.waitForTimeout(2000)
await page.screenshot({ path: `${OUT}/4-surface.png` })

// 関数を変更してエラーが出ないか確認(2D へ戻って tan(x))
await page.getByRole('button', { name: '微分' }).click()
await page.waitForTimeout(300)
const input = page.locator('.fn-input')
await input.fill('tan(x)')
await page.waitForTimeout(800)
await page.screenshot({ path: `${OUT}/5-tan.png` })

// 不正な式でエラーメッセージが表示されるか
await input.fill('x +')
await page.waitForTimeout(500)
const errVisible = await page.locator('.error-text').isVisible()
await page.screenshot({ path: `${OUT}/6-invalid-input.png` })

await browser.close()

console.log('console errors:', errors.length === 0 ? 'なし' : errors)
console.log('invalid-input error message visible:', errVisible)
if (errors.length > 0 || !errVisible) process.exit(1)
console.log('VERIFY OK')
