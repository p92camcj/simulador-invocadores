#!/usr/bin/env python3
"""Genera las imágenes de las cartas del tablero (assets/cards/*.png) a partir
de los SVG originales de assets/cartas/ (exportados de Canva).

    node tools/rasterizar_svg.cjs cartas    # SVG -> build/cartas/*.png
    python3 tools/generar_cartas.py         # -> assets/cards/*.png (362x504)

portal.svg es el reverso común de las cartas: se guarda como
assets/cards/carta-oculta-reverso.png. Requiere Pillow.
"""
from pathlib import Path
from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
RASTER = RAIZ / 'build' / 'cartas'
DESTINO = RAIZ / 'assets' / 'cards'
TAMANO = (362, 504)  # proporción real de las cartas físicas
NOMBRE_DESTINO = {'portal': 'carta-oculta-reverso'}

if __name__ == '__main__':
    for png in sorted(RASTER.glob('*.png')):
        im = Image.open(png).convert('RGBA').resize(TAMANO, Image.LANCZOS)
        salida = DESTINO / f"{NOMBRE_DESTINO.get(png.stem, png.stem)}.png"
        im.save(salida, optimize=True)
        print(salida.name, salida.stat().st_size // 1024, 'KB')
