// Rasteriza SVG a PNG (x3) con el Chromium de Playwright:
//   assets/personajes/*.svg -> build/personajes/*.png  (tools/generar_figuras.py)
//   assets/cartas/*.svg     -> build/cartas/*.png      (tools/generar_cartas.py)
// Uso: node tools/rasterizar_svg.cjs [personajes|cartas]   (sin argumento: ambas)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const raiz = path.resolve(__dirname, '..');
const carpetas = process.argv[2] ? [process.argv[2]] : ['personajes', 'cartas'];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 726, height: 1008 } });
  for (const carpeta of carpetas) {
  const origen = path.join(raiz, 'assets', carpeta);
  const destino = path.join(raiz, 'build', carpeta);
  fs.mkdirSync(destino, { recursive: true });
  for (const f of fs.readdirSync(origen).filter(n => n.endsWith('.svg'))) {
    const svg = fs.readFileSync(path.join(origen, f), 'utf8')
      .replace(/width="242"/, 'width="726"').replace(/height="336"/, 'height="1008"');
    await p.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
    await p.waitForTimeout(150);
    await p.screenshot({ path: path.join(destino, f.replace('.svg', '.png')), omitBackground: true });
  }
  }
  await b.close();
})();
