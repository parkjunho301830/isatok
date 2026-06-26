import { chromium } from 'playwright';

const url = process.argv[2] || 'https://isatok.web.app/?probe=' + Date.now();
const browser = await chromium.launch();
const page = await browser.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGE: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errs.push('CON: ' + m.text());
});
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(8000);
const boot = await page.evaluate(() => ({
  ls: document.getElementById('ls')?.style.display,
  app: document.getElementById('app')?.style.display,
  ver: document.querySelector('.header-ver-text')?.textContent
}));
console.log('BOOT', JSON.stringify(boot));
for (const tab of ['my', 'hall']) {
  await page.evaluate((id) => { window.nav(id); }, tab);
  await page.waitForTimeout(1500);
  const info = await page.evaluate((id) => {
    const box = id === 'my'
      ? document.getElementById('my-page-dashboard')
      : document.getElementById('hall-content');
    return {
      tab: id,
      len: box ? box.innerHTML.length : -1,
      preview: box ? box.innerHTML.slice(0, 120) : ''
    };
  }, tab);
  console.log('TAB', JSON.stringify(info));
}
console.log('ERRORS\n' + (errs.join('\n') || 'none'));
await browser.close();
