#!/usr/bin/env python3
"""Genera assets/cards/<personaje>.png (362x504, esquinas redondeadas) a partir
del PDF de cartas que exporta Adrián desde Canva (una carta por página).

    pdftoppm -r 300 -png cartas.pdf build/pdf/p    # una imagen por página
    python3 tools/cartas_desde_pdf.py build/pdf

Las páginas 1-14 son los personajes en este orden. Las de reverso y ayuda
(15-17) no se usan: en el PDF salen recortadas, y las de assets/cards no han
cambiado. Si el orden del PDF cambia, actualiza ORDEN. Requiere Pillow.
"""
import sys
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw

RAIZ = Path(__file__).resolve().parent.parent
DESTINO = RAIZ / 'assets' / 'cards'
TAMANO = (362, 504)
RADIO = 7  # radio de las esquinas a 362 px de ancho
ORDEN = ['maestro', 'clarividente', 'ocultista', 'cronomante', 'estratega',
         'cronista', 'aprendiz', 'centinela', 'picaro', 'metamorfo',
         'entusiasta', 'reena', 'sora', 'lumo']


def recortar_carta(im):
    """Recorta el margen blanco de la página y deja solo la carta."""
    fondo = Image.new('RGB', im.size, (255, 255, 255))
    dif = ImageChops.difference(im, fondo).convert('L').point(lambda v: 255 if v > 12 else 0)
    return im.crop(dif.getbbox())


if __name__ == '__main__':
    origen = Path(sys.argv[1])
    paginas = sorted(origen.glob('*.png'))
    mascara = Image.new('L', TAMANO, 0)
    ImageDraw.Draw(mascara).rounded_rectangle((0, 0, TAMANO[0] - 1, TAMANO[1] - 1), RADIO, fill=255)
    for nombre, png in zip(ORDEN, paginas):
        carta = recortar_carta(Image.open(png).convert('RGB')).resize(TAMANO, Image.LANCZOS).convert('RGBA')
        carta.putalpha(mascara)
        salida = DESTINO / f'{nombre}.png'
        carta.save(salida, optimize=True)
        print(png.name, '->', salida.name, salida.stat().st_size // 1024, 'KB')
