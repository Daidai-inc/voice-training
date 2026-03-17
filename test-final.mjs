import { chromium } from 'playwright';

const FILE1 = '/Users/Shota/Music/Music/Media.localized/Music/Unknown Artist/Unknown Album/Mrs. GREEN APPLE ー 僕のこと LIVEAtlantis on WOWOW.mp3';
const FILE2 = '/Users/Shota/Music/Music/Media.localized/Music/Unknown Artist/Unknown Album/Mrs. GREEN APPLE  点描の唄LIVE from ゼンジン未到とヴェルトラウム銘銘編.mp3';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const logs = [];
page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', err => logs.push(`[PAGE ERROR] ${err.message}`));
page.on('dialog', async d => { logs.push(`[ALERT] ${d.message()}`); await d.accept(); });

await page.goto('http://localhost:3002', { waitUntil: 'networkidle' });

// --- トラック1 ---
console.log('トラック1: アップロード中...');
const [fc1] = await Promise.all([
  page.waitForEvent('filechooser', { timeout: 5000 }),
  page.locator('section').first().locator('.border-dashed').click(),
]);
await fc1.setFiles(FILE1);

// 完了まで待つ
await page.waitForSelector('section:first-of-type canvas', { timeout: 10000 });
console.log('トラック1: ✓ canvas表示');

// canvasにコンテンツあるか
const t1ok = await page.evaluate(() => {
  const c = document.querySelector('section:first-of-type canvas');
  if (!c) return false;
  const ctx = c.getContext('2d');
  if (!ctx || c.width === 0) return false;
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  for (let i = 0; i < d.length; i += 40) {
    if (d[i+3] > 0 && !(d[i]===26 && d[i+1]===26 && d[i+2]===46)) return true;
  }
  return false;
});
console.log(`トラック1: 波形描画 ${t1ok ? '✓' : '✗'}`);

// 再生確認
await page.locator('section:first-of-type button:has(svg polygon)').click();
await page.waitForTimeout(500);
const t1time = await page.evaluate(() => {
    const s = document.querySelector('section');
    const spans = s?.querySelectorAll('span');
    for (const sp of spans || []) {
      if (sp.textContent?.match(/\d+:\d+ \/ \d+:\d+/)) return sp.textContent;
    }
    return 'N/A';
  });
console.log(`トラック1: 再生 ${t1time}`);
await page.locator('section:first-of-type button:has(svg rect)').first().click(); // stop

// --- トラック2 ---
console.log('\nトラック2: アップロード中...');
const [fc2] = await Promise.all([
  page.waitForEvent('filechooser', { timeout: 5000 }),
  page.locator('section').nth(1).locator('.border-dashed').click(),
]);
await fc2.setFiles(FILE2);

// 完了まで待つ
try {
  await page.waitForFunction(() => document.querySelectorAll('canvas').length >= 2, { timeout: 15000 });
  console.log('トラック2: ✓ canvas表示');
} catch {
  console.log('トラック2: ✗ canvas表示タイムアウト');
  console.log(`  canvas数: ${await page.evaluate(() => document.querySelectorAll('canvas').length)}`);

  // トラック2のsection状態を詳しく調べる
  const debug = await page.evaluate(() => {
    const s = document.querySelectorAll('section')[1];
    return {
      disabled: s?.className.includes('pointer-events-none'),
      hasCanvas: !!s?.querySelector('canvas'),
      innerHTML: s?.innerHTML?.substring(0, 300),
    };
  });
  console.log('  debug:', JSON.stringify(debug, null, 2));
}

// canvas 2のコンテンツ確認
const t2ok = await page.evaluate(() => {
  const canvases = document.querySelectorAll('canvas');
  if (canvases.length < 2) return false;
  const c = canvases[1];
  const ctx = c.getContext('2d');
  if (!ctx || c.width === 0) return false;
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  for (let i = 0; i < d.length; i += 40) {
    if (d[i+3] > 0 && !(d[i]===26 && d[i+1]===26 && d[i+2]===46)) return true;
  }
  return false;
});
console.log(`トラック2: 波形描画 ${t2ok ? '✓' : '✗'}`);

// 再生確認
if (t2ok) {
  const playBtns = await page.locator('section').nth(1).locator('button:has(svg polygon)').all();
  if (playBtns.length > 0) {
    await playBtns[0].click();
    await page.waitForTimeout(500);
    const t2time = await page.evaluate(() => {
      const s = document.querySelectorAll('section')[1];
      const spans = s?.querySelectorAll('span');
      for (const sp of spans || []) {
        if (sp.textContent?.match(/\d+:\d+ \/ \d+:\d+/)) return sp.textContent;
      }
      return 'N/A';
    });
    console.log(`トラック2: 再生 ${t2time}`);
  }
}

// ログ出力
const relevant = logs.filter(l => l.includes('[トラック') || l.includes('[AudioUploader') || l.includes('ERROR'));
if (relevant.length > 0) {
  console.log('\nブラウザログ:');
  relevant.forEach(l => console.log(`  ${l}`));
}

await page.screenshot({ path: '/tmp/voice-training/test-final.png', fullPage: true });
console.log('\nスクリーンショット: /tmp/voice-training/test-final.png');

await browser.close();
