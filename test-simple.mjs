import { chromium } from 'playwright';

const FILE1 = '/Users/Shota/Music/Music/Media.localized/Music/Unknown Artist/Unknown Album/Mrs. GREEN APPLE ー 僕のこと LIVEAtlantis on WOWOW.mp3';
const FILE2 = '/Users/Shota/Music/Music/Media.localized/Music/Unknown Artist/Unknown Album/Mrs. GREEN APPLE  点描の唄LIVE from ゼンジン未到とヴェルトラウム銘銘編.mp3';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', err => errors.push(err.message));

await page.goto('http://localhost:3002', { waitUntil: 'networkidle' });

// トラック1
const [fc1] = await Promise.all([
  page.waitForEvent('filechooser', { timeout: 5000 }),
  page.locator('section').first().locator('.border-dashed').click(),
]);
await fc1.setFiles(FILE1);
await page.waitForSelector('canvas', { timeout: 10000 });
console.log('トラック1: ✓ 波形表示OK');

// 再生
await page.evaluate(() => {
  const btn = document.querySelector('section button');
  // play button (has polygon SVG)
  const btns = document.querySelectorAll('section:first-of-type button');
  for (const b of btns) { if (b.querySelector('polygon')) { b.click(); break; } }
});
await page.waitForTimeout(500);
const t1 = await page.evaluate(() => {
  const spans = document.querySelector('section')?.querySelectorAll('span') || [];
  for (const s of spans) { if (s.textContent?.match(/\d:\d\d \/ \d/)) return s.textContent; }
  return null;
});
console.log(`トラック1: 再生=${t1 || '✗'}`);

// トラック2
await page.waitForTimeout(500);
const [fc2] = await Promise.all([
  page.waitForEvent('filechooser', { timeout: 5000 }),
  page.locator('section').nth(1).locator('.border-dashed').click(),
]);
await fc2.setFiles(FILE2);

try {
  await page.waitForFunction(() => document.querySelectorAll('canvas').length >= 2, { timeout: 20000 });
  console.log('トラック2: ✓ 波形表示OK');
} catch {
  console.log('トラック2: ✗ 波形表示失敗');
}

const final = await page.evaluate(() => ({
  canvases: document.querySelectorAll('canvas').length,
  errors: [],
}));
console.log(`最終: canvases=${final.canvases}`);

if (errors.length > 0) {
  console.log('ページエラー:');
  errors.forEach(e => console.log(`  ${e}`));
}

await page.screenshot({ path: '/tmp/voice-training/test-final.png', fullPage: true });
console.log('スクリーンショット保存');
await browser.close();
process.exit(0);
