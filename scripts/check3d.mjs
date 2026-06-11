import { chromium } from 'playwright-core'
import { homedir } from 'node:os'
import { join } from 'node:path'

const EXECUTABLE = join(homedir(), 'Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing')
const browser = await chromium.launch({ executablePath: EXECUTABLE })
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
await page.goto('http://localhost:5199', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: '3D 曲面' }).click()
await page.waitForTimeout(1500)
// 一時停止して x = 1.0 に設定(山の上に点が来るように)
await page.locator('.play-btn').click()
await page.locator('.x-slider input').evaluate((el) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(el, '1.0')
  el.dispatchEvent(new Event('input', { bubbles: true }))
})
await page.waitForTimeout(800)
await page.screenshot({ path: 'screenshots/7-surface-point.png' })
await browser.close()
console.log('done')
