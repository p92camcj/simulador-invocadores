// Rasteriza assets/personajes/*.svg a build/personajes/*.png (x3) con el
// Chromium de Playwright. Ver tools/generar_figuras.py.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const raiz = path.resolve(__dirname, '..');
const origen = path.join(raiz, 'assets', 'personajes');
const destino = path.join(raiz, 'build', 'personajes');
(async () => {
  fs.mkdirSync(destino, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 726, height: 1008 } });
  for (const f of fs.readdirSync(origen).filter(n => n.endsWith('.svg'))) {
    const svg = fs.readFileSync(path.join(origen, f), 'utf8')
      .replace(/width="242"/, 'width="726"').replace(/height="336"/, 'height="1008"');
    await p.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
    await p.waitForTimeout(150);
    await p.screenshot({ path: path.join(destino, f.replace('.svg', '.png')), omitBackground: true });
  }
  await b.close();
})();
