const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const baseUrl = 'https://mergeship-git-fork-pranavagarka-0d74f4-codersogs-3057s-projects.vercel.app';
  const screenshotDir = '/home/pranav/Desktop/projects/gitPr/gssoc/MergeShip/screenshots';
  require('fs').mkdirSync(screenshotDir, { recursive: true });

  // Try issues list
  await page.goto(`${baseUrl}/issues`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  await page.screenshot({ path: `${screenshotDir}/issues-list.png`, fullPage: true });
  console.log('Took issues-list screenshot');

  // Try issue detail (id=1)
  await page.goto(`${baseUrl}/issues/1`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  await page.screenshot({ path: `${screenshotDir}/issue-detail.png`, fullPage: true });
  console.log('Took issue-detail screenshot');

  // Try issues list on main Vercel
  await page.goto('https://mergeship-lszc60y5y-codersogs-3057s-projects.vercel.app/issues', { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  await page.screenshot({ path: `${screenshotDir}/issues-list-main.png`, fullPage: true });
  console.log('Took issues-list-main screenshot');

  await browser.close();
})();
